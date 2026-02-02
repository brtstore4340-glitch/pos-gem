[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path,
  [switch]$AddNoopBuild
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

function Save-Json([object]$Obj, [string]$Path) {
  # ConvertTo-Json will reformat; acceptable for firebase.json / package.json
  $json = $Obj | ConvertTo-Json -Depth 100
  Set-Content -LiteralPath $Path -Value $json -Encoding UTF8
}

function Detect-TypeScript([string]$FunctionsDir) {
  if (Test-Path -LiteralPath (Join-Path $FunctionsDir "tsconfig.json")) { return $true }
  $ts = Get-ChildItem -LiteralPath $FunctionsDir -Recurse -File -Filter *.ts -ErrorAction SilentlyContinue | Select-Object -First 1
  return [bool]$ts
}

# ---- Main ----
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path

$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
$workDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $workDir "logs"
$bakDir  = Join-Path $workDir ("backup-" + $ts)

New-Dir $workDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("fix-missing-build-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"
Write-Log $logFile ("INFO: PSVersion={0}" -f ($PSVersionTable.PSVersion.ToString()))

$firebaseJsonPath = Join-Path $RepoRoot "firebase.json"
$functionsDir     = Join-Path $RepoRoot "functions"
$functionsPkgPath = Join-Path $functionsDir "package.json"

Backup-File $firebaseJsonPath $bakDir $logFile
Backup-File $functionsPkgPath $bakDir $logFile

if (-not (Test-Path -LiteralPath $firebaseJsonPath)) { throw "firebase.json not found: $firebaseJsonPath" }
if (-not (Test-Path -LiteralPath $functionsPkgPath)) { throw "functions/package.json not found: $functionsPkgPath" }

# --- Patch firebase.json: add --if-present to any "npm ... run build" predeploy entries
$fbRaw = Get-Content -LiteralPath $firebaseJsonPath -Raw
$fb = $fbRaw | ConvertFrom-Json -ErrorAction Stop

$changedFirebase = $false
if ($null -ne $fb.functions -and $null -ne $fb.functions.predeploy) {
  $pre = $fb.functions.predeploy

  # Normalize to array
  if ($pre -is [string]) { $preArr = @($pre) }
  else { $preArr = @($pre) }

  $newPre = @()
  foreach ($cmd in $preArr) {
    $newCmd = $cmd

    # Add --if-present if command runs "npm ... run build" without it
    # Handles: "$RESOURCE_DIR", $RESOURCE_DIR, "%RESOURCE_DIR%"
    if ($newCmd -match 'npm\s+--prefix\s+("?\$RESOURCE_DIR"?|"%RESOURCE_DIR%"|%RESOURCE_DIR%)\s+run\s+build(\s|$)') {
      if ($newCmd -notmatch 'run\s+build\s+--if-present') {
        $newCmd = [regex]::Replace($newCmd, 'run\s+build(\s|$)', 'run build --if-present$1')
        $changedFirebase = $true
        Write-Log $logFile ("PATCH: firebase.json predeploy: '{0}' -> '{1}'" -f $cmd, $newCmd)
      }
    }

    $newPre += $newCmd
  }

  # Restore original type (string vs array)
  if ($pre -is [string]) { $fb.functions.predeploy = $newPre[0] }
  else { $fb.functions.predeploy = $newPre }
} else {
  Write-Log $logFile "INFO: No functions.predeploy found in firebase.json (nothing to patch there)."
}

if ($changedFirebase) {
  Save-Json $fb $firebaseJsonPath
  Write-Log $logFile "OK: Patched firebase.json (build --if-present)."
} else {
  Write-Log $logFile "OK: firebase.json unchanged (no matching build predeploy found or already patched)."
}

# --- Optional: add noop build to functions/package.json (ONLY if no TS detected)
$tsDetected = Detect-TypeScript $functionsDir
Write-Log $logFile ("INFO: TypeScript detected in functions/: {0}" -f $tsDetected)

$pkgRaw = Get-Content -LiteralPath $functionsPkgPath -Raw
$pkg = $pkgRaw | ConvertFrom-Json -ErrorAction Stop

$changedPkg = $false
if ($AddNoopBuild) {
  if ($tsDetected) {
    Write-Log $logFile "BLOCK: TS detected; refusing to add noop build. You must define a real build (e.g. tsc) for safe deploy."
    throw "TypeScript detected in functions/ but scripts.build is missing (unsafe to add noop). Define a real build script."
  }

  if ($null -eq $pkg.scripts) {
    $pkg | Add-Member -NotePropertyName scripts -NotePropertyValue (@{}) -Force
    $changedPkg = $true
  }

  if ($null -eq $pkg.scripts.build) {
    # No-op build for JS functions
    $pkg.scripts | Add-Member -NotePropertyName build -NotePropertyValue 'node -e "console.log(''build: skip (no build step configured)'')"' -Force
    $changedPkg = $true
    Write-Log $logFile "PATCH: Added noop scripts.build to functions/package.json (JS-only)."
  } else {
    Write-Log $logFile "INFO: functions/package.json already has scripts.build (no change)."
  }

  if ($changedPkg) {
    Save-Json $pkg $functionsPkgPath
    Write-Log $logFile "OK: Patched functions/package.json."
  }
} else {
  # Just report if build is missing
  if ($null -eq $pkg.scripts -or $null -eq $pkg.scripts.build) {
    Write-Log $logFile "INFO: functions/package.json is missing scripts.build."
    if ($tsDetected) {
      Write-Log $logFile "WARN: TS detected. You should add a real build script (e.g. tsc) instead of skipping."
    } else {
      Write-Log $logFile "INFO: If functions are plain JS, you can run this script with -AddNoopBuild."
    }
  } else {
    Write-Log $logFile "INFO: functions/package.json has scripts.build."
  }
}

Write-Log $logFile "END"
Write-Host ""
Write-Host "Log written to: $logFile"
Write-Host "Backups in:     $bakDir"
