# patch-posui-no-empty-line51.ps1
# HARD / DETERMINISTIC / SYSTEMATIC
# Fix EXACT remaining error:
#   pos-gem\src\components\PosUI.jsx 51:13  error  Empty block statement  no-empty
#
# Strategy (deterministic):
# - Patch ONLY around the reported line 51 (1-based)
# - Handles both forms:
#   A) "{}" on the same line
#   B) "{" on line 51 and "}" on line 52 (empty multi-line block)
# - Inserts: /* noop */ inside the empty block
#
# SAFE MODE: ExecutionPolicy only for this session (no persistent change)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
try { Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null } catch {}

$root = "D:\01 Main Work\Boots\Boots-POS Gemini"
Set-Location $root

$path = Join-Path $root "pos-gem\src\components\PosUI.jsx"
if (-not (Test-Path -LiteralPath $path)) { throw "Missing file: $path" }

# Backup
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item -LiteralPath $path -Destination "$path.bak.$ts" -Force
Write-Host "[BACKUP] $path.bak.$ts"

# Load lines (keep structure)
$lines = Get-Content -LiteralPath $path

# Show context (for your verification, deterministic and transparent)
$start = [Math]::Max(0, 45-1)   # show around line 45
$count = 20                    # show 45-64
Write-Host "`n[CONTEXT] $path (lines 45-64, 1-based)`n"
for ($i = $start; $i -lt [Math]::Min($lines.Count, $start + $count); $i++) {
  $ln = $i + 1
  Write-Host ("{0,4}: {1}" -f $ln, $lines[$i])
}

# Patch EXACT target line 51
$target = 51
if ($lines.Count -lt $target) { throw "File has only $($lines.Count) lines; cannot patch line $target." }

$idx = $target - 1
$patched = $false

# Case A: empty block on same line: "{ }" or "{}" (possibly with spaces/tabs)
# We will replace ONLY if the line contains a standalone empty block token.
$line = $lines[$idx]
if ($line -match "\{\s*\}") {
  $lines[$idx] = [regex]::Replace(
    $line,
    "\{\s*\}",
    { param($m) "{ /* noop */ }" }
  )
  $patched = $true
} else {
  # Case B: empty block across two lines: line 51 has "{" (maybe with spaces), line 52 has "}"
  if (($line -match "^\s*\{\s*$") -and ($idx + 1 -lt $lines.Count) -and ($lines[$idx + 1] -match "^\s*\}\s*$")) {
    # Insert comment line between them
    $indent = ""
    if ($line -match "^\s+") { $indent = $matches[0] }
    $lines = @($lines[0..$idx] + ("$indent  /* noop */") + $lines[($idx + 1)..($lines.Count - 1)])
    $patched = $true
  }
}

if (-not $patched) {
  Write-Host "`n[FAIL] Did not find an empty block at line 51 in a deterministic way."
  Write-Host "       That means the empty block is not a simple '{}' or '{' '}' at that line."
  Write-Host "       Next deterministic step: patch by exact ESLint range requires the exact lines 49-53 from disk."
  Write-Host "       Run this and paste output:"
  Write-Host "       Get-Content -LiteralPath `"$path`" | Select-Object -Skip 48 -First 6 | ForEach-Object { `$_ }"
  exit 2
}

# Write back UTF-8 no BOM
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($path, ($lines -join "`n") + "`n", $enc)
Write-Host "`n[PATCHED] Inserted /* noop */ into empty block at/around line 51"

# Re-run lint:fix
Write-Host "`n[RUN] npm run lint:fix`n"
npm run lint:fix
