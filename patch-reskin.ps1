<# 
PATCH: Reskin POS UI – Boots Colors + Glass Effect + AppShell redesign

วิธีใช้:
1. วางไฟล์นี้ (patch-reskin.ps1) ใน root ของโปรเจ็กต์ React (เช่น D:\01 Main Work\Boots\Boots-POS Gemini).
2. เปิด PowerShell ในโฟลเดอร์นั้น แล้วรัน:
   Set-ExecutionPolicy -Scope Process Bypass -Force
   .\patch-reskin.ps1
3. จากนั้นตรวจสอบผลการ build ด้วย `npm run build` หรือรัน dev server.

ปล. สคริปต์จะสำรองไฟล์ที่มีการแก้ไขลงในไฟล์ .bak.<timestamp> เสมอ
#>

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host "[PATCH] $msg"
}

# สำรองและเขียนไฟล์
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

# -----------------------------------------------------------------------
# 1) ขยาย tailwind.config.js – เพิ่มสี boots และ discount
# -----------------------------------------------------------------------
$tailwindPath = Join-Path $root "tailwind.config.js"
if (Test-Path -LiteralPath $tailwindPath) {
  $tailwind = Get-Content -LiteralPath $tailwindPath -Raw
  # หากยังไม่มีค่าสี boots และ discount ให้อัปเดตด้วยข้อความเพิ่มต่อท้าย extend.colors
  # (ถ้า patch ซ้ำ, สคริปต์จะข้าม)
  if ($tailwind -notmatch "boots") {
    $tailwind = $tailwind -replace 'colors:\s*{', 'colors: {
        /* Boots brand colors */
        boots: {
          base: {
            DEFAULT: "hsl(var(--boots))",
            foreground: "hsl(var(--boots-foreground))"
          },
          light: "hsl(var(--boots-light))"
        },
        /* Discount color (yellow) */
        discount: {
          DEFAULT: "hsl(var(--discount))",
          foreground: "hsl(var(--discount-foreground))"
        },'
    Write-TextFile $tailwindPath $tailwind
  } else {
    Write-Step "tailwind.config.js already contains boots colors, skipping."
  }
} else {
  Write-Step "tailwind.config.js not found! Skipping tailwind config update."
}

# -----------------------------------------------------------------------
# 2) ปรับ globals.css – เพิ่มตัวแปรสี boots/light/discount + สร้าง glass classes
# -----------------------------------------------------------------------
$globalsPath = Join-Path $root "src\styles\globals.css"
if (Test-Path -LiteralPath $globalsPath) {
  $globals = Get-Content -LiteralPath $globalsPath -Raw
  # เพิ่มตัวแปรใน :root (โหมด light)
  if ($globals -notmatch "--boots") {
    $globals = $globals -replace '--ring:.*', '--ring: 222.2 84% 4.9%;
    /* Boots brand color variables */
    --boots: 214 65% 50%;
    --boots-light: 214 80% 96%;
    --boots-foreground: 210 40% 98%;
    /* Discount (yellow) variables */
    --discount: 40 90% 60%;
    --discount-foreground: 214 65% 20%;'
  }
  # เพิ่มตัวแปรใน .dark (โหมด dark)
  if ($globals -notmatch "--boots-light.*dark") {
    $globals = $globals -replace '--ring:\s*.*;', '--ring: 212.7 26.8% 83.9%;
    /* Boots brand color variables (dark mode) */
    --boots: 214 80% 45%;
    --boots-light: 214 70% 20%;
    --boots-foreground: 210 40% 98%;
    /* Discount variables (dark mode) */
    --discount: 40 85% 55%;
    --discount-foreground: 210 40% 10%;'
  }
  # เพิ่ม class glass-panel และ glass-input ถ้ายังไม่มี
  if ($globals -notmatch "\.glass-panel") {
    $globals += @'

/* Glass effect panels (POSUI style) */
.glass-panel {
  @apply rounded-xl border border-white/30 dark:border-white/10 bg-white/60 dark:bg-black/30 backdrop-blur-lg shadow-lg;
}
.glass-input {
  @apply rounded-md border border-transparent bg-white/80 dark:bg-black/40 backdrop-blur-md px-3 py-2 placeholder:text-slate-400 text-slate-800 dark:text-slate-200 focus:border-slate-300 focus:ring-2 focus:ring-boots-base/50;
}
'@
  }
  Write-TextFile $globalsPath $globals
} else {
  Write-Step "globals.css not found! Skipping globals update."
}

# -----------------------------------------------------------------------
# 3) ปรับ AppShell.jsx – แถบหัวมีโลโก้ + ชื่อรายการขาย
# -----------------------------------------------------------------------
$appShellPath = Join-Path $root "src\components\layout\AppShell.jsx"
if (Test-Path -LiteralPath $appShellPath) {
  $appShell = @'
import * as React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Container } from "@/components/ui/grid";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/pos", label: "POS Terminal" },
  { to: "/reports", label: "Daily" },
  { to: "/settings", label: "Setting" },
];

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "text-sm px-3 py-2 rounded-md border transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          isActive ? "bg-accent text-accent-foreground" : "bg-background"
        )
      }
    >
      {label}
    </NavLink>
  );
}

export function AppShell() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-slate-50/70 dark:bg-black/40 backdrop-blur-md">
        <Container className="py-4 px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Logo + Title (รายการขาย) */}
          <div className="flex items-center gap-2">
            {/* โลโก้ Boots สามารถเปลี่ยน src เป็นไฟล์อื่นหรือเพิ่มใน public folder */}
            <img src="https://store.boots.co.th/images/boots-logo.png" alt="Boots Logo" className="h-8 w-auto object-contain" />
            <span className="font-bold text-xl text-slate-800 dark:text-slate-200">รายการขาย</span>
          </div>
          {/* Navigation */}
          <nav className="flex flex-wrap gap-2 items-center">
            {navItems.map((it) => (
              <NavItem key={it.to} to={it.to} label={it.label} />
            ))}
          </nav>
          {/* Theme toggle or other actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </Container>
      </header>
      {/* Main content */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
'@
  Write-TextFile $appShellPath $appShell
} else {
  Write-Step "AppShell.jsx not found! Please ensure the file exists at src/components/layout/AppShell.jsx."
}

Write-Step "DONE ✅ Reskin applied – คุณสามารถรัน 'npm run build' หรือ 'npm run dev' เพื่อดูผลลัพธ์"
