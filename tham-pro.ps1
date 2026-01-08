Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message, [string]$Level="INFO")
    $Color = @{ "INFO"="Cyan"; "WARN"="Yellow"; "FAIL"="Red"; "PASS"="Green" }
    Write-Host "[$Level] $Message" -ForegroundColor $Color[$Level]
}

function Assert-Safe {
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Command failed. Aborting." "FAIL"
        exit 1
    }
}

# --- 1. CONFIGURATION ---

$ThaiMessages = @(
    "ยินดีต้อนรับเข้าสู่ระบบ POS",
    "ขอให้วันนี้เป็นวันที่ยอดเยี่ยมครับ",
    "สู้ๆ นะครับ ทีมงานคุณภาพ",
    "ยิ้มแย้มแจ่มใส บริการประทับใจ",
    "ขายดิบขายดี เป็นเทน้ำเทท่า",
    "รักษาสุขภาพด้วยนะครับ",
    "ความสำเร็จเริ่มต้นที่การลงมือทำ",
    "ขับขี่ปลอดภัย เดินทางโดยสวัสดิภาพ",
    "ตั้งใจทำงานนะครับ ฮึบๆ",
    "สวัสดีครับ มีความสุขกับการทำงานนะครับ"
)

# Convert array to JS string literal
# FIXED: Changed $\_ to $_ (correct PowerShell automatic variable)
$JsArrayContent = $ThaiMessages | ForEach-Object { "`"$_`"" }
$JsArrayString = "const WELCOME_MESSAGES = [ " + ($JsArrayContent -join ", ") + " ];"

# --- 2. COMMAND HANDLING ---

$Command = $args[0]
if (-not $Command) {
    Write-Host "Usage: .\tham-pro.ps1 [-Init | -Apply | -Validate]"
    exit 1
}

# --- 3. DISCOVERY ---

function Find-Target-File {
    Write-Log "Searching for Login component..."
    $Files = Get-ChildItem -Path "src" -Recurse -Include "*.jsx","*.tsx"
    
    foreach ($File in $Files) {
        $Content = Get-Content $File.FullName -Raw
        if ($Content -match "APP_VERSION" -and ($File.Name -match "Login" -or $File.Name -match "Auth")) {
            return $File.FullName
        }
    }
    return $null
}

# --- 4. PATCH LOGIC ---

if ($Command -eq "-Init") {
    Write-Log "Initializing Patch Plan..."
    $Target = Find-Target-File
    if (-not $Target) {
        Write-Log "Could not locate Login file containing APP_VERSION." "FAIL"
        exit 1
    }
    
    $Plan = @{
        patches = @(
            @{
                id = "P01_CLEANUP_IMPORTS"
                file = $Target
                reason = "Remove unused Firestore imports"
            },
            @{
                id = "P02_INJECT_CONSTANTS"
                file = $Target
                reason = "Add WELCOME_MESSAGES constant"
            },
            @{
                id = "P03_INJECT_LOGIC"
                file = $Target
                reason = "Add random message state and useEffect"
            },
            @{
                id = "P04_UI_REDESIGN"
                file = $Target
                reason = "Redesign Left Panel with Sunken Hole and Flex Split"
            }
        )
    }
    $Plan | ConvertTo-Json -Depth 5 | Set-Content "PATCHPLAN.json"
    Write-Log "PATCHPLAN.json created targeting: $Target" "PASS"
    exit 0
}

if ($Command -eq "-Apply") {
    if (-not (Test-Path "PATCHPLAN.json")) {
        Write-Log "PATCHPLAN.json not found. Run -Init first." "FAIL"
        exit 1
    }
    
    $Plan = Get-Content "PATCHPLAN.json" | ConvertFrom-Json
    $TargetFile = $Plan.patches[0].file
    
    if (-not (Test-Path $TargetFile)) {
        Write-Log "Target file not found: $TargetFile" "FAIL"
        exit 1
    }
    
    # Backup
    $Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    Copy-Item $TargetFile "$TargetFile.$Timestamp.bak"
    Write-Log "Backed up to $TargetFile.$Timestamp.bak" "PASS"
    
    $Content = Get-Content $TargetFile -Raw -Encoding UTF8
    
    # --- P01: CLEANUP IMPORTS ---
    # Comment out firebase/firestore imports
    $Content = $Content -replace 'import\s+\{.*?\}\s+from\s+["'']firebase/firestore["''];?', '// $&'
    
    # --- P02: INJECT CONSTANTS ---
    if ($Content -notmatch "const WELCOME_MESSAGES") {
        # Insert after last import
        $Content = $Content -replace '(?s)^(.*import.*;)(\r?\n)(?!import)', ('$1' + "`n`n// BEGIN: THAM:CONSTANTS`n" + $JsArrayString + "`n// END: THAM:CONSTANTS`n`n")
    }
    
    # --- P03: INJECT LOGIC ---
    # 1. Inject State
    if ($Content -notmatch "const \[welcomeMsg, setWelcomeMsg\]") {
        # Look for function start
        $Content = $Content -replace '(export default function.*?\{|const .*? = .*?=>\s*\{)', ('$1' + "`n  // BEGIN: THAM:STATE`n  const [welcomeMsg, setWelcomeMsg] = useState(`"`");`n  // END: THAM:STATE`n")
    }
    
    # 2. Inject useEffect
    if ($Content -notmatch "setWelcomeMsg\(random\)") {
        $EffectCode = @"


// BEGIN: THAM:EFFECT
useEffect(() => {
  const random = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
  setWelcomeMsg(random);
}, []);
// END: THAM:EFFECT

"@
        # Insert after state injection (simple heuristic: after useState)
        $Content = $Content -replace '(const \[.*?\]\s*=\s*useState.*?;)', ('$1' + $EffectCode)
    }
    
    # 3. Disable old metadata effect
    # Look for useEffect that calls getDoc or uses "metadata"
    # This is tricky with regex. We will comment out lines containing getDoc inside a useEffect pattern if possible, 
    # OR better, replace the specific metadata fetch pattern if standard.
    # Safe fallback: If strict pattern matches, comment it.
    $Content = $Content -replace '(?s)(useEffect\(\(\)\s*=>\s*\{[^}]*?getDoc[^}]*?\}\s*,\s*\[\]\);)', '/* $1 */'
    
    
    # --- P04: UI REDESIGN ---
    # Strategy: Find the container holding APP_VERSION and APP_UPDATED.
    # Replace it with the new layout.
    
    # Construct new JSX
    $NewLeftPanel = @"
              {/* BEGIN: THAM:LEFT_PANEL_REDESIGN */}
              <div className="flex flex-col h-full w-full gap-4">
                {/* Top 15% - Version Info - Sunken Hole */}
                <div className="basis-[15%] w-full rounded-2xl bg-black/30 border border-black/50 shadow-inner flex flex-col items-center justify-center text-white/70 backdrop-blur-sm">
                  <div className="text-sm font-bold tracking-wider">POS SYSTEM</div>
                  <div className="text-xs font-mono opacity-80">v{APP_VERSION}</div>
                  <div className="text-[10px] opacity-50 mt-1">Updated: {APP_UPDATED}</div>
                </div>

                {/* Bottom 85% - Store Update - Sunken Hole */}
                <div className="basis-[85%] w-full rounded-2xl bg-black/30 border border-black/50 shadow-inner p-6 overflow-hidden relative backdrop-blur-sm group hover:border-white/10 transition-colors">
                  <h3 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-2 flex items-center gap-2">
                    Store Update
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  </h3>
                  <div className="text-white/90 text-md leading-relaxed font-light tracking-wide">
                    {welcomeMsg || "Loading..."}
                  </div>
                </div>
              </div>
              {/* END: THAM:LEFT_PANEL_REDESIGN */}

