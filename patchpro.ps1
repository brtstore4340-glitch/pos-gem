Set-ExecutionPolicy -Scope Process Bypass -Force

New-Item -ItemType Directory -Force -Path .\tools | Out-Null

@'
# tools/patch-functions-eslint9-flat.ps1
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

Push-Location $RepoRoot
try {
  if (-not (Test-Path "functions")) { throw "functions folder not found." }
  if (-not (Test-Path "functions\package.json")) { throw "functions\package.json not found." }

  # ESLint v9 prefers Flat Config. Since functions is CommonJS, use eslint.config.cjs.
  $flatPath = Join-Path $RepoRoot "functions\eslint.config.cjs"
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
      // Keep signal, don’t block legacy code on hygiene
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "no-empty": "warn"
    }
  }
];
'@
  WriteFileUtf8 $flatPath $flat

  Step "Install/update lint deps inside functions"
  Push-Location "functions"
  try {
    npm install -D @eslint/js globals | Out-Null
    npm install | Out-Null
    Step "Run functions lint"
    npm run lint
  } finally {
    Pop-Location
  }

  Step "DONE: ESLint v9 flat config is now active for functions/"
} finally {
  Pop-Location
}
'@ | Set-Content -LiteralPath .\tools\patch-functions-eslint9-flat.ps1 -Encoding UTF8

pwsh -File .\tools\patch-functions-eslint9-flat.ps1