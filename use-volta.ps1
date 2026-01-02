Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$volta = "C:\Program Files\Volta"
if (-not (Test-Path -LiteralPath $volta)) { throw "Volta not found: $volta" }

$env:PATH = "$volta;$env:PATH"

Write-Host "OK: node=$((Get-Command node).Source) npm=$((Get-Command npm).Source)" -ForegroundColor Green
node -v
npm -v
