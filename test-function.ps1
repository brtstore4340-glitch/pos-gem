#Requires -Version 7.0

param(
    [string]$BaseUrl = "http://localhost:5001/boots-pos-project/asia-southeast1",
    [switch]$Production
)

if ($Production) {
    $BaseUrl = "https://asia-southeast1-boots-pos-project.cloudfunctions.net"
}

Write-Host "Testing Firebase Functions..." -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Yellow

# Test Health Check
Write-Host "`nTesting healthCheck..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/healthCheck" -Method Get -UseBasicParsing
    Write-Host "✓ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "✓ Body: $($response.Content)" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed: $_" -ForegroundColor Red
}

Write-Host "`nDone!" -ForegroundColor Cyan