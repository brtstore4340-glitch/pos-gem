# tools/patch-firebase-cd.ps1  (FIXED: no PowerShell variable expansion inside YAML)
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [string]$ProjectId,

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
function WriteFileUtf8($path, $content){
  EnsureDir (Split-Path -Parent $path)
  BackupFile $path
  Set-Content -LiteralPath $path -Value $content -Encoding UTF8
  Step "Wrote: $path"
}

Push-Location $RepoRoot
try {
  Step "RepoRoot: $RepoRoot"
  if (-not (Test-Path "package.json")) { throw "package.json not found." }
  if (-not (Test-Path "firebase.json")) { throw "firebase.json not found." }

  # 1) .firebaserc
  $firebasercPath = Join-Path $RepoRoot ".firebaserc"
  $firebaserc = @"
{
  "projects": {
    "default": "$ProjectId"
  }
}
"@
  WriteFileUtf8 $firebasercPath $firebaserc

  # 2) workflows dir
  $wfDir = Join-Path $RepoRoot ".github\workflows"
  EnsureDir $wfDir

  # 3) Preview deploy on PR (Hosting preview channel)
  $previewPath = Join-Path $wfDir "firebase-preview.yml"
  $preview = @"
name: Firebase Hosting Preview

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  build_and_preview:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '$NodeVersion'
          cache: 'npm'

      - name: Install (locked)
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to Firebase Hosting preview channel
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: \${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: \${{ secrets.FIREBASE_SERVICE_ACCOUNT_$ProjectId }}
          projectId: $ProjectId
"@
  WriteFileUtf8 $previewPath $preview

  # 4) Live deploy on push to main
  # IMPORTANT: Use SINGLE-QUOTED here-string so PowerShell does NOT expand $FIREBASE_PROJECT_ID etc.
  $livePath = Join-Path $wfDir "firebase-deploy-live.yml"
  $live = @'
name: Firebase Deploy (Live)

on:
  push:
    branches: [ "main" ]

permissions:
  contents: read

concurrency:
  group: ${{ github.repository }}-live-deploy
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 25

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install (locked)
        run: npm ci

      - name: Lint
        run: npm run lint --if-present

      - name: Typecheck
        run: npm run typecheck --if-present

      - name: Test
        run: npm test --if-present

      - name: Build
        run: npm run build

      - name: Auth to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Install Firebase CLI
        run: npm i -g firebase-tools

      - name: Deploy (Hosting + Firestore + Functions if present)
        shell: bash
        env:
          FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
        run: |
          set -euo pipefail

          ONLY="hosting,firestore"

          if [ -d "functions" ]; then
            ONLY="hosting,firestore,functions"
          fi

          firebase --version
          firebase deploy --project "$FIREBASE_PROJECT_ID" --only "$ONLY"
'@

  # Replace placeholders inside the YAML safely
  $live = $live.Replace('"20"', "'$NodeVersion'")
  WriteFileUtf8 $livePath $live

  Step "DONE"
  Step "Required secrets:"
  Step "1) FIREBASE_SERVICE_ACCOUNT_$ProjectId  (service account JSON)  -> for preview"
  Step "2) GCP_SA_KEY                           (service account JSON)  -> for live deploy auth"
  Step "3) FIREBASE_PROJECT_ID                  ($ProjectId)            -> live deploy target project"

} finally {
  Pop-Location
}