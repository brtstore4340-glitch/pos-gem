# fix-tailwind-apply-arbitrary.ps1
$ErrorActionPreference = "Stop"

$path = "src/index.css"
if (-not (Test-Path $path)) { throw "Not found: $path" }

$backup = "$path.bak." + (Get-Date -Format "yyyyMMdd-HHmmss")
Copy-Item $path $backup -Force
Write-Host "Backup: $backup"

$lines = Get-Content $path
$changed = $false
$removedLog = New-Object System.Collections.Generic.List[string]

for ($i=0; $i -lt $lines.Count; $i++) {
  $line = $lines[$i]

  if ($line -match "@apply") {
    # Remove arbitrary bg tokens inside @apply: bg-[#....] / dark:bg-[#....]
    $new = $line

    # remove well-formed arbitrary tokens
    $new = [regex]::Replace($new, "(^|\s)(dark:)?bg-\[[^\]]+\]", { param($m)
      $removedLog.Add("Line " + ($i+1) + ": removed '" + $m.Value.Trim() + "'") | Out-Null
      $changed = $true
      return " "
    })

    # remove broken/truncated tokens like dark:bg-[#25283 (no closing ])
    $new = [regex]::Replace($new, "(^|\s)(dark:)?bg-\[[^\s;]+", { param($m)
      if ($m.Value -match "bg-\[") {
        $removedLog.Add("Line " + ($i+1) + ": removed BROKEN '" + $m.Value.Trim() + "'") | Out-Null
        $changed = $true
        return " "
      }
      return $m.Value
    })

    # normalize spacing
    $new = ($new -replace "\s{2,}", " ")

    $lines[$i] = $new
  }
}

if ($changed) {
  $lines | Set-Content -Encoding UTF8 $path
  Write-Host "Patched: $path"
  Write-Host ""
  Write-Host "Removed tokens:"
  $removedLog | ForEach-Object { Write-Host $_ }
} else {
  Write-Host "No changes needed."
}
