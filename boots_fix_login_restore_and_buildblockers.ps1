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
    $rel = $Source.Replace($RepoRoot, "").TrimStart("\","/")
    $safe = ($rel -replace '[\\/:*?"<>|]', '_')
    $dest = Join-Path $BackupDir ($safe + ".bak")
    Copy-Item -LiteralPath $Source -Destination $dest -Force
    Write-Log $LogFile "BACKUP: '$Source' -> '$dest'"
  }
}
function Write-Utf8([string]$Path, [string]$Text) {
  New-Dir (Split-Path -Parent $Path)
  Set-Content -LiteralPath $Path -Value $Text -Encoding UTF8
}
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
      # collect HEAD until =======
      $i++
      while ($i -lt $lines.Length -and $lines[$i] -notlike "=======") {
        [void]$out.AppendLine($lines[$i])
        $i++
      }
      # skip "=======" line
      while ($i -lt $lines.Length -and $lines[$i] -notlike ">>>>>>>*") { $i++ }
      # skip ">>>>>>>" line
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
$logFile = Join-Path $logDir ("fix-login-restore-build-" + $ts + ".log")

Write-Log $logFile "START RepoRoot=$RepoRoot"

# Paths
$routerPath = Join-Path $RepoRoot "src\router\AppRouter.jsx"
$pagesDir   = Join-Path $RepoRoot "src\pages"
$legacyDir  = Join-Path $pagesDir "_legacy_oldgit"

$loginPage  = Join-Path $pagesDir "LoginPage.jsx"
$dashPage   = Join-Path $pagesDir "DashboardPage.jsx"
$pinPage    = Join-Path $pagesDir "PinPage.jsx"

$modAuthDir = Join-Path $RepoRoot "src\modules\auth\pages"
$modLogin   = Join-Path $modAuthDir "Login.jsx"
$modPin     = Join-Path $modAuthDir "Pin.jsx"

# Backups
Backup-File $routerPath $bakDir $logFile
Backup-File $loginPage  $bakDir $logFile
Backup-File $dashPage   $bakDir $logFile
Backup-File $pinPage    $bakDir $logFile
Backup-File $modLogin   $bakDir $logFile
Backup-File $modPin     $bakDir $logFile

# 1) Fix merge conflict markers in AppRouter.jsx (prefer HEAD)
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
  Write-Log $logFile "WARN: src/router/AppRouter.jsx not found (skip conflict fix)"
}

# 2) Restore old pages from latest cloned oldrepo in _boot
$oldRepoDir = Find-LatestDir $bootDir "oldrepo-*"
if (-not $oldRepoDir) {
  Write-Log $logFile "FATAL: No _boot/oldrepo-* found. Run your clone script first (it already worked before)."
  throw "Missing oldrepo directory"
}

$oldPagesDir = Join-Path $oldRepoDir "src\pages"
if (-not (Test-Path -LiteralPath $oldPagesDir)) { throw "Old repo pages not found: $oldPagesDir" }

$oldLogin = Join-Path $oldPagesDir "LoginPage.jsx"
$oldDash  = Join-Path $oldPagesDir "DashboardPage.jsx"

if (-not (Test-Path -LiteralPath $oldLogin)) { throw "Old LoginPage.jsx not found: $oldLogin" }
if (-not (Test-Path -LiteralPath $oldDash))  { throw "Old DashboardPage.jsx not found: $oldDash" }

New-Dir $legacyDir
$legacyLogin = Join-Path $legacyDir "LoginLegacy.jsx"
$legacyDash  = Join-Path $legacyDir "DashboardLegacy.jsx"

Write-Utf8 $legacyLogin (Read-Text $oldLogin)
Write-Utf8 $legacyDash  (Read-Text $oldDash)
Write-Log $logFile ("OK: Copied old Login/Dashboard to {0}" -f $legacyDir)

# Optional pin: find any *Pin*.jsx in old repo
$oldPin = Get-ChildItem -LiteralPath $oldPagesDir -File -Filter "*Pin*.jsx" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($oldPin) {
  $legacyPin = Join-Path $legacyDir "PinLegacy.jsx"
  Write-Utf8 $legacyPin (Read-Text $oldPin.FullName)
  Write-Log $logFile ("OK: Copied old pin page: {0}" -f $oldPin.Name)

  $pinWrapper = @"
import PinLegacy from "./_legacy_oldgit/PinLegacy";
export default function PinPage(props) { return <PinLegacy {...props} />; }
"@
  Write-Utf8 $pinPage $pinWrapper
} else {
  Write-Log $logFile "WARN: No old pin page found in old repo (skipping Pin restore)."
}

# 3) Write wrappers (pages)
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

# 4) Create module aliases so router import works: "@/modules/auth/pages/Login"
New-Dir $modAuthDir
$aliasLogin = @"
import LoginPage from "../../../pages/LoginPage";
export default LoginPage;
"@
Write-Utf8 $modLogin $aliasLogin
Write-Log $logFile "OK: Wrote alias src/modules/auth/pages/Login.jsx -> src/pages/LoginPage.jsx"

if (Test-Path -LiteralPath $pinPage) {
  $aliasPin = @"
import PinPage from "../../../pages/PinPage";
export default PinPage;
"@
  Write-Utf8 $modPin $aliasPin
  Write-Log $logFile "OK: Wrote alias src/modules/auth/pages/Pin.jsx -> src/pages/PinPage.jsx"
}

# 5) Optional: add Noto Sans Thai import if a global css exists (prevents ugly Thai rendering)
$cssTargets = @(
  Join-Path $RepoRoot "src\index.css",
  Join-Path $RepoRoot "src\main.css",
  Join-Path $RepoRoot "src\App.css"
)
$css = $cssTargets | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if ($css) {
  Backup-File $css $bakDir $logFile
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

Write-Log $logFile "END"
Write-Host ""
Write-Host "DONE. Log: $logFile"
Write-Host "Backups: $bakDir"
Write-Host ("Old repo used: {0}" -f $oldRepoDir)
