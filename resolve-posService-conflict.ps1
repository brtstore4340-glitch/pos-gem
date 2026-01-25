# resolve-posService-conflict.ps1
param(
  [ValidateSet("HEAD","INCOMING")]
  [string]$Keep = "HEAD"
)

$path = "src/services/posService.js"
if (-not (Test-Path $path)) { throw "Not found: $path" }

$backup = "$path.bak." + (Get-Date -Format "yyyyMMdd-HHmmss")
Copy-Item $path $backup -Force
Write-Host "Backup: $backup"

$raw = Get-Content $path -Raw

if ($raw -notmatch "<<<<<<<") {
  Write-Host "No conflict markers found. Nothing to do."
  exit 0
}

# Parse and resolve: keep HEAD block or incoming block
# Format:
# <<<<<<< HEAD
#   head lines
# =======
#   incoming lines
# >>>>>>> branch
$lines = $raw -split "`r?`n"
$out = New-Object System.Collections.Generic.List[string]

$state = "NORMAL" # NORMAL | HEAD | INCOMING | SKIP_TO_END
foreach ($line in $lines) {
  if ($line -match "^<{7}") { $state = "HEAD"; continue }
  if ($line -match "^={7}") { $state = "INCOMING"; continue }
  if ($line -match "^>{7}") { $state = "NORMAL"; continue }

  switch ($state) {
    "NORMAL"   { $out.Add($line) | Out-Null }
    "HEAD"     { if ($Keep -eq "HEAD")     { $out.Add($line) | Out-Null } }
    "INCOMING" { if ($Keep -eq "INCOMING") { $out.Add($line) | Out-Null } }
  }
}

# Write resolved file
($out -join "`r`n") | Set-Content -Encoding UTF8 $path
Write-Host "Resolved conflict by keeping: $Keep"
Write-Host "Saved: $path"

Write-Host ""
Write-Host "Now running: npm run build"
& npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

Write-Host ""
Write-Host "Build OK."