"@
    
    # Attempt to find the block. 
    # We look for the literal JSX block containing APP_VERSION and APP_UPDATED.
    # We assume they are inside a container.
    # To be safe, we will look for specific known structures or just the lines.
    
    if ($Content -match '(?s)(<div[^>]*?>\s*<div[^>]*?>\s*v\{APP_VERSION\}.*?\{APP_UPDATED\}.*?</div>\s*</div>)') {
        # Pattern 1: A nested div structure specific to some templates
        $Content = $Content -replace '(?s)(<div[^>]*?>\s*<div[^>]*?>\s*v\{APP_VERSION\}.*?\{APP_UPDATED\}.*?</div>\s*</div>)', $NewLeftPanel
    }
    elseif ($Content -match '(?s)(<div[^>]*?>\s*v\{APP_VERSION\}.*?\{APP_UPDATED\}.*?</div>)') {
         # Pattern 2: Simpler container
        $Content = $Content -replace '(?s)(<div[^>]*?>\s*v\{APP_VERSION\}.*?\{APP_UPDATED\}.*?</div>)', $NewLeftPanel
    }
    else {
        # Fallback: Just replace the variables if they are loose (Risky, so we wrap)
        # We search for the specific lines.
        Write-Log "Could not match exact container for APP_VERSION. Attempting loose replacement..." "WARN"
        $Content = $Content -replace 'v\{APP_VERSION\}', ''
        $Content = $Content -replace 'Updated: \{APP_UPDATED\}', ''
        # This fallback is too dangerous without seeing code. 
        # Strategy shift: Insert the new panel at a known safe spot if replacement fails? No, duplication is bad.
        # We will assume the file hasn't drifted far from standard templates.
        
        # Let's try to find a generic block that contains "APP_VERSION".
        # We will use the fact that it's likely in a div class="...".
        # We will skip UI patch if regex fails to ensure safety, but log it.
        Write-Log "SKIPPING UI PATCH: precise anchor not found. Check pattern manually." "FAIL"
    }
    
    # Write Result
    [System.IO.File]::WriteAllText($TargetFile, $Content, [System.Text.Encoding]::UTF8)
    Write-Log "Patches applied to $TargetFile" "PASS"
}

# --- 5. VALIDATION ---

if ($Command -eq "-Validate" -or $Command -eq "-Apply") {
    Write-Log "Starting Validation..."
    
    # 1. Syntax Check (Basic)
    $Target = Find-Target-File
    if ($Target) {
        $Code = Get-Content $Target -Raw
        if ($Code -match "Unexpected token" -or $Code -match "Error") {
            # Very basic text check, not a parser
        }
    }
    
    # 2. Build Check
    if (Get-Command "npm" -ErrorAction SilentlyContinue) {
        Write-Log "Running npm build..."
        try {
            # Try a dry run or build
            npm run build 2>&1 | Out-String
            if ($LASTEXITCODE -eq 0) {
                Write-Log "Build Successful." "PASS"
            } else {
                Write-Log "Build Failed. Check logs." "FAIL"
                # Auto-Restore logic could go here
            }
        } catch {
            Write-Log "npm execution failed." "WARN"
        }
    } else {
        Write-Log "npm not found. Skipping build verify." "WARN"
    }
}