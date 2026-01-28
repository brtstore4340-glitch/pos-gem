<# 
PATCH: Fix fonts, ring classes, and page transitions decisively

– นำเข้า Noto Sans Thai & Inter ใน globals.css
– ตั้งค่า font-family สำหรับ body ผ่าน @layer base
– เพิ่ม custom ring classes ใน @layer utilities
– ปรับ Tailwind config: กำหนด fontFamily.sans และ ringColor
– ติดตั้ง framer-motion
– เขียน AppShell.jsx ใหม่ (header, footer ไม่ยุ่ง แค่เพิ่ม transition wrapper)

วิธีใช้:
1. บันทึกสคริปต์นี้เป็น patch-fix-font-transition.ps1 ใน root ของโปรเจ็กต์ (เช่น D:\01 Main Work\Boots\Boots-POS Gemini).
2. เปิด PowerShell รัน: Set-ExecutionPolicy -Scope Process Bypass -Force
3. รันสคริปต์: .\patch-fix-font-transition.ps1
4. แล้วสั่ง npm install (เพื่อให้ framer-motion ถูกติดตั้ง) หากสคริปต์ไม่ติดตั้งอัตโนมัติ
5. สั่ง npm run build หรือ npm run dev เพื่อทดสอบ

#>

$ErrorActionPreference = "Stop"

function Write-Info($msg) { Write-Host "[PATCH] $msg" }
function Backup-IfExists($path) {
  if (Test-Path -LiteralPath $path) {
    $backup = "$path.bak.$((Get-Date).ToString('yyyyMMdd-HHmmss'))"
    Copy-Item -LiteralPath $path -Destination $backup -Force
    Write-Info "Backup created: $backup"
  }
}

# Resolve project root
$root = (Get-Location).Path
Write-Info "Repo root: $root"

# 1) Update tailwind.config.js
$tailwindPath = Join-Path $root "tailwind.config.js"
if (-not (Test-Path -LiteralPath $tailwindPath)) { throw "tailwind.config.js not found" }
$tailwindContent = @'
/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
        boots: {
          base: {
            DEFAULT: "hsl(var(--boots))",
            foreground: "hsl(var(--boots-foreground))"
          },
          light: "hsl(var(--boots-light))"
        },
        discount: {
          DEFAULT: "hsl(var(--discount))",
          foreground: "hsl(var(--discount-foreground))"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      ringColor: {
        "boots-base": "hsl(var(--boots))",
        "boots-light": "hsl(var(--boots-light))",
        "discount": "hsl(var(--discount))"
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Thai", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
'@

Backup-IfExists $tailwindPath
Set-Content -LiteralPath $tailwindPath -Value $tailwindContent -Encoding UTF8
Write-Info "Replaced tailwind.config.js"

# 2) Update globals.css
$globalsPath = Join-Path $root "src\styles\globals.css"
if (-not (Test-Path -LiteralPath $globalsPath)) { throw "globals.css not found" }
$globalsContent = @'
@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@200;300;400;500;600;700;800;900&display=swap");
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap");

@tailwind base;
@tailwind components;
@tailwind utilities;

/* Base variables and dark mode */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.75rem;

    /* Boots & Discount */
    --boots: 214 65% 50%;
    --boots-light: 214 80% 96%;
    --boots-foreground: 210 40% 98%;
    --discount: 40 90% 60%;
    --discount-foreground: 214 65% 20%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;

    /* Boots & Discount dark */
    --boots: 214 80% 45%;
    --boots-light: 214 70% 20%;
    --boots-foreground: 210 40% 98%;
    --discount: 40 85% 55%;
    --discount-foreground: 210 40% 10%;
  }

  body {
    @apply bg-background text-foreground antialiased;
    font-family: 'Inter', 'Noto Sans Thai', sans-serif;
  }
}

/* Glass effect utilities */
.glass-panel {
  @apply rounded-xl border border-white/30 dark:border-white/10 bg-white/60 dark:bg-black/30 backdrop-blur-lg shadow-lg;
}
.glass-input {
  @apply rounded-md border border-transparent bg-white/80 dark:bg-black/40 backdrop-blur-md px-3 py-2 placeholder:text-slate-400 text-slate-800 dark:text-slate-200 focus:border-slate-300 focus:ring-2 focus:ring-boots-base focus:ring-opacity-50;
}

/* Custom ring classes */
@layer utilities {
  .ring-boots-base   { --tw-ring-color: hsl(var(--boots)); }
  .ring-boots-light  { --tw-ring-color: hsl(var(--boots-light)); }
  .ring-discount     { --tw-ring-color: hsl(var(--discount)); }
}
'@

Backup-IfExists $globalsPath
Set-Content -LiteralPath $globalsPath -Value $globalsContent -Encoding UTF8
Write-Info "Replaced globals.css"

# 3) Install framer-motion (idempotent)
Write-Info "Installing framer-motion..."
npm install framer-motion --save --silent
if ($LASTEXITCODE -ne 0) {
  Write-Info "npm install framer-motion failed – please run 'npm install framer-motion' manually"
}

# 4) Overwrite AppShell.jsx with transition logic
$appShellPath = Join-Path $root "src\components\layout\AppShell.jsx"
if (-not (Test-Path -LiteralPath $appShellPath)) { throw "AppShell.jsx not found" }
$appshellContent = @'
import * as React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  const location = useLocation();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-slate-50/70 dark:bg-black/40 backdrop-blur-md">
        <Container className="py-4 px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="https://store.boots.co.th/images/boots-logo.png" alt="Boots Logo" className="h-8 w-auto object-contain" />
            <span className="font-bold text-xl text-slate-800 dark:text-slate-200">รายการขาย</span>
          </div>
          <nav className="flex flex-wrap gap-2 items-center">
            {navItems.map((it) => (
              <NavItem key={it.to} to={it.to} label={it.label} />
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </Container>
      </header>

      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={{ duration: 0.35, ease: "circOut" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
'@

Backup-IfExists $appShellPath
Set-Content -LiteralPath $appShellPath -Value $appshellContent -Encoding UTF8
Write-Info "Replaced AppShell.jsx"

Write-Info "✅ Patch complete – fonts, ring classes, and transitions updated. Run 'npm install' if framer-motion did not install, then run 'npm run build' or 'npm run dev' to verify."
