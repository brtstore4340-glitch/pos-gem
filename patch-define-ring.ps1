<# 
PATCH: Define custom ring classes in globals.css

– เพิ่ม block @layer utilities เพื่อกำหนด ring colors สำหรับ boots-base, boots-light และ discount
– สำรองไฟล์ src/styles/globals.css ก่อนแก้ไข

วิธีใช้:
1. บันทึกสคริปต์นี้เป็น patch-define-ring.ps1 ใน root ของโปรเจ็กต์ (เช่น D:\01 Main Work\Boots\Boots-POS Gemini)
2. เปิด PowerShell ในโฟลเดอร์นั้นแล้วรัน:
   Set-ExecutionPolicy -Scope Process Bypass -Force
   .\patch-define-ring.ps1
3. รัน `npm run build` เพื่อทดสอบว่าปัญหาหายไป

#>

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "[RING-PATCH] $msg" }
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
  throw "globals.css not found. Please check the path."
}

# Read current content
$globals = Get-Content -LiteralPath $globalsPath -Raw

# Define block for custom ring classes
$ringBlock = @'
@layer utilities {
  /* Custom ring colors for Boots design tokens */
  .ring-boots-base {
    --tw-ring-color: hsl(var(--boots));
  }
  .ring-boots-light {
    --tw-ring-color: hsl(var(--boots-light));
  }
  .ring-discount {
    --tw-ring-color: hsl(var(--discount));
  }
}
'@

# Append block only if not already present
if ($globals -notmatch '\.ring-boots-base') {
  Backup-IfExists $globalsPath
  $newGlobals = $globals.TrimEnd() + "`n`n" + $ringBlock
  Set-Content -LiteralPath $globalsPath -Value $newGlobals -Encoding UTF8
  Write-Step "Appended custom ring classes to globals.css"
} else {
  Write-Step "Custom ring classes already exist; skipping update."
}

Write-Step "เสร็จแล้ว คุณสามารถรัน 'npm run build' เพื่อตรวจสอบการแก้ไข"
