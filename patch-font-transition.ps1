<# 
PATCH: Add Noto Sans Thai font & page transitions via framer-motion

ฟังก์ชัน:
- นำเข้า Google Fonts (Noto Sans Thai & Inter) ใน globals.css
- ตั้งค่า fontFamily ของ Tailwind ให้ใช้ Noto Sans Thai, Inter
- สร้าง custom ring classes (boots-base, boots-light, discount) เพื่อแก้ Error ring class
- ติดตั้ง framer-motion
- ปรับ AppShell.jsx ให้ใช้ AnimatePresence + motion.div เพื่อ transition ระหว่างหน้า

วิธีใช้:
1. วางไฟล์นี้ (patch-font-transition.ps1) ใน root ของโปรเจ็กต์ React (เช่น D:\01 Main Work\Boots\Boots-POS Gemini)
2. เปิด PowerShell แล้วรัน:
   Set-ExecutionPolicy -Scope Process Bypass -Force
   .\patch-font-transition.ps1
3. จากนั้นรัน `npm run build` หรือ `npm run dev` เพื่อตรวจสอบผลลัพธ์

สคริปต์จะสำรองไฟล์เดิม (นามสกุล .bak.<timestamp>) ก่อนแก้ไขเสมอ
#>

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "[PATCH] $msg" }

function Backup-IfExists($path) {
  if (Test-Path -LiteralPath $path) {
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    Copy-Item -LiteralPath $path -Destination "$path.bak.$ts" -Force
    Write-Step "Backup: $path -> $path.bak.$ts"
  }
}

function Write-TextFile($path, $content) {
  Backup-IfExists $path
  $dir = Split-Path -Parent $path
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
  Set-Content -LiteralPath $path -Value $content -Encoding UTF8
  Write-Step "Wrote: $path"
}

$root = (Get-Location).Path
Write-Step "Repo root: $root"

# --------------------------------------------
# 1) Update tailwind.config.js: add fontFamily and ringColor if missing
# --------------------------------------------
$tailwindPath = Join-Path $root "tailwind.config.js"
if (-not (Test-Path -LiteralPath $tailwindPath)) {
  throw "tailwind.config.js not found at $tailwindPath"
}
$tailwind = Get-Content -LiteralPath $tailwindPath -Raw

# Add fontFamily definition if not present
if ($tailwind -notmatch "fontFamily") {
  $tailwind = $tailwind -replace 'extend:\s*{', 'extend: {
    fontFamily: {
      sans: ["Inter", "Noto Sans Thai", "sans-serif"],
    },'
  Write-Step "Added fontFamily.sans to tailwind.config.js"
} elseif ($tailwind -notmatch 'Noto Sans Thai') {
  # Append Noto Sans Thai to existing fontFamily.sans
  $tailwind = $tailwind -replace 'fontFamily:\s*{\s*sans:\s*\[([^\]]+)\]', 'fontFamily: {
      sans: [$1, "Noto Sans Thai"]'
  Write-Step "Appended Noto Sans Thai to existing fontFamily.sans"
}

# Ensure ringColor is defined for custom colors
if ($tailwind -notmatch '"boots-base"') {
  $tailwind = $tailwind -replace 'extend:\s*{', 'extend: {
    ringColor: {
      "boots-base": "hsl(var(--boots))",
      "boots-light": "hsl(var(--boots-light))",
      "discount": "hsl(var(--discount))",
    },'
  Write-Step "Added ringColor definitions to tailwind.config.js"
}

Write-TextFile $tailwindPath $tailwind

# --------------------------------------------
# 2) Update globals.css: import fonts, fix glass-input ring class, add ring utilities
# --------------------------------------------
$globalsPath = Join-Path $root "src\styles\globals.css"
if (-not (Test-Path -LiteralPath $globalsPath)) {
  throw "globals.css not found at $globalsPath"
}
$globals = Get-Content -LiteralPath $globalsPath -Raw

# Insert @import lines for fonts at top if missing
if ($globals -notmatch "Noto Sans Thai") {
  $imports = "@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@100;200;300;400;500;600;700;800;900&display=swap');`n" +
             "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');"
  $globals = $imports + "`n`n" + $globals.TrimStart()
  Write-Step "Added Google Fonts import to globals.css"
}

# Fix glass-input ring class: replace /50 with ring-opacity-50
$globals = $globals -replace 'focus:ring-boots-base/50', 'focus:ring-boots-base focus:ring-opacity-50'
$globals = $globals -replace 'focus:ring-blue-500/50', 'focus:ring-blue-500 focus:ring-opacity-50'
# If still references 'ring-boots-base' (not ring-opacity), keep as is (we'll define class)

# Define custom ring classes if not present
if ($globals -notmatch '\.ring-boots-base') {
  $customRing = @'

@layer utilities {
  /* Custom ring colors for custom hues */
  .ring-boots-base   { --tw-ring-color: hsl(var(--boots));      }
  .ring-boots-light  { --tw-ring-color: hsl(var(--boots-light)); }
  .ring-discount     { --tw-ring-color: hsl(var(--discount));    }
}
'@
  $globals = $globals.TrimEnd() + "`n`n" + $customRing
  Write-Step "Appended custom ring utilities to globals.css"
}

Write-TextFile $globalsPath $globals

# --------------------------------------------
# 3) Install framer-motion if not already
# --------------------------------------------
Write-Step "Installing framer-motion (if not already present)..."
& npm install framer-motion --save
if ($LASTEXITCODE -ne 0) {
  throw "npm install framer-motion failed"
}

# --------------------------------------------
# 4) Update AppShell.jsx for page transitions
# --------------------------------------------
$appShellPath = Join-Path $root "src\components\layout\AppShell.jsx"
if (-not (Test-Path -LiteralPath $appShellPath)) {
  throw "AppShell.jsx not found at $appShellPath"
}
$appShellContent = Get-Content -LiteralPath $appShellPath -Raw

# Inject imports for AnimatePresence, motion, and useLocation
if ($appShellContent -notmatch "AnimatePresence") {
  $appShellContent = $appShellContent -replace 'import \* as React from "react";', 'import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";'
}

# Inject location and transition wrapper in <main>
if ($appShellContent -notmatch "useLocation") {
  # Wrap Outlet rendering
  $pattern = '<main([^>]*)>([\s\S]*?)</main>'
  $replacement = '<main$1>`n        {`n          const location = useLocation();`n        }`n        <AnimatePresence mode="wait">`n          <motion.div`n            key={location.pathname}`n            initial={{ opacity: 0, y: 10, scale: 0.99 }}`n            animate={{ opacity: 1, y: 0, scale: 1 }}`n            exit={{ opacity: 0, y: -10, scale: 0.99 }} `n            transition={{ duration: 0.25, ease: "circOut" }} `n          >`n            <Outlet />`n          </motion.div>`n        </AnimatePresence>`n      </main>'
  $appShellContent = [System.Text.RegularExpressions.Regex]::Replace($appShellContent, $pattern, $replacement, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  Write-Step "Added page transition wrapper (AnimatePresence + motion) in AppShell"
}

Write-TextFile $appShellPath $appShellContent

Write-Step "All patches applied. You can now run 'npm run build' or 'npm run dev' to verify."
