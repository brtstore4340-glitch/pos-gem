# patch-react-refresh-warnings.ps1
# HARD / DETERMINISTIC / SYSTEMATIC
# Goal: eliminate react-refresh/only-export-components warnings by moving non-component exports
# into companion *.constants.js files (no rule-disabling).
#
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

function Read-All([string]$Path) {
  return Get-Content -LiteralPath $Path -Raw
}

function Patch-File([string]$Path, [scriptblock]$Mutator) {
  if (-not (Test-Path -LiteralPath $Path)) {
    Write-Host "[SKIP] Missing: $Path"
    return $false
  }
  $orig = Read-All $Path
  $new  = & $Mutator $orig
  if ($new -ne $orig) {
    Backup-File $Path
    Write-Utf8NoBom $Path $new
    Write-Host "[PATCHED] $Path"
    return $true
  }
  Write-Host "[OK] $Path (no change)"
  return $false
}

function Ensure-Constants-File([string]$Path, [string]$Content) {
  if (Test-Path -LiteralPath $Path) { return }
  Write-Utf8NoBom $Path ($Content.TrimEnd() + "`n")
  Write-Host "[CREATED] $Path"
}

# -----------------------------
# Rule-specific fix patterns
# -----------------------------
# Pattern A (common in shadcn button.jsx):
#   export { buttonVariants }
#   or: export const buttonVariants = cva(...)
# We move buttonVariants to button.constants.js and re-export from there (or import it).
function Fix-ButtonOnlyExportComponents([string]$filePath) {
  $changed = $false
  $dir = Split-Path -Parent $filePath
  $constantsPath = Join-Path $dir "button.constants.js"

  $changed = Patch-File $filePath {
    param($t)

    # If file already imports from button.constants.js, do nothing.
    if ($t -match "from\s+['""]\./button\.constants\.js['""]") { return $t }

    # Find an exported const named buttonVariants (very common)
    $m = [regex]::Match($t, "(?s)(^|\n)\s*export\s+const\s+buttonVariants\s*=\s*.*?;\s*(\n|$)")
    if (-not $m.Success) {
      # Another common form: const buttonVariants = ...; export { buttonVariants };
      $m2 = [regex]::Match($t, "(?s)(^|\n)\s*const\s+buttonVariants\s*=\s*.*?;\s*(\n|$)")
      $m3 = [regex]::Match($t, "(?m)^\s*export\s*\{\s*buttonVariants\s*\}\s*;?\s*$")
      if (-not ($m2.Success -and $m3.Success)) { return $t }

      $decl = $m2.Value.Trim()
      # Remove declaration + named export
      $t2 = $t
      $t2 = $t2.Replace($m2.Value, "`n")
      $t2 = [regex]::Replace($t2, "(?m)^\s*export\s*\{\s*buttonVariants\s*\}\s*;?\s*$\s*", "", 1)

      Ensure-Constants-File $constantsPath @"
$decl
export { buttonVariants };
"@

      # Add import near top (after existing imports)
      $t2 = [regex]::Replace(
        $t2,
        "(?m)^(import .+\n)+",
        { param($mm) $mm.Value + "import { buttonVariants } from './button.constants.js';`n" },
        1
      )
      if ($t2 -notmatch "import\s+\{\s*buttonVariants\s*\}\s+from\s+['""]\./button\.constants\.js['""]") {
        # If no imports block matched, just prepend
        $t2 = "import { buttonVariants } from './button.constants.js';`n" + $t2
      }
      return $t2
    }

    # Case: export const buttonVariants = ...;
    $decl = $m.Value.Trim()
    $t2 = $t.Replace($m.Value, "`n")

    Ensure-Constants-File $constantsPath @"
$decl
"@

    # Replace in original: define via import (so file exports only components)
    $t2 = [regex]::Replace(
      $t2,
      "(?m)^(import .+\n)+",
      { param($mm) $mm.Value + "import { buttonVariants } from './button.constants.js';`n" },
      1
    )
    if ($t2 -notmatch "import\s+\{\s*buttonVariants\s*\}\s+from\s+['""]\./button\.constants\.js['""]") {
      $t2 = "import { buttonVariants } from './button.constants.js';`n" + $t2
    }

    return $t2
  }

  return $changed
}

