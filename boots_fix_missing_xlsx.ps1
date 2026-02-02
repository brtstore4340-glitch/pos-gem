[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path,
  [string]$XlsxVersion = ""   # leave empty to install latest
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

# ---- Main ----
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
$bootDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $bootDir "logs"
$bakDir  = Join-Path $bootDir ("backup-" + $ts)
New-Dir $bootDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("fix-missing-xlsx-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"

$pkgPath  = Join-Path $RepoRoot "package.json"
$lockPath = Join-Path $RepoRoot "package-lock.json"

if (-not (Test-Path -LiteralPath $pkgPath)) { throw "Missing package.json at repo root: $pkgPath" }

Backup-File $pkgPath $bakDir $logFile $RepoRoot
Backup-File $lockPath $bakDir $logFile $RepoRoot

# Ensure dependency exists in package.json (so it’s explicit, not just in lockfile)
$pkg = (Get-Content -LiteralPath $pkgPath -Raw) | ConvertFrom-Json -ErrorAction Stop
if ($null -eq $pkg.dependencies) {
  $pkg | Add-Member -NotePropertyName dependencies -NotePropertyValue (@{}) -Force
}

$has = $pkg.dependencies.PSObject.Properties.Match("xlsx").Count -gt 0
if ($has) {
  Write-Log $logFile ("OK: package.json already has dependencies.xlsx = {0}" -f $pkg.dependencies.xlsx)
} else {
  # put a placeholder; npm install will finalize version + lockfile
  $pkg.dependencies | Add-Member -NotePropertyName xlsx -NotePropertyValue "*" -Force
  ($pkg | ConvertTo-Json -Depth 100) | Set-Content -LiteralPath $pkgPath -Encoding UTF8
  Write-Log $logFile "PATCH: Added dependencies.xlsx='*' to package.json (npm will pin in lockfile)."
}

# Run npm install (deterministic enough because lockfile will be updated)
$pkgArg = if ([string]::IsNullOrWhiteSpace($XlsxVersion)) { "xlsx" } else { ("xlsx@" + $XlsxVersion) }
Write-Log $logFile ("RUN: npm install --save {0}" -f $pkgArg)

$prev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
  $out = & npm install --save $pkgArg 2>&1
  $exit = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $prev
}
foreach ($l in $out) { Write-Log $logFile ("NPM: " + $l) }
if ($exit -ne 0) { throw "npm install failed (exit=$exit). See log: $logFile" }

Write-Log $logFile "END"
Write-Host ""
Write-Host "DONE. Log: $logFile"
Write-Host "Backups: $bakDir"
