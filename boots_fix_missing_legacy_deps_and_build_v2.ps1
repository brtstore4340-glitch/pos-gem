[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path,
  [string]$MaxFixIterations = "10"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Validate MaxFixIterations safely (accept string inputs)
$MaxFixIterations = Parse-Int $MaxFixIterations 10
if ($MaxFixIterations -lt 1) { $MaxFixIterations = 10 }

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
  } else {
    Write-Log $LogFile "WARN: Missing file: $Source"
  }
}

function Run-Cmd([string]$CmdLine, [string]$WorkingDir, [string]$LogFile, [string]$Prefix) {
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

  return @{
    ExitCode = $p.ExitCode
    Output   = ($stdout + "`n" + $stderr)
  }
}

function Extract-MissingImport([string]$Text) {
  # Handles both:
  #   failed to resolve import "X" from "Y"
  #   Rollup failed to resolve import "X" from "Y"
  $re = '((Rollup\s+)?failed to resolve import)\s+"([^"]+)"\s+from\s+"([^"]+)"'
  $m = [regex]::Match($Text, $re, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($m.Success) {
    return @{ Dep = $m.Groups[3].Value; From = $m.Groups[4].Value }
  }
  return $null
}

function Is-BareModule([string]$Spec) {
  if ([string]::IsNullOrWhiteSpace($Spec)) { return $false }
  return -not ($Spec.StartsWith(".") -or $Spec.StartsWith("/") -or $Spec.StartsWith(".."))
}

function Parse-Int($Value, [int]$Default = -1) {
  $s = [string]$Value
  $tmp = 0
  if ([int]::TryParse($s, [ref]$tmp)) { return $tmp }
  return $Default
}

# ---- Main ----
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")

$bootDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $bootDir "logs"
$bakDir  = Join-Path $bootDir ("backup-" + $ts)
New-Dir $bootDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("fix-missing-legacy-deps-build-v2-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"

Backup-File (Join-Path $RepoRoot "package.json")      $bakDir $logFile $RepoRoot
Backup-File (Join-Path $RepoRoot "package-lock.json") $bakDir $logFile $RepoRoot

# Sanity: log versions (don’t stop on nonzero here; just record)
$nv = Run-Cmd "node -v" $RepoRoot $logFile "NODE"
$pv = Run-Cmd "npm -v"  $RepoRoot $logFile "NPM"

for ($i=1; $i -le $MaxFixIterations; $i++) {
  Write-Log $logFile ("STEP: Build attempt {0}/{1}" -f $i, $MaxFixIterations)

  $b = Run-Cmd "npm run build" $RepoRoot $logFile "BUILD"
  $bExit = Parse-Int $b['ExitCode'] -1
  $bOut  = [string]$b['Output']
  if ($bExit -lt 0) { Write-Log $logFile ("WARN: Non-numeric build ExitCode: '{0}' (raw type: {1})" -f [string]$b['ExitCode'], ($b['ExitCode'] -ne $null ? $b['ExitCode'].GetType().FullName : 'null')) }

  if ($bExit -eq 0) {
    Write-Log $logFile "OK: Build succeeded"
    Write-Log $logFile "END"
    Write-Host ""
    Write-Host "OK: Build succeeded."
    Write-Host "Log: $logFile"
    Write-Host "Backups: $bakDir"
    exit 0
  }

  $miss = Extract-MissingImport $bOut
  if (-not $miss) {
    Write-Log $logFile "FATAL: Build failed but could not extract missing import from output."
    break
  }

  $dep  = [string]$miss['Dep']
  $from = [string]$miss['From']
  Write-Log $logFile ("DETECTED: missing import '{0}' from '{1}'" -f $dep, $from)

  if (-not (Is-BareModule $dep)) {
    Write-Log $logFile ("FATAL: Missing import is not a bare module (likely local path). dep={0}" -f $dep)
    break
  }

  Write-Log $logFile ("RUN: npm install --save {0}" -f $dep)
  $inst = Run-Cmd ("npm install --save " + $dep) $RepoRoot $logFile "NPM"
  $instExit = Parse-Int $inst['ExitCode'] -1
  if ($instExit -lt 0) { Write-Log $logFile ("WARN: Non-numeric npm install ExitCode: '{0}' (raw type: {1})" -f [string]$inst['ExitCode'], ($inst['ExitCode'] -ne $null ? $inst['ExitCode'].GetType().FullName : 'null')) }
  if ($instExit -ne 0) {
    Write-Log $logFile ("FATAL: npm install failed for {0} (exit={1})" -f $dep, $instExit)
    break
  }
}

Write-Log $logFile "END"
throw "Build still failing. Paste the latest log file for the next targeted fix."
