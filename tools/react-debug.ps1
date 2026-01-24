[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("status","disable","restore","open-trace","scan-loops","scan-open")]
  [string]$Action,

  [string]$ProjectRoot = ".",

  [string]$TraceFile,
  [string]$TraceText,

  [int]$MaxEffectLines = 140
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-ProjectRoot([string]$Root) { (Resolve-Path -LiteralPath $Root).Path }

function Get-MainEntry([string]$Root) {
  $src = Join-Path $Root "src"
  if (-not (Test-Path -LiteralPath $src)) { throw "Missing src/ under $Root" }

  $candidates = Get-ChildItem -LiteralPath $src -File -Include "main.tsx","main.jsx","main.ts","main.js" -ErrorAction SilentlyContinue
  if (-not $candidates) { throw "Cannot find src/main.(ts|tsx|js|jsx)" }

  foreach ($p in @("main.tsx","main.jsx","main.ts","main.js")) {
    $hit = $candidates | Where-Object { $_.Name -eq $p } | Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }
  ($candidates | Select-Object -First 1).FullName
}

function StrictMode-IsEnabled([string]$MainFile) {
  $raw = Get-Content -LiteralPath $MainFile -Raw
  ($raw -match '<React\.StrictMode>' -or $raw -match 'React\.StrictMode')
}

function Disable-StrictMode([string]$MainFile) {
  $bak = "$MainFile.bak-strictmode"
  Copy-Item -LiteralPath $MainFile -Destination $bak -Force

  $raw = Get-Content -LiteralPath $MainFile -Raw
  $patched = $raw `
    -replace '(?s)<React\.StrictMode>\s*', '' `
    -replace '(?s)\s*</React\.StrictMode>\s*', "`n"

  Set-Content -LiteralPath $MainFile -Value $patched -Encoding UTF8
  Write-Host "✅ StrictMode wrapper removed."
  Write-Host "   main: $MainFile"
  Write-Host "   backup: $bak"
}

function Restore-StrictMode([string]$MainFile) {
  $bak = "$MainFile.bak-strictmode"
  if (-not (Test-Path -LiteralPath $bak)) { throw "Backup not found: $bak" }
  Copy-Item -LiteralPath $bak -Destination $MainFile -Force
  Write-Host "✅ Restored from backup."
  Write-Host "   main: $MainFile"
  Write-Host "   backup: $bak"
}

function Read-TraceText([string]$File, [string]$Inline) {
  if ($Inline) { return $Inline }
  if ($File)   { return (Get-Content -LiteralPath $File -Raw) }
  throw "Provide -TraceText or -TraceFile"
}

function Try-Open-InVSCode([string]$PathWithLineCol) {
  $codeCmd = Get-Command code -ErrorAction SilentlyContinue
  if (-not $codeCmd) {
    Write-Host "⚠️ VS Code CLI 'code' not found in PATH. Open manually:"
    Write-Host "   $PathWithLineCol"
    return
  }
  & $codeCmd.Source -g $PathWithLineCol | Out-Null
  Write-Host "✅ Opened: $PathWithLineCol"
}

function Open-From-Trace([string]$Root, [string]$Trace) {
  $m = [regex]::Match($Trace, 'http://localhost:\d+/(?<path>src/[^:\s\)]+):(?<line>\d+):(?<col>\d+)', 'IgnoreCase')
  if (-not $m.Success) {
    $m = [regex]::Match($Trace, '(?<path>src/[^:\s\)]+):(?<line>\d+):(?<col>\d+)', 'IgnoreCase')
  }
  if (-not $m.Success) { throw "Could not find a src/* file:line:col in the provided trace." }

  $rel = $m.Groups["path"].Value.Replace('/', [IO.Path]::DirectorySeparatorChar)
  $abs = Join-Path $Root $rel
  if (-not (Test-Path -LiteralPath $abs)) { throw "File not found on disk: $abs" }

  Try-Open-InVSCode "$abs`:$($m.Groups["line"].Value)`:$($m.Groups["col"].Value)"
}

function Get-SourceFiles([string]$Root) {
  $excludeDirs = @("node_modules","dist","build",".git",".next","coverage","out",".turbo","android","ios")
  Get-ChildItem -LiteralPath $Root -Recurse -File -Include *.js,*.jsx,*.ts,*.tsx |
    Where-Object {
      $full = $_.FullName
      foreach ($d in $excludeDirs) {
        if ($full -match [regex]::Escape([IO.Path]::DirectorySeparatorChar + $d + [IO.Path]::DirectorySeparatorChar)) { return $false }
      }
      $true
    }
}

function Parse-StatePairs([string[]]$Lines) {
  $pairs = @()
  for ($i=0; $i -lt $Lines.Count; $i++) {
    if ($Lines[$i] -match 'const\s*\[\s*(?<state>[A-Za-z_]\w*)\s*,\s*(?<setter>set[A-Za-z_]\w*)\s*\]\s*=\s*useState\b') {
      $pairs += [pscustomobject]@{ State = $Matches.state; Setter = $Matches.setter }
    }
  }
  $pairs
}

