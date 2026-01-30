$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "[PATCH] $msg" }
function Backup-IfExists($path) {
  if (Test-Path -LiteralPath $path) {
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    Copy-Item -LiteralPath $path -Destination "$path.bak.$ts" -Force
    Write-Step "Backup: $path -> $path.bak.$ts"
  }
}
function Write-TextFile($path, $content) {
  Backup-IfExists $path
  $dir = Split-Path -Parent $path
  if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  Set-Content -LiteralPath $path -Value $content -Encoding UTF8
  Write-Step "Wrote: $path"
}

$root = (Get-Location).Path
Write-Step "Repo root: $root"

Write-Step "Installing @radix-ui/react-slot..."
& npm install @radix-ui/react-slot
if ($LASTEXITCODE -ne 0) { throw "npm install @radix-ui/react-slot failed" }

# --- Patch Button to implement asChild via Slot (no DOM prop leak)
$buttonPath = Join-Path $root "src\components\ui\button.jsx"

$buttonContent = @'
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
    "disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:opacity-90",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

const Button = React.forwardRef(function Button(
  { className, variant, size, asChild = false, ...props },
  ref
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});

export { Button, buttonVariants };
'@

Write-TextFile $buttonPath $buttonContent

# --- Patch HomePage to remove asChild={false} usage
$homePath = Join-Path $root "src\pages\HomePage.jsx"
if (Test-Path -LiteralPath $homePath) {
  $home = Get-Content -LiteralPath $homePath -Raw
  $patched = $home -replace 'asChild=\{false\}\s*', ''
  if ($patched -ne $home) {
    Backup-IfExists $homePath
    Set-Content -LiteralPath $homePath -Value $patched -Encoding UTF8
    Write-Step "Patched: $homePath (removed asChild={false})"
  } else {
    Write-Step "No asChild={false} found in HomePage (skip)."
  }
}

Write-Step "Verifying build..."
& npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

Write-Step "DONE ✅ asChild warning fixed."
Write-Host ""
Write-Host "Run:"
Write-Host "  npm run dev"
