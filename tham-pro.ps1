Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
[switch]$Init,
[switch]$Apply,
[switch]$Validate,
[string]$Root = ""
)

# =========================

# THAM-PRO: SAFE PATCH TOOL

# =========================

$NL = "`r`n"

function Write-OK([string]$msg) { Write-Host ("[PASS] {0}" -f $msg) -ForegroundColor Green }
function Write-INFO([string]$msg) { Write-Host ("[INFO] {0}" -f $msg) -ForegroundColor Cyan }
function Write-WARN([string]$msg) { Write-Host ("[WARN] {0}" -f $msg) -ForegroundColor Yellow }
function Write-FAIL([string]$msg) { Write-Host ("[FAIL] {0}" -f $msg) -ForegroundColor Red }

function Read-TextFile([string]$path) {
if (-not (Test-Path -LiteralPath $path)) { throw "File not found: $path" }
return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}

function Write-TextFile([string]$path, [string]$content) {
$dir = Split-Path -Parent $path
if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($path, $content, $enc)
}

function Backup-File([string]$path) {
if (-not (Test-Path -LiteralPath $path)) { return $null }
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$bak = "$path.bak_$ts"
Copy-Item -LiteralPath $path -Destination $bak -Force
return $bak
}

function Restore-Backup([string]$bakPath, [string]$targetPath) {
if (-not $bakPath) { return }
if (-not (Test-Path -LiteralPath $bakPath)) { throw "Backup missing: $bakPath" }
Copy-Item -LiteralPath $bakPath -Destination $targetPath -Force
}

function Find-RepoRoot([string]$start) {
$p = if ($start -and $start.Trim().Length -gt 0) { (Resolve-Path -LiteralPath $start).Path } else { (Get-Location).Path }
$cur = $p
while ($true) {
$pkg = Join-Path $cur "package.json"
$fnPkg = Join-Path $cur "functions\package.json"
if (Test-Path -LiteralPath $pkg -PathType Leaf) { return $cur }
if (Test-Path -LiteralPath $fnPkg -PathType Leaf) { return $cur }
$parent = Split-Path -Parent $cur
if (-not $parent -or $parent -eq $cur) { break }
$cur = $parent
}
throw "Repo root not found (no package.json). Start: $p"
}

function Get-NpmScripts([string]$pkgPath) {
if (-not (Test-Path -LiteralPath $pkgPath -PathType Leaf)) { return @{} }
$json = Read-TextFile $pkgPath | ConvertFrom-Json
if ($null -eq $json.scripts) { return @{} }
$scripts = @{}
foreach ($p in $json.scripts.PSObject.Properties) { $scripts[$p.Name] = [string]$p.Value }
return $scripts
}

function Invoke-Npm([string]$wd, [string[]]$args) {
if (-not (Test-Path -LiteralPath $wd -PathType Container)) { throw "Working dir not found: $wd" }
$npmExe = "npm"
$p = Start-Process -FilePath $npmExe -ArgumentList $args -WorkingDirectory $wd -NoNewWindow -PassThru -Wait
if ($p.ExitCode -ne 0) { throw ("npm {0} failed (exit {1}) in {2}" -f ($args -join " "), $p.ExitCode, $wd) }
}

function Invoke-NodeCheck([string]$wd, [string]$filePath) {
if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) { throw "Node check target missing: $filePath" }
$p = Start-Process -FilePath "node" -ArgumentList @("--check", $filePath) -WorkingDirectory $wd -NoNewWindow -PassThru -Wait
if ($p.ExitCode -ne 0) { throw ("node --check failed (exit {0}): {1}" -f $p.ExitCode, $filePath) }
}

function Assert-NoForbiddenSequences([string]$text, [string]$label) {
$bad = @("{{/*", "{$/*", ");const", "`$_")
foreach ($s in $bad) {
if ($text.Contains($s)) { throw "Forbidden sequence found in $label : $s" }
}
}

function Get-PatchMarkerName([string]$code) {
$m = [regex]::Match($code, "(?m)^\s*//\s*BEGIN:\s*THAM:([A-Za-z0-9_-]+)\s*$")
if ($m.Success) { return $m.Groups[1].Value }
return $null
}

