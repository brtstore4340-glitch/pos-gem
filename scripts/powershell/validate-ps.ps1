[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [string[]]$Paths
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Info([string]$m) { Write-Host "[INFO] $m" }
function Write-Err ([string]$m) { Write-Host "[ERR ] $m" -ForegroundColor Red }

$anyErrors = $false

foreach ($p in $Paths) {
  $full = Resolve-Path $p -ErrorAction SilentlyContinue
  if (-not $full) {
    Write-Err "Not found: $p"
    $anyErrors = $true
    continue
  }

  $tokens = $null
  $errors = $null
  [System.Management.Automation.Language.Parser]::ParseFile($full.Path, [ref]$tokens, [ref]$errors) | Out-Null

  if ($errors -and $errors.Count -gt 0) {
    Write-Err "Syntax errors in: $($full.Path)"
    foreach ($e in $errors) {
      Write-Err ("  Line {0}, Col {1}: {2}" -f $e.Extent.StartLineNumber, $e.Extent.StartColumnNumber, $e.Message)
    }
    $anyErrors = $true
  } else {
    Write-Info "OK: $($full.Path)"
  }
}

if ($anyErrors) { exit 1 }
exit 0
