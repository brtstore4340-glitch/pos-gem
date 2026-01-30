# tools/patch-gold-ci-react-vite.ps1
[CmdletBinding()]
param(
  [string]$RepoRoot = (Resolve-Path ".").Path,
  [int]$NodeVersion = 20
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Step($m){ Write-Host "==> $m" -ForegroundColor Cyan }
function EnsureDir($p){ if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p | Out-Null } }
function BackupFile($path){
  if (Test-Path $path) {
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    Copy-Item $path "$path.bak.$ts" -Force
  }
}
function ReadJson($path){
  Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
}
function WriteJson($path, $obj){
  $json = $obj | ConvertTo-Json -Depth 100
  Set-Content -LiteralPath $path -Value $json -Encoding UTF8
}
function WriteFileUtf8($path, $content){
  EnsureDir (Split-Path -Parent $path)
  BackupFile $path
  Set-Content -LiteralPath $path -Value $content -Encoding UTF8
  Step "Wrote: $path"
}

Push-Location $RepoRoot
try {
  Step "RepoRoot: $RepoRoot"
  if (-not (Test-Path "package.json")) { throw "package.json not found at repo root." }

  # 1) Ensure folders
  EnsureDir ".github/workflows"
  EnsureDir "tools"

  # 2) Add ESLint config (flat config, modern)
  $eslintConfigPath = Join-Path $RepoRoot "eslint.config.js"
  $eslintConfig = @"
import js from "@eslint/js";
import globals from "globals";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    settings: { react: { version: "detect" } },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "react/react-in-jsx-scope": "off"
    },
  },
];
"@
  WriteFileUtf8 $eslintConfigPath $eslintConfig

  # 3) Patch package.json scripts
  $pkgPath = Join-Path $RepoRoot "package.json"
  BackupFile $pkgPath
  $pkg = ReadJson $pkgPath

  if (-not $pkg.scripts) { $pkg | Add-Member -MemberType NoteProperty -Name scripts -Value (@{}) }

  # Replace your placeholder lint with real lint
  $pkg.scripts.lint = "eslint ."
  # Provide a safe no-op typecheck for JS-only repo (gold standard expects a step)
  if (-not $pkg.scripts.PSObject.Properties.Name.Contains("typecheck")) {
    $pkg.scripts | Add-Member -MemberType NoteProperty -Name typecheck -Value "node -e `"console.log('typecheck: skip (JS project)')`""
  }
  # Provide a safe no-op test for now (optional, but makes CI consistent)
  if (-not $pkg.scripts.PSObject.Properties.Name.Contains("test")) {
    $pkg.scripts | Add-Member -MemberType NoteProperty -Name test -Value "node -e `"console.log('test: skip (no tests configured yet)')`""
  }

  WriteJson $pkgPath $pkg
  Step "Patched: package.json scripts (lint/typecheck/test)"

  # 4) Install ESLint dev deps
  Step "Installing ESLint tooling..."
  npm install -D eslint @eslint/js globals eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-refresh

  # 5) Write local gate runner (same as CI)
  $verifyPath = Join-Path $RepoRoot "tools\ci-verify.ps1"
  $verify = @"
[CmdletBinding()]
param([string]`$RepoRoot = (Resolve-Path ".").Path)

Set-StrictMode -Version Latest
`$ErrorActionPreference = "Stop"

function Step(`$m){ Write-Host "==> `$m" -ForegroundColor Cyan }

Push-Location `$RepoRoot
try {
  Step "Node versions"
  node -v
  npm -v

  Step "Install (locked)"
  if (Test-Path "package-lock.json") { npm ci } else { npm install }

  Step "Lint"
  npm run lint

  Step "Typecheck"
  npm run typecheck --if-present

  Step "Test"
  npm test --if-present

  Step "Build"
  npm run build
  Step "SUCCESS: All gates passed."
} finally {
  Pop-Location
}
"@
  WriteFileUtf8 $verifyPath $verify

  # 6) Write CI workflow (PR gates)
  $ciPath = Join-Path $RepoRoot ".github\workflows\ci.yml"
  $ci = @"
name: CI

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read

concurrency:
  group: `$\{\{ github.repository \}\}-`$\{\{ github.event.pull_request.number \}\}-ci
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '$NodeVersion'
          cache: 'npm'

      - name: Install (locked)
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck --if-present

      - name: Test
        run: npm test --if-present

      - name: Build
        run: npm run build
"@
  WriteFileUtf8 $ciPath $ci

  # 7) Verify locally now
  Step "Running local verification..."
  pwsh -File $verifyPath -RepoRoot $RepoRoot

  Step "DONE: CI + linting + local gates are ready."
  Step "NEXT: paste firebase.json so I can patch deploy to be correct (dist + rewrites + optional functions)."

} finally {
  Pop-Location
}
