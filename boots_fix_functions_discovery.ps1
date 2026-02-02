[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-Dir([string]$Path) { if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path | Out-Null } }
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

$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
$workDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $workDir "logs"
$bakDir  = Join-Path $workDir ("backup-" + $ts)
New-Dir $workDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("fix-functions-discovery-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"
Write-Log $logFile ("INFO: PSVersion={0}" -f ($PSVersionTable.PSVersion.ToString()))

$functionsDir = Join-Path $RepoRoot "functions"
$pkgPath = Join-Path $functionsDir "package.json"
$indexPath = Join-Path $functionsDir "index.js"

Backup-File $pkgPath $bakDir $logFile
Backup-File $indexPath $bakDir $logFile

if (-not (Test-Path -LiteralPath $pkgPath)) { throw "Missing: $pkgPath" }
if (-not (Test-Path -LiteralPath $indexPath)) { throw "Missing: $indexPath" }

# ---- Patch functions/package.json: align engines.node to 20 (matches firebase.json runtime nodejs20)
$pkgRaw = Get-Content -LiteralPath $pkgPath -Raw
$pkg = $pkgRaw | ConvertFrom-Json -ErrorAction Stop

if ($null -eq $pkg.engines) {
  $pkg | Add-Member -NotePropertyName engines -NotePropertyValue (@{}) -Force
}
$oldNode = $pkg.engines.node
if ([string]$oldNode -ne "20") {
  $pkg.engines.node = "20"
  $pkgOut = $pkg | ConvertTo-Json -Depth 50
  Set-Content -LiteralPath $pkgPath -Value $pkgOut -Encoding UTF8
  Write-Log $logFile ("PATCH: functions/package.json engines.node: '{0}' -> '20'" -f $oldNode)
} else {
  Write-Log $logFile "OK: functions/package.json engines.node already '20'"
}

# ---- Patch functions/index.js: lazy-load cartService; avoid unconditional admin.initializeApp()
$src = Get-Content -LiteralPath $indexPath -Raw

# Idempotency marker
if ($src -match "BOOT_DISCOVERY_PATCH_V1") {
  Write-Log $logFile "OK: functions/index.js already patched (BOOT_DISCOVERY_PATCH_V1)."
  Write-Log $logFile "END"
  Write-Host "Already patched. Log: $logFile"
  exit 0
}

# 1) Make admin initialization safe (no behavior change, prevents accidental double-init patterns)
if ($src -match "admin\.initializeApp\(\);\s*\r?\nconst db = admin\.firestore\(\);") {
  $src = [regex]::Replace(
    $src,
    "admin\.initializeApp\(\);\s*\r?\nconst db = admin\.firestore\(\);",
    "if (!admin.apps.length) { admin.initializeApp(); }`r`nconst db = admin.firestore();"
  )
  Write-Log $logFile "PATCH: guarded admin.initializeApp()"
} else {
  Write-Log $logFile "WARN: did not find expected 'admin.initializeApp(); const db = admin.firestore();' pattern (skipped guard)."
}

# 2) Remove eager cartService require and replace with lazy getter
$cartRequirePattern = 'const\s+\{\s*calculateCartSummary\s*\}\s*=\s*require\("\./src/services/cartService"\);\s*'
if ($src -match $cartRequirePattern) {
  $lazyBlock = @'
/* BOOT_DISCOVERY_PATCH_V1
 * Lazy-load cartService to keep module load fast for Firebase discovery.
 */
let _calculateCartSummary = null;
function getCalculateCartSummary() {
  if (!_calculateCartSummary) {
    _calculateCartSummary = require("./src/services/cartService").calculateCartSummary;
  }
  return _calculateCartSummary;
}

'@
  $src = [regex]::Replace($src, $cartRequirePattern, $lazyBlock)
  Write-Log $logFile "PATCH: made calculateCartSummary lazy"
} else {
  Write-Log $logFile "WARN: did not find expected cartService require (skipped lazy patch)."
}

# 3) Update calculateOrder to call the lazy getter (only if old call exists)
if ($src -match "return\s+calculateCartSummary\(") {
  $src = $src -replace "return\s+calculateCartSummary\(", "return getCalculateCartSummary()("
  Write-Log $logFile "PATCH: calculateOrder now uses getCalculateCartSummary()"
} else {
  Write-Log $logFile "WARN: did not find 'return calculateCartSummary(' (skipped call patch)."
}

Set-Content -LiteralPath $indexPath -Value $src -Encoding UTF8
Write-Log $logFile "OK: wrote patched functions/index.js"

Write-Log $logFile "END"
Write-Host ""
Write-Host "Log written to: $logFile"
Write-Host "Backups in:     $bakDir"
