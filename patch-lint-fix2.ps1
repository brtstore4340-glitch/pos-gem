# patch-lint-fix2.ps1
# Goal: make `npm run lint:fix` pass (0 errors). Warnings are allowed by eslint unless your CI treats them as errors.
# Fix remaining error: pos-gem/src/components/PosUI.jsx -> no-empty at line ~51
# SAFE MODE: ExecutionPolicy only for this session.

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
try { Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null } catch {}

$root = "D:\01 Main Work\Boots\Boots-POS Gemini"
Set-Location $root

function Backup-File([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $ts = Get-Date -Format "yyyyMMdd-HHmmss"
  Copy-Item -LiteralPath $Path -Destination "$Path.bak.$ts" -Force
}

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

function Patch-PosUi-NoEmpty([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    Write-Host "[SKIP] Missing: $Path"
    return
  }

  $text = Get-Content -LiteralPath $Path -Raw

  # Systematic: replace ONLY truly empty blocks with a harmless comment
  # - catch (...) { }
  # - if (...) { }
  # - else { }
  $patched = $text
  $patched = [regex]::Replace(
    $patched,
    "catch\s*\(([^)]*)\)\s*\{\s*\}",
    { param($m) "catch (" + $m.Groups[1].Value + ") { /* noop */ }" }
  )
  $patched = [regex]::Replace(
    $patched,
    "(\bif\s*\([^\)]*\))\s*\{\s*\}",
    { param($m) $m.Groups[1].Value + " { /* noop */ }" }
  )
  $patched = [regex]::Replace(
    $patched,
    "(\belse)\s*\{\s*\}",
    { param($m) $m.Groups[1].Value + " { /* noop */ }" }
  )

  # Extra-safe fallback: if eslint still flags an empty block, we patch the SPECIFIC line number (51) by inserting a comment
  # without relying on JS parsing. This is deterministic and minimal.
  if ($patched -eq $text) {
    $lines = Get-Content -LiteralPath $Path
    if ($lines.Count -ge 51) {
      $i = 50  # 0-based index for line 51
      $line = $lines[$i]
      # If line looks like "{ }" or "{}" after trimming, add comment inside.
      $trim = ($line -replace "\s+", "")
      if ($trim -eq "{}" -or $trim -eq "{ }".Replace(" ","")) {
        $lines[$i] = $line -replace "\{\s*\}", "{ /* noop */ }"
        $patched = ($lines -join "`n") + "`n"
      }
    }
  }

  if ($patched -ne $text) {
    Backup-File $Path
    Write-Utf8NoBom $Path $patched
    Write-Host "[PATCHED] $Path"
  } else {
    Write-Host "[NO CHANGE] $Path (if lint still errors, paste lines 45-60 and I will patch exact block)"
  }
}

# Apply fix to the failing file
Patch-PosUi-NoEmpty (Join-Path $root "pos-gem\src\components\PosUI.jsx")

Write-Host "`n[RUN] npm run lint:fix`n"
npm run lint:fix
