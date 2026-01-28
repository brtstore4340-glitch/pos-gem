<# 
PATCH: Fix Tailwind ring class error for .glass-input

จุดประสงค์:
- แก้ไขปัญหา `[plugin:vite:css] The 'focus:ring-boots-base/50' class does not exist`
- แทนที่ `focus:ring-boots-base/50` ด้วย `focus:ring-boots-base focus:ring-opacity-50`
- สำรองไฟล์ `globals.css` ก่อนทำการแก้ไข

วิธีใช้งาน:
1. บันทึกสคริปต์นี้เป็นไฟล์ เช่น `patch-fix-glass-ring.ps1` ใน root โฟลเดอร์ของโปรเจ็กต์ (เช่น `D:\01 Main Work\Boots\Boots-POS Gemini`).
2. เปิด PowerShell และรัน:
   Set-ExecutionPolicy -Scope Process Bypass -Force
   .\patch-fix-glass-ring.ps1
3. เมื่อรันเสร็จ `npm run build` หรือ `npm run dev` เพื่อทดสอบว่า error หายไปแล้ว

#>

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host "[FIX] $msg"
}

function Backup-IfExists($path) {
  if (Test-Path -LiteralPath $path) {
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    Copy-Item -LiteralPath $path -Destination "$path.bak.$ts" -Force
    Write-Step "Backup created: $path.bak.$ts"
  }
}

$root = (Get-Location).Path
Write-Step "Repo root: $root"

# Path to globals.css
$globalsPath = Join-Path $root "src\styles\globals.css"

if (-not (Test-Path -LiteralPath $globalsPath)) {
  Write-Step "File not found: $globalsPath"
  throw "globals.css not found. Please check path and rerun."
}

# Read and replace the problematic class
$globals = Get-Content -LiteralPath $globalsPath -Raw
$newGlobals = $globals -replace 'focus:ring-boots-base\/50', 'focus:ring-boots-base focus:ring-opacity-50'

# Only write if changes occurred
if ($globals -ne $newGlobals) {
  Backup-IfExists $globalsPath
  Set-Content -LiteralPath $globalsPath -Value $newGlobals -Encoding UTF8
  Write-Step "Patched: Replaced 'focus:ring-boots-base/50' with 'focus:ring-boots-base focus:ring-opacity-50'"
} else {
  Write-Step "No occurrences of 'focus:ring-boots-base/50' found. No changes made."
}

Write-Step "Done. You can now run 'npm run build' or 'npm run dev' to verify."