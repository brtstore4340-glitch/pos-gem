# show-posService-conflict.ps1
$path = "src/services/posService.js"
if (-not (Test-Path $path)) { throw "Not found: $path" }

Write-Host "---- Showing conflict sections from $path ----"
$lines = Get-Content $path
for ($i=0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match "^(<{7}|={7}|>{7})") {
    "{0,5}: {1}" -f ($i+1), $lines[$i] | Write-Host
  }
}
Write-Host "Tip: open the file to see the full two versions between markers."
