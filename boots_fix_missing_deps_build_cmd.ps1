[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path,
  [int]$MaxFixIterations = 10
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-Dir([string]$Path) { if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path | Out-Null } }
function Write-Log([string]$LogFile, [string]$Message) {
  $ts = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffK")
  "$ts $Message" | Tee-Object -FilePath $LogFile -Append
}
function Backup-File([string]$Source, [string]$BackupDir, [string]$LogFile, [string]$RepoRootForRel) {
  if (Test-Path -LiteralPath $Source) {
    $rel = $Source.Replace($RepoRootForRel, "").TrimStart("\","/")
    $safe = ($rel -replace '[\\/:*?"<>|]', '_')
    $dest = Join-Path $BackupDir ($safe + ".bak")
    Copy-Item -LiteralPath $Source -Destination $dest -Force
    Write-Log $LogFile "BACKUP: '$Source' -> '$dest'"
  }
}

<<<<<<< HEAD
function Invoke-Cmd([string]$CmdLine, [string]$WorkingDir, [string]$LogFile, [string]$Prefix) {
=======
function Invoke-Cmd([string]$CmdLine, [string]$WorkingDir, [string]$LogFile, [string]$Prefix) {
>>>>>>> main
  # /d disables AutoRun, /s handles quotes, /c runs then exits
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "cmd.exe"
  $psi.Arguments = "/d /s /c ""$CmdLine"""
  $psi.WorkingDirectory = $WorkingDir
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()

  $stdout = $p.StandardOutput.ReadToEnd()
  $stderr = $p.StandardError.ReadToEnd()
  $p.WaitForExit()

  foreach ($l in ($stdout -split "`r?`n")) { if ($l.Trim() -ne "") { Write-Log $LogFile ("{0}: {1}" -f $Prefix, $l) } }
  foreach ($l in ($stderr -split "`r?`n")) { if ($l.Trim() -ne "") { Write-Log $LogFile ("{0}: {1}" -f $Prefix, $l) } }

  return @{ exit = $p.ExitCode; out = ($stdout + "`n" + $stderr) }
}

<<<<<<< HEAD
function Get-MissingImport([string]$Text) {
=======
function Get-MissingImport([string]$Text) {
>>>>>>> main
  # vite/rollup: failed to resolve import "X" from "Y"
  $m = [regex]::Match($Text, 'failed to resolve import\s+"([^"]+)"\s+from\s+"([^"]+)"', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($m.Success) { return @{ dep = $m.Groups[1].Value; from = $m.Groups[2].Value } }
  return $null
}
<<<<<<< HEAD
function Test-BareModule([string]$Spec) {
=======
function Test-BareModule([string]$Spec) {
>>>>>>> main
  if ([string]::IsNullOrWhiteSpace($Spec)) { return $false }
  return -not ($Spec.StartsWith(".") -or $Spec.StartsWith("/") -or $Spec.StartsWith(".."))
}

# ---- Main ----
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")

$bootDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $bootDir "logs"
$bakDir  = Join-Path $bootDir ("backup-" + $ts)
New-Dir $bootDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("fix-missing-deps-build-cmd-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"

Backup-File (Join-Path $RepoRoot "package.json")      $bakDir $logFile $RepoRoot
Backup-File (Join-Path $RepoRoot "package-lock.json") $bakDir $logFile $RepoRoot

# Sanity
Run-Cmd "node -v" $RepoRoot $logFile "NODE" | Out-Null
Run-Cmd "npm -v"  $RepoRoot $logFile "NPM"  | Out-Null

for ($i=1; $i -le $MaxFixIterations; $i++) {
  Write-Log $logFile ("STEP: Build attempt {0}/{1}" -f $i, $MaxFixIterations)
  $b = Run-Cmd "npm run build" $RepoRoot $logFile "BUILD"

  if ($b.exit -eq 0) {
    Write-Log $logFile "OK: Build succeeded"
    Write-Log $logFile "END"
    Write-Host ""
    Write-Host "OK: Build succeeded."
    Write-Host "Log: $logFile"
    Write-Host "Backups: $bakDir"
    exit 0
  }

  $miss = Extract-MissingImport $b.out
  if (-not $miss) {
    Write-Log $logFile "FATAL: Build failed but could not extract missing import."
    break
  }

  $dep = [string]$miss.dep
  $from = [string]$miss.from
  Write-Log $logFile ("DETECTED: missing import '{0}' from '{1}'" -f $dep, $from)

  if (-not (Is-BareModule $dep)) {
    Write-Log $logFile ("FATAL: Missing import is not a bare module (likely local file). dep={0}" -f $dep)
    break
  }

  Write-Log $logFile ("RUN: npm install --save {0}" -f $dep)
  $inst = Run-Cmd ("npm install --save " + $dep) $RepoRoot $logFile "NPM"
  if ($inst.exit -ne 0) {
    Write-Log $logFile ("FATAL: npm install failed for {0} (exit={1})" -f $dep, $inst.exit)
    break
  }
}

Write-Log $logFile "END"
throw "Build still failing. Paste the latest log file for the next targeted fix."
