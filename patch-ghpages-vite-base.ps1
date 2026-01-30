# patch-ghpages-vite-base.ps1
# Purpose: Fix GitHub Pages subpath deploy for Vite by setting base="/pos-gem/" (or derived from repo folder)
# Safety: creates timestamped backups; deterministic logging

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-Stamp() { Get-Date -Format "yyyyMMdd_HHmmss" }
function Log([string]$msg) { Write-Host ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $msg) }

$root = (Get-Location).Path
$stamp = New-Stamp
$logPath = Join-Path $root ("patch-log_{0}.txt" -f $stamp)

Start-Transcript -Path $logPath | Out-Null
try {
  Log "Repo root: $root"

  $viteConfig = Join-Path $root "vite.config.js"
  $pkgJson    = Join-Path $root "package.json"

  if (!(Test-Path $viteConfig)) { throw "Missing vite.config.js at repo root. Cannot patch safely." }
  if (!(Test-Path $pkgJson))    { throw "Missing package.json at repo root. Cannot patch safely." }

  # Heuristic: GitHub Pages project site usually "/<repo-name>/"
  $repoName = Split-Path $root -Leaf
  $expectedBase = "/$repoName/"
  # User repo is pos-gem; keep deterministic even if folder name differs
  if ($repoName -ne "pos-gem") {
    Log "Note: folder name '$repoName' != 'pos-gem'. Using base '$expectedBase'. If repo name is pos-gem, run script from that folder."
  } else {
    $expectedBase = "/pos-gem/"
  }

  # Backups
  $bkDir = Join-Path $root ("ai-backups\patch_{0}" -f $stamp)
  New-Item -ItemType Directory -Force -Path $bkDir | Out-Null
  Copy-Item $viteConfig (Join-Path $bkDir "vite.config.js.bak") -Force
  Copy-Item $pkgJson    (Join-Path $bkDir "package.json.bak") -Force
  Log "Backups created at: $bkDir"

  # --- Patch vite.config.js ---
  $vc = Get-Content -Raw -Encoding UTF8 $viteConfig

  $hasBase = $vc -match "(?m)\bbase\s*:\s*['""]\/.*?\/['""]\s*,?"
  $usesDefineConfig = $vc -match "defineConfig\s*\("

  if (-not $usesDefineConfig) {
    Log "vite.config.js does not appear to use defineConfig(). Patch will be conservative."
  }

  if ($hasBase) {
    # Replace existing base value
    $vc2 = [regex]::Replace(
      $vc,
      "(?m)\bbase\s*:\s*['""]\/.*?\/['""]\s*,?",
      ("base: '{0}'," -f $expectedBase),
      1
    )
    if ($vc2 -ne $vc) {
      Set-Content -Path $viteConfig -Value $vc2 -Encoding UTF8
      Log "Patched existing base -> $expectedBase"
    } else {
      Log "Found base but could not replace (unexpected format). No change."
    }
  } else {
    # Insert base into object literal passed to defineConfig(...)
    # Try pattern: defineConfig({ ... })
    if ($vc -match "defineConfig\s*\(\s*\{") {
      $vc2 = [regex]::Replace(
        $vc,
        "defineConfig\s*\(\s*\{",
        ("defineConfig({`n  base: '{0}'," -f $expectedBase),
        1
      )
      Set-Content -Path $viteConfig -Value $vc2 -Encoding UTF8
      Log "Inserted base -> $expectedBase"
    } else {
      Log "Could not confidently insert base into vite.config.js. Manual edit required: set export default defineConfig({ base: '$expectedBase', ... })"
    }
  }

  # --- Patch package.json scripts ---
  $pj = Get-Content -Raw -Encoding UTF8 $pkgJson

  # Add build:ghpages script if missing.
  # Use cross-platform env injection pattern via "vite build --base=..." is simplest.
  if ($pj -notmatch '"build:ghpages"\s*:') {
    if ($pj -match '"scripts"\s*:\s*\{') {
      $insert = '"build:ghpages": "vite build --base=' + $expectedBase.Replace('"','\"') + '",'
      $pj2 = [regex]::Replace($pj, '"scripts"\s*:\s*\{', ('"scripts": {' + "`n    $insert"), 1)
      Set-Content -Path $pkgJson -Value $pj2 -Encoding UTF8
      Log 'Added npm script: build:ghpages'
    } else {
      Log 'Could not find scripts block in package.json. No change.'
    }
  } else {
    Log "build:ghpages already exists. No change."
  }

  Log "Patch complete."
  Log "Next: run commands in section F and share outputs if still slow."
}
catch {
  Log ("ERROR: " + $_.Exception.Message)
  throw
}
finally {
  Stop-Transcript | Out-Null
  Log "Log saved: $logPath"
}
