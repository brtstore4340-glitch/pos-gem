# patch-react-not-defined.ps1
# Minimal + safe: fixes "React is not defined" by adding missing import when React.* is used in src/main.jsx
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Stamp { Get-Date -Format "yyyyMMdd_HHmmss" }
function Log([string]$m) { Write-Host ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $m) }

$root = Get-Location
$stamp = Stamp
$logPath = Join-Path $root ("patch-log_{0}.txt" -f $stamp)

Start-Transcript -Path $logPath | Out-Null
try {
  $main = Join-Path $root "src\main.jsx"
  if (!(Test-Path $main)) { throw "Missing file: src/main.jsx" }

  # backup
  $bkDir = Join-Path $root ("ai-backups\patch_{0}" -f $stamp)
  New-Item -ItemType Directory -Force -Path $bkDir | Out-Null
  Copy-Item $main (Join-Path $bkDir "main.jsx.bak") -Force
  Log "Backup: $bkDir\main.jsx.bak"

  $content = Get-Content -Raw -Encoding UTF8 $main

  $usesReactDot = $content.Contains("React.")
  $hasImportReactFrom =
    $content.Contains('import React from "react"') -or
    $content.Contains("import React from 'react'") -or
    $content.Contains('import * as React from "react"') -or
    $content.Contains("import * as React from 'react'")

  if (-not $usesReactDot) {
    Log "No 'React.' usage found in src/main.jsx. No change."
    return
  }

  if ($hasImportReactFrom) {
    Log "React import already present. No change."
    return
  }

  # Insert import at the top, after possible "use strict" or comments (keep it simple & safe: prepend)
  $newContent = "import React from `"react`";`r`n" + $content
  Set-Content -Path $main -Value $newContent -Encoding UTF8

  Log 'Patched src/main.jsx: added `import React from "react";`'
}
catch {
  Log ("ERROR: " + $_.Exception.Message)
  throw
}
finally {
  Stop-Transcript | Out-Null
  Log "Log saved: $logPath"
}
