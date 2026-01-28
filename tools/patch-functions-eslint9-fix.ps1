# tools/patch-functions-eslint9-fix.ps1
[CmdletBinding()]
param(
  [string]$RepoRoot = (Resolve-Path ".").Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Step($m){ Write-Host "==> $m" -ForegroundColor Cyan }
function BackupFile($path){
  if (Test-Path $path) {
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    Copy-Item $path "$path.bak.$ts" -Force
  }
}
function WriteFileUtf8($path, $content){
  $dir = Split-Path -Parent $path
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  BackupFile $path
  Set-Content -LiteralPath $path -Value $content -Encoding UTF8
  Step "Wrote: $path"
}
function ReadJson($path){ Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json }
function WriteJson($path, $obj){
  $json = $obj | ConvertTo-Json -Depth 100
  BackupFile $path
  Set-Content -LiteralPath $path -Value $json -Encoding UTF8
  Step "Patched: $path"
}

Push-Location $RepoRoot
try {
  if (-not (Test-Path "functions\package.json")) { throw "functions\package.json not found." }

  # 1) Create ESLint v9 flat config in the canonical filename eslint.config.js
  $cfgPath = Join-Path $RepoRoot "functions\eslint.config.js"
  $cfg = @'
const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  { ignores: ["node_modules/**"] },

  js.configs.recommended,

  {
    files: ["**/*.{js,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.node
      }
    },
    rules: {
      // keep CI useful but not noisy for legacy
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "no-empty": "warn"
    }
  }
];
'@
  WriteFileUtf8 $cfgPath $cfg

  # 2) Patch functions/package.json lint script to lint real files (not ".")
  $pkgPath = Join-Path $RepoRoot "functions\package.json"
  $pkg = ReadJson $pkgPath

  if (-not $pkg.scripts) { $pkg | Add-Member -NotePropertyName scripts -NotePropertyValue (@{}) }
  $pkg.scripts.lint = 'eslint "**/*.{js,cjs}"'
  WriteJson $pkgPath $pkg

  # 3) Ensure deps exist
  Step "Installing ESLint flat-config deps in functions..."
  Push-Location "functions"
  try {
    npm install -D @eslint/js globals | Out-Null
    npm install | Out-Null

    Step "Run lint (should no longer say '.' ignored)"
    npm run lint
  } finally {
    Pop-Location
  }

  Step "DONE: Functions ESLint 9 is working."
} finally {
  Pop-Location
}
