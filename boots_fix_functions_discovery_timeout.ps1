[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path,
  [int]$DiscoveryTimeoutMs = 60000,
  [switch]$RunDeploy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-Dir([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path | Out-Null }
}

function Write-Log([string]$LogFile, [string]$Message) {
  $ts = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffK")
  "$ts $Message" | Tee-Object -FilePath $LogFile -Append
}

function Backup-File([string]$Source, [string]$BackupDir, [string]$LogFile) {
  if (Test-Path -LiteralPath $Source) {
    $leaf = Split-Path -Leaf $Source
    $dest = Join-Path $BackupDir $leaf
    Copy-Item -LiteralPath $Source -Destination $dest -Force
    Write-Log $LogFile "BACKUP: '$Source' -> '$dest'"
  } else {
    Write-Log $LogFile "WARN: Missing file: $Source"
  }
}

function Read-Json([string]$Path) {
  (Get-Content -LiteralPath $Path -Raw) | ConvertFrom-Json -ErrorAction Stop
}

# ---- Main ----
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")

$workDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $workDir "logs"
$bakDir  = Join-Path $workDir ("backup-" + $ts)
New-Dir $workDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("functions-discovery-timeout-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"
Write-Log $logFile ("INFO: PSVersion={0}" -f ($PSVersionTable.PSVersion.ToString()))

$firebaseJsonPath = Join-Path $RepoRoot "firebase.json"
$functionsDir     = Join-Path $RepoRoot "functions"
$functionsPkgPath = Join-Path $functionsDir "package.json"

Backup-File $firebaseJsonPath $bakDir $logFile
Backup-File $functionsPkgPath $bakDir $logFile

if (-not (Test-Path -LiteralPath $functionsPkgPath)) { throw "Missing: $functionsPkgPath" }

$pkg = Read-Json $functionsPkgPath
$entry = $null

# Determine entrypoint (prefer "main")
if ($pkg.PSObject.Properties.Match("main").Count -gt 0 -and [string]$pkg.main) {
  $entry = [string]$pkg.main
} else {
  $entry = "index.js"
}

$entryPath = Join-Path $functionsDir $entry
Write-Log $logFile ("INFO: functions entry candidate = {0}" -f $entryPath)

if (-not (Test-Path -LiteralPath $entryPath)) {
  # Try common fallbacks
  $fallbacks = @("index.js","src\index.ts","lib\index.js","dist\index.js")
  foreach ($f in $fallbacks) {
    $p = Join-Path $functionsDir $f
    if (Test-Path -LiteralPath $p) { $entryPath = $p; break }
  }
  Write-Log $logFile ("INFO: entry fallback = {0}" -f $entryPath)
}

if (-not (Test-Path -LiteralPath $entryPath)) {
  Write-Log $logFile "FATAL: Could not find functions entry file. Paste your functions/ tree."
  throw "Cannot find functions entry file to test load"
}

# Set discovery timeout for this process (affects firebase-tools)
$env:FUNCTIONS_DISCOVERY_TIMEOUT = [string]$DiscoveryTimeoutMs
Write-Log $logFile ("INFO: Set env FUNCTIONS_DISCOVERY_TIMEOUT={0}" -f $env:FUNCTIONS_DISCOVERY_TIMEOUT)

# Create an import/load test (uses dynamic import; works for CJS/ESM entry)
$tester = Join-Path $workDir ("functions-load-test-" + $ts + ".cjs")
@"
const path = require('path');
const { pathToFileURL } = require('url');

const entry = process.argv[2];
const timeoutMs = Number(process.argv[3] || 10000);

console.log('[load-test] entry=', entry);
console.log('[load-test] timeoutMs=', timeoutMs);

const start = Date.now();
let fired = false;

function done(code, msg) {
  if (fired) return;
  fired = true;
  const dur = Date.now() - start;
  console.log('[load-test] durationMs=', dur);
  if (msg) console.log(msg);
  process.exit(code);
}

setTimeout(() => done(124, '[load-test] TIMEOUT importing entry'), timeoutMs);

(async () => {
  try {
    // Always use file URL to avoid path issues
    const url = pathToFileURL(path.resolve(entry)).href;
    await import(url);
    done(0, '[load-test] OK imported');
  } catch (e) {
    console.error('[load-test] IMPORT ERROR');
    console.error(e && e.stack ? e.stack : e);
    done(2, '[load-test] FAILED import');
  }
})();
"@ | Set-Content -LiteralPath $tester -Encoding UTF8

# Run load test with same 10s as firebase default (so we know if you’ll hit it)
Write-Log $logFile "RUN: node load-test (10s)"
$nodeOut = & node $tester $entryPath 10000 2>&1
foreach ($l in $nodeOut) { Write-Log $logFile ("NODE: " + $l) }

# If requested, run deploy with debug and capture output
if ($RunDeploy) {
  Write-Log $logFile "RUN: firebase deploy --only functions --debug"
  $fbOut = & firebase deploy --only functions --debug 2>&1
  foreach ($l in $fbOut) { Write-Log $logFile ("FIREBASE: " + $l) }
}

Write-Log $logFile "END"
Write-Host ""
Write-Host "Log written to: $logFile"
Write-Host "Backups in:     $bakDir"
Write-Host ("FUNCTIONS_DISCOVERY_TIMEOUT set for this session: {0} ms" -f $DiscoveryTimeoutMs)
