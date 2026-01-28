# tools/patch-firebase-functions-fix.ps1
[CmdletBinding()]
param(
  [string]$RepoRoot = (Resolve-Path ".").Path
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

Push-Location $RepoRoot
try {
  Step "RepoRoot: $RepoRoot"

  if (-not (Test-Path "firebase.json")) { throw "firebase.json not found." }

  # Ensure functions folder
  EnsureDir "functions"
  EnsureDir "functions/src"

  # 1) Backup + replace functions/package.json
  $funcPkgPath = Join-Path $RepoRoot "functions\package.json"
  if (Test-Path $funcPkgPath) { BackupFile $funcPkgPath }

  $funcPkg = @"
{
  "name": "boots-pos-gemini-functions",
  "private": true,
  "type": "module",
  "main": "src/index.js",
  "engines": {
    "node": "20"
  },
  "scripts": {
    "lint": "eslint .",
    "test": "node -e \"console.log('test: skip (add tests later)')\""
  },
  "dependencies": {
    "firebase-admin": "^12.7.0",
    "firebase-functions": "^6.4.0"
  },
  "devDependencies": {
    "eslint": "^9.39.2"
  }
}
"@
  WriteFileUtf8 $funcPkgPath $funcPkg

  # 2) Minimal ESLint config for functions (safe + quiet)
  $funcEslintPath = Join-Path $RepoRoot "functions\.eslintrc.cjs"
  $funcEslint = @"
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  extends: ["eslint:recommended"],
  ignorePatterns: ["node_modules/**"],
  rules: {
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
  }
};
"@
  WriteFileUtf8 $funcEslintPath $funcEslint

  # 3) Create functions/src/index.js using v2 + onInit pattern
  # Firebase recommends deferring slow init using onInit(). :contentReference[oaicite:2]{index=2}
  $funcIndexPath = Join-Path $RepoRoot "functions\src\index.js"
  $funcIndex = @"
import { onRequest } from "firebase-functions/v2/https";
import { onInit } from "firebase-functions/v2";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { initializeApp } from "firebase-admin/app";

setGlobalOptions({ region: "asia-southeast1" });

/**
 * Best practice:
 * Avoid heavy initialization at module load time.
 * Firebase recommends using onInit() to defer slow init during deploy discovery.
 */
let _appInitialized = false;

onInit(() => {
  if (!_appInitialized) {
    initializeApp();
    _appInitialized = true;
  }
});

export const health = onRequest((req, res) => {
  res.status(200).json({ ok: true, service: "boots-pos-gemini-functions" });
});
"@
  WriteFileUtf8 $funcIndexPath $funcIndex

  # 4) Patch live workflow to install functions deps before deploy (fail fast)
  $liveWf = Join-Path $RepoRoot ".github\workflows\firebase-deploy-live.yml"
  if (Test-Path $liveWf) {
    $wf = Get-Content -LiteralPath $liveWf -Raw -Encoding UTF8

    if ($wf -notmatch "Install functions deps") {
      # Insert after main "Build" step
      $needle = "      - name: Build"
      $pos = $wf.IndexOf($needle)
      if ($pos -lt 0) {
        Step "Could not locate Build step in firebase-deploy-live.yml; skipping workflow patch."
      } else {
        $insert = @"
      - name: Install functions deps (if functions exists)
        shell: bash
        run: |
          set -euo pipefail
          if [ -d "functions" ]; then
            cd functions
            npm ci
          fi

"@
        # Insert right after the Build step block (approx: after "run: npm run build")
        $wf = $wf -replace "(?s)(- name: Build\s*\n\s*run: npm run build\s*\n)", "`$1`n$insert"
        BackupFile $liveWf
        Set-Content -LiteralPath $liveWf -Value $wf -Encoding UTF8
        Step "Patched: firebase-deploy-live.yml (functions npm ci)"
      }
    } else {
      Step "firebase-deploy-live.yml already has functions install step."
    }
  } else {
    Step "No firebase-deploy-live.yml found. (Run patch-firebase-cd.ps1 first.)"
  }

  Step "Install functions deps locally to validate..."
  Push-Location "functions"
  try {
    npm install
    npm run lint
  } finally {
    Pop-Location
  }

  Step "DONE: Functions folder is now correct for Firebase deploy."
} finally {
  Pop-Location
}
