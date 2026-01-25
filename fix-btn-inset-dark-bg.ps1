# fix-btn-inset-dark-bg.ps1
$ErrorActionPreference = "Stop"

$path = "src/index.css"
if (-not (Test-Path $path)) { throw "Not found: $path" }

$backup = "$path.bak." + (Get-Date -Format "yyyyMMdd-HHmmss")
Copy-Item $path $backup -Force
Write-Host "Backup: $backup"

$content = Get-Content $path -Raw

# Replace the broken @apply block for .btn-inset with a safe version
$pattern = "(?s)/\*\s*--- Unity Theme: Interactive ""Sunken"" Buttons ---\s*\*/\s*\.btn-inset\s*\{\s*@apply.*?\;\s*\}"
$replacement = @"
/* --- Unity Theme: Interactive "Sunken" Buttons --- */
.btn-inset {
  background-color: #f1f5f9; /* slate-100 */
}
.dark .btn-inset {
  background-color: #252830;
}
.btn-inset {
  @apply relative overflow-hidden transition-all duration-150 ease-out
         text-slate-600 dark:text-slate-300
         border border-slate-200/80 dark:border-white/5
         shadow-sm hover:brightness-105
         active:shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.1)]
         active:translate-y-[1px] active:scale-[0.99]
         rounded-xl flex flex-col items-center justify-center;
}
"@

$new = [regex]::Replace($content, $pattern, $replacement)

if ($new -eq $content) {
  Write-Warning "Did not find the .btn-inset block to replace. Showing lines 45-60 for manual edit:"
  $lines = Get-Content $path
  $start = 45; $end = 60
  for ($i=$start; $i -le $end; $i++) { "{0,3}: {1}" -f $i, $lines[$i-1] | Write-Host }
  exit 1
}

Set-Content -LiteralPath $path -Value $new -Encoding UTF8
Write-Host "Patched: $path"
Write-Host ""
Write-Host "Running: npm run build"
& npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

Write-Host ""
Write-Host "Build OK. Next:"
Write-Host "firebase deploy --only hosting"
