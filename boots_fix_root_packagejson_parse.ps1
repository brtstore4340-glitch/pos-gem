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
      while ($i -lt $lines.Length -and $lines[$i] -notlike "=======") {
        [void]$out.AppendLine($lines[$i]); $i++
      }
      while ($i -lt $lines.Length -and $lines[$i] -notlike ">>>>>>>*") { $i++ }
      if ($i -lt $lines.Length -and $lines[$i] -like ">>>>>>>*") { $i++ }
      continue
    }
    [void]$out.AppendLine($line)
    $i++
  }
  return $out.ToString()
}

function Show-ContextByPos([string]$Raw, [int]$Pos, [int]$Radius, [string]$LogFile) {
  $start = [Math]::Max(0, $Pos - $Radius)
  $end = [Math]::Min($Raw.Length, $Pos + $Radius)
  $slice = $Raw.Substring($start, $end - $start)
  Write-Log $LogFile "---- Context (by char pos) ----"
  Write-Log $LogFile ("pos=$Pos start=$start end=$end")
  Write-Log $LogFile ($slice.Replace("`r","").Replace("`n","\n"))
  Write-Log $LogFile "--------------------------------"
}

# ---- Main ----
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")

$bootDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $bootDir "logs"
$bakDir  = Join-Path $bootDir ("backup-" + $ts)
New-Dir $bootDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("fix-root-packagejson-parse-" + $ts + ".log")
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

# 2) Try PowerShell JSON parse (gives line/pos sometimes)
$psOk = $false
try {
  $null = $raw | ConvertFrom-Json -ErrorAction Stop
  $psOk = $true
  Write-Log $logFile "OK: ConvertFrom-Json parsed package.json"
} catch {
  Write-Log $logFile "FAIL: ConvertFrom-Json failed"
  Write-Log $logFile ("MSG: {0}" -f $_.Exception.Message)
}

# 3) Node JSON.parse to get exact "position N" like npm/volta
try {
  $nodeCmd = Get-Command node -ErrorAction Stop
  Write-Log $logFile ("INFO: node={0}" -f $nodeCmd.Source)

  $tmp = Join-Path $bootDir ("jsonparse-" + $ts + ".cjs")
@"
const fs = require('fs');
const p = process.argv[2];
const s = fs.readFileSync(p,'utf8');
try { JSON.parse(s); console.log('OK'); }
catch(e){
  console.log('FAIL');
  console.log(String(e.message));
  const m=/position (\d+)/.exec(String(e.message));
  if(m){ console.log('POS=' + m[1]); }
  process.exit(1);
}
"@ | Set-Content -LiteralPath $tmp -Encoding UTF8

  $out = & node $tmp $pkgPath 2>&1
  foreach ($l in $out) { Write-Log $logFile ("NODE: " + $l) }

  $posLine = $out | Where-Object { $_ -match '^POS=\d+' } | Select-Object -First 1
  if ($posLine) {
    $pos = [int]($posLine -replace '^POS=','')
    Show-ContextByPos -Raw $raw -Pos $pos -Radius 220 -LogFile $logFile
  }

  if ($LASTEXITCODE -ne 0) {
    Write-Log $logFile "FATAL: package.json still invalid JSON after conflict fix."
    Write-Log $logFile "ACTION: Copy the context block above and paste it in chat (or upload package.json)."
    throw "package.json invalid JSON"
  }
} catch {
  Write-Log $logFile ("FATAL: Node parse check failed: {0}" -f $_.Exception.Message)
  throw
}

Write-Log $logFile "END"
Write-Host ""
Write-Host "OK: package.json parses now."
Write-Host "Log: $logFile"
Write-Host "Backups: $bakDir"
