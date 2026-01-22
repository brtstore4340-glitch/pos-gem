# tools/fix-firebase-functions-sdk.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

trap {
  try {
    Write-Host "[FAIL] $($_.Exception.Message)" -ForegroundColor Red
  } catch {}
  exit 1
}

function New-Dir([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { throw "New-Dir: empty path" }
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $enc)
}

function Write-Log([string]$Message, [ValidateSet("INFO","WARN","PASS","FAIL")] [string]$Level = "INFO") {
  $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
  $line = "[$ts][$Level] $Message"
  Add-Content -LiteralPath $script:LogFile -Value $line -Encoding UTF8
  $color = switch ($Level) {
    "INFO" { "Cyan" }
    "WARN" { "Yellow" }
    "PASS" { "Green" }
    "FAIL" { "Red" }
    default { "Gray" }
  }
  Write-Host $line -ForegroundColor $color
}

function Exec([string]$FilePath, [string[]]$Args, [string]$WorkDir) {
  if (-not (Test-Path -LiteralPath $WorkDir)) { throw "Working directory not found: $WorkDir" }
  Write-Log "RUN: $FilePath $($Args -join ' ')" "INFO"
  $p = Start-Process -FilePath $FilePath -ArgumentList $Args -WorkingDirectory $WorkDir -NoNewWindow -PassThru -Wait
  $code = $p.ExitCode
  if ($code -ne 0) {
    Write-Log "EXIT CODE: $code (FAIL) => $FilePath" "FAIL"
    throw "Command failed: $FilePath (exit $code)"
  }
  Write-Log "EXIT CODE: $code (PASS) => $FilePath" "PASS"
}

function Try-Exec([string]$FilePath, [string[]]$Args, [string]$WorkDir) {
  try {
    Exec -FilePath $FilePath -Args $Args -WorkDir $WorkDir
    return $true
  } catch {
    Write-Log "Non-fatal command error: $($_.Exception.Message)" "WARN"
    return $false
  }
}

function Find-RepoRoot([string]$StartDir) {
  $d = (Resolve-Path -LiteralPath $StartDir).Path
  while ($true) {
    if (Test-Path -LiteralPath (Join-Path $d ".git")) { return $d }
    if (Test-Path -LiteralPath (Join-Path $d "firebase.json")) { return $d }
    $parent = Split-Path -Path $d -Parent
    if ($parent -eq $d -or [string]::IsNullOrWhiteSpace($parent)) { break }
    $d = $parent
  }
  return (Resolve-Path -LiteralPath $StartDir).Path
}

function Copy-Dir([string]$Src, [string]$Dst) {
  New-Dir $Dst
  Copy-Item -LiteralPath (Join-Path $Src "*") -Destination $Dst -Recurse -Force -ErrorAction Stop
}

function Backup-Path([string]$RepoRoot, [string]$PathToBackup, [string]$BackupDir) {
  $full = Join-Path $RepoRoot $PathToBackup
  if (-not (Test-Path -LiteralPath $full)) {
    Write-Log "Skip backup (not found): $PathToBackup" "WARN"
    return
  }
  $dst = Join-Path $BackupDir ($PathToBackup -replace '[\\/:*?"<>|]', "_")
  if ((Get-Item -LiteralPath $full).PSIsContainer) {
    Write-Log "Backup DIR: $PathToBackup -> $dst" "INFO"
    Copy-Dir -Src $full -Dst $dst
  } else {
    New-Dir (Split-Path -Path $dst -Parent)
    Write-Log "Backup FILE: $PathToBackup -> $dst" "INFO"
    Copy-Item -LiteralPath $full -Destination $dst -Force -ErrorAction Stop
  }
}

# -------------------- MAIN --------------------
$here = Get-Location
$repoRoot = Find-RepoRoot -StartDir $here.Path

$toolsDir = Join-Path $repoRoot "tools"
$logsDir  = Join-Path $toolsDir "logs"
New-Dir $toolsDir
New-Dir $logsDir

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$script:LogFile = Join-Path $logsDir "fix_firebase_functions_sdk_$stamp.log"

Write-Log "RepoRoot: $repoRoot" "INFO"
Write-Log "LogFile:  $script:LogFile" "INFO"

$functionsDir = Join-Path $repoRoot "functions"
if (-not (Test-Path -LiteralPath $functionsDir)) {
  throw "Missing functions folder: $functionsDir"
}

# Backup
$backupDir = Join-Path $toolsDir ("backup_functions_sdk_" + $stamp)
New-Dir $backupDir
Write-Utf8NoBom -Path (Join-Path $toolsDir "LAST_BACKUP_DIR.txt") -Content $backupDir

Backup-Path -RepoRoot $repoRoot -PathToBackup "functions" -BackupDir $backupDir
Backup-Path -RepoRoot $repoRoot -PathToBackup "package-lock.json" -BackupDir $backupDir
Backup-Path -RepoRoot $repoRoot -PathToBackup "pnpm-lock.yaml" -BackupDir $backupDir
Backup-Path -RepoRoot $repoRoot -PathToBackup "yarn.lock" -BackupDir $backupDir
Backup-Path -RepoRoot $repoRoot -PathToBackup "firebase.json" -BackupDir $backupDir
Backup-Path -RepoRoot $repoRoot -PathToBackup ".firebaserc" -Backup
