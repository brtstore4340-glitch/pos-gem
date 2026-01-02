# copy-prompt.ps1

[CmdletBinding()]
param(
  # Optional: also save prompt to a text file (UTF-8 no BOM)
  [string]$OutFile = "",

  # Optional: do not attempt clipboard copy (only save to file / print status)
  [switch]$NoClipboard
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ===========================================
# ChatGPT 5.2 Codex Prompt Copier (Codex | Upload + Smart Multi-Search)
# PowerShell-safe: copies prompt to clipboard
# SAFE MODE WARNING: Paste only. Do NOT execute unknown scripts.
# ===========================================

function Write-Status([string]$msg, [ValidateSet("INFO","PASS","FAIL","WARN")] [string]$level = "INFO") {
  switch ($level) {
    "PASS" { Write-Host $msg -ForegroundColor Green }
    "FAIL" { Write-Host $msg -ForegroundColor Red }
    "WARN" { Write-Host $msg -ForegroundColor Yellow }
    default { Write-Host $msg }
  }
}

# Ensure we run in STA for reliable clipboard operations
try {
  if ([System.Threading.Thread]::CurrentThread.ApartmentState -ne 'STA') {
    $self = $PSCommandPath
    if (-not $self) { throw "PSCommandPath is empty. Please run this script from a saved .ps1 file." }

    $argList = @(
      "-NoProfile",
      "-STA",
      "-ExecutionPolicy", "Bypass",
      "-File", "`"$self`""
    )
    if ($OutFile) { $argList += @("-OutFile", "`"$OutFile`"") }
    if ($NoClipboard) { $argList += @("-NoClipboard") }

    Start-Process -FilePath "powershell.exe" -ArgumentList $argList -WorkingDirectory $PWD -NoNewWindow -Wait | Out-Null
    return
  }
} catch {
  Write-Status ("WARN: Could not relaunch as STA. Will try clipboard anyway. Details: {0}" -f $_.Exception.Message) "WARN"
}

$PromptText = @'
# ===========================================
# Chat GPT 5.2 - Codex (Google DeepMind) — Upload System + Smart Multi-Search
# English + Thai allowed. Keep my Thai text EXACTLY as written.
# PowerShell-safe: Paste only
# SAFE MODE WARNING
# ===========================================

You are ChatGPT 5.2. Act as a senior software engineer, Google DeepMind.

You MUST output ONLY a PowerShell script.
[X] No explanation
[X] No markdown
[X] No commentary
[OK] Only executable PowerShell

==========================================
GOAL
==========================================

Implement **Module #1: Price Calculation & Promotion Discount**
for my POS system using a SAFE, INCREMENTAL, PATCH-BASED approach.

This system already exists.
You MUST NOT refactor unrelated code.
You MUST NOT use regex to modify JSX or nested tags.

All changes must be:

* AST / structured edits
* OR small isolated patch blocks
* With backup + verification + rollback safety

==========================================
HARD RULES (MUST FOLLOW)
==========================================

1. OUTPUT FORMAT

   * Output ONLY PowerShell
   * No markdown
   * No explanation

2. SAFE MODE (MANDATORY)

   * Backup every file before modification
   * Abort immediately if:

     * build fails
     * lint fails
     * JSX is corrupted
   * Never overwrite without backup

3. PATCH SYSTEM

   * Create PATCHPLAN.json
   * Each patch:

     * id
     * file
     * reason
     * insert_before OR insert_after
     * code
   * Apply patch ONE BY ONE
   * Stop if any patch fails

4. JSX SAFETY RULES (CRITICAL)

   * [X] DO NOT use regex on JSX
   * [X] DO NOT touch JSX comments `{/* ... */}`
   * [X] DO NOT touch nested JSX via regex
   * [OK] Only AST-safe or bounded patch blocks
   * [X] NEVER produce:
     {{/*
     {$/*
     );const

5. VALIDATION (MANDATORY)
   After every patch:

   * npm run build OR npm run dev
   * run eslint / prettier if available
   * abort on error

6. MARKERS (MANDATORY)
   Every inserted block MUST be wrapped in:

   // BEGIN: THAM:<NAME>
   // END:   THAM:<NAME>

7. OUTPUT FILES

   * PATCHPLAN.json
   * Modified source files
   * No inline explanations

==========================================
MODULE TO IMPLEMENT (MODULE #1)
==========================================

### [TARGET] Module: Price Calculation & Promotion Discount

### Scope

Server-side ONLY (Cloud Functions)
Client must NOT normalize pricing.

### Files

* functions/src/services/cartService.js
* functions/src/utils/fieldMapper.js (NEW)
* tests for calculation logic

==========================================
FEATURE REQUIREMENTS
==========================================

1. FIELD NORMALIZATION (SERVER ONLY)

Implement:

function normalizeKey(key) {
return String(key)
.trim()
.toUpperCase()
.replace(/[_\s]+/g, ' ')
.replace(/[()]/g, '');
}

FIELD MAP:

* DESCRIPTION PRINT -> name
* REG PRICE -> unitPrice
* DEAL PRICE -> dealPrice
* DEAL QTY -> dealQty
* METHOD -> method

2. SINGLE SOURCE OF TRUTH

[X] No normalization in frontend
[OK] All normalization in Cloud Function only

3. SAFE NORMALIZATION

* parseFloat -> fallback 0
* parseInt -> fallback 0
* empty/null safe
* string-safe

4. PROMOTION LOGIC (MODULE 1)

Method 8 – Buy N Get 1 Free

Interpretation A (default):

* dealQty = N
* freeItems = floor(qty / dealQty)
* payable = qty - freeItems

Also include:

* Alternative interpretation B (documented only)
* Unit tests for both

5. NO UI CHANGES
6. NO CLIENT LOGIC CHANGES
7. NO JSX TOUCHING

==========================================
AUTOMATION REQUIREMENTS
==========================================

Your script must:

1. Create PATCHPLAN.json
2. Backup all affected files
3. Apply patches in order
4. Run:

   * npm run build (or dev)
5. Stop immediately on failure
6. Print clear PASS / FAIL messages

==========================================
COMMAND INTERFACE
==========================================

Your PowerShell must support:

.\tham-pro.ps1 -Init
-> Create PATCHPLAN.json

.\tham-pro.ps1 -Apply
-> Apply patches safely

.\tham-pro.ps1 -Validate
-> Run build + sanity checks

==========================================
FINAL RULE
==========================================

If anything is ambiguous:
[X] Do NOT guess
[X] Do NOT improvise
[OK] Fail safely with message

OUTPUT:
-> PowerShell script only
-> No explanation
-> No markdown
'@

# --- THAM: sanitize unicode that commonly garbles in Windows codepages ---
# Replace arrow characters (convert char to string first)
$PromptText = $PromptText.Replace(([char]0x2192).ToString(), "->")     # U+2192 RIGHTWARDS ARROW

# Replace box-drawing characters
$PromptText = $PromptText.Replace(([char]0x2501).ToString(), "=")      # U+2501 BOX DRAWINGS HEAVY HORIZONTAL

# Normalize quotes - using char codes to avoid encoding issues
$PromptText = $PromptText.Replace(([char]0x2018).ToString(), "'")      # LEFT SINGLE QUOTATION MARK
$PromptText = $PromptText.Replace(([char]0x2019).ToString(), "'")      # RIGHT SINGLE QUOTATION MARK
$PromptText = $PromptText.Replace(([char]0x201C).ToString(), '"')      # LEFT DOUBLE QUOTATION MARK
$PromptText = $PromptText.Replace(([char]0x201D).ToString(), '"')      # RIGHT DOUBLE QUOTATION MARK

# Replace Unicode dashes
$PromptText = $PromptText.Replace(([char]0x2013).ToString(), "-")      # EN DASH
$PromptText = $PromptText.Replace(([char]0x2014).ToString(), "-")      # EM DASH


# Optional: save to file (UTF-8 no BOM)
if ($OutFile) {
  try {
    $dest = $OutFile
    if (-not [System.IO.Path]::IsPathRooted($dest)) {
      $dest = Join-Path $PWD $dest
    }
    [System.IO.File]::WriteAllText($dest, $PromptText, [System.Text.Encoding]::Unicode)
    Write-Status "PASS: Saved prompt to: $dest" "PASS"
  } catch {
    Write-Status ("FAIL: Could not save file. {0}" -f $_.Exception.Message) "FAIL"
    exit 1
  }
}

if ($NoClipboard) {
  Write-Status "INFO: -NoClipboard set. Skipping clipboard copy." "INFO"
  return
}

# Clipboard copy (prefer Set-Clipboard)
$copied = $false

if (Get-Command -Name Set-Clipboard -ErrorAction SilentlyContinue) {
  try {
    Set-Clipboard -Value $PromptText -AsPlainText
    $copied = $true
  } catch {
    $copied = $false
  }
}

# Fallback 1: Windows Forms Clipboard (works well in STA)
if (-not $copied) {
  try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    [System.Windows.Forms.Clipboard]::SetText($PromptText)
    $copied = $true
  } catch {
    $copied = $false
  }
}

# Fallback 2: clip.exe via temp UTF-16LE file (Thai-safe)
if (-not $copied) {
  $clip = Join-Path $env:SystemRoot "System32\clip.exe"
  $cmd  = Join-Path $env:SystemRoot "System32\cmd.exe"
  if (Test-Path -LiteralPath $clip -and Test-Path -LiteralPath $cmd) {
    $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("tham_prompt_{0}.txt" -f ([Guid]::NewGuid().ToString("N")))
    try {
      [System.IO.File]::WriteAllText($tmp, $PromptText, [System.Text.Encoding]::Unicode) # UTF-16LE
      $p = Start-Process -FilePath $cmd -ArgumentList @("/c", "type ""$tmp"" | ""$clip""") -NoNewWindow -Wait -PassThru
      if ($p.ExitCode -eq 0) { $copied = $true }
    } catch {
      $copied = $false
    } finally {
      try { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue } catch {}
    }
  }
}

if ($copied) {
  Write-Status "PASS: Prompt copied to clipboard." "PASS"
} else {
  Write-Status "FAIL: Could not copy to clipboard in this terminal. Use -OutFile PROMPT.txt then copy from the file." "FAIL"
  exit 1
}
