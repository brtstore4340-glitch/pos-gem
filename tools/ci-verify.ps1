[CmdletBinding()]
param([string]$RepoRoot = (Resolve-Path ".").Path)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Step($m){ Write-Host "==> $m" -ForegroundColor Cyan }

Push-Location $RepoRoot
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
