# tools/patch-functions-eslint9-flat.ps1
[CmdletBinding()]
param(
  [string]$RepoRoot = (Resolve-Path ".").Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Step($m){ Write-Host "==> $m" -ForegroundColor Cyan }
function EnsureDir($p){ if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p | Out-Null } }
function BackupFile($path){
  if (Test-Path $path) {
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    Copy-Item $path "$path.bak.$ts" -Force
  }
}
function WriteFileUtf8($path, $content){
  EnsureDir (Split-Path -Parent $path)
  BackupFile $path
  Set-Content -LiteralPath $path -Value $content -Encoding UTF8
  Step "Wrote: $path"
}

Push-Location $RepoRoot
try {
  if (-not (Test-Path "functions")) { throw "functions folder not found." }
  if (-not (Test-Path "functions\package.json")) { throw "functions\package.json not found." }

  # 1) Write ESLint v9 flat config in functions/
  $flatPath = Join-Path $RepoRoot "functions\eslint.config.js"
  $flat = @'
const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  { ignores: ["node_modules/**"] },

  js.configs.recommended,

  {
    files: ["**/*.js", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.node
      }
    },
    rules: {
      // Keep deploy-safe signal without blocking on legacy style issues
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "no-empty": "warn"
    }
  }
];
'@
  WriteFileUtf8 $flatPath $flat

  # 2) Ensure required deps exist for flat config
  Step "Ensuring ESLint flat-config deps in functions..."
  Push-Location "functions"
  try {
    npm install -D @eslint/js globals | Out-Null
    npm install | Out-Null

    Step "Run functions lint"
    npm run lint
  } finally {
    Pop-Location
  }

  Step "DONE: ESLint v9 flat config active for functions/"
} finally {
  Pop-Location
}
