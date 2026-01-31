<#
  fix-build-react-hot-toast.ps1
  Systematic build fix for: Rollup failed to resolve "react-hot-toast"
  - Option 1: ensure dependency exists + build
  - Option 2: quarantine node_modules + clean install + build
  - Option 3: diagnostics (no guessing): npm ls, require.resolve, who imports legacy, vite config scan
  - Option 4 (OPT-IN only): stub legacy page to remove react-hot-toast import (behavior change)
#>

param(
  [string]$RepoRoot = (Get-Location).Path,
  [string]$PkgName = "react-hot-toast",
  [string]$PkgVersion = "2.6.0",   # deterministic; update consciously if you want
  [switch]$AutoStubLegacyAsLastResort
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-Timestamp { (Get-Date -Format "yyyyMMdd-HHmmss") }

$ts = New-Timestamp
$bootDir = Join-Path $RepoRoot "_boot"
$logDir  = Join-Path $bootDir "patchlogs"
$trashDir = Join-Path $bootDir "trash\fix-build-$ts"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
New-Item -ItemType Directory -Force -Path $trashDir | Out-Null

$logFile = Join-Path $logDir "fix-build-react-hot-toast-$ts.log"

function Log([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "o"), $msg
  $line | Tee-Object -FilePath $logFile -Append | Out-Host
}

function Run([string]$label, [scriptblock]$cmd) {
  Log "---- $label ----"
  & $cmd 2>&1 | Tee-Object -FilePath $logFile -Append | Out-Host
  $code = $LASTEXITCODE
  if ($code -ne $null -and $code -ne 0) {
    Log "EXITCODE: $code (fail)"
    return $false
  }
  Log "OK"
  return $true
}

function Backup-File([string]$path) {
  if (Test-Path $path) {
    $bak = "$path.bak.$ts"
    Copy-Item -LiteralPath $path -Destination $bak -Force
    Log "Backup: $bak"
  }
}

function Quarantine-Dir([string]$path) {
  if (!(Test-Path $path)) { return $null }
  $name = Split-Path $path -Leaf
  $dest = Join-Path $trashDir $name
  if (Test-Path $dest) { $dest = Join-Path $trashDir ("{0}__dup__{1}" -f $name, (New-Timestamp)) }
  try {
    Move-Item -LiteralPath $path -Destination $dest -Force
    Log "Quarantined: $path => $dest"
    return $dest
  } catch {
    Log "WARN: move quarantine failed, will delete: $path | $($_.Exception.Message)"
    Remove-Item -LiteralPath $path -Recurse -Force
    Log "Deleted: $path"
    return $null
  }
}

function Test-Pkg-Installed() {
  # npm ls exit code nonzero when missing -> use that
  $ok = Run "Check installed: npm ls $PkgName" { npm ls $PkgName --depth=0 }
  return $ok
}

function Build() {
  return (Run "Build: npm run build" { npm run build })
}

try {
  Log "RepoRoot: $RepoRoot"
  Log "Pkg: $PkgName@$PkgVersion"
  Log "Trash: $trashDir"
  Log "Log: $logFile"

  Push-Location $RepoRoot

  # Sanity: tools
  Run "Node/NPM versions" { node -v; npm -v } | Out-Null

  $pkgJson = Join-Path $RepoRoot "package.json"
  if (!(Test-Path $pkgJson)) { throw "Missing package.json at $pkgJson" }
  Backup-File $pkgJson

  $pkgLock = Join-Path $RepoRoot "package-lock.json"
  if (Test-Path $pkgLock) { Backup-File $pkgLock }

  $legacyFile = Join-Path $RepoRoot "src\pages\_legacy_oldgit\LoginLegacy.jsx"
  if (Test-Path $legacyFile) {
    Log "Found legacy file: $legacyFile"
    Run "Show legacy import lines (react-hot-toast)" { Select-String -LiteralPath $legacyFile -Pattern "react-hot-toast" -SimpleMatch -AllMatches } | Out-Null
  } else {
    Log "NOTE: legacy file not found at expected path: $legacyFile"
  }

  # ======================
  # OPTION 1: install dependency if missing, then build
  # ======================
  Log "===== OPTION 1: Ensure dependency and build ====="

  $installed = Test-Pkg-Installed
  if (-not $installed) {
    Run "Install $PkgName@$PkgVersion (save-exact)" { npm install "$PkgName@$PkgVersion" --save-exact --no-audit --no-fund } | Out-Null
  } else {
    Log "Dependency appears installed already (per npm ls)."
  }

  if (Build) {
    Log "SUCCESS: Build passed after Option 1."
    exit 0
  }

  # ======================
  # OPTION 2: clean install (quarantine node_modules) then build
  # ======================
  Log "===== OPTION 2: Clean install (quarantine node_modules) and build ====="

  $nodeModules = Join-Path $RepoRoot "node_modules"
  if (Test-Path $nodeModules) {
    Quarantine-Dir $nodeModules | Out-Null
  }

  # lockfile strategy
  if (Test-Path $pkgLock) {
    Run "Reinstall via npm ci" { npm ci --no-audit --no-fund } | Out-Null
  } else {
    Run "Reinstall via npm install" { npm install --no-audit --no-fund } | Out-Null
  }

  if (Build) {
    Log "SUCCESS: Build passed after Option 2."
    exit 0
  }

  # ======================
  # OPTION 3: diagnostics (no guessing)
  # ======================
  Log "===== OPTION 3: Diagnostics (no guessing) ====="

  Run "npm ls $PkgName (depth=1)" { npm ls $PkgName --depth=1 } | Out-Null

  # Node resolve check (works even if package is ESM; require.resolve just resolves path)
  Run "Node resolve check: require.resolve('$PkgName')" { node -e "try{console.log(require.resolve('$PkgName'))}catch(e){console.error('RESOLVE_FAIL:',e.message);process.exit(2)}" } | Out-Null

  # Who imports the legacy page? (This is the real reason Rollup even touches it)
  Run "Find references to _legacy_oldgit/LoginLegacy in src" {
    Get-ChildItem -Path (Join-Path $RepoRoot "src") -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -notmatch [regex]::Escape("\src\pages\_legacy_oldgit\") } |
      Select-String -Pattern "_legacy_oldgit[\\/].*LoginLegacy" -AllMatches -ErrorAction SilentlyContinue |
      ForEach-Object { "{0}:{1} {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
  } | Out-Null

  # Vite config quick scan
  $viteConfigs = @("vite.config.ts","vite.config.js","vite.config.mjs","vite.config.cjs") | ForEach-Object { Join-Path $RepoRoot $_ } | Where-Object { Test-Path $_ }
  if ($viteConfigs.Count -gt 0) {
    foreach ($vc in $viteConfigs) {
      Log "Found Vite config: $vc"
      Run "Scan Vite config for alias/external mentions" {
        Select-String -LiteralPath $vc -Pattern "external","rollupOptions","resolve","alias","react-hot-toast" -AllMatches -ErrorAction SilentlyContinue |
          ForEach-Object { "{0}:{1} {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
      } | Out-Null
    }
  } else {
    Log "No vite.config.* found at root (OK if using inline config elsewhere)."
  }

  Log "RESULT: Build still failing after Option 1+2."
  Log "Next actions (choose one, based on diagnostics):"
  Log " - If npm ls/require.resolve FAIL => install is not effective at this root (workspace or wrong folder). Run install at the correct workspace root."
  Log " - If npm ls/require.resolve OK but Vite still fails => check Vite config alias/external or multiple package roots."
  Log " - If legacy page is NOT needed in prod => Option 4 can stub legacy page to remove '$PkgName' import."

  # ======================
  # OPTION 4 (OPT-IN): stub legacy page (behavior change) then build
  # ======================
  if ($AutoStubLegacyAsLastResort) {
    Log "===== OPTION 4: STUB legacy page (OPT-IN behavior change) ====="

    if (!(Test-Path $legacyFile)) {
      throw "Option 4 requested but legacy file not found: $legacyFile"
    }

    Backup-File $legacyFile

    $stub = @"
import React from 'react';

export default function LoginLegacy() {
  return (
    <div style={{ padding: 16 }}>
      <h2>Legacy Login Disabled (Production Build)</h2>
      <p>
        This legacy page was stubbed to unblock production build because a dependency was missing/unresolvable.
        Re-enable by restoring the original file from backup.
      </p>
    </div>
  );
}
"@

    Set-Content -LiteralPath $legacyFile -Value $stub -Encoding UTF8 -NoNewline
    Log "Patched legacy file with a stub: $legacyFile"

    if (Build) {
      Log "SUCCESS: Build passed after Option 4 (stub)."
      Log "WARNING: This changes runtime behavior for the legacy page."
      exit 0
    }

    Log "FAIL: Even Option 4 did not fix build. At this point the import failing is likely elsewhere."
  } else {
    Log "Option 4 not executed (no -AutoStubLegacyAsLastResort)."
    Log "If you confirm legacy page is not needed in prod, rerun with:"
    Log "  powershell -ExecutionPolicy Bypass -File .\fix-build-react-hot-toast.ps1 -AutoStubLegacyAsLastResort"
  }

  throw "Build still failing. Please provide the full npm run build output + the diagnostics log: $logFile"
}
catch {
  Log ("ERROR: " + $_.Exception.Message)
  Pop-Location -ErrorAction SilentlyContinue
  throw
}
finally {
  try { Pop-Location -ErrorAction SilentlyContinue } catch {}
}
