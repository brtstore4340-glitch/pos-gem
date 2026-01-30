# patch-lint-pass.ps1
# Goal: make `npm run lint` pass by (1) ignoring backup/vendor junk, (2) setting Node globals for config/functions,
#       (3) fixing real "no-empty" + React no-undef in app source.

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Backup-File([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  $ts = Get-Date -Format "yyyyMMdd-HHmmss"
  $bak = "$Path.bak.$ts"
  Copy-Item -LiteralPath $Path -Destination $bak -Force
  return $bak
}

function Write-TextUtf8NoBom([string]$Path, [string]$Content) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Patch-File([string]$Path, [scriptblock]$Mutator) {
  if (-not (Test-Path -LiteralPath $Path)) { return $false }
  $orig = Get-Content -LiteralPath $Path -Raw
  $new = & $Mutator $orig
  if ($new -ne $orig) {
    $bak = Backup-File $Path
    Write-Host "[PATCH] Backup: $bak"
    Write-TextUtf8NoBom $Path $new
    Write-Host "[PATCH] Patched: $Path"
    return $true
  }
  Write-Host "[PATCH] No change: $Path"
  return $false
}

function Ensure-Ignores-In-EslintConfig([string]$configText) {
  # Flat config typical: export default [ ... ]
  if ($configText -notmatch 'export\s+default\s*\[') { return $configText }

  $ignoreBlock = @"
  {
    // Ignore generated / vendor / backup snapshots (these are not source-of-truth)
    ignores: [
      "**/.backup-*/**",
      "**/.backup-eslint-*/**",
      "**/.backup-eslint-fix*/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      // Vendor/minified legacy files (eslint will explode on them)
      "src/toggle/**",
      "src/toggle/jquery.js"
    ],
  },
"@

  # If we already have an ignores block for these, don't add again
  if ($configText -match '\bignores\s*:\s*\[' -and $configText -match '\.backup-eslint') {
    return $configText
  }

  # Insert the ignore block as the first config entry right after "export default ["
  return [regex]::Replace(
    $configText,
    'export\s+default\s*\[\s*',
    { param($m) $m.Value + "`n" + $ignoreBlock },
    1
  )
}

function Ensure-Node-Globals-Override([string]$configText) {
  if ($configText -notmatch 'export\s+default\s*\[') { return $configText }

  $nodeGlobalsBlock = @"
  {
    // Node/CommonJS files: allow require/module/exports/process
    files: [
      "**/vite.config.js",
      "**/tailwind.config.js",
      "**/*.config.js",
      "pos-gem/functions/**/*.js",
      "pos-gem/functions/src/**/*.js",
      "shared/**/*.js"
    ],
    languageOptions: {
      globals: {
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        process: "readonly"
      }
    }
  },
"@

  # If already present, skip
  if ($configText -match 'globals\s*:\s*\{[^}]*\brequire\b' -and $configText -match '\bmodule\b' -and $configText -match '\bexports\b') {
    return $configText
  }

  # Add near the top (after ignores block if we inserted it; otherwise after export default [ )
  # We'll insert after the first object block if it is the ignore block; simplest: insert after "export default [" if not present.
  return [regex]::Replace(
    $configText,
    'export\s+default\s*\[\s*',
    { param($m) $m.Value + "`n" + $nodeGlobalsBlock },
    1
  )
}

function Fix-Empty-Blocks([string]$text) {
  # Fix common eslint no-empty patterns by adding a comment inside empty blocks.
  # 1) catch (e) { }
  $text = [regex]::Replace($text, 'catch\s*\(([^)]*)\)\s*\{\s*\}', 'catch ($1) { /* noop */ }')

  # 2) if (...) { } / else { }
  $text = [regex]::Replace($text, '(\bif\s*\([^\)]*\)\s*)\{\s*\}', '$1{ /* noop */ }')
  $text = [regex]::Replace($text, '(\belse\s*)\{\s*\}', '$1{ /* noop */ }')

  # 3) generic function blocks "{}" are too risky to touch; we only handle the above.
  return $text
}

function Ensure-React-Import([string]$text) {
  # If file references React.* or extends React.Component and doesn't import React, add import.
  $usesReactIdentifier = ($text -match '\bReact\b')
 $hasReactImport = (
  $text -match "^\s*import\s+React\b" -or
  $text -match "^\s*import\s*\{\s*.*\}\s*from\s*['""]react['""]" -or
  $text -match "from\s*['""]react['""]"
)
  if ($usesReactIdentifier -and -not $hasReactImport) {
    # Insert import React from 'react'; at top, after 'use strict' if present.
    if ($text -match '^\s*[\'"]use strict[\'"];\s*') {
      return [regex]::Replace($text, '^\s*[\'"]use strict[\'"];\s*', { param($m) $m.Value + "`nimport React from 'react';`n" }, 1)
    }
    return "import React from 'react';`n" + $text
  }
  return $text
}

# -----------------------------
# 1) Patch eslint.config.mjs
# -----------------------------
$eslintConfig = Join-Path (Get-Location) "eslint.config.mjs"
if (-not (Test-Path -LiteralPath $eslintConfig)) {
  throw "eslint.config.mjs not found at repo root: $eslintConfig"
}

Patch-File $eslintConfig {
  param($t)
  $t2 = Ensure-Ignores-In-EslintConfig $t
  $t3 = Ensure-Node-Globals-Override $t2
  return $t3
} | Out-Null

# -----------------------------
# 2) Fix real no-empty in PosUI.jsx copies (not backups)
# -----------------------------
$posUi1 = Join-Path (Get-Location) "src\components\PosUI.jsx"
$posUi2 = Join-Path (Get-Location) "pos-gem\src\components\PosUI.jsx"

foreach ($f in @($posUi1, $posUi2)) {
  if (Test-Path -LiteralPath $f) {
    Patch-File $f { param($t) Fix-Empty-Blocks $t } | Out-Null
  } else {
    Write-Host "[SKIP] Missing: $f"
  }
}

# -----------------------------
# 3) Fix React no-undef in ErrorBoundary.jsx (import React if needed)
# -----------------------------
$errorBoundary = Join-Path (Get-Location) "src\components\ErrorBoundary.jsx"
if (Test-Path -LiteralPath $errorBoundary) {
  Patch-File $errorBoundary {
    param($t)
    $t1 = Ensure-React-Import $t
    return $t1
  } | Out-Null
} else {
  Write-Host "[SKIP] Missing: $errorBoundary"
}

# -----------------------------
# 4) Run lint to verify
# -----------------------------
Write-Host "`n[RUN] npm run lint`n"
npm run lint
