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
  }
}
function Write-Utf8([string]$Path, [string]$Text) { New-Dir (Split-Path -Parent $Path); Set-Content -LiteralPath $Path -Value $Text -Encoding UTF8 }
function Read-Text([string]$Path) { Get-Content -LiteralPath $Path -Raw }

function Find-LatestDir([string]$Root, [string]$Pattern) {
  if (-not (Test-Path -LiteralPath $Root)) { return $null }
  $dirs = Get-ChildItem -LiteralPath $Root -Directory -Filter $Pattern -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
  if ($dirs.Count -gt 0) { return $dirs[0].FullName }
  return $null
}

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
        [void]$out.AppendLine($lines[$i])
        $i++
      }
      # skip to >>>>>>>
      while ($i -lt $lines.Length -and $lines[$i] -notlike ">>>>>>>*") { $i++ }
      if ($i -lt $lines.Length -and $lines[$i] -like ">>>>>>>*") { $i++ }
      continue
    }
    [void]$out.AppendLine($line)
    $i++
  }
  return $out.ToString()
}

# ---- Main ----
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd-HHmmss")
$bootDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $bootDir "logs"
$bakDir  = Join-Path $bootDir ("backup-" + $ts)
New-Dir $bootDir; New-Dir $logDir; New-Dir $bakDir

$logFile = Join-Path $logDir ("finish-login-restore-" + $ts + ".log")
Write-Log $logFile "START RepoRoot=$RepoRoot"

# Key paths
$routerPath = Join-Path $RepoRoot "src\router\AppRouter.jsx"
$pagesDir   = Join-Path $RepoRoot "src\pages"
$legacyDir  = Join-Path $pagesDir "_legacy_oldgit"
$loginPage  = Join-Path $pagesDir "LoginPage.jsx"
$dashPage   = Join-Path $pagesDir "DashboardPage.jsx"

$modAuthDir = Join-Path $RepoRoot "src\modules\auth\pages"
$modLogin   = Join-Path $modAuthDir "Login.jsx"

# Backups
Backup-File $routerPath $bakDir $logFile $RepoRoot
Backup-File $loginPage  $bakDir $logFile $RepoRoot
Backup-File $dashPage   $bakDir $logFile $RepoRoot
Backup-File $modLogin   $bakDir $logFile $RepoRoot

# 1) Fix merge conflicts if still present
if (Test-Path -LiteralPath $routerPath) {
  $routerText = Read-Text $routerPath
  if ($routerText -match "<<<<<<<") {
    $cnt = 0
    $fixed = Resolve-ConflictsPreferHead -Text $routerText -ResolvedCount ([ref]$cnt)
    Write-Utf8 $routerPath $fixed
    Write-Log $logFile ("PATCH: Resolved {0} conflict block(s) in src/router/AppRouter.jsx (prefer HEAD)" -f $cnt)
  } else {
    Write-Log $logFile "OK: No conflict markers in src/router/AppRouter.jsx"
  }
} else {
  Write-Log $logFile "WARN: src/router/AppRouter.jsx not found (skip)"
}

# 2) Copy legacy pages from latest oldrepo
$oldRepoDir = Find-LatestDir $bootDir "oldrepo-*"
if (-not $oldRepoDir) { throw "No _boot/oldrepo-* found. (Your previous clone created it; check _boot folder.)" }

$oldPagesDir = Join-Path $oldRepoDir "src\pages"
$oldLogin = Join-Path $oldPagesDir "LoginPage.jsx"
$oldDash  = Join-Path $oldPagesDir "DashboardPage.jsx"
if (-not (Test-Path -LiteralPath $oldLogin)) { throw "Old LoginPage.jsx not found: $oldLogin" }
if (-not (Test-Path -LiteralPath $oldDash))  { throw "Old DashboardPage.jsx not found: $oldDash" }

New-Dir $legacyDir
$legacyLogin = Join-Path $legacyDir "LoginLegacy.jsx"
$legacyDash  = Join-Path $legacyDir "DashboardLegacy.jsx"

Backup-File $legacyLogin $bakDir $logFile $RepoRoot
Backup-File $legacyDash  $bakDir $logFile $RepoRoot

Write-Utf8 $legacyLogin (Read-Text $oldLogin)
Write-Utf8 $legacyDash  (Read-Text $oldDash)
Write-Log $logFile "OK: Copied legacy Login/Dashboard into src/pages/_legacy_oldgit"

# 3) Write wrappers (pages)
Backup-File $loginPage $bakDir $logFile $RepoRoot
Backup-File $dashPage  $bakDir $logFile $RepoRoot

$loginWrapper = @"
import LoginLegacy from "./_legacy_oldgit/LoginLegacy";
export default function LoginPage(props) { return <LoginLegacy {...props} />; }
"@
$dashWrapper = @"
import DashboardLegacy from "./_legacy_oldgit/DashboardLegacy";
export default function DashboardPage(props) { return <DashboardLegacy {...props} />; }
"@
Write-Utf8 $loginPage $loginWrapper
Write-Utf8 $dashPage  $dashWrapper
Write-Log $logFile "OK: Wrote wrappers src/pages/LoginPage.jsx and src/pages/DashboardPage.jsx"

# 4) Ensure module alias used by router: "@/modules/auth/pages/Login"
New-Dir $modAuthDir
Backup-File $modLogin $bakDir $logFile $RepoRoot

$aliasLogin = @"
import LoginPage from "../../../pages/LoginPage";
export default LoginPage;
"@
Write-Utf8 $modLogin $aliasLogin
Write-Log $logFile "OK: Ensured alias src/modules/auth/pages/Login.jsx -> src/pages/LoginPage.jsx"

# 5) Patch font (FIXED: no Join-Path comma bug)
try {
  $cssTargets = @(
    (Join-Path $RepoRoot "src\index.css"),
    (Join-Path $RepoRoot "src\main.css"),
    (Join-Path $RepoRoot "src\App.css")
  )
  $css = $cssTargets | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if ($css) {
    Backup-File $css $bakDir $logFile $RepoRoot
    $cssText = Read-Text $css
    if ($cssText -notmatch "Noto Sans Thai") {
      $fontBlock = "@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;700&display=swap');`n:root{ font-family: 'Noto Sans Thai', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }`n`n"
      Write-Utf8 $css ($fontBlock + $cssText)
      Write-Log $logFile ("PATCH: Added Noto Sans Thai to {0}" -f $css)
    } else {
      Write-Log $logFile ("OK: Noto Sans Thai already present in {0}" -f $css)
    }
  } else {
    Write-Log $logFile "INFO: No global css found to patch font (skip)."
  }
} catch {
  Write-Log $logFile ("WARN: Font patch failed but non-blocking: {0}" -f $_.Exception.Message)
}

Write-Log $logFile "END"
Write-Host ""
Write-Host "DONE. Log: $logFile"
Write-Host "Backups: $bakDir"
Write-Host ("Old repo used: {0}" -f $oldRepoDir)
