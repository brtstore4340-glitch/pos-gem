Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

trap {
  Write-Host "[FATAL] $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

function New-DirSafe([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path -Force | Out-Null }
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $enc)
}

function Backup-File([string]$FilePath, [string]$BackupDir) {
  if (-not (Test-Path -LiteralPath $FilePath)) { return }
  $leaf = Split-Path -Leaf $FilePath
  Copy-Item -LiteralPath $FilePath -Destination (Join-Path $BackupDir $leaf) -Force
}

param(
  [string]$RepoPath = ""
)

if ([string]::IsNullOrWhiteSpace($RepoPath)) {
  $RepoPath = (Get-Location).Path
}

if (-not (Test-Path -LiteralPath $RepoPath)) {
  throw "RepoPath not found: $RepoPath"
}

$toolsDir = Join-Path $RepoPath "tools"
$logsDir  = Join-Path $toolsDir "logs"
New-DirSafe $toolsDir
New-DirSafe $logsDir

$ts = (Get-Date).ToString("yyyyMMdd_HHmmss")
$logPath = Join-Path $logsDir "fix_appcheck_find_$ts.log"
$backupDir = Join-Path $toolsDir ("backup_fix_appcheck_find_" + $ts)
New-DirSafe $backupDir

Write-Utf8NoBom -Path (Join-Path $toolsDir "LAST_BACKUP_DIR.txt") -Content ($backupDir + "`n")

Add-Content -LiteralPath $logPath -Value "[INFO] RepoPath: $RepoPath"
Add-Content -LiteralPath $logPath -Value "[INFO] BackupDir: $backupDir"

# backup env files
Get-ChildItem -LiteralPath $RepoPath -Force -File -Filter ".env*" -ErrorAction SilentlyContinue | ForEach-Object {
  Backup-File -FilePath $_.FullName -BackupDir $backupDir
  Add-Content -LiteralPath $logPath -Value "[INFO] Backed up: $($_.Name)"
}

$pattern = "VITE_ENABLE_APPCHECK|App Check is disabled"

Add-Content -LiteralPath $logPath -Value "[INFO] Pattern: $pattern"
Add-Content -LiteralPath $logPath -Value "[INFO] Searching (Select-String)..."

$files = Get-ChildItem -LiteralPath $RepoPath -Recurse -File -Force |
  Where-Object {
    $_.FullName -notmatch "\\node_modules\\" -and
    $_.FullName -notmatch "\\\.git\\" -and
    $_.FullName -notmatch "\\dist\\" -and
    $_.FullName -notmatch "\\build\\" -and
    $_.FullName -notmatch "\\\.firebase\\" -and
    $_.FullName -notmatch "\\\.vite\\" -and
    $_.FullName -notmatch "\\tools\\backup_" -and
    $_.FullName -notmatch "\\tools\\logs\\"
  }

$hits = @()
foreach ($f in $files) {
  try {
    $m = Select-String -LiteralPath $f.FullName -Pattern $pattern -CaseSensitive:$false -ErrorAction SilentlyContinue
    if ($m) { $hits += $m }
  } catch { }
}

if ($hits.Count -gt 0) {
  Add-Content -LiteralPath $logPath -Value "[HITS-BEGIN]"
  foreach ($h in $hits) {
    Add-Content -LiteralPath $logPath -Value ("{0}:{1}:{2}" -f $h.Path, $h.LineNumber, $h.Line.Trim())
  }
  Add-Content -LiteralPath $logPath -Value "[HITS-END]"
  Add-Content -LiteralPath $logPath -Value "[PASS] Found $($hits.Count) hit(s)."
} else {
  Add-Content -LiteralPath $logPath -Value "[WARN] No matches found."
}

Add-Content -LiteralPath $logPath -Value "[DONE] ExitCode=0"
Write-Host "[OK] Done. Log: $logPath"
exit 0
