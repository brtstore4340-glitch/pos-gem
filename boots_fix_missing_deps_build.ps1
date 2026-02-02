[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path,
  [int]$MaxFixIterations = 6
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
  } else {
    Write-Log $LogFile "WARN: Missing file: $Source"
  }
}

function Run-Cmd([string]$Exe, [string[]]$Args, [string]$LogFile, [string]$Prefix) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $out = & $Exe @Args 2>&1
    $exit = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prev
  }
  foreach ($l in $out) { Write-Log $LogFile ("{0}: {1}" -f $Prefix, $l) }
  return @{ exit = $exit; out = $out }
}

function Extract-MissingImport([object[]]$BuildOut) {
  # matches: failed to resolve import "X" from "Y"
  foreach ($line in $BuildOut) {
    $s = [string]$line
    if ($s -match 'failed to resolve import\s+"([^"]+)"\s+from\s+"([^"]+)"') {
      return @{ dep = $Matches[1]; from = $Matches[2] }
    }
  }
  return $null
}

function Is-BareModule([string]$Spec) {
  if ([string]::IsNullOrWhiteSpace($Spec)) { return $false }
  if ($Spec.StartsWith(".") -or $Spec.StartsWith("/") -or $Spec.StartsWith("..")) { return $false }
  return $true
}

# ---- Main ----
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")

$bootDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $bootDir "logs"
$bakDir  = Join-Path $bootDir ("backup-" + $ts)
New-Dir $bootDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("fix-missing-deps-build-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"

$pkgPath  = Join-Path $RepoRoot "package.json"
$lockPath = Join-Path $RepoRoot "package-lock.json"
Backup-File $pkgPath  $bakDir $logFile $RepoRoot
Backup-File $lockPath $bakDir $logFile $RepoRoot

# Sanity (node/npm should work now)
Run-Cmd "node" @("-v") $logFile "NODE" | Out-Null
Run-Cmd "npm"  @("-v") $logFile "NPM"  | Out-Null

for ($i=1; $i -le $MaxFixIterations; $i++) {
  Write-Log $logFile ("STEP: Build attempt {0}/{1}" -f $i, $MaxFixIterations)
  $b = Run-Cmd "npm" @("run","build") $logFile "BUILD"

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
    Write-Log $logFile "FATAL: Build failed but could not extract missing import from output."
    break
  }

  $dep = [string]$miss.dep
  $from = [string]$miss.from
  Write-Log $logFile ("DETECTED: missing import '{0}' from '{1}'" -f $dep, $from)

  if (-not (Is-BareModule $dep)) {
    Write-Log $logFile ("FATAL: Missing import is not a bare module specifier (likely a local path). Stop auto-fix. dep={0}" -f $dep)
    break
  }

  Write-Log $logFile ("RUN: npm install --save {0}" -f $dep)
  $inst = Run-Cmd "npm" @("install","--save",$dep) $logFile "NPM"
  if ($inst.exit -ne 0) {
    Write-Log $logFile ("FATAL: npm install failed for {0} (exit={1})" -f $dep, $inst.exit)
    break
  }
}

Write-Log $logFile "END"
throw "Build still failing. Paste the latest log file for the next targeted fix."
