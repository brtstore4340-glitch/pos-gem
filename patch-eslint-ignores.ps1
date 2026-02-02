<# 
  patch-eslint-ignores.ps1
  - Adds Flat Config ignores to eslint.config.mjs for backup/vendor paths
  - Creates timestamped backup + log
#>

param(
  [string]$RepoRoot = (Get-Location).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-Timestamp {
  return (Get-Date -Format "yyyyMMdd-HHmmss")
}

$ts = New-Timestamp
$logDir = Join-Path $RepoRoot "_boot\patchlogs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "eslint-ignores-$ts.log"

function Log([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "o"), $msg
  $line | Tee-Object -FilePath $logFile -Append | Out-Host
}

try {
  Log "RepoRoot: $RepoRoot"
  $cfg = Join-Path $RepoRoot "eslint.config.mjs"
  if (!(Test-Path $cfg)) {
    throw "Missing eslint config: $cfg"
  }

  $content = Get-Content -Path $cfg -Raw -Encoding UTF8

  if ($content -notmatch 'export\s+default\s*\[') {
    throw "Unexpected eslint.config.mjs format. Expected to find: export default ["
  }

  # Only add patterns that aren't already present
  $candidates = @(
    "_boot/**",
    "src/toggle/jquery.js",
    "**/*.min.js",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**"
  )

  $toAdd = New-Object System.Collections.Generic.List[string]
  foreach ($p in $candidates) {
    if ($content -notmatch [regex]::Escape($p)) {
      $toAdd.Add($p) | Out-Null
    }
  }

  if ($toAdd.Count -eq 0) {
    Log "No changes needed. Ignore patterns already present."
    exit 0
  }

  $backup = "$cfg.bak.$ts"
  Copy-Item -Path $cfg -Destination $backup -Force
  Log "Backup created: $backup"

  $ignoreLines = $toAdd | ForEach-Object { "      `"$($_)`"," }
  $ignoreBlock = @"
  {
    ignores: [
$($ignoreLines -join "`n")
    ],
  },
"@

  # Insert ignore block as the first entry in the exported array
  $updated = [regex]::Replace(
    $content,
    'export\s+default\s*\[',
    { param($m) $m.Value + "`n" + $ignoreBlock },
    1
  )

  Set-Content -Path $cfg -Value $updated -Encoding UTF8 -NoNewline
  Log "Patched: $cfg"
  Log ("Added ignore patterns: " + ($toAdd -join ", "))
  Log "Done."
  Log "Log file: $logFile"
}
catch {
  Log ("ERROR: " + $_.Exception.Message)
  Log "Aborted."
  throw
}