# Generic helper:
# If a file exports any non-component symbol (const/function) AND also exports a component,
# we move ALL named exports that are NOT components into <basename>.constants.js
# Deterministic heuristic for component export:
#   export default function X(...)
#   export function X(...)
#   export const X = (...) => ( <JSX>
# This is conservative: if unsure, it will NOT modify.
function Fix-OnlyExportComponentsGeneric([string]$filePath) {
  $dir = Split-Path -Parent $filePath
  $base = [System.IO.Path]::GetFileNameWithoutExtension($filePath)
  $constantsPath = Join-Path $dir "$base.constants.js"

  return Patch-File $filePath {
    param($t)

    if ($t -match "from\s+['""]\./$base\.constants\.js['""]") { return $t }

    # Must have at least one component export
    $hasComponent =
      ($t -match "(?m)^\s*export\s+default\s+function\s+\w+\s*\(") -or
      ($t -match "(?m)^\s*export\s+function\s+\w+\s*\(") -or
      ($t -match "(?m)^\s*export\s+const\s+\w+\s*=\s*\(?.*=>\s*\(\s*<")

    if (-not $hasComponent) { return $t }

    # Find non-component exports: exported const/function that does NOT look like a component
    # Heuristic: name starting with lowercase OR content not returning JSX.
    $exportBlocks = New-Object System.Collections.Generic.List[string]
    $t2 = $t

    # export const foo = ...;
    foreach ($m in [regex]::Matches($t2, "(?s)(^|\n)\s*export\s+const\s+([A-Za-z_]\w*)\s*=\s*.*?;\s*(\n|$)")) {
      $name = $m.Groups[2].Value
      # skip likely components (PascalCase)
      if ($name -match "^[A-Z]") { continue }
      $exportBlocks.Add($m.Value.Trim())
    }

    # export function foo(...) { ... }
    foreach ($m in [regex]::Matches($t2, "(?s)(^|\n)\s*export\s+function\s+([A-Za-z_]\w*)\s*\(.*?\)\s*\{.*?\}\s*(\n|$)")) {
      $name = $m.Groups[2].Value
      if ($name -match "^[A-Z]") { continue }
      $exportBlocks.Add($m.Value.Trim())
    }

    if ($exportBlocks.Count -eq 0) { return $t }

    # Remove those blocks from original
    foreach ($blk in $exportBlocks) {
      $t2 = $t2.Replace($blk, "`n")
    }

    # Create constants file exporting them
    $content = ($exportBlocks -join "`n`n") + "`n"
    Ensure-Constants-File $constantsPath $content

    # Import moved names
    $names = @()
    foreach ($blk in $exportBlocks) {
      $mName = [regex]::Match($blk, "export\s+(const|function)\s+([A-Za-z_]\w*)")
      if ($mName.Success) { $names += $mName.Groups[2].Value }
    }
    $importLine = "import { " + ($names -join ", ") + " } from './$base.constants.js';`n"

    # Insert import after existing imports block
    $t2a = [regex]::Replace(
      $t2,
      "(?m)^(import .+\n)+",
      { param($mm) $mm.Value + $importLine },
      1
    )
    if ($t2a -eq $t2) {
      $t2a = $importLine + $t2
    }

    return $t2a
  }
}

# -----------------------------
# Apply fixes to the 5 files producing warnings
# -----------------------------
$files = @(
  "src\components\ui\button.jsx",
  "src\context\AuthContext.jsx",
  "src\context\CartContext.jsx",
  "src\context\ThemeContext.jsx",
  "src\providers\ThemeProvider.jsx"
) | ForEach-Object { Join-Path $root $_ }

# Prefer exact fix for shadcn button.jsx
Fix-ButtonOnlyExportComponents $files[0] | Out-Null

# Conservative generic fix for the remaining 4
Fix-OnlyExportComponentsGeneric $files[1] | Out-Null
Fix-OnlyExportComponentsGeneric $files[2] | Out-Null
Fix-OnlyExportComponentsGeneric $files[3] | Out-Null
Fix-OnlyExportComponentsGeneric $files[4] | Out-Null

Write-Host "`n[RUN] npm run lint`n"
npm run lint
