<#
  patch-add-react-hot-toast.ps1
  - Fix Vite/Rollup "failed to resolve import react-hot-toast" by installing dependency
  - Creates timestamped backups + log
  - Uses --save-exact for deterministic installs
#>

param(
  [string]$RepoRoot = (Get-Location).Path,
  [string]$Version = "2.6.0"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-Timestamp { (Get-Date -Format "yyyyMMdd-HHmmss") }

$ts = New-Timestamp
$bootDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $bootDir "patchlogs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "patch-add-react-hot-toast-$ts.log"

function Log([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "o"), $msg
  $line | Tee-Object -FilePath $logFile -Append | Out-Host
}

try {
  Log "RepoRoot: $RepoRoot"
  Log "Target package: react-hot-toast@$Version"
  Log "LogFile: $logFile"

  $pkgJson = Join-Path $RepoRoot "package.json"
  if (!(Test-Path $pkgJson)) { throw "Missing package.json at: $pkgJson" }

  $pkgLock = Join-Path $RepoRoot "package-lock.json"

  # Backups
  $pkgBak = "$pkgJson.bak.$ts"
  Copy-Item -Path $pkgJson -Destination $pkgBak -Force
  Log "Backup created: $pkgBak"

  if (Test-Path $pkgLock) {
    $lockBak = "$pkgLock.bak.$ts"
    Copy-Item -Path $pkgLock -Destination $lockBak -Force
    Log "Backup created: $lockBak"
  } else {
    Log "No package-lock.json found (will be generated/updated by npm if applicable)."
  }

  # Sanity: ensure npm available
  $npm = Get-Command npm -ErrorAction Stop
  Log "npm: $($npm.Source)"

  # Check if already installed in package.json (light check)
  $raw = Get-Content -Path $pkgJson -Raw -Encoding UTF8
  if ($raw -match '"react-hot-toast"\s*:\s*"') {
    Log "package.json already contains react-hot-toast. Running npm install to reconcile lock/node_modules."
    & npm install --no-audit --no-fund | Tee-Object -FilePath $logFile -Append | Out-Host
    Log "Done."
    exit 0
  }

  # Install exact version (updates package.json + package-lock.json)
  Log "Running: npm install react-hot-toast@$Version --save-exact --no-audit --no-fund"
  & npm install "react-hot-toast@$Version" --save-exact --no-audit --no-fund |
    Tee-Object -FilePath $logFile -Append | Out-Host

  Log "Install complete."
  Log "Next: run npm run build"
}
catch {
  Log ("ERROR: " + $_.Exception.Message)
  Log "Aborted."
  throw
}
