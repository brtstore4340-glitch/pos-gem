param(
  [string]$Root = "",
  [switch]$Apply,
  [switch]$DeployAll,
  [switch]$ValidateBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-OK([string]$m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Write-INFO([string]$m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-WARN([string]$m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-FAIL([string]$m){ Write-Host "[FAIL] $m" -ForegroundColor Red }

function Find-RepoRoot([string]$start) {
  $p = if ($start) { (Resolve-Path -LiteralPath $start).Path } else { (Get-Location).Path }
  $cur = $p
  while ($true) {
    if (Test-Path -LiteralPath (Join-Path $cur "firebase.json")) { return $cur }
    if (Test-Path -LiteralPath (Join-Path $cur "package.json")) { return $cur }
    $parent = Split-Path -Parent $cur
    if ([string]::IsNullOrWhiteSpace($parent) -or ($parent -eq $cur)) { return $p }
    $cur = $parent
  }
}

function Backup-File([string]$path) {
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $bak = "$path.bak_$ts"
  Copy-Item -LiteralPath $path -Destination $bak -Force
  return $bak
}

function Read-Text([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return "" }
  return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}

function Write-Text([string]$path, [string]$content) {
  $dir = Split-Path -Parent $path
  if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
}

function Get-FirebaseProjectId([string]$repo) {
  $rc = Join-Path $repo ".firebaserc"
  if (Test-Path -LiteralPath $rc) {
    try {
      $j = (Read-Text $rc) | ConvertFrom-Json
      if ($j.projects) {
        if ($j.projects.default) { return [string]$j.projects.default }
        $first = $j.projects.PSObject.Properties | Select-Object -First 1
        if ($first) { return [string]$first.Value }
      }
    } catch {}
  }
  return ""
}

function Get-RulesPaths([string]$repo) {
  $firebaseJsonPath = Join-Path $repo "firebase.json"
  $firestoreRules = Join-Path $repo "firestore.rules"
  $storageRules   = Join-Path $repo "storage.rules"

  if (Test-Path -LiteralPath $firebaseJsonPath) {
    try {
      $cfg = (Read-Text $firebaseJsonPath) | ConvertFrom-Json
      if ($cfg.firestore -and $cfg.firestore.rules) { $firestoreRules = Join-Path $repo $cfg.firestore.rules }
      if ($cfg.storage -and $cfg.storage.rules) { $storageRules = Join-Path $repo $cfg.storage.rules }
    } catch {}
  }

  return @{ firestore=$firestoreRules; storage=$storageRules; firebaseJson=$firebaseJsonPath }
}

function Find-FileByNames([string]$base, [string[]]$names) {
  foreach ($n in $names) {
    $hit = Get-ChildItem -LiteralPath $base -Recurse -File -Force -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -ieq $n } | Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }
  return ""
}

function Replace-FirstMatch([string]$text, [string]$pattern, [string]$replacement) {
  $rx = [regex]::new($pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $m = $rx.Match($text)
  if (-not $m.Success) { return $text }
  return $rx.Replace($text, $replacement, 1)
}

function Patch-LoginFlushTop([string]$loginPath) {
  $t0 = Read-Text $loginPath
  if (-not $t0) { return @{Changed=$false; Reason="Login file empty/not found."} }

  $today = (Get-Date).ToString("yyyy-MM-dd")
  $t = $t0

  # Version + Date
  $t = [regex]::Replace($t, '(?m)^\s*const\s+version\s*=\s*["''][^"'']+["'']\s*;\s*$', "  const version = `"2.0.0`";")
  $t = [regex]::Replace($t, '(?m)^\s*const\s+patchDate\s*=\s*["'']\d{4}-\d{2}-\d{2}["'']\s*;\s*$', "  const patchDate = `"$today`";")
  $t = $t.Replace("Patch:", "Data update:")
  $t = $t.Replace("v2.1.4", "2.0.0").Replace("2.1.4", "2.0.0")

  # Force outer wrapper flush-top: first p-* -> p-0
  $t2 = Replace-FirstMatch $t '(<div\s+className="[^"]*)(?<!\S)p-(\d+)(?!\S)([^"]*")' '$1p-0$3'

  if ($t2 -ne $t0) {
    $bak = Backup-File $loginPath
    Write-Text $loginPath $t2
    return @{Changed=$true; Reason="Login flush-top + version/date updated. Backup=$bak"}
  }
  return @{Changed=$false; Reason="No outer padding token found on first wrapper."}
}

function Patch-AppNavbarNoVerticalPadding([string]$appPath) {
  $t0 = Read-Text $appPath
  if (-not $t0) { return @{Changed=$false; Reason="App file empty/not found."} }

  $lines = $t0 -split "`r?`n"
  $changed = $false

  function StripNavPad([string]$line) {
    $m = [regex]::Match($line, 'className\s*=\s*"(?<cls>[^"]+)"')
    if (-not $m.Success) { return $line }
    $cls = $m.Groups["cls"].Value
    $newCls = [regex]::Replace($cls, "(?<!\S)(py-\d+|pt-\d+|pb-\d+)(?!\S)", "")
    $newCls = [regex]::Replace($newCls, "\s{2,}", " ").Trim()
    if ($newCls -eq $cls) { return $line }
    return $line.Replace($cls, $newCls)
  }

  for ($i=0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "(?i)<nav\b" -and $lines[$i] -match "className") {
      $nl = StripNavPad $lines[$i]
      if ($nl -ne $lines[$i]) { $lines[$i] = $nl; $changed = $true; break }
    }
  }

  if (-not $changed) {
    for ($i=0; $i -lt $lines.Count; $i++) {
      if ($lines[$i] -match "(?i)nav(bar|igation)?" -and $lines[$i] -match "className") {
        $nl = StripNavPad $lines[$i]
        if ($nl -ne $lines[$i]) { $lines[$i] = $nl; $changed = $true; break }
      }
    }
  }

  $t2 = ($lines -join "`r`n")
  $t2 = $t2.Replace("v2.1.4", "2.0.0").Replace("2.1.4", "2.0.0")

  if ($t2 -ne $t0) {
    $bak = Backup-File $appPath
    Write-Text $appPath $t2
    return @{Changed=$true; Reason="Removed navbar vertical padding + version. Backup=$bak"}
  }
  return @{Changed=$false; Reason="No navbar padding tokens matched (maybe cn()/template string)."}
}

function Write-OpenFirestoreRules([string]$path) {
  $bak = $null
  if (Test-Path -LiteralPath $path) { $bak = Backup-File $path }

  $content = @"
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }

    // TEMP OPEN (signed-in) to unblock: products stats + upload writes
    match /products/{doc} {
      allow read: if signedIn();
      allow create, update, delete: if signedIn();
    }

    match /uploads/{doc} {
      allow read, create, update, delete: if signedIn();
    }

    match /masterData/{doc} {
      allow read, create, update, delete: if signedIn();
    }

    // Default deny
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
"@

  Write-Text $path $content
  if ($bak) { Write-INFO "Firestore rules backup: $bak" }
  Write-OK "Wrote Firestore rules: $path"
}

function Write-OpenStorageRules([string]$path) {
  $bak = $null
  if (Test-Path -LiteralPath $path) { $bak = Backup-File $path }

  $content = @"
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function signedIn() { return request.auth != null; }

    // TEMP OPEN (signed-in) to unblock file uploads
    match /{allPaths=**} {
      allow read: if signedIn();
      allow write: if signedIn();
    }
  }
}
"@

  Write-Text $path $content
  if ($bak) { Write-INFO "Storage rules backup: $bak" }
  Write-OK "Wrote Storage rules: $path"
}

# -------------------------
# MAIN
# -------------------------
$Repo = Find-RepoRoot $Root
Set-Location -LiteralPath $Repo

$ProjectId = Get-FirebaseProjectId $Repo
Write-INFO "Repo: $Repo"
if ($ProjectId) {
  Write-INFO "Firebase project (from .firebaserc): $ProjectId"
  if ($ProjectId -ne "boots-4340-project") {
    Write-WARN "ProjectId is NOT boots-4340-project. You may be deploying to the wrong project."
  }
} else {
  Write-WARN "No .firebaserc project detected."
}

if (-not $Apply) {
  Write-Host "`nRun:" -ForegroundColor Yellow
  Write-Host "  .\fix-now.ps1 -Apply -DeployAll -ValidateBuild" -ForegroundColor Cyan
  exit 0
}

$src = Join-Path $Repo "src"
if (-not (Test-Path -LiteralPath $src)) { throw "src/ not found. Wrong folder?" }

$loginPath = Find-FileByNames $src @("Login.jsx","LoginPage.jsx")
if (-not $loginPath) { $loginPath = Join-Path $Repo "src\pages\Login.jsx" }

$appPath = Find-FileByNames $src @("App.jsx","App.tsx")
if (-not $appPath) { throw "App.jsx/App.tsx not found under src/." }

Write-INFO "Login candidate: $loginPath"
Write-INFO "App candidate:   $appPath"

Write-Host "`n=== APPLY UI PATCHES ===" -ForegroundColor Yellow
$r1 = Patch-LoginFlushTop $loginPath
if ($r1.Changed) { Write-OK $r1.Reason } else { Write-WARN $r1.Reason }

$r2 = Patch-AppNavbarNoVerticalPadding $appPath
if ($r2.Changed) { Write-OK $r2.Reason } else { Write-WARN $r2.Reason }

Write-Host "`n=== APPLY RULES (UPLOAD PERMISSION) ===" -ForegroundColor Yellow
$paths = Get-RulesPaths $Repo
Write-INFO "Firestore rules path: $($paths.firestore)"
Write-INFO "Storage rules path:   $($paths.storage)"
Write-OpenFirestoreRules $paths.firestore
Write-OpenStorageRules $paths.storage

if ($ValidateBuild) {
  Write-Host "`n=== BUILD ===" -ForegroundColor Yellow
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed." }
  Write-OK "Build passed."
}

if ($DeployAll) {
  Write-Host "`n=== DEPLOY (rules + hosting) ===" -ForegroundColor Yellow

  try { & firebase --version | Out-Null } catch { throw "firebase CLI not found in PATH." }

  try { & firebase use } catch {}

  & firebase deploy --only firestore:rules,storage
  if ($LASTEXITCODE -ne 0) { throw "firebase deploy rules failed." }
  Write-OK "Deployed Firestore+Storage rules."

  & firebase deploy --only hosting
  if ($LASTEXITCODE -ne 0) { throw "firebase deploy hosting failed." }
  Write-OK "Deployed hosting."
}

Write-Host "`n=== IF STILL NO CHANGE (VERY IMPORTANT) ===" -ForegroundColor Yellow
Write-Host "1) CLEAR CACHE / SERVICE WORKER:" -ForegroundColor Cyan
Write-Host "   Chrome DevTools > Application > Service Workers: Unregister" -ForegroundColor Cyan
Write-Host "   Chrome DevTools > Application > Storage: Clear site data" -ForegroundColor Cyan
Write-Host "   Then Ctrl+Shift+R" -ForegroundColor Cyan

Write-Host "`n2) APP CHECK (your logs show 400/throttled):" -ForegroundColor Cyan
Write-Host "   If App Check ENFORCEMENT is ON for Firestore/Storage => uploads will FAIL even with rules." -ForegroundColor Cyan
Write-Host "   Firebase Console > App Check > Firestore: Enforcement OFF" -ForegroundColor Cyan
Write-Host "   Firebase Console > App Check > Storage : Enforcement OFF" -ForegroundColor Cyan