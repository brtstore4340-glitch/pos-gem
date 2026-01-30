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
function Has-Prop([object]$Obj, [string]$Name) {
  if ($null -eq $Obj) { return $false }
  return ($Obj.PSObject.Properties.Match($Name).Count -gt 0)
}
function Save-Json([object]$Obj, [string]$Path) {
  $json = $Obj | ConvertTo-Json -Depth 100
  Set-Content -LiteralPath $Path -Value $json -Encoding UTF8
}

# ---- Main ----
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")

$workDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $workDir "logs"
$bakDir  = Join-Path $workDir ("backup-" + $ts)
New-Dir $workDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("fix-engines-node-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"
Write-Log $logFile ("INFO: PSVersion={0}" -f ($PSVersionTable.PSVersion.ToString()))

$firebaseJsonPath = Join-Path $RepoRoot "firebase.json"
$functionsDir     = Join-Path $RepoRoot "functions"
$pkgPath          = Join-Path $functionsDir "package.json"

Backup-File $firebaseJsonPath $bakDir $logFile
Backup-File $pkgPath $bakDir $logFile

if (-not (Test-Path -LiteralPath $firebaseJsonPath)) { throw "firebase.json not found: $firebaseJsonPath" }
if (-not (Test-Path -LiteralPath $pkgPath)) { throw "functions/package.json not found: $pkgPath" }

$fb = (Get-Content -LiteralPath $firebaseJsonPath -Raw) | ConvertFrom-Json -ErrorAction Stop

# Determine runtime from firebase.json (supports functions as object OR array)
$runtime = $null
if (Has-Prop $fb "functions") {
  $f = $fb.functions
  if ($f -is [object[]]) {
    foreach ($item in $f) {
      if (Has-Prop $item "runtime") { $runtime = [string]$item.runtime; break }
    }
  } else {
    if (Has-Prop $f "runtime") { $runtime = [string]$f.runtime }
  }
}

if (-not $runtime) {
  Write-Log $logFile "WARN: No functions.runtime found in firebase.json. Defaulting target node to 20."
  $targetNode = "20"
} else {
  Write-Log $logFile ("INFO: firebase.json functions.runtime='{0}'" -f $runtime)
  switch -Regex ($runtime) {
    '^nodejs(\d+)$' { $targetNode = $Matches[1]; break }
    default { $targetNode = "20"; Write-Log $logFile "WARN: Unrecognized runtime; defaulting target node to 20." }
  }
}

# Patch functions/package.json
$pkg = (Get-Content -LiteralPath $pkgPath -Raw) | ConvertFrom-Json -ErrorAction Stop

# Add name if missing (removes npm "package: undefined" in warnings)
if (-not (Has-Prop $pkg "name") -or [string]::IsNullOrWhiteSpace([string]$pkg.name)) {
  $pkg | Add-Member -NotePropertyName name -NotePropertyValue "boots-functions" -Force
  Write-Log $logFile "PATCH: Added functions/package.json name='boots-functions'"
}

if (-not (Has-Prop $pkg "engines") -or $null -eq $pkg.engines) {
  $pkg | Add-Member -NotePropertyName engines -NotePropertyValue (@{}) -Force
}

$old = $pkg.engines.node
if ([string]$old -ne $targetNode) {
  $pkg.engines.node = $targetNode
  Write-Log $logFile ("PATCH: engines.node '{0}' -> '{1}'" -f $old, $targetNode)
} else {
  Write-Log $logFile ("OK: engines.node already '{0}'" -f $targetNode)
}

Save-Json $pkg $pkgPath
Write-Log $logFile "OK: Wrote patched functions/package.json"
Write-Log $logFile "END"

Write-Host ""
Write-Host "Log written to: $logFile"
Write-Host "Backups in:     $bakDir"
Write-Host ("Target engines.node set to: {0}" -f $targetNode)