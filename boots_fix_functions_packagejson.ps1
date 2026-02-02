<#
Boots Engineering AI - Firebase deploy blocker fixer (diagnostic-first)
- Backs up target files
- Validates JSON using System.Text.Json (gives line/byte position)
- Prints surrounding context for quick manual fix
- Does NOT auto-modify by default (safe/minimal)
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory=$false)]
  [string]$RepoRoot = (Get-Location).Path,

  [Parameter(Mandatory=$false)]
  [switch]$NormalizeJson  # optional: rewrite valid JSON in a canonical pretty format
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-Dir([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
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

function Get-Context([string[]]$Lines, [int]$LineIndex0, [int]$Radius = 3) {
  $start = [Math]::Max(0, $LineIndex0 - $Radius)
  $end   = [Math]::Min($Lines.Length - 1, $LineIndex0 + $Radius)
  $out = New-Object System.Collections.Generic.List[string]
  for ($i = $start; $i -le $end; $i++) {
    $prefix = if ($i -eq $LineIndex0) { ">>" } else { "  " }
    $out.Add(("{0} {1,5}: {2}" -f $prefix, ($i+1), $Lines[$i]))
  }
  return $out -join "`n"
}

function Test-JsonFile([string]$Path, [string]$LogFile) {
  Write-Log $LogFile "CHECK: JSON parse '$Path'"
  $raw = Get-Content -LiteralPath $Path -Raw

  try {
    # Parse using System.Text.Json for precise line/byte positioning
    $doc = [System.Text.Json.JsonDocument]::Parse($raw)
    $doc.Dispose()
    Write-Log $LogFile "OK: JSON is valid: $Path"
    return @{ Ok = $true; Raw = $raw }
  }
  catch [System.Text.Json.JsonException] {
    $ex = $_.Exception
    $line0 = [int]$ex.LineNumber  # 0-based
    $byte0 = [int]$ex.BytePositionInLine  # 0-based byte position within the line
    Write-Log $LogFile ("FAIL: JSON invalid: {0}" -f $Path)
    Write-Log $LogFile ("      Message: {0}" -f $ex.Message)
    Write-Log $LogFile ("      Line: {0} (1-based: {1}), BytePosInLine: {2}" -f $line0, ($line0+1), $byte0)

    $lines = $raw -split "`r?`n",-1
    $context = Get-Context -Lines $lines -LineIndex0 $line0 -Radius 4
    Write-Log $LogFile "---- Context ----`n$context`n-----------------"

    return @{
      Ok = $false
      Line0 = $line0
      Byte0 = $byte0
      Message = $ex.Message
    }
  }
}

function Normalize-Json([string]$Path, [string]$LogFile) {
  $raw = Get-Content -LiteralPath $Path -Raw
  $node = $raw | ConvertFrom-Json -ErrorAction Stop
  # ConvertTo-Json can reorder props; only do this if explicitly asked.
  $pretty = $node | ConvertTo-Json -Depth 100
  Set-Content -LiteralPath $Path -Value $pretty -Encoding UTF8
  Write-Log $LogFile "NORMALIZE: Rewrote JSON canonical formatting: $Path"
}

# ---- Main ----
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path

$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
$workDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $workDir "logs"
$bakDir  = Join-Path $workDir ("backup-" + $ts)

New-Dir $workDir
New-Dir $logDir
New-Dir $bakDir

$logFile = Join-Path $logDir ("firebase-jsoncheck-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"

$functionsPkg = Join-Path $RepoRoot "functions\package.json"
$firebaseJson = Join-Path $RepoRoot "firebase.json"

Backup-File $functionsPkg $bakDir $logFile
Backup-File $firebaseJson $bakDir $logFile

if (-not (Test-Path -LiteralPath $functionsPkg)) {
  Write-Log $logFile "FATAL: functions\package.json not found. Aborting."
  throw "functions\package.json not found"
}

$resPkg = Test-JsonFile $functionsPkg $logFile
if (-not $resPkg.Ok) {
  Write-Log $logFile "NEXT: Fix the invalid JSON in functions\package.json (see context above), then re-run this script."
  Write-Log $logFile "END (failed)"
  throw "Invalid JSON in functions\package.json"
}

# Optional firebase.json check (helps catch other blockers)
if (Test-Path -LiteralPath $firebaseJson) {
  $resFb = Test-JsonFile $firebaseJson $logFile
  if ($resFb.Ok) {
    try {
      $fb = (Get-Content -LiteralPath $firebaseJson -Raw) | ConvertFrom-Json -ErrorAction Stop
      if ($null -ne $fb.functions -and $null -ne $fb.functions.predeploy) {
        $pre = $fb.functions.predeploy
        Write-Log $logFile ("INFO: firebase.json functions.predeploy = {0}" -f (($pre | ConvertTo-Json -Compress)))
        # Just warn about RESOURCE_DIR patterns; do not rewrite automatically.
        $preStr = ($pre -join " ")
        if ($preStr -match '\$RESOURCE_DIR' -or $preStr -match '%RESOURCE_DIR%') {
          Write-Log $logFile "INFO: Detected RESOURCE_DIR usage in predeploy. If Windows shell issues appear, consider using a Node wrapper or ensure firebase-tools is updated."
        }
      } else {
        Write-Log $logFile "INFO: No functions.predeploy found in firebase.json"
      }
    } catch {
      Write-Log $logFile "WARN: firebase.json parsed by System.Text.Json but failed ConvertFrom-Json (edge encoding/formatting)."
    }
  }
}

if ($NormalizeJson) {
  Normalize-Json $functionsPkg $logFile
  if (Test-Path -LiteralPath $firebaseJson) {
    # Only normalize firebase.json if it parses cleanly via ConvertFrom-Json
    try {
      Normalize-Json $firebaseJson $logFile
    } catch {
      Write-Log $logFile "WARN: Skipped normalizing firebase.json (ConvertFrom-Json failed)."
    }
  }
}

Write-Log $logFile "OK: JSON checks passed."
Write-Log $logFile "END (success)"
Write-Host ""
Write-Host "Log written to: $logFile"
Write-Host "Backups in:     $bakDir"