function Get-UseEffectBlocks([string[]]$Lines, [int]$MaxLines) {
  $blocks = @()
  for ($i=0; $i -lt $Lines.Count; $i++) {
    if ($Lines[$i] -notmatch '\buseEffect\s*\(') { continue }
    $start = $i; $text = ""; $end = [Math]::Min($Lines.Count - 1, $i + $MaxLines); $paren = 0
    for ($j=$i; $j -le $end; $j++) {
      $line = $Lines[$j]
      $text += $line + "`n"
      $paren += ([regex]::Matches($line, '\(')).Count - ([regex]::Matches($line, '\)')).Count
      if ($paren -le 0 -and $line -match '\)\s*;') {
        $blocks += [pscustomobject]@{ StartLine = $start + 1; EndLine = $j + 1; Text = $text }
        $i = $j; break
      }
    }
  }
  $blocks
}

function Has-DepArray([string]$EffectText) {
  [regex]::IsMatch($EffectText, ',\s*\[[\s\S]*?\]\s*\)\s*;', 'Singleline')
}

function Extract-Deps([string]$EffectText) {
  $m = [regex]::Match($EffectText, ',\s*\[(?<deps>[\s\S]*?)\]\s*\)\s*;', 'Singleline')
  if ($m.Success) { $m.Groups["deps"].Value.Trim() } else { $null }
}

function Dep-Includes([string]$Deps, [string]$Token) {
  if ([string]::IsNullOrWhiteSpace($Deps)) { return $false }
  [regex]::IsMatch($Deps, "(^|[^A-Za-z0-9_])" + [regex]::Escape($Token) + "([^A-Za-z0-9_]|$)")
}

function Find-SetStateCalls([string]$EffectText, [object[]]$StatePairs) {
  $calls = @()
  foreach ($p in $StatePairs) {
    if ($EffectText -match ("\b" + [regex]::Escape($p.Setter) + "\s*\(")) {
      $calls += [pscustomobject]@{ Setter = $p.Setter; State = $p.State }
    }
  }
  $calls
}

function Scan-EffectLoops([string]$Root, [int]$MaxLines) {
  $hits = @()
  foreach ($f in (Get-SourceFiles -Root $Root)) {
    $lines = Get-Content -LiteralPath $f.FullName
    $pairs = Parse-StatePairs -Lines $lines
    $effects = Get-UseEffectBlocks -Lines $lines -MaxLines $MaxLines
    foreach ($e in $effects) {
      $setCalls = Find-SetStateCalls -EffectText $e.Text -StatePairs $pairs
      if ($setCalls.Count -eq 0) { continue }

      if (-not (Has-DepArray $e.Text)) {
        $hits += [pscustomobject]@{ File=$f.FullName; StartLine=$e.StartLine; EndLine=$e.EndLine; Kind="missing-deps"; Why="useEffect calls setState but has no dependency array" }
        continue
      }

      $deps = Extract-Deps $e.Text
      foreach ($c in $setCalls) {
        if ($c.State -and (Dep-Includes -Deps $deps -Token $c.State)) {
          $hits += [pscustomobject]@{ File=$f.FullName; StartLine=$e.StartLine; EndLine=$e.EndLine; Kind="state-in-deps"; Why="Effect updates '$($c.State)' and deps include '$($c.State)'" }
        }
      }
    }
  }
  $hits
}

$root = Resolve-ProjectRoot $ProjectRoot

switch ($Action) {
  "status" {
    $main = Get-MainEntry $root
    Write-Host "main: $main"
    Write-Host ("StrictMode: " + ($(if (StrictMode-IsEnabled $main) { "ON" } else { "OFF" })))
  }
  "disable" {
    $main = Get-MainEntry $root
    if (-not (StrictMode-IsEnabled $main)) { Write-Host "StrictMode already OFF."; Write-Host "main: $main"; break }
    Disable-StrictMode $main
  }
  "restore" {
    $main = Get-MainEntry $root
    Restore-StrictMode $main
  }
  "open-trace" {
    $trace = Read-TraceText -File $TraceFile -Inline $TraceText
    Open-From-Trace -Root $root -Trace $trace
  }
  "scan-loops" {
    $hits = Scan-EffectLoops -Root $root -MaxLines $MaxEffectLines
    if ($hits.Count -eq 0) { Write-Host "✅ No obvious useEffect->setState loop patterns found."; break }
    Write-Host "⚠️ Possible loop causes:"
    $hits | Sort-Object File, StartLine | Format-Table File, StartLine, EndLine, Kind, Why -AutoSize
    exit 1
  }
  "scan-open" {
    $hits = Scan-EffectLoops -Root $root -MaxLines $MaxEffectLines | Sort-Object File, StartLine
    if ($hits.Count -eq 0) { Write-Host "✅ No obvious useEffect->setState loop patterns found."; break }
    $first = $hits[0]
    Write-Host "Opening first hit: $($first.File):$($first.StartLine)"
    Try-Open-InVSCode "$($first.File):$($first.StartLine):1"
    exit 1
  }
}