function Assert-PatchHasMarkers([hashtable]$patch) {
$code = [string]$patch.code
$name = Get-PatchMarkerName $code
if (-not $name) { throw "Patch '$($patch.id)' missing BEGIN marker" }
$endOk = [regex]::IsMatch($code, "(?m)^\s*//\s*END:\s*THAM:$([regex]::Escape($name))\s*$")
if (-not $endOk) { throw "Patch '$($patch.id)' missing END marker for THAM:$name" }
}

function Apply-Insert([string]$text, [string]$anchor, [string]$code, [bool]$before) {
$idx = $text.IndexOf($anchor, [StringComparison]::Ordinal)
if ($idx -lt 0) { throw "Anchor not found" }
if ($before) {
return $text.Substring(0, $idx) + $NL + $code + $NL + $text.Substring($idx)
} else {
$idx2 = $idx + $anchor.Length
return $text.Substring(0, $idx2) + $NL + $code + $NL + $text.Substring($idx2)
}
}

function Apply-Patch([string]$repoRoot, [hashtable]$patch, [hashtable]$rollbackMap) {
Assert-PatchHasMarkers $patch

$rel = [string]$patch.file
if (-not $rel -or $rel.Trim().Length -eq 0) { throw "Patch '$($patch.id)' missing file" }
$path = Join-Path $repoRoot $rel
$code = [string]$patch.code

Assert-NoForbiddenSequences $code ("patch-code:$($patch.id)")

$marker = Get-PatchMarkerName $code
if ($marker -and (Test-Path -LiteralPath $path -PathType Leaf)) {
$existing = Read-TextFile $path
if ($existing -match "(?m)^\s*//\s*BEGIN:\s*THAM:$([regex]::Escape($marker))\s*$") {
Write-INFO ("Skip already-applied patch {0} ({1})" -f $patch.id, $rel)
return @()
}
}

$createdOrModified = New-Object System.Collections.Generic.List[string]

$insertBefore = $null
$insertAfter = $null
if ($patch.ContainsKey("insert_before")) { $insertBefore = [string]$patch.insert_before }
if ($patch.ContainsKey("insert_after")) { $insertAfter = [string]$patch.insert_after }

if ($insertAfter -eq "**CREATE_IF_MISSING**") {
if (Test-Path -LiteralPath $path -PathType Leaf) {
Write-INFO ("Exists, not creating: {0}" -f $rel)
return @()
}
Write-INFO ("Create: {0}" -f $rel)
Write-TextFile $path ($code.TrimEnd() + $NL)
$createdOrModified.Add($path) | Out-Null
return $createdOrModified
}

if ($insertAfter -eq "**CREATE_OR_REPLACE**") {
Write-INFO ("Create/Replace: {0}" -f $rel)
$bak = Backup-File $path
if ($bak) { $rollbackMap[$path] = $bak }
Write-TextFile $path ($code.TrimEnd() + $NL)
$createdOrModified.Add($path) | Out-Null
return $createdOrModified
}

if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Target file missing: $rel" }

$orig = Read-TextFile $path
$bak2 = Backup-File $path
if ($bak2) { $rollbackMap[$path] = $bak2 }

$newText = $null

if ($insertAfter -eq "**EOF**") {
$t = $orig
if (-not $t.EndsWith($NL)) { $t = $t + $NL }
$newText = $t + $code.TrimEnd() + $NL
} elseif ($insertBefore) {
$newText = Apply-Insert $orig $insertBefore $code $true
} elseif ($insertAfter) {
$newText = Apply-Insert $orig $insertAfter $code $false
} else {
throw "Patch '$($patch.id)' must define insert_before or insert_after"
}

Assert-NoForbiddenSequences $newText ("patched:$rel")

Write-TextFile $path $newText
$createdOrModified.Add($path) | Out-Null
return $createdOrModified
}

