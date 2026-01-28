<# 
PATCH: Fix src/main.jsx (remove corrupted patch)
- Rewrites src/main.jsx with correct imports + ThemeProvider + Toaster
- Verifies build

Run:
  Set-ExecutionPolicy -Scope Process Bypass -Force
  cd "D:\01 Main Work\Boots\Boots-POS Gemini"
  notepad .\patch-mainjsx-fix.ps1  # paste + save
  .\patch-mainjsx-fix.ps1
#>

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "[MAIN-FIX] $msg" }
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
  if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  Set-Content -LiteralPath $path -Value $content -Encoding UTF8
  Write-Step "Wrote: $path"
}

$root = (Get-Location).Path
Write-Step "Repo root: $root"

$mainPath = Join-Path $root "src\main.jsx"
if (-not (Test-Path -LiteralPath $mainPath)) { throw "src/main.jsx not found" }

$mainFixed = @'
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";
import "./styles/globals.css";

import { ThemeProvider } from "@/providers/ThemeProvider";
import { Toaster } from "@/components/toaster";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="theme">
      <App />
      <Toaster />
    </ThemeProvider>
  </React.StrictMode>
);
'@

Write-TextFile $mainPath $mainFixed

Write-Step "Verifying build..."
& npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

Write-Step "DONE ✅ main.jsx fixed"
Write-Host ""
Write-Host "Run:"
Write-Host "  npm run dev"
