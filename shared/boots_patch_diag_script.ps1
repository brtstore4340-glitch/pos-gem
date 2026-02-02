<#
Boots Engineering AI - Patch boots_diag_functions_pkgjson.ps1 for PowerShell 5.1 compatibility
- Creates backups under _boot\patch-backups-<timestamp>\
- Writes deterministic log under _boot\logs\
- Replaces the diagnostic script with a PS 5.1 safe version (ConvertFrom-Json + Node JSON.parse via .cjs)
#>

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

$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$target = Join-Path $RepoRoot "boots_diag_functions_pkgjson.ps1"

$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
$workDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $workDir "logs"
$bakDir  = Join-Path $workDir ("patch-backups-" + $ts)

New-Dir $workDir
New-Dir $logDir
New-Dir $bakDir

$logFile = Join-Path $logDir ("patch-diag-script-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"
Write-Log $logFile ("INFO: PSVersion={0}" -f ($PSVersionTable.PSVersion.ToString()))
Write-Log $logFile ("INFO: Target={0}" -f $target)

if (-not (Test-Path -LiteralPath $target)) {
  Write-Log $logFile "FATAL: boots_diag_functions_pkgjson.ps1 not found in repo root."
  throw "boots_diag_functions_pkgjson.ps1 not found at: $target"
}

# Idempotency: if already patched, stop cleanly
$current = Get-Content -LiteralPath $target -Raw
if ($current -match "PS51_COMPAT_V2") {
  Write-Log $logFile "OK: Target script already patched (PS51_COMPAT_V2). No changes made."
  Write-Host "Already patched. Log: $logFile"
  exit 0
}

# Backup
$backupPath = Join-Path $bakDir "boots_diag_functions_pkgjson.ps1.bak"
Copy-Item -LiteralPath $target -Destination $backupPath -Force
Write-Log $logFile ("BACKUP: {0} -> {1}" -f $target, $backupPath)

# New PS5.1-safe diagnostic script (replaces System.Text.Json usage)
$newScript = @'
# PS51_COMPAT_V2
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
  Write-Log $LogFile ($slice.Replace("`r","").Replace("`n","\n"))
  Write-Log $LogFile "--------------------------------"
}

# ---- Main ----
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")

$workDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $workDir "logs"
$bakDir  = Join-Path $workDir ("backup-" + $ts)
New-Dir $workDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("functions-packagejson-diag-ps51-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"
Write-Log $logFile ("INFO: PSVersion={0}" -f ($PSVersionTable.PSVersion.ToString()))

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

# 1) PowerShell-native JSON parse (often yields line/char)
try {
  $null = $raw | ConvertFrom-Json -ErrorAction Stop
  Write-Log $logFile "OK: ConvertFrom-Json succeeded (JSON appears valid to PowerShell)."
} catch {
  Write-Log $logFile "FAIL: ConvertFrom-Json failed."
  Write-Log $logFile ("      Message: {0}" -f $_.Exception.Message)

  $pm = $null
  if ($_.InvocationInfo -and $_.InvocationInfo.PositionMessage) {
    $pm = ($_.InvocationInfo.PositionMessage -replace "\r","" -replace "\n"," | ")
    Write-Log $logFile ("      PositionMessage: {0}" -f $pm)
  }

  # Try parse common formats:
  # - "At line:X char:Y"
  # - "Line X, position Y"
  if ($pm -match 'At line:(\d+)\s+char:(\d+)') {
    $line = [int]$Matches[1]
    Show-ContextByLine -Raw $raw -Line1Based $line -Radius 6 -LogFile $logFile
  } elseif ($_.Exception.Message -match 'Line\s+(\d+).*position\s+(\d+)') {
    $line = [int]$Matches[1]
    Show-ContextByLine -Raw $raw -Line1Based $line -Radius 6 -LogFile $logFile
  }
}

# 2) Node JSON.parse for npm-like "position N"
try {
  $nodeCmd = Get-Command node -ErrorAction Stop
  Write-Log $logFile ("INFO: node found: {0}" -f $nodeCmd.Source)

  # IMPORTANT: use .cjs so require() works even if repo root has "type":"module"
  $tmpCjs = Join-Path $workDir ("jsonparse-" + $ts + ".cjs")
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
    const start = Math.max(0, pos - 160);
    const end = Math.min(s.length, pos + 160);
    console.log('CONTEXT_START=' + start);
    console.log('CONTEXT_END=' + end);
    console.log(s.slice(start, end).replace(/\r/g,'').replace(/\n/g,'\\n'));
  }
  process.exit(1);
}
"@ | Set-Content -LiteralPath $tmpCjs -Encoding UTF8

  $out = & node $tmpCjs $funcPkg 2>&1
  foreach ($line in $out) { Write-Log $logFile ("NODE: " + $line) }

  $posLine = $out | Where-Object { $_ -match '^POS=\d+' } | Select-Object -First 1
  if ($posLine) {
    $pos = [int]($posLine -replace '^POS=','')
    Show-ContextByPos -Raw $raw -Pos $pos -Radius 220 -LogFile $logFile
  }
} catch {
  Write-Log $logFile ("WARN: Node JSON.parse check failed: {0}" -f $_.Exception.Message)
}

Write-Log $logFile "END"
Write-Host ""
Write-Host "Log written to: $logFile"
Write-Host "Backups in:     $bakDir"
'@

# Write new script (UTF8, no BOM)
Set-Content -LiteralPath $target -Value $newScript -Encoding UTF8
Write-Log $logFile "OK: Patched boots_diag_functions_pkgjson.ps1 -> PS51_COMPAT_V2"
Write-Log $logFile "END"

Write-Host "Patched OK."
Write-Host "Backup: $backupPath"
Write-Host "Log:    $logFile"
