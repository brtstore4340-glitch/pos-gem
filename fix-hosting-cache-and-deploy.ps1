# fix-hosting-cache-and-deploy.ps1
$ErrorActionPreference = "Stop"

function Say($m){ Write-Host $m }
function Warn($m){ Write-Warning $m }
function Fail($m){ Write-Host ("ERROR: " + $m) -ForegroundColor Red; exit 1 }

if (-not (Test-Path -LiteralPath "firebase.json")) { Fail "firebase.json not found" }

$raw = Get-Content -LiteralPath "firebase.json" -Raw
try { $cfg = $raw | ConvertFrom-Json } catch { Fail "firebase.json invalid JSON" }

# Support hosting:{} and hosting:[{}]
$hosting = $null
if ($cfg.hosting -is [System.Array]) {
  if ($cfg.hosting.Count -lt 1) { Fail "hosting array is empty" }
  $hosting = $cfg.hosting[0]
} else {
  $hosting = $cfg.hosting
}
if (-not $hosting) { Fail "hosting config missing" }

# Ensure hosting.public exists
if (-not $hosting.public) {
  Warn "hosting.public missing - setting to 'dist'"
  $hosting | Add-Member -NotePropertyName public -NotePropertyValue "dist" -Force
}

# Ensure SPA rewrite exists (safe default)
if (-not $hosting.rewrites) {
  $hosting | Add-Member -NotePropertyName rewrites -NotePropertyValue @(@{ source="**"; destination="/index.html" }) -Force
}

# Desired headers
$wantedHeaders = @(
  @{
    source="/index.html"
    headers=@(
      @{ key="Cache-Control"; value="no-cache, no-store, must-revalidate" }
    )
  },
  @{
    source="/assets/**"
    headers=@(
      @{ key="Cache-Control"; value="public, max-age=31536000, immutable" }
    )
  }
)

# IMPORTANT: Add/replace property using Add-Member -Force
$hosting | Add-Member -NotePropertyName headers -NotePropertyValue $wantedHeaders -Force

# Write back (with backup)
$backup = "firebase.json.bak." + (Get-Date -Format "yyyyMMdd-HHmmss")
Copy-Item -LiteralPath "firebase.json" -Destination $backup -Force
Say ("Backup created: " + $backup)

($cfg | ConvertTo-Json -Depth 100) | Set-Content -LiteralPath "firebase.json" -Encoding UTF8
Say "Patched firebase.json headers OK"
Say ""

# Rebuild
if (Test-Path -LiteralPath "package.json") {
  Say "Running: npm run build"
  & npm run build
  if ($LASTEXITCODE -ne 0) { Fail "npm run build failed" }
} else {
  Warn "package.json not found - skipping build"
}

# Deploy hosting
Say "Deploying: firebase deploy --only hosting"
& firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) { Fail "firebase deploy failed" }

Say ""
Say "DONE. Now hard refresh browser (Ctrl+Shift+R) and test login."
