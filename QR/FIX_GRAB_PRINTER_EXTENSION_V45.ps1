param(
  [string]$RepoRoot = "D:\01 Main Work\Boots\keys-aesthetics-fulfillment"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Step($m){ Write-Host "`n[STEP] $m" -ForegroundColor Cyan }
function OK($m){ Write-Host "[OK]  $m" -ForegroundColor Green }
function Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }

function EnsureDir($p){ if(!(Test-Path $p)){ New-Item -ItemType Directory -Path $p | Out-Null } }
function Exists($p){ return (Test-Path $p) }

Step "Go to repo root"
Set-Location $RepoRoot
OK ("PWD = " + (Get-Location).Path)

Step "Verify git repo"
if(!(Test-Path ".git")){ throw "Missing .git - not a git repo: $RepoRoot" }
OK "Git repo detected"

Step "Verify workspace root package.json"
if(!(Test-Path "package.json")){ throw "Missing root package.json" }
node -p "require('./package.json').name" | Out-Null
OK "Root package.json parses"

Step "Ensure monorepo folders"
EnsureDir "apps"
EnsureDir "packages"
EnsureDir "apps\fulfillment-web"
OK "apps/, packages/, apps/fulfillment-web ready"

Step "Ensure web app key files exist"
if(!(Test-Path "apps\fulfillment-web\package.json")){ throw "Missing apps/fulfillment-web/package.json" }
if(!(Test-Path "apps\fulfillment-web\src")){ Warn "Missing apps/fulfillment-web/src (did you move src yet?)" }
if(!(Test-Path "apps\fulfillment-web\index.html")){ Warn "Missing apps/fulfillment-web/index.html (Vite entry) - build will fail" }

Step "Put Vite config inside app if available from backup"
if(Test-Path "_backup_ts_25690122_072415\vite.config.ts"){
  Copy-Item "_backup_ts_25690122_072415\vite.config.ts" "apps\fulfillment-web\vite.config.ts" -Force
  OK "Copied vite.config.ts into apps/fulfillment-web"
} elseif(Test-Path "vite.config.ts") {
  Copy-Item "vite.config.ts" "apps\fulfillment-web\vite.config.ts" -Force
  OK "Copied root vite.config.ts into apps/fulfillment-web"
} elseif(Test-Path "vite.config.js") {
  Copy-Item "vite.config.js" "apps\fulfillment-web\vite.config.js" -Force
  OK "Copied root vite.config.js into apps/fulfillment-web"
} else {
  Warn "No vite.config.* found to copy; relying on default Vite config."
}

Step "Safety: ensure secrets/backups are ignored"
$gitignore = ".gitignore"
if(!(Test-Path $gitignore)){ "" | Set-Content -Encoding UTF8 $gitignore }
$ignoreLines = @(
  ".env",
  ".env.*",
  "*.bak",
  "*_backup_*",
  "_backup_*",
  ".backup-*",
  "node_modules",
  "dist",
  ".vite"
)
$existing = Get-Content $gitignore -ErrorAction SilentlyContinue
$toAdd = $ignoreLines | Where-Object { $existing -notcontains $_ }
if($toAdd.Count -gt 0){
  Add-Content -Path $gitignore -Value ($toAdd -join "`n")
  OK "Updated .gitignore with safety ignores"
} else {
  OK ".gitignore already has safety ignores"
}

Step "Clean install (workspace-aware)"
# (optional) keep lockfile; if builds are unstable, uncomment lockfile removals below
# Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
# Remove-Item -Force apps\fulfillment-web\package-lock.json -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force apps\fulfillment-web\node_modules -ErrorAction SilentlyContinue

npm install
OK "npm install done"

Step "Verify react resolution"
npm -w apps/fulfillment-web ls react
OK "React resolves in workspace"

Step "Build web app"
npm -w apps/fulfillment-web run build
OK "Web build succeeded"

Step "Optional: build functions if workspace is valid"
if(Test-Path "functions\package.json"){
  try {
    npm -w functions run build
    OK "Functions build succeeded"
  } catch {
    Warn "Functions build failed (check functions config/scripts). Continuing."
  }
} else {
  Warn "No functions/package.json found; skipping functions build."
}

Step "Summary"
OK "Systemic check complete. Next recommended: git status, commit, push."
Write-Host "`nRun next:`n  git status`n  git add -A`n  git commit -m `"chore: stabilize monorepo structure`"`n  git push`n" -ForegroundColor Gray