function Detect-Method8AlreadyImplemented([string]$cartText) {
if ($cartText -match "(?m)\bcase\s+8\s*:") { return $true }
if ($cartText -match "(?m)\bmethod\s*(===|==)\s*8\b") { return $true }
if ($cartText -match "(?m)\bMETHOD\s*8\b") { return $true }
return $false
}

function Detect-CartCalcTarget([string]$cartText) {
if ($cartText -match "(?m)\bmodule.exports\s*=\s*(async\s+)?function\b") {
return @{ kind = "module_function"; name = "" }
}

$exported = New-Object System.Collections.Generic.HashSet[string]([StringComparer]::OrdinalIgnoreCase)
foreach ($m in [regex]::Matches($cartText, "(?m)\bmodule.exports.([A-Za-z_]\w*)\b")) { [void]$exported.Add($m.Groups[1].Value) }
foreach ($m in [regex]::Matches($cartText, "(?m)\bexports.([A-Za-z_]\w*)\b")) { [void]$exported.Add($m.Groups[1].Value) }

$candidates = @(
"calculateCart","computeCart","processCart","buildCart","recalcCart","calculateTotals","getCartSummary","calculateSummary","calculate"
)

$hits = @()
foreach ($c in $candidates) {
if ($exported.Contains($c)) { $hits += $c }
}

if ($hits.Count -eq 1) { return @{ kind = "export_member"; name = $hits[0] } }

foreach ($c in $candidates) {
if ($cartText -match "(?m)\bmodule.exports\s*=\s*$([regex]::Escape($c))\b") { return @{ kind = "module_assign"; name = $c } }
if ($cartText -match "(?m)\bexport\s+default\s+$([regex]::Escape($c))\b") { return @{ kind = "export_default"; name = $c } }
}

return $null
}

function Assert-NoClientNormalization([string]$repoRoot) {
$paths = @(
"src\hooks\useCart.js",
"src\components\PosUI.jsx",
"functions\src\components\PosUI.jsx"
)

$needleA = "function normalizeKey(key)"
$needleB = ".replace(/[_\s]+/g"
$needleC = ".replace(/[()]/g"

foreach ($rel in $paths) {
$p = Join-Path $repoRoot $rel
if (Test-Path -LiteralPath $p -PathType Leaf) {
$t = Read-TextFile $p
if ($t.Contains($needleA) -or $t.Contains($needleB) -or $t.Contains($needleC)) {
throw "Client-side normalization detected in: $rel"
}
}
}
}

function Run-Validation([string]$repoRoot, [string[]]$changedFiles) {
Write-INFO "Sanity: node --check (changed .js only)"
foreach ($f in $changedFiles) {
if ($f -and (Test-Path -LiteralPath $f) -and ([IO.Path]::GetExtension($f).ToLowerInvariant() -eq ".js")) {
Invoke-NodeCheck $repoRoot $f
}
}
Write-OK "Node syntax check OK"

Assert-NoClientNormalization $repoRoot
Write-OK "Client normalization guard OK"

$rootPkg = Join-Path $repoRoot "package.json"
$rootScripts = Get-NpmScripts $rootPkg

$fnDir = Join-Path $repoRoot "functions"
$fnPkg = Join-Path $fnDir "package.json"
$fnScripts = if (Test-Path -LiteralPath $fnPkg) { Get-NpmScripts $fnPkg } else { @{} }

function Run-ScriptsIfPresent([string]$wd, [hashtable]$scripts) {
if ($scripts.Count -eq 0) { return }
$order = @()


if ($scripts.ContainsKey("lint")) { $order += "lint" }
if ($scripts.ContainsKey("eslint")) { $order += "eslint" }
if ($scripts.ContainsKey("prettier")) { $order += "prettier" }
if ($scripts.ContainsKey("format")) { $order += "format" }

foreach ($s in $order) {
  Write-INFO ("npm run {0} @ {1}" -f $s, $wd)
  Invoke-Npm $wd @("run", $s)
  Write-OK ("{0} OK" -f $s)
}

if ($scripts.ContainsKey("build")) {
  Write-INFO ("npm run build @ {0}" -f $wd)
  Invoke-Npm $wd @("run", "build")
  Write-OK "build OK"
} elseif ($scripts.ContainsKey("dev")) {
  throw "No build script found (dev exists but is not safe to run non-interactively)."
} else {
  throw "No build or dev script found for validation in: $wd"
}


}

Write-INFO "Validation: root"
Run-ScriptsIfPresent $repoRoot $rootScripts

if (Test-Path -LiteralPath $fnPkg) {
Write-INFO "Validation: functions"
Run-ScriptsIfPresent $fnDir $fnScripts
}

Write-OK "VALIDATION OK"
}

