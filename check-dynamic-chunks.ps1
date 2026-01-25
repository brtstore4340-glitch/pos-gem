# check-dynamic-chunks.ps1
# Vite + Firebase dynamic import / chunk checker (read-only)
# Safe ASCII only

$ErrorActionPreference = "Stop"

function Say($msg) { Write-Host $msg }
function Warn($msg) { Write-Warning $msg }
function Fail($msg) { Write-Host ("ERROR: " + $msg) -ForegroundColor Red }

Say "========================================"
Say " VITE + FIREBASE DYNAMIC CHUNK CHECKER"
Say "========================================"
Say ""

# 1) Locate firebase.json
Say "[1] Checking firebase.json ..."
if (-not (Test-Path -LiteralPath "firebase.json")) {
  Fail "firebase.json NOT FOUND"
  exit 1
}

$firebaseRaw = Get-Content -LiteralPath "firebase.json" -Raw
try {
  $firebase = $firebaseRaw | ConvertFrom-Json
} catch {
  Fail "firebase.json is not valid JSON"
  throw
}

# Support both hosting:{} and hosting:[{}]
$hostingObj = $null
if ($firebase.hosting -is [System.Array]) {
  if ($firebase.hosting.Count -gt 0) { $hostingObj = $firebase.hosting[0] }
} else {
  $hostingObj = $firebase.hosting
}

if (-not $hostingObj) {
  Fail "firebase.json does not contain hosting config"
  exit 1
}

$publicDir = $hostingObj.public
if (-not $publicDir) {
  Fail "hosting.public is missing in firebase.json"
  exit 1
}

Say ("OK hosting.public = " + $publicDir)

if (-not (Test-Path -LiteralPath $publicDir)) {
  Fail ("Hosting public directory does not exist: " + $publicDir)
} else {
  Say "OK Hosting directory exists"
}
Say ""

# 2) Check index.html
Say "[2] Checking index.html ..."
$indexPath = Join-Path -Path $publicDir -ChildPath "index.html"
if (-not (Test-Path -LiteralPath $indexPath)) {
  Fail ("index.html not found in: " + $publicDir)
} else {
  Say ("OK index.html found: " + $indexPath)
}
Say ""

# 3) Check assets folder
Say "[3] Checking assets folder ..."
$assetsPath = Join-Path -Path $publicDir -ChildPath "assets"
if (-not (Test-Path -LiteralPath $assetsPath)) {
  Fail ("assets folder not found: " + $assetsPath)
  exit 1
}

$assetFiles = Get-ChildItem -LiteralPath $assetsPath -File -ErrorAction SilentlyContinue
$assetCount = 0
if ($assetFiles) { $assetCount = $assetFiles.Count }
Say ("OK assets file count = " + $assetCount)
Say ""

# 4) Scan index.html for "/assets/*.js" references and verify they exist
Say "[4] Scanning index.html for asset references ..."
if (Test-Path -LiteralPath $indexPath) {
  $indexContent = Get-Content -LiteralPath $indexPath -Raw

  # find occurrences of /assets/<something>.js
  $pattern = "/assets/([A-Za-z0-9_\-\.]+\.js)"
  $all = [regex]::Matches($indexContent, $pattern)

  if ($all.Count -eq 0) {
    Warn "No /assets/*.js references found in index.html (is this a Vite build output?)"
  } else {
    Say ("Found references = " + $all.Count)
  }

  $missing = New-Object System.Collections.Generic.List[string]

  foreach ($m in $all) {
    $file = $m.Groups[1].Value
    $filePath = Join-Path -Path $assetsPath -ChildPath $file

    if (-not (Test-Path -LiteralPath $filePath)) {
      Fail ("MISSING asset referenced by index.html: " + $file)
      $missing.Add($file) | Out-Null
    } else {
      Say ("OK asset exists: " + $file)
    }
  }

  if ($missing.Count -eq 0 -and $all.Count -gt 0) {
    Say "OK All index.html asset references exist"
  }

  Say ""

  # 5) Look for chunk containing AdminSettingsPage
  $chunkName = "AdminSettingsPage"
  Say ("[5] Checking for chunk name contains: " + $chunkName)

  $chunkMatches = Get-ChildItem -LiteralPath $assetsPath -File -Filter ("*" + $chunkName + "*.js") -ErrorAction SilentlyContinue
  if (-not $chunkMatches -or $chunkMatches.Count -eq 0) {
    Warn ("No chunk file found matching: *" + $chunkName + "*.js")
  } else {
    foreach ($c in $chunkMatches) {
      Say ("OK Found chunk: " + $c.Name)
    }
  }

  Say ""
  Say "[6] Checking for Service Worker / PWA artifacts ..."

  $swCandidates = @(
    "service-worker.js",
    "sw.js",
    (Join-Path $publicDir "service-worker.js"),
    (Join-Path $publicDir "sw.js")
  )

  $foundSW = @()
  foreach ($p in $swCandidates) {
    if ($p -and (Test-Path -LiteralPath $p)) { $foundSW += $p }
  }

  if ($foundSW.Count -gt 0) {
    Warn "Service Worker files found (may cause stale cache):"
    foreach ($p in $foundSW) { Say (" - " + $p) }
  } else {
    Say "OK No service worker file found in common locations"
  }

  Say ""
  Say "========================================"
  Say " SUMMARY"
  Say "========================================"

  if ($missing.Count -gt 0) {
    Fail "FAIL: Some assets referenced by index.html are missing."
    Say "Likely causes: stale cached index.html or incomplete deploy output."
  } else {
    Say "OK Assets and index.html are internally consistent."
  }

  Say ""
  Say "NEXT STEPS (if crash persists):"
  Say "1) Ensure index.html Cache-Control is no-cache"
  Say "2) Clear browser cache and unregister service worker (if any)"
  Say "3) Rebuild then deploy hosting again"
  Say ""

} else {
  Fail "Cannot scan index.html because it does not exist."
  exit 1
}
