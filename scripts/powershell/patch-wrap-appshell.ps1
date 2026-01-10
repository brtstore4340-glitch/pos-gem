[CmdletBinding()]
param(
  [string]$RepoRoot=".",
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference="Stop"

function Ensure-Dir([string]$p){
  if(!(Test-Path -LiteralPath $p)){
    New-Item -ItemType Directory -Path $p -Force | Out-Null
  }
}

function Backup-File([string]$path,[string]$backupRoot,[string]$rootAbs){
  if(!(Test-Path -LiteralPath $path)){ return }
  $rel = $path.Substring($rootAbs.Length).TrimStart('\','/')
  $dest = Join-Path $backupRoot $rel
  Ensure-Dir (Split-Path $dest -Parent)
  Copy-Item -LiteralPath $path -Destination $dest -Force
}

function Save-Text([string]$path,[string]$text){
  Ensure-Dir (Split-Path $path -Parent)
  if($DryRun){
    Write-Host "[INFO] DryRun: would write $path"
    return
  }
  Set-Content -LiteralPath $path -Value $text -Encoding UTF8
  Write-Host "[INFO] Wrote: $path"
}

function Ensure-Import([string]$raw,[string]$importLine){
  if($raw -match [regex]::Escape($importLine)){ return $raw }
  $m = [regex]::Match($raw, "(?ms)^(?:\s*import[^\n]*\n)+")
  if($m.Success){
    return $raw.Substring(0,$m.Length) + $importLine + "`n" + $raw.Substring($m.Length)
  }
  return $importLine + "`n" + $raw
}

$root = (Resolve-Path $RepoRoot).Path
$ts = (Get-Date).ToString("yyyyMMdd_HHmmss")
$logDir = Join-Path $root "ai-logs"
$backupRoot = Join-Path (Join-Path $root "ai-backups") ("wrap_appshell_" + $ts)
Ensure-Dir $logDir
Ensure-Dir $backupRoot

$main = Join-Path $root "src\main.jsx"
if(!(Test-Path -LiteralPath $main)){ throw "Missing src/main.jsx at $main" }

# 1) Create AppShell.jsx (layout + DynamicNav)
$appShellPath = Join-Path $root "src\AppShell.jsx"

# NOTE: Use double-quoted here-string so this script can be embedded safely in an outer @' ... '@ writer.
$appShell = @"
import React from "react";
import DynamicNav from "./components/nav/DynamicNav";
import { db, auth } from "./firebase";

export default function AppShell({ children }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r">
        <DynamicNav db={db} auth={auth} />
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
"@

if(Test-Path -LiteralPath $appShellPath){
  Backup-File -path $appShellPath -backupRoot $backupRoot -rootAbs $root
}

if($DryRun){
  $previewShell = Join-Path $logDir ("preview_AppShell_" + $ts + ".txt")
  Save-Text -path $previewShell -text $appShell
  Write-Host "[INFO] DryRun preview written: $previewShell"
} else {
  Save-Text -path $appShellPath -text $appShell
}

# 2) Patch main.jsx to wrap rendered App with <AppShell>...</AppShell>
$raw = Get-Content -LiteralPath $main -Raw

if($raw -match "<AppShell\b"){
  throw "Already patched: AppShell already present in main.jsx"
}

$raw2 = Ensure-Import $raw 'import AppShell from "./AppShell";'

$patterns = @(
  "(?s)(<AppAuth\b[^>]*\/>)",
  "(?s)(<App\b[^>]*\/>)",
  "(?s)(<RouterProvider\b[^>]*\/>)"
)

$wrapped = $false
foreach($pat in $patterns){
  if($raw2 -match $pat){
    $raw2 = [regex]::Replace($raw2, $pat, "<AppShell>`n      `$1`n    </AppShell>", 1)
    $wrapped = $true
    break
  }
}

if(-not $wrapped){
  throw "Could not find <App /> or <AppAuth /> or <RouterProvider /> in main.jsx to wrap."
}

Backup-File -path $main -backupRoot $backupRoot -rootAbs $root

if($DryRun){
  $previewMain = Join-Path $logDir ("preview_main_" + $ts + ".txt")
  Save-Text -path $previewMain -text $raw2
  Write-Host "[INFO] DryRun preview written: $previewMain"
  Write-Host "[INFO] Backup would be at: $backupRoot"
} else {
  Save-Text -path $main -text $raw2
  Write-Host "[INFO] Patched: $main"
  Write-Host "[INFO] Backup: $backupRoot"
}

Write-Host "[INFO] DONE"