function Build-PatchPlan([string]$repoRoot) {
$cartRel = "functions\src\services\cartService.js"
$cartPath = Join-Path $repoRoot $cartRel
if (-not (Test-Path -LiteralPath $cartPath -PathType Leaf)) { throw "Missing required file: $cartRel" }

$cartText = Read-TextFile $cartPath

if (Detect-Method8AlreadyImplemented $cartText) {
throw "cartService.js already appears to implement Method 8 logic (ambiguous). Fail-safe."
}

$target = Detect-CartCalcTarget $cartText
if (-not $target) {
throw "Unable to determine cart calculation export target in cartService.js (fail-safe)."
}

$fieldMapperRel = "functions\src\utils\fieldMapper.js"
$fieldMapperCode = @
'use strict';

// BEGIN: THAM:FIELD_MAPPER_MODULE1
function normalizeKey(key) {
return String(key)
.trim()
.toUpperCase()
.replace(/[_\s]+/g, ' ')
.replace(/[()]/g, '');
}

const FIELD_MAP = {
'DESCRIPTION PRINT': 'name',
'REG PRICE': 'unitPrice',
'DEAL PRICE': 'dealPrice',
'DEAL QTY': 'dealQty',
'METHOD': 'method'
};

function safeNumber(value) {
if (value === null || value === undefined) return 0;
const n = parseFloat(String(value).trim());
return Number.isFinite(n) ? n : 0;
}

function safeInt(value) {
if (value === null || value === undefined) return 0;
const n = parseInt(String(value).trim(), 10);
return Number.isFinite(n) ? n : 0;
}

function mapFieldsToItem(raw) {
const src = (raw && typeof raw === 'object') ? raw : {};
const out = Object.assign({}, src);

for (const k of Object.keys(src)) {
const norm = normalizeKey(k);
const mapped = FIELD_MAP[norm];
if (mapped) out[mapped] = src[k];
}

if (out.name !== undefined && out.name !== null) out.name = String(out.name).trim();
if (out.unitPrice !== undefined) out.unitPrice = safeNumber(out.unitPrice);
if (out.dealPrice !== undefined) out.dealPrice = safeNumber(out.dealPrice);
if (out.dealQty !== undefined) out.dealQty = safeInt(out.dealQty);
if (out.method !== undefined) out.method = safeInt(out.method);

return out;
}

/**

* Method 8 — Buy N Get 1 Free
* Interpretation A (DEFAULT):
* dealQty = N
* freeItems = floor(qty / dealQty)
* payableQty = qty - freeItems
*
* Alternative Interpretation B (DOCUMENTED / TESTED ONLY):
* dealQty = N
* group = N + 1
* freeItems = floor(qty / group)
* payableQty = qty - freeItems
  */
  function applyMethod8PromotionA(qty, dealQty) {
  const q = safeInt(qty);
  const n = safeInt(dealQty);
  if (q <= 0 || n <= 0) return { freeItems: 0, payableQty: q };
  const freeItems = Math.floor(q / n);
  const payableQty = q - freeItems;
  return { freeItems, payableQty };
  }

function applyMethod8PromotionB(qty, dealQty) {
const q = safeInt(qty);
const n = safeInt(dealQty);
if (q <= 0 || n <= 0) return { freeItems: 0, payableQty: q };
const group = n + 1;
const freeItems = Math.floor(q / group);
const payableQty = q - freeItems;
return { freeItems, payableQty };
}

module.exports = {
normalizeKey,
FIELD_MAP,
safeNumber,
safeInt,
mapFieldsToItem,
applyMethod8PromotionA,
applyMethod8PromotionB
};
// END:   THAM:FIELD_MAPPER_MODULE1
"@.TrimEnd()

$testRel = "functions\src\utils_*tests*_\method8.promo.test.js"
$testCode = @"
'use strict';

// BEGIN: THAM:TEST_METHOD8_PROMO
const { applyMethod8PromotionA, applyMethod8PromotionB } = require('../fieldMapper');

describe('Method 8 — Buy N Get 1 Free', () => {
test('Interpretation A (default): freeItems = floor(qty / dealQty)', () => {
expect(applyMethod8PromotionA(0, 3)).toEqual({ freeItems: 0, payableQty: 0 });
expect(applyMethod8PromotionA(1, 3)).toEqual({ freeItems: 0, payableQty: 1 });
expect(applyMethod8PromotionA(3, 3)).toEqual({ freeItems: 1, payableQty: 2 });
expect(applyMethod8PromotionA(6, 3)).toEqual({ freeItems: 2, payableQty: 4 });
expect(applyMethod8PromotionA(7, 3)).toEqual({ freeItems: 2, payableQty: 5 });
});

test('Interpretation B (documented): freeItems = floor(qty / (dealQty + 1))', () => {
expect(applyMethod8PromotionB(0, 3)).toEqual({ freeItems: 0, payableQty: 0 });
expect(applyMethod8PromotionB(3, 3)).toEqual({ freeItems: 0, payableQty: 3 });
expect(applyMethod8PromotionB(4, 3)).toEqual({ freeItems: 1, payableQty: 3 });
expect(applyMethod8PromotionB(8, 3)).toEqual({ freeItems: 2, payableQty: 6 });
});
});
// END:   THAM:TEST_METHOD8_PROMO
"@.TrimEnd()

$targetJson = ($target | ConvertTo-Json -Compress)
$wrapRel = $cartRel
$wrapCode = @"
'use strict';

// BEGIN: THAM:MODULE1_PRICE_PROMO_SERVER
const __THAM_M1_TARGET = $targetJson;
const { mapFieldsToItem, applyMethod8PromotionA, safeInt, safeNumber } = require('../utils/fieldMapper');

function __thm_getQty(item) {
if (!item || typeof item !== 'object') return 0;
const keys = ['qty','quantity','count','QTY','Qty','Quantity'];
for (const k of keys) {
if (item[k] !== undefined && item[k] !== null) return safeInt(item[k]);
}
return 0;
}

function __thm_setLineNumber(line, key, value) {
if (!line || typeof line !== 'object') return false;
if (line[key] === undefined) return false;
const cur = safeNumber(line[key]);
line[key] = cur + value;
return true;
}

function __thm_findLinesArray(result, inputItems) {
if (!result || typeof result !== 'object') return null;
const candidates = ['items','cartItems','lines','products','details','lineItems'];
for (const k of candidates) {
const v = result[k];
if (Array.isArray(v) && Array.isArray(inputItems) && v.length === inputItems.length) return v;
}
return null;
}

function __thm_applyMethod8Adjustments(inputItems, result) {
if (!Array.isArray(inputItems) || inputItems.length === 0) return result;

let totalDiscount = 0;

for (let i = 0; i < inputItems.length; i++) {
const item = inputItems[i];
if (!item || typeof item !== 'object') continue;


const method = safeInt(item.method);
if (method !== 8) continue;

const qty = __thm_getQty(item);
const dealQty = safeInt(item.dealQty);
if (qty <= 0 || dealQty <= 0) continue;

const promo = applyMethod8PromotionA(qty, dealQty);
const unitPrice = safeNumber(item.unitPrice);
const discount = safeNumber(promo.freeItems) * unitPrice;

totalDiscount += discount;

if (result && typeof result === 'object') {
  if (!result.promotion) result.promotion = {};
  if (!result.promotion.method8) result.promotion.method8 = { totalDiscount: 0 };
  result.promotion.method8.totalDiscount = safeNumber(result.promotion.method8.totalDiscount) + discount;
}

item.freeItems = promo.freeItems;
item.payableQty = promo.payableQty;


}

if (totalDiscount !== 0 && result && typeof result === 'object') {
const lines = __thm_findLinesArray(result, inputItems);
if (lines) {
for (let i = 0; i < lines.length; i++) {
const item = inputItems[i];
if (!item || typeof item !== 'object') continue;
if (safeInt(item.method) !== 8) continue;


    const unitPrice = safeNumber(item.unitPrice);
    const discount = safeNumber(item.freeItems) * unitPrice;
    if (discount === 0) continue;

    const line = lines[i];
    if (!line || typeof line !== 'object') continue;

    line.freeItems = item.freeItems;
    line.payableQty = item.payableQty;

    const totalKeys = ['lineTotal','total','amount','subtotal','totalPrice','net'];
    let adjusted = false;
    for (const k of totalKeys) {
      if (line[k] !== undefined) {
        line[k] = safeNumber(line[k]) - discount;
        adjusted = true;
        break;
      }
    }

    if (!adjusted) {
      // No known total field; do not mutate further.
    }

    const discKeys = ['discount','discountAmount','promoDiscount'];
    for (const k of discKeys) {
      if (line[k] !== undefined) {
        line[k] = safeNumber(line[k]) + discount;
        break;
      }
    }
  }
}

const topKeys = ['subtotal','total','grandTotal','netTotal','amount'];
for (const k of topKeys) {
  if (result[k] !== undefined) result[k] = safeNumber(result[k]) - totalDiscount;
}

if (result.summary && typeof result.summary === 'object') {
  const sk = ['subtotal','total','grandTotal','netTotal','amount'];
  for (const k of sk) {
    if (result.summary[k] !== undefined) result.summary[k] = safeNumber(result.summary[k]) - totalDiscount;
  }
}


}

return result;
}

function __thm_normalizeItemsInArgs(args) {
if (!args || args.length === 0) return { args, items: null };

if (Array.isArray(args[0])) {
const items = args[0].map(mapFieldsToItem);
const newArgs = Array.from(args);
newArgs[0] = items;
return { args: newArgs, items };
}

const first = args[0];
if (first && typeof first === 'object') {
const keys = ['items','cartItems','lines','products'];
for (const k of keys) {
if (Array.isArray(first[k])) {
const items = first[k].map(mapFieldsToItem);
const obj = Object.assign({}, first);
obj[k] = items;
const newArgs = Array.from(args);
newArgs[0] = obj;
return { args: newArgs, items };
}
}
}

return { args, items: null };
}

(function __thm_install_module1() {
try {
const t = __THAM_M1_TARGET;


if (t && t.kind === 'module_function' && typeof module.exports === 'function') {
  const orig = module.exports;
  module.exports = function() {
    const norm = __thm_normalizeItemsInArgs(arguments);
    const res = orig.apply(this, norm.args);
    return __thm_applyMethod8Adjustments(norm.items, res);
  };
  module.exports.__THAM_MODULE1_ACTIVE = true;
  return;
}

if (t && (t.kind === 'export_member' || t.kind === 'module_assign' || t.kind === 'export_default') && t.name) {
  const name = String(t.name);
  const holder = module.exports;

  if (holder && typeof holder === 'object' && typeof holder[name] === 'function') {
    const orig = holder[name];
    holder[name] = function() {
      const norm = __thm_normalizeItemsInArgs(arguments);
      const res = orig.apply(this, norm.args);
      return __thm_applyMethod8Adjustments(norm.items, res);
    };
    holder.__THAM_MODULE1_ACTIVE = true;
    return;
  }
}

if (typeof module.exports === 'function') {
  // Fallback: do not change exports if ambiguous.
  module.exports.__THAM_MODULE1_ACTIVE = false;
  return;
}

if (module.exports && typeof module.exports === 'object') {
  module.exports.__THAM_MODULE1_ACTIVE = false;
  return;
}


} catch (e) {
try {
if (module.exports && typeof module.exports === 'object') module.exports.__THAM_MODULE1_ACTIVE = false;
} catch (_) {}
}
})();
// END:   THAM:MODULE1_PRICE_PROMO_SERVER
"@.TrimEnd()

$patches = @()

$patches += @{
id = "M1-001"
file = $fieldMapperRel
reason = "Create server-side field normalization + Method 8 promotion helpers (Module 1)."
insert_after = "**CREATE_IF_MISSING**"
code = $fieldMapperCode
}

$patches += @{
id = "M1-002"
file = $testRel
reason = "Add unit tests for Method 8 promo interpretations A and B."
insert_after = "**CREATE_IF_MISSING**"
code = $testCode
}

$patches += @{
id = "M1-003"
file = $wrapRel
reason = "Server-only: normalize incoming fields + apply Method 8 pricing adjustment wrapper."
insert_after = "**EOF**"
code = $wrapCode
}

foreach ($p in $patches) { Assert-PatchHasMarkers $p }

return $patches
}

