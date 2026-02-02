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
    $dest = Join-Path $BackupDir ($leaf + ".bak")
    Copy-Item -LiteralPath $Source -Destination $dest -Force
    Write-Log $LogFile "BACKUP: '$Source' -> '$dest'"
  } else {
    throw "Missing file to patch: $Source"
  }
}

# ---- Main ----
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")

$workDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $workDir "logs"
$bakDir  = Join-Path $workDir ("backup-" + $ts)
New-Dir $workDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("patch-restore-script-gitclone-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"
Write-Log $logFile ("INFO: PSVersion={0}" -f ($PSVersionTable.PSVersion.ToString()))

$target = Join-Path $RepoRoot "boots_restore_pages_and_add_announcement.ps1"
Backup-File $target $bakDir $logFile

$src = Get-Content -LiteralPath $target -Raw

if ($src -match "GIT_CLONE_SAFE_V1") {
  Write-Log $logFile "OK: Script already patched (GIT_CLONE_SAFE_V1). No changes."
  Write-Host "Already patched. Log: $logFile"
  exit 0
}

# Replace the git clone pipeline with a safe block:
# - uses --quiet (no progress spam)
# - temporarily sets ErrorActionPreference to Continue during clone
# - captures output and checks LASTEXITCODE
$pattern = '(?s)Write-Log \$logFile \("RUN: git clone.*?\)\s*& git clone --depth 1 --branch \$OldBranch \$OldRepoUrl \$oldDir 2>&1 \| ForEach-Object \{ Write-Log \$logFile \("GIT: " \+ \$_\) \}\s*if \(\$LASTEXITCODE -ne 0\) \{ throw "git clone failed\. See log: \$logFile" \}'

$replacement = @'
# GIT_CLONE_SAFE_V1
Write-Log $logFile ("RUN: git clone --depth 1 --branch {0} {1} {2}" -f $OldBranch, $OldRepoUrl, $oldDir)

if (Test-Path -LiteralPath $oldDir) {
  Write-Log $logFile ("SKIP: old repo dir already exists: {0}" -f $oldDir)
} else {
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    # --quiet prevents stderr progress from becoming a PowerShell NativeCommandError
    $cloneOut = & git clone --quiet --depth 1 --branch $OldBranch $OldRepoUrl $oldDir 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prevEap
  }

  foreach ($line in $cloneOut) { Write-Log $logFile ("GIT: " + $line) }

  if ($exitCode -ne 0) {
    throw ("git clone failed with exit code {0}. See log: {1}" -f $exitCode, $logFile)
  }
  if (-not (Test-Path -LiteralPath $oldDir)) {
    throw ("git clone reported success but folder missing: {0}" -f $oldDir)
  }
  Write-Log $logFile "OK: git clone completed"
}
'@

if ($src -notmatch $pattern) {
  Write-Log $logFile "FATAL: Could not find the expected git clone block to patch."
  Write-Log $logFile "HINT: Your restore script differs from expected. Paste lines ~80-110 of boots_restore_pages_and_add_announcement.ps1."
  throw "Patch failed (pattern not found)."
}

$patched = [regex]::Replace($src, $pattern, $replacement)

Set-Content -LiteralPath $target -Value $patched -Encoding UTF8
Write-Log $logFile "OK: Patched boots_restore_pages_and_add_announcement.ps1 (safe git clone)"
Write-Log $logFile "END"

Write-Host "Patched OK."
Write-Host "Log:     $logFile"
Write-Host "Backup:  $bakDir"
