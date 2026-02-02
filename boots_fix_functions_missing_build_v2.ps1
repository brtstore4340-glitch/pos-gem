[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path
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

function Has-Prop([object]$Obj, [string]$Name) {
  if ($null -eq $Obj) { return $false }
  return ($Obj.PSObject.Properties.Match($Name).Count -gt 0)
}

function Save-Json([object]$Obj, [string]$Path) {
  $json = $Obj | ConvertTo-Json -Depth 100
  Set-Content -LiteralPath $Path -Value $json -Encoding UTF8
}

function Patch-PredeployCommands([object]$FuncBlock, [string]$LogFile, [ref]$AnyChanged) {
  if (-not (Has-Prop $FuncBlock "predeploy")) {
    Write-Log $LogFile "INFO: functions block has no 'predeploy' property (skipping)."
    return
  }

  $pre = $FuncBlock.PSObject.Properties["predeploy"].Value

  # Normalize to array of strings
  $preArr = @()
  if ($pre -is [string]) {
    $preArr = @($pre)
  } elseif ($pre -is [System.Collections.IEnumerable]) {
    foreach ($c in $pre) { $preArr += [string]$c }
  } else {
    $preArr = @([string]$pre)
  }

  $newPre = @()
  foreach ($cmd in $preArr) {
    $newCmd = $cmd

    # Patch only the "run build" part; leave everything else untouched.
    # Handles: "$RESOURCE_DIR", $RESOURCE_DIR, "%RESOURCE_DIR%"
    if ($newCmd -match 'npm\s+--prefix\s+("?\$RESOURCE_DIR"?|"%RESOURCE_DIR%"|%RESOURCE_DIR%)\s+run\s+build(\s|$)') {
      if ($newCmd -notmatch 'run\s+build\s+--if-present') {
        $patched = [regex]::Replace($newCmd, 'run\s+build(\s|$)', 'run build --if-present$1')
        Write-Log $LogFile ("PATCH: predeploy: '{0}' -> '{1}'" -f $newCmd, $patched)
        $newCmd = $patched
        $AnyChanged.Value = $true
      }
    }

    $newPre += $newCmd
  }

  # Write back preserving original scalar/array shape
  if ($pre -is [string]) {
    $FuncBlock.PSObject.Properties["predeploy"].Value = $newPre[0]
  } else {
    $FuncBlock.PSObject.Properties["predeploy"].Value = $newPre
  }
}

# ---- Main ----
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path

$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
$workDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $workDir "logs"
$bakDir  = Join-Path $workDir ("backup-" + $ts)
New-Dir $workDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("fix-missing-build-v2-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"
Write-Log $logFile ("INFO: PSVersion={0}" -f ($PSVersionTable.PSVersion.ToString()))

$firebaseJsonPath = Join-Path $RepoRoot "firebase.json"
$functionsPkgPath = Join-Path $RepoRoot "functions\package.json"

Backup-File $firebaseJsonPath $bakDir $logFile
Backup-File $functionsPkgPath $bakDir $logFile

if (-not (Test-Path -LiteralPath $firebaseJsonPath)) { throw "firebase.json not found: $firebaseJsonPath" }

$fbRaw = Get-Content -LiteralPath $firebaseJsonPath -Raw
$fb = $fbRaw | ConvertFrom-Json -ErrorAction Stop

if (-not (Has-Prop $fb "functions")) {
  Write-Log $logFile "FATAL: firebase.json has no top-level 'functions' key. Nothing to patch."
  throw "firebase.json missing 'functions' key"
}

$anyChanged = $false
$funcVal = $fb.PSObject.Properties["functions"].Value

if ($funcVal -is [object[]]) {
  Write-Log $logFile ("INFO: firebase.json functions is an array (count={0})" -f $funcVal.Length)
  for ($i=0; $i -lt $funcVal.Length; $i++) {
    $block = $funcVal[$i]
    Write-Log $logFile ("INFO: Patching functions[{0}] (keys: {1})" -f $i, (($block.PSObject.Properties.Name -join ", ")))
    Patch-PredeployCommands -FuncBlock $block -LogFile $logFile -AnyChanged ([ref]$anyChanged)
  }
} else {
  Write-Log $logFile ("INFO: firebase.json functions is an object (keys: {0})" -f (($funcVal.PSObject.Properties.Name -join ", ")))
  Patch-PredeployCommands -FuncBlock $funcVal -LogFile $logFile -AnyChanged ([ref]$anyChanged)
}

if ($anyChanged) {
  Save-Json $fb $firebaseJsonPath
  Write-Log $logFile "OK: Patched firebase.json (build -> build --if-present where applicable)."
} else {
  Write-Log $logFile "OK: No matching predeploy 'npm ... run build' found (or already patched)."
  Write-Log $logFile "NOTE: If deploy still runs 'npm ... run build', paste your firebase.json functions section."
}

Write-Log $logFile "END"
Write-Host ""
Write-Host "Log written to: $logFile"
Write-Host "Backups in:     $bakDir"