function Save-PatchPlan([string]$repoRoot, [object[]]$patches) {
$path = Join-Path $repoRoot "PATCHPLAN.json"
if (Test-Path -LiteralPath $path) {
$bak = Backup-File $path
if ($bak) { Write-INFO ("Backup PATCHPLAN.json -> {0}" -f (Split-Path -Leaf $bak)) }
}
$json = $patches | ConvertTo-Json -Depth 12
Write-TextFile $path ($json.TrimEnd() + $NL)
Write-OK "PATCHPLAN.json created"
}

function Load-PatchPlan([string]$repoRoot) {
$path = Join-Path $repoRoot "PATCHPLAN.json"
if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "PATCHPLAN.json not found at repo root" }
$raw = Read-TextFile $path
$arr = $raw | ConvertFrom-Json
if ($null -eq $arr) { throw "PATCHPLAN.json parse failed" }
$list = @()
foreach ($p in $arr) {
$h = @{}
foreach ($prop in $p.PSObject.Properties) { $h[$prop.Name] = $prop.Value }
$list += $h
}
return $list
}

function Apply-PatchPlan([string]$repoRoot) {
$patches = Load-PatchPlan $repoRoot
if ($patches.Count -eq 0) { throw "No patches in PATCHPLAN.json" }

$rollback = @{}
$allChanged = New-Object System.Collections.Generic.List[string]

try {
$i = 0
foreach ($patch in $patches) {
$i++
Write-INFO ("Apply patch {0}/{1}: {2} -> {3}" -f $i, $patches.Count, $patch.id, $patch.file)


  $changed = Apply-Patch $repoRoot $patch $rollback
  foreach ($f in $changed) { $allChanged.Add($f) | Out-Null }

  if ($changed.Count -gt 0) {
    Run-Validation $repoRoot $changed
  } else {
    Write-OK ("Patch {0} no-op" -f $patch.id)
  }

  Write-OK ("Patch {0} OK" -f $patch.id)
}

Write-OK "ALL PATCHES APPLIED"


}
catch {
Write-FAIL $_.Exception.Message
Write-WARN "ROLLBACK start"
foreach ($kv in $rollback.GetEnumerator()) {
$target = [string]$kv.Key
$bak = [string]$kv.Value
try {
Restore-Backup $bak $target
Write-INFO ("Rolled back: {0}" -f (Resolve-Path -LiteralPath $target).Path)
} catch {
Write-FAIL ("Rollback failed: {0} :: {1}" -f $target, $_.Exception.Message)
}
}
throw
}
}

# =========================

# MAIN

# =========================

if (-not ($Init -or $Apply -or $Validate)) {
throw "Specify one: -Init | -Apply | -Validate"
}

$repoRoot = Find-RepoRoot $Root
Write-INFO ("RepoRoot: {0}" -f $repoRoot)

if ($Init) {
$patches = Build-PatchPlan $repoRoot
Save-PatchPlan $repoRoot $patches
}

if ($Apply) {
Apply-PatchPlan $repoRoot
}

if ($Validate) {
Run-Validation $repoRoot @()
}
