# tools/patch-gold-standard.ps1
[CmdletBinding()]
param(
  [string]$RepoRoot = (Resolve-Path ".").Path,
  [ValidateSet("npm","pnpm","yarn")] [string]$Pm = "npm",
  [int]$NodeVersion = 20,
  [switch]$AddCodeQL
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
function WriteFileUtf8($path, $content){
  EnsureDir (Split-Path -Parent $path)
  BackupFile $path
  Set-Content -LiteralPath $path -Value $content -Encoding UTF8
  Step "Wrote: $path"
}

# --- Validate repo ---
Push-Location $RepoRoot
try {
  Step "RepoRoot: $RepoRoot"
  if (-not (Test-Path "package.json")) { throw "package.json not found at repo root." }

  # --- Write tools/ci-verify.ps1 ---
  $verifyPath = Join-Path $RepoRoot "tools\ci-verify.ps1"
  $verify = @"
[CmdletBinding()]
param([string]`$RepoRoot = (Resolve-Path ".").Path)

Set-StrictMode -Version Latest
`$ErrorActionPreference = "Stop"

function Step(`$m){ Write-Host "==> `$m" -ForegroundColor Cyan }
function Warn(`$m){ Write-Host "WARN: `$m" -ForegroundColor Yellow }

Push-Location `$RepoRoot
try {
  Step "Node & package manager"
  node -v
  npm -v

  Step "Install (locked)"
  if (Test-Path "package-lock.json") {
    npm ci
  } elseif (Test-Path "pnpm-lock.yaml") {
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw "pnpm not installed" }
    pnpm install --frozen-lockfile
  } elseif (Test-Path "yarn.lock") {
    if (-not (Get-Command yarn -ErrorAction SilentlyContinue)) { throw "yarn not installed" }
    yarn install --frozen-lockfile
  } else {
    Warn "No lockfile found. Best practice is to commit a lockfile."
    npm install
  }

  Step "Lint"
  npm run lint --if-present

  Step "Typecheck"
  npm run typecheck --if-present

  Step "Test"
  npm test --if-present

  Step "Build"
  npm run build --if-present

  Step "SUCCESS: All gates passed."
} finally {
  Pop-Location
}
"@
  WriteFileUtf8 $verifyPath $verify

  # --- CI workflow (least privilege + caching) ---
  $cache = $Pm
  $installCmd = switch ($Pm) {
    "npm"  { "npm ci" }
    "pnpm" { "pnpm install --frozen-lockfile" }
    "yarn" { "yarn install --frozen-lockfile" }
  }

  $ciPath = Join-Path $RepoRoot ".github\workflows\ci.yml"
  $ci = @"
name: CI

on:
  pull_request:
    types: [opened, synchronize, reopened]

# Least privilege by default (increase only if needed). 
# See GitHub Actions security guidance.
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
          cache: '$cache'

"@

  if ($Pm -eq "pnpm") {
    $ci += @"
      - name: Enable Corepack
        run: corepack enable

"@
  }

  $ci += @"
      - name: Install (locked)
        run: $installCmd

      - name: Lint
        run: npm run lint --if-present

      - name: Typecheck
        run: npm run typecheck --if-present

      - name: Test
        run: npm test --if-present

      - name: Build
        run: npm run build --if-present
"@
  WriteFileUtf8 $ciPath $ci

  # --- Optional CodeQL ---
  if ($AddCodeQL) {
    $codeqlPath = Join-Path $RepoRoot ".github\workflows\codeql.yml"
    $codeql = @"
name: CodeQL

on:
  pull_request:
  push:
    branches: [ "main" ]
  schedule:
    - cron: '0 3 * * 1'

permissions:
  contents: read
  security-events: write

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript
      - uses: github/codeql-action/analyze@v3
"@
    WriteFileUtf8 $codeqlPath $codeql
  }

  Step "Run local verify to ensure correctness"
  pwsh -File $verifyPath -RepoRoot $RepoRoot

  Step "DONE"
} finally {
  Pop-Location
}
