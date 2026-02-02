# patch-auth-fix.ps1
# SafeMode patch for: src\modules\auth\AuthContext.jsx
# - Backup before patch
# - Always write tools\logs\summary.txt

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-Dir([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path | Out-Null }
}

function Write-Log([string]$Path, [string]$Msg) {
  $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  Add-Content -LiteralPath $Path -Value "[$ts] $Msg"
}

function Save-TextUtf8NoBom([string]$Path, [string]$Text) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

$repoRoot = (Get-Location).Path
$tsId = (Get-Date).ToString("yyMMdd-HHmmss")
$toolsDir = Join-Path $repoRoot "tools"
$logsDir  = Join-Path $toolsDir "logs"
$bakRoot  = Join-Path $toolsDir "backups"
$bakDir   = Join-Path $bakRoot ("auth-fix-" + $tsId)

New-Dir $toolsDir
New-Dir $logsDir
New-Dir $bakRoot
New-Dir $bakDir

$logPath = Join-Path $logsDir ("patch-auth-fix-" + $tsId + ".log")
$summaryPath = Join-Path $logsDir "summary.txt"
$lastBakPath = Join-Path $toolsDir "LAST_BACKUP_DIR.txt"

# Ensure summary exists even if fail
Save-TextUtf8NoBom $summaryPath "PENDING`r`n"

try {
  Write-Log $logPath "Repo root: $repoRoot"
  Write-Log $logPath "Backup dir: $bakDir"
  Save-TextUtf8NoBom $lastBakPath $bakDir

  $targetRel = "src\modules\auth\AuthContext.jsx"
  $target = Join-Path $repoRoot $targetRel

  if (-not (Test-Path -LiteralPath $target)) {
    throw "Target file not found: $targetRel"
  }

  # Backup target
  $bakTarget = Join-Path $bakDir ("AuthContext.jsx.bak")
  Copy-Item -LiteralPath $target -Destination $bakTarget -Force
  Write-Log $logPath "Backed up: $targetRel -> $bakTarget"

  $txt = Get-Content -LiteralPath $target -Raw

  # Normalize newlines to `n internally
  $txt = $txt -replace "`r`n", "`n"
  $txt = $txt -replace "`r", "`n"

  $lines = $txt -split "`n", -1

  # 1) Fix React import block (remove corrupted block and insert canonical import)
  $reactImportIdx = -1
  for ($i=0; $i -lt [Math]::Min($lines.Count, 80); $i++) {
    if ($lines[$i] -match '^\s*import\s+React\b') { $reactImportIdx = $i; break }
  }

  if ($reactImportIdx -ge 0) {
    $endIdx = -1
    for ($j=$reactImportIdx; $j -lt [Math]::Min($lines.Count, $reactImportIdx + 40); $j++) {
      if ($lines[$j] -match 'from\s+["'']react["'']\s*;') { $endIdx = $j; break }
    }
    if ($endIdx -lt 0) {
      # If broken (no from "react"; found), assume it should be replaced up to next line that ends with ';' (best-effort)
      for ($j=$reactImportIdx; $j -lt [Math]::Min($lines.Count, $reactImportIdx + 10); $j++) {
        if ($lines[$j] -match ';\s*$') { $endIdx = $j; break }
      }
      if ($endIdx -lt 0) { $endIdx = [Math]::Min($lines.Count-1, $reactImportIdx + 5) }
    }

    $canonicalReactImport = 'import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";'
    $newLines = New-Object System.Collections.Generic.List[string]
    for ($i=0; $i -lt $lines.Count; $i++) {
      if ($i -eq $reactImportIdx) {
        $newLines.Add($canonicalReactImport)
        $i = $endIdx
        continue
      }
      $newLines.Add($lines[$i])
    }
    $lines = $newLines.ToArray()
    Write-Log $logPath "Patched React import block."
  } else {
    Write-Log $logPath "WARN: React import not found in first 80 lines (skipped import patch)."
  }

  # 2) Remove stray top-level 'async function logout' accidentally injected near the header
  #    Only if it's within first ~120 lines (symptom you showed).
  $logoutTopIdx = -1
  for ($i=0; $i -lt [Math]::Min($lines.Count, 140); $i++) {
    if ($lines[$i] -match '^\s*async\s+function\s+logout\s*\(') { $logoutTopIdx = $i; break }
  }

  if ($logoutTopIdx -ge 0) {
    # Remove until matching brace close (best-effort brace counting)
    $brace = 0
    $end = $logoutTopIdx
    $started = $false
    for ($j=$logoutTopIdx; $j -lt $lines.Count; $j++) {
      $l = $lines[$j]
      foreach ($ch in $l.ToCharArray()) {
        if ($ch -eq '{') { $brace++; $started = $true }
        elseif ($ch -eq '}') { $brace-- }
      }
      $end = $j
      if ($started -and $brace -le 0) { break }
      if ($j -ge ($logoutTopIdx + 80)) { break } # safety
    }

    $newLines2 = New-Object System.Collections.Generic.List[string]
    for ($i=0; $i -lt $lines.Count; $i++) {
      if ($i -eq $logoutTopIdx) { $i = $end; continue }
      $newLines2.Add($lines[$i])
    }
    $lines = $newLines2.ToArray()
    Write-Log $logPath "Removed stray top-level logout() block (lines $logoutTopIdx..$end)."
  } else {
    Write-Log $logPath "No stray top-level logout() found (ok)."
  }

  $txt2 = ($lines -join "`n")

  # 3) Fix purity: useRef(Date.now()) -> useRef(0)
  $txt2 = $txt2 -replace 'useRef\(\s*Date\.now\(\)\s*\)', 'useRef(0)'

  # 4) Fix lint: logout accessed before declared (replace logout("disabled") with inline signOut)
  #    (Best-effort: handles "disabled" with single/double quotes)
  $inline = @'
setReason("disabled");
setSelectedProfile(null);
try { void signOut(auth); } catch (_e) { void _e; }
'@.TrimEnd()

  # replace both single and double quote call sites
  $txt2 = $txt2 -replace 'logout\(\s*["'']disabled["'']\s*\)\s*;', ($inline -replace "`r?`n", "`n")

  # Restore newlines to CRLF for Windows
  $txt2 = $txt2 -replace "`n", "`r`n"

  Save-TextUtf8NoBom $target $txt2
  Write-Log $logPath "Wrote patched file: $targetRel"

  Save-TextUtf8NoBom $summaryPath @"
OK
- Patched: $targetRel
- Backup: $bakTarget
- Log: $logPath
Next:
1) npm run lint
2) npm run build
If build still fails to resolve 'firebase/auth': npm i firebase
"@
}
catch {
  $err = $_.Exception.Message
  Write-Log $logPath "ERROR: $err"

  Save-TextUtf8NoBom $summaryPath @"
FAILED
$err
See log: $logPath
Backup dir: $bakDir
"@
  throw
}
finally {
  # Always ensure summary exists
  if (-not (Test-Path -LiteralPath $summaryPath)) {
    Save-TextUtf8NoBom $summaryPath "FAILED`r`n(summary missing due to unexpected error)"
  }
}
