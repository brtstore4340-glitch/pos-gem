# patch-lint-hard.ps1
# HARD / DETERMINISTIC / SYSTEMATIC
# Safe Mode only (Process scope)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

try {
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
} catch {}

# -----------------------------
# Utilities
# -----------------------------
function Backup-File([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $ts = Get-Date -Format "yyyyMMdd-HHmmss"
  Copy-Item $Path "$Path.bak.$ts" -Force
}

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

function Patch-File([string]$Path, [scriptblock]$Fn) {
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $orig = Get-Content $Path -Raw
  $new  = & $Fn $orig
  if ($orig -ne $new) {
    Backup-File $Path
    Write-Utf8NoBom $Path $new
    Write-Host "[PATCHED] $Path"
  } else {
    Write-Host "[OK] $Path"
  }
}

# -----------------------------
# ESLint config fixes
# -----------------------------
function Patch-EslintConfig([string]$text) {

  if ($text -notmatch "export\s+default\s*\[") { return $text }

  if ($text -match "\.backup-eslint" -and $text -match "src/toggle") {
    return $text
  }

  $inject = @"
  {
    ignores: [
      "**/.backup-*/**",
      "**/.backup-eslint-*/**",
      "**/.backup-eslint-fix*/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "src/toggle/**",
      "src/toggle/jquery.js"
    ],
  },
  {
    files: [
      "**/*.config.js",
      "**/vite.config.js",
      "**/tailwind.config.js",
      "pos-gem/functions/**/*.js",
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

  return [regex]::Replace(
    $text,
    "export\s+default\s*\[\s*",
    { param($m) $m.Value + "`n" + $inject },
    1
  )
}

# -----------------------------
# no-empty FIX (SAFE)
# -----------------------------
function Fix-Empty-Blocks([string]$text) {

  # catch (e) { }
  $text = [regex]::Replace(
    $text,
    "catch\s*\(([^)]*)\)\s*\{\s*\}",
    { param($m) "catch (" + $m.Groups[1].Value + ") { /* noop */ }" }
  )

  # if (...) { }
  $text = [regex]::Replace(
    $text,
    "(\bif\s*\([^\)]*\))\s*\{\s*\}",
    { param($m) $m.Groups[1].Value + " { /* noop */ }" }
  )

  # else { }
  $text = [regex]::Replace(
    $text,
    "(\belse)\s*\{\s*\}",
    { param($m) $m.Groups[1].Value + " { /* noop */ }" }
  )

  return $text
}

# -----------------------------
# React import fix (SAFE)
# -----------------------------
function Ensure-ReactImport([string]$text) {
  if ($text -match "\bReact\b" -and $text -notmatch "from\s+['""]react['""]") {
    return "import React from 'react';`n" + $text
  }
  return $text
}

# =============================
# EXECUTION
# =============================
$root = (Get-Location).Path
Write-Host "[ROOT] $root"

# 1. ESLint config
Patch-File (Join-Path $root "eslint.config.mjs") { param($t) Patch-EslintConfig $t }

# 2. no-empty in PosUI.jsx (real files only)
Patch-File (Join-Path $root "src\components\PosUI.jsx") { param($t) Fix-Empty-Blocks $t }
Patch-File (Join-Path $root "pos-gem\src\components\PosUI.jsx") { param($t) Fix-Empty-Blocks $t }

# 3. React no-undef
Patch-File (Join-Path $root "src\components\ErrorBoundary.jsx") { param($t) Ensure-ReactImport $t }

# 4. Run lint
Write-Host "`n[RUN] npm run lint`n"
npm run lint
