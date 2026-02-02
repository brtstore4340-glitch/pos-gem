[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path,
  [switch]$SkipBuild
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

# ---- Main ----
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")

$bootDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $bootDir "logs"
$bakDir  = Join-Path $bootDir ("backup-" + $ts)
New-Dir $bootDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("add-xlsx-and-build-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"

$pkgPath  = Join-Path $RepoRoot "package.json"
$lockPath = Join-Path $RepoRoot "package-lock.json"
Backup-File $pkgPath  $bakDir $logFile $RepoRoot
Backup-File $lockPath $bakDir $logFile $RepoRoot

if (-not (Test-Path -LiteralPath $pkgPath)) { throw "Missing root package.json: $pkgPath" }

# Quick tool sanity (Volta should be OK now)
$nodeV = (& node -v 2>&1); Write-Log $logFile ("NODE: " + ($nodeV -join " | "))
$npmV  = (& npm -v  2>&1); Write-Log $logFile ("NPM: "  + ($npmV  -join " | "))

# Install xlsx (this updates package.json + lockfile)
Write-Log $logFile "RUN: npm install --save xlsx"
$prev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
  $out = & npm install --save xlsx 2>&1
  $exit = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $prev
}
foreach ($l in $out) { Write-Log $logFile ("NPM: " + $l) }
if ($exit -ne 0) { throw "npm install xlsx failed (exit=$exit). See log: $logFile" }

if (-not $SkipBuild) {
  Write-Log $logFile "RUN: npm run build"
  $ErrorActionPreference = "Continue"
  try {
    $bout = & npm run build 2>&1
    $bexit = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prev
  }
  foreach ($l in $bout) { Write-Log $logFile ("BUILD: " + $l) }
  if ($bexit -ne 0) { throw "npm run build failed (exit=$bexit). See log: $logFile" }
}

Write-Log $logFile "END"
Write-Host ""
Write-Host "DONE. Log: $logFile"
Write-Host "Backups: $bakDir"
if (-not $SkipBuild) { Write-Host "Build completed OK (see log)." }
