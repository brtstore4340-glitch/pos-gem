# =============================================================================
# FILE: smoke-test-emulators.ps1
# PURPOSE: Firebase Emulator smoke test for Boots POS AI Module
# USAGE:
#   # run from repo root OR functions/
#   powershell -ExecutionPolicy Bypass -File .\smoke-test-emulators.ps1
#
#   # override project/region
#   powershell -ExecutionPolicy Bypass -File .\smoke-test-emulators.ps1 -ProjectId boots-pos-project -Region asia-southeast1
#
# NOTES:
# - Requires: Java 17 (for emulators), Firebase CLI installed, Node installed
# - This smoke test validates:
#   1) emulators can start (hub + functions ports)
#   2) healthCheck returns 200 + json
#   3) schemaSnapshot + aiOrchestrator endpoints respond (expected unauthenticated)
# =============================================================================

[CmdletBinding()]
param(
  [string]$RepoRoot = ".",
  [string]$ProjectId = "",
  [string]$Region = "asia-southeast1",
  [int]$FunctionsPort = 5001,
  [int]$HubPort = 4400,
  [int]$WaitSeconds = 60,
  [switch]$KeepRunning
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Info([string]$m) { Write-Host "[INFO] $m" }
function Write-Warn([string]$m) { Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err ([string]$m) { Write-Host "[ERR ] $m" -ForegroundColor Red }

function Resolve-RepoRoot([string]$start) {
  $p = Resolve-Path $start
  $cur = $p.Path
  for ($i=0; $i -lt 8; $i++) {
    if (Test-Path (Join-Path $cur ".firebaserc")) { return $cur }
    $parent = Split-Path $cur -Parent
    if ($parent -eq $cur) { break }
    $cur = $parent
  }
  return (Resolve-Path $start).Path
}

function Read-ProjectIdFromFirebaserc([string]$root) {
  $rc = Join-Path $root ".firebaserc"
  if (!(Test-Path $rc)) { return "" }
  try {
    $json = Get-Content $rc -Raw | ConvertFrom-Json
    # Prefer "projects.default"
    if ($json.projects -and $json.projects.default) { return [string]$json.projects.default }
    # Else pick first project value if exists
    if ($json.projects) {
      $props = $json.projects.psobject.Properties
      if ($props.Count -gt 0) { return [string]$props[0].Value }
    }
  } catch { }
  return ""
}

function Assert-Command([string]$name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "Missing command: $name. Install it and retry." }
  return $cmd.Source
}

function Assert-Java {
  try {
    & java -version | Out-Null
  } catch {
    throw "Java not found. Install Java 17 and ensure 'java' is on PATH. (winget install Microsoft.OpenJDK.17)"
  }
}

function Wait-Port([int]$port, [int]$timeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $ok = Test-NetConnection -ComputerName "127.0.0.1" -Port $port -InformationLevel Quiet
      if ($ok) { return $true }
    } catch { }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Invoke-Json([string]$method, [string]$url, [object]$body = $null) {
  $headers = @{ "Content-Type" = "application/json" }
  if ($null -eq $body) {
    return Invoke-RestMethod -Method $method -Uri $url -Headers $headers -TimeoutSec 20
  }
  $payload = $body | ConvertTo-Json -Depth 64
  return Invoke-RestMethod -Method $method -Uri $url -Headers $headers -Body $payload -TimeoutSec 20
}

function Start-Emulators([string]$root, [string]$projectId) {
  $logDir = Join-Path $root "ai-logs"
  if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
  $logFile = Join-Path $logDir ("emulators_{0}.log" -f (Get-Date).ToString("yyyyMMdd_HHmmss"))

  Write-Info "Starting emulators (project=$projectId) ..."
  Write-Info "Log: $logFile"

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "cmd.exe"
  $psi.Arguments = "/c firebase emulators:start --only functions,firestore,auth --project $projectId"
  $psi.WorkingDirectory = $root
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()

  # async log pump
  $stdOut = New-Object System.IO.StreamWriter($logFile, $true)
  $stdOut.AutoFlush = $true

  Register-ObjectEvent -InputObject $p -EventName OutputDataReceived -Action {
    if ($EventArgs.Data) { $Event.MessageData.WriteLine($EventArgs.Data) }
  } -MessageData $stdOut | Out-Null

  Register-ObjectEvent -InputObject $p -EventName ErrorDataReceived -Action {
    if ($EventArgs.Data) { $Event.MessageData.WriteLine("[stderr] " + $EventArgs.Data) }
  } -MessageData $stdOut | Out-Null

  $p.BeginOutputReadLine()
  $p.BeginErrorReadLine()

  return @{ Process = $p; LogFile = $logFile }
}

function Stop-Emulators($proc) {
  if ($null -eq $proc) { return }
  try {
    if (-not $proc.HasExited) {
      Write-Info "Stopping emulator process tree (PID=$($proc.Id)) ..."
      # Kill tree reliably
      & taskkill.exe /PID $proc.Id /T /F | Out-Null
    }
  } catch {
    Write-Warn "Failed to stop emulator process: $($_.Exception.Message)"
  }
}

# ---------------- Main ----------------
$RepoRoot = Resolve-RepoRoot $RepoRoot
Write-Info "RepoRoot: $RepoRoot"

Assert-Java | Out-Null
Assert-Command "firebase" | Out-Null
Assert-Command "node" | Out-Null

if ([string]::IsNullOrWhiteSpace($ProjectId)) {
  $ProjectId = Read-ProjectIdFromFirebaserc $RepoRoot
}

if ([string]::IsNullOrWhiteSpace($ProjectId)) {
  throw "ProjectId not provided and not found in .firebaserc. Run with -ProjectId <id>."
}

$emu = Start-Emulators -root $RepoRoot -projectId $ProjectId
$proc = $emu.Process

try {
  Write-Info "Waiting for hub port $HubPort ..."
  if (-not (Wait-Port -port $HubPort -timeoutSeconds $WaitSeconds)) {
    throw "Emulator hub not reachable on port $HubPort within $WaitSeconds seconds. Check log: $($emu.LogFile)"
  }

  Write-Info "Waiting for functions port $FunctionsPort ..."
  if (-not (Wait-Port -port $FunctionsPort -timeoutSeconds $WaitSeconds)) {
    throw "Functions emulator not reachable on port $FunctionsPort within $WaitSeconds seconds. Check log: $($emu.LogFile)"
  }

  $base = "http://127.0.0.1:$FunctionsPort/$ProjectId/$Region"

  # 1) healthCheck (HTTP onRequest)
  $healthUrl = "$base/healthCheck"
  Write-Info "GET $healthUrl"
  $health = Invoke-Json -method "GET" -url $healthUrl
  Write-Info ("healthCheck OK: " + ($health | ConvertTo-Json -Depth 8))

  # 2) schemaSnapshot (callable onCall) - expect unauthenticated if no auth
  $schemaUrl = "$base/schemaSnapshot"
  Write-Info "POST $schemaUrl (expect unauthenticated)"
  try {
    $schema = Invoke-Json -method "POST" -url $schemaUrl -body @{ data = @{} }
    Write-Warn ("schemaSnapshot unexpectedly succeeded (no auth): " + ($schema | ConvertTo-Json -Depth 8))
  } catch {
    Write-Info "schemaSnapshot responded (expected)."
    Write-Info ("schemaSnapshot error: " + $_.Exception.Message)
  }

  # 3) aiOrchestrator (callable onCall) - expect unauthenticated if no auth
  $orchUrl = "$base/aiOrchestrator"
  Write-Info "POST $orchUrl (expect unauthenticated)"
  try {
    $orch = Invoke-Json -method "POST" -url $orchUrl -body @{ data = @{ moduleId="admin-ai-module"; intent="smoke test" } }
    Write-Warn ("aiOrchestrator unexpectedly succeeded (no auth): " + ($orch | ConvertTo-Json -Depth 8))
  } catch {
    Write-Info "aiOrchestrator responded (expected)."
    Write-Info ("aiOrchestrator error: " + $_.Exception.Message)
  }

  Write-Host ""
  Write-Info "SMOKE TEST PASSED: emulators up + healthCheck OK + endpoints reachable."
  Write-Info "Log file: $($emu.LogFile)"

  if ($KeepRunning) {
    Write-Warn "KeepRunning enabled. Press Ctrl+C to stop emulators in this shell, or close the window."
    while ($true) { Start-Sleep -Seconds 2 }
  }
}
finally {
  if (-not $KeepRunning) {
    Stop-Emulators $proc
  }
}
# End of smoke-test-emulators.ps1
