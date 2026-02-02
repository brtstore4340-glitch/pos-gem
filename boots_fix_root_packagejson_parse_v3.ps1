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
function Backup-File([string]$Source, [string]$BackupDir, [string]$LogFile, [string]$RepoRootForRel) {
  if (Test-Path -LiteralPath $Source) {
    $rel = $Source.Replace($RepoRootForRel, "").TrimStart("\","/")
    $safe = ($rel -replace '[\\/:*?"<>|]', '_')
    $dest = Join-Path $BackupDir ($safe + ".bak")
    Copy-Item -LiteralPath $Source -Destination $dest -Force
    Write-Log $LogFile "BACKUP: '$Source' -> '$dest'"
  } else {
    throw "Missing file: $Source"
  }
}
function Read-Text([string]$Path) { Get-Content -LiteralPath $Path -Raw }
function Write-Utf8([string]$Path, [string]$Text) { Set-Content -LiteralPath $Path -Value $Text -Encoding UTF8 }

function Resolve-ConflictsPreferHead([string]$Text, [ref]$ResolvedCount) {
  $out = New-Object System.Text.StringBuilder
  $lines = $Text -split "`r?`n",-1
  $i = 0
  while ($i -lt $lines.Length) {
    $line = $lines[$i]
    if ($line -like "<<<<<<<*") {
      $ResolvedCount.Value++
      $i++
      while ($i -lt $lines.Length -and $lines[$i] -notlike "=======") { [void]$out.AppendLine($lines[$i]); $i++ }
      while ($i -lt $lines.Length -and $lines[$i] -notlike ">>>>>>>*") { $i++ }
      if ($i -lt $lines.Length -and $lines[$i] -like ">>>>>>>*") { $i++ }
      continue
    }
    [void]$out.AppendLine($line)
    $i++
  }
  return $out.ToString()
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

<<<<<<< HEAD
function Convert-LinePosFromPsError([string]$Msg, [ref]$Line, [ref]$Pos) {
=======
function Convert-LinePosFromPsError([string]$Msg, [ref]$Line, [ref]$Pos) {
>>>>>>> main
  # common: "line 12, position 34"
  if ($Msg -match 'line\s+(\d+),\s*position\s+(\d+)') {
    $Line.Value = [int]$Matches[1]
    $Pos.Value = [int]$Matches[2]
    return $true
  }
  return $false
}

# ---- Main ----
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
$bootDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $bootDir "logs"
$bakDir  = Join-Path $bootDir ("backup-" + $ts)
New-Dir $bootDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("fix-root-packagejson-v3-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"

$pkgPath = Join-Path $RepoRoot "package.json"
Backup-File $pkgPath $bakDir $logFile $RepoRoot

$raw = Read-Text $pkgPath
Write-Log $logFile ("INFO: package.json length={0} chars" -f $raw.Length)

# 1) Auto-fix merge conflict markers if present
if ($raw -match "<<<<<<<" -or $raw -match ">>>>>>>" -or $raw -match "=======") {
  $cnt = 0
  $fixed = Resolve-ConflictsPreferHead -Text $raw -ResolvedCount ([ref]$cnt)
  Write-Utf8 $pkgPath $fixed
  Write-Log $logFile ("PATCH: Resolved {0} conflict block(s) in package.json (prefer HEAD)" -f $cnt)
  $raw = $fixed
}

# 2) Try PowerShell JSON parse (no node)
try {
  $null = $raw | ConvertFrom-Json -ErrorAction Stop
  Write-Log $logFile "OK: ConvertFrom-Json parsed package.json"
  Write-Log $logFile "END"
  Write-Host ""
  Write-Host "OK: package.json parses now."
  Write-Host "Log: $logFile"
  Write-Host "Backups: $bakDir"
  exit 0
} catch {
  Write-Log $logFile "FAIL: ConvertFrom-Json failed"
  $msg = $_.Exception.Message
  Write-Log $logFile ("MSG: {0}" -f $msg)

  $line = 0; $pos = 0
  if (Try-Parse-LinePosFromPsError -Msg $msg -Line ([ref]$line) -Pos ([ref]$pos)) {
    Write-Log $logFile ("INFO: Parsed location line={0} position={1}" -f $line, $pos)
    Show-ContextByLine -Raw $raw -Line1Based $line -Radius 8 -LogFile $logFile
  } else {
    Write-Log $logFile "INFO: Could not extract line/position from PowerShell error."
  }
}

# 3) Optional: use python for precise JSONDecodeError line/col (does NOT use volta)
try {
  $py = Get-Command python -ErrorAction Stop
  Write-Log $logFile ("INFO: python={0}" -f $py.Source)

  $tmpPy = Join-Path $bootDir ("jsondiag-" + $ts + ".py")
@"
import json, sys
p = sys.argv[1]
raw = open(p, 'rb').read()
try:
  s = raw.decode('utf-8-sig')
except Exception:
  s = raw.decode('utf-8', errors='replace')

try:
  json.loads(s)
  print("PY_OK")
except json.JSONDecodeError as e:
  print("PY_FAIL")
  print(f"LINE={e.lineno}")
  print(f"COL={e.colno}")
  print(f"POS={e.pos}")
  print(f"MSG={e.msg}")
"@ | Set-Content -LiteralPath $tmpPy -Encoding UTF8

  $out = & python $tmpPy $pkgPath 2>&1
  foreach ($l in $out) { Write-Log $logFile ("PY: " + $l) }

  $lineLine = $out | Where-Object { $_ -match '^LINE=\d+' } | Select-Object -First 1
  if ($lineLine) {
    $line = [int]($lineLine -replace '^LINE=','')
    Show-ContextByLine -Raw $raw -Line1Based $line -Radius 8 -LogFile $logFile
  }

} catch {
  Write-Log $logFile ("WARN: python not available or failed: {0}" -f $_.Exception.Message)
}

Write-Log $logFile "FATAL: package.json still invalid JSON."
Write-Log $logFile "ACTION: Paste the 'Context' block(s) from this log into chat OR upload package.json."
Write-Log $logFile "END"

throw "package.json invalid JSON (see log for exact context)"
