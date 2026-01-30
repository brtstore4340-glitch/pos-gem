[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path
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

function Show-ContextByLine([string]$Raw, [int]$Line1Based, [int]$Radius, [string]$LogFile) {
  $lines = $Raw -split "`r?`n",-1
  $idx0 = [Math]::Max(0, $Line1Based - 1)
  $start = [Math]::Max(0, $idx0 - $Radius)
  $end = [Math]::Min($lines.Length - 1, $idx0 + $Radius)
  Write-Log $LogFile "---- Context (by line) ----"
  for ($i=$start; $i -le $end; $i++) {
    $prefix = if ($i -eq $idx0) { ">>" } else { "  " }
    Write-Log $LogFile ("{0} {1,5}: {2}" -f $prefix, ($i+1), $lines[$i])
  }
  Write-Log $LogFile "---------------------------"
}

function Show-ContextByPos([string]$Raw, [int]$Pos, [int]$Radius, [string]$LogFile) {
  $start = [Math]::Max(0, $Pos - $Radius)
  $end = [Math]::Min($Raw.Length, $Pos + $Radius)
  $slice = $Raw.Substring($start, $end - $start)
  Write-Log $LogFile "---- Context (by char pos) ----"
  Write-Log $LogFile ("pos=$Pos, start=$start, end=$end")
  Write-Log $LogFile $slice.Replace("`r","").Replace("`n","\n")
  Write-Log $LogFile "--------------------------------"
}

$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
$workDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $workDir "logs"
$bakDir  = Join-Path $workDir ("backup-" + $ts)
New-Dir $workDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("functions-packagejson-diag-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"

$funcPkg = Join-Path $RepoRoot "functions\package.json"
$firebaseJson = Join-Path $RepoRoot "firebase.json"

Backup-File $funcPkg $bakDir $logFile
Backup-File $firebaseJson $bakDir $logFile

if (-not (Test-Path -LiteralPath $funcPkg)) {
  Write-Log $logFile "FATAL: functions\package.json not found."
  throw "functions\package.json not found"
}

$raw = Get-Content -LiteralPath $funcPkg -Raw
Write-Log $logFile ("INFO: functions\package.json length={0} chars" -f $raw.Length)

# 1) Try System.Text.Json for line/byte info
try {
  $doc = [System.Text.Json.JsonDocument]::Parse($raw)
  $doc.Dispose()
  Write-Log $logFile "OK: System.Text.Json parse succeeded (JSON is valid)."
} catch [System.Text.Json.JsonException] {
  $ex = $_.Exception
  $line1 = [int]$ex.LineNumber + 1
  $byte0 = [int]$ex.BytePositionInLine
  Write-Log $logFile "FAIL: System.Text.Json parse failed."
  Write-Log $logFile ("      Message: {0}" -f $ex.Message)
  Write-Log $logFile ("      Line: {0} (1-based), BytePosInLine: {1}" -f $line1, $byte0)
  Show-ContextByLine -Raw $raw -Line1Based $line1 -Radius 5 -LogFile $logFile
}

# 2) Try Node JSON.parse to get "at position N" like npm
try {
  $node = Get-Command node -ErrorAction Stop
  Write-Log $logFile ("INFO: node found: {0}" -f $node.Source)

  $tmpJs = Join-Path $workDir ("jsonparse-" + $ts + ".js")
  @"
const fs = require('fs');
const p = process.argv[2];
const s = fs.readFileSync(p,'utf8');
try {
  JSON.parse(s);
  console.log('OK: JSON.parse succeeded');
} catch (e) {
  console.log('FAIL: JSON.parse failed');
  console.log(String(e.message));
  const m = /position (\d+)/.exec(String(e.message));
  if (m) {
    const pos = Number(m[1]);
    console.log('POS=' + pos);
    const start = Math.max(0, pos - 80);
    const end = Math.min(s.length, pos + 80);
    console.log('CONTEXT_START=' + start);
    console.log('CONTEXT_END=' + end);
    console.log(s.slice(start, end).replace(/\r/g,'').replace(/\n/g,'\\n'));
  }
  process.exit(1);
}
"@ | Set-Content -LiteralPath $tmpJs -Encoding UTF8

  $out = & node $tmpJs $funcPkg 2>&1
  foreach ($line in $out) { Write-Log $logFile ("NODE: " + $line) }

  $posLine = $out | Where-Object { $_ -match '^POS=\d+' } | Select-Object -First 1
  if ($posLine) {
    $pos = [int]($posLine -replace '^POS=','')
    Show-ContextByPos -Raw $raw -Pos $pos -Radius 120 -LogFile $logFile
  }
} catch {
  Write-Log $logFile ("WARN: Node JSON.parse check skipped/failed: {0}" -f $_.Exception.Message)
}

Write-Log $logFile "END"
Write-Host ""
Write-Host "Log written to: $logFile"
Write-Host "Backups in:     $bakDir"
