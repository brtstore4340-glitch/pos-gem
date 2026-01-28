<# 
PATCH: DS Expand Pack (Dialog + Toast + Badge + Table + Real Scan Buffer)
- Adds deps: @radix-ui/react-dialog sonner
- Adds UI: dialog.jsx, badge.jsx, table.jsx
- Adds toaster.jsx (sonner) + wires to main.jsx
- Upgrades scan listener to real keyboard buffer (keeps window.__emitScan for debug)
- Adds example usage in PosPage (Dialog + toast)

Run:
  Set-ExecutionPolicy -Scope Process Bypass -Force
  cd "D:\01 Main Work\Boots\Boots-POS Gemini"
  notepad .\patch-ds-expand.ps1  # paste + save
  .\patch-ds-expand.ps1
  npm run dev
#>

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "[DS-EXPAND] $msg" }
function Ensure-Dir($path) { if (-not (Test-Path -LiteralPath $path)) { New-Item -ItemType Directory -Path $path | Out-Null } }
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

Ensure-Dir "$root\src\components\ui"
Ensure-Dir "$root\src\components"
Ensure-Dir "$root\src\features\pos\hooks"

Write-Step "Installing deps..."
& npm install @radix-ui/react-dialog sonner
if ($LASTEXITCODE -ne 0) { throw "npm install deps failed" }

# --- UI: Badge
$badge = @'
import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-transparent",
        secondary: "bg-secondary text-secondary-foreground border-transparent",
        outline: "bg-background text-foreground",
        destructive: "bg-destructive text-destructive-foreground border-transparent",
        muted: "bg-muted text-muted-foreground border-transparent"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
'@

# --- UI: Table
$table = @'
import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }) {
  return <div className={cn("w-full overflow-auto", className)} {...props} />;
}

export function TableRoot({ className, ...props }) {
  return <table className={cn("w-full caption-bottom text-sm", className)} {...props} />;
}

export function TableHeader({ className, ...props }) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}

export function TableBody({ className, ...props }) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableFooter({ className, ...props }) {
  return <tfoot className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />;
}

export function TableRow({ className, ...props }) {
  return <tr className={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)} {...props} />;
}

export function TableHead({ className, ...props }) {
  return <th className={cn("h-10 px-2 text-left align-middle font-medium text-muted-foreground", className)} {...props} />;
}

export function TableCell({ className, ...props }) {
  return <td className={cn("p-2 align-middle", className)} {...props} />;
}

export function TableCaption({ className, ...props }) {
  return <caption className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />;
}
'@

# --- UI: Dialog (Radix)
$dialog = @'
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-black/50",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  );
});

export const DialogContent = React.forwardRef(function DialogContent({ className, children, ...props }, ref) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4",
          "border bg-background p-6 shadow-lg sm:rounded-lg",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
          "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className={cn(
            "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity",
            "hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:pointer-events-none"
          )}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});

export function DialogHeader({ className, ...props }) {
  return <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />;
}

export function DialogFooter({ className, ...props }) {
  return <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />;
}

export const DialogTitle = React.forwardRef(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
});

export const DialogDescription = React.forwardRef(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
});
'@

# --- Toast: Toaster wrapper
$toaster = @'
import * as React from "react";
import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      duration={2500}
    />
  );
}
'@

# --- Upgrade scan listener to real keyboard buffer
$scanListener = @'
import * as React from "react";

/**
 * Real keyboard-wedge scan listener (barcode scanners that type keys fast).
 *
 * Behavior:
 * - Buffers keystrokes.
 * - If Enter is pressed, emits the buffer as a scan code.
 * - Also emits on inactivity gap (default 50ms) if buffer looks like a scan.
 *
 * Also exposes: window.__emitScan(code) for debugging.
 *
 * Options:
 * - minLength: minimum length to treat as scan (default 6)
 * - endKeys: keys that finalize scan (default Enter, Tab)
 * - gapMs: inactivity gap that finalizes scan (default 50)
 */
export function useScanListener(onScan, opts = {}) {
  const {
    minLength = 6,
    endKeys = ["Enter", "Tab"],
    gapMs = 50
  } = opts;

  const bufferRef = React.useRef("");
  const timerRef = React.useRef(null);

  const flush = React.useCallback(() => {
    const code = bufferRef.current;
    bufferRef.current = "";
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (code && code.length >= minLength) onScan?.(code);
  }, [minLength, onScan]);

  React.useEffect(() => {
    function onKeyDown(e) {
      // Ignore if user is typing in input/textarea or contenteditable
      const el = e.target;
      const tag = el?.tagName?.toLowerCase();
      const isEditable = el?.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
      if (isEditable) return;

      if (endKeys.includes(e.key)) {
        if (bufferRef.current.length) {
          e.preventDefault();
          flush();
        }
        return;
      }

      // only accept printable characters
      if (e.key.length !== 1) return;

      bufferRef.current += e.key;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // Inactivity flush
        flush();
      }, gapMs);
    }

    window.addEventListener("keydown", onKeyDown, { capture: true });

    // Debug helper
    window.__emitScan = (code) => onScan?.(String(code));

    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      if (window.__emitScan) delete window.__emitScan;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [endKeys, gapMs, flush, onScan]);
}
'@

# --- Update main.jsx to include Toaster
$mainPath = Join-Path $root "src\main.jsx"
if (-not (Test-Path -LiteralPath $mainPath)) { throw "src\main.jsx not found" }
$mainContent = Get-Content -LiteralPath $mainPath -Raw

if ($mainContent -notmatch "Toaster") {
  $mainPatched = $mainContent `
    -replace 'import\s+\{\s*ThemeProvider\s*\}\s+from\s+"@\/providers\/ThemeProvider";', 'import { ThemeProvider } from "@/providers/ThemeProvider";' `
    -replace 'import\s+App\s+from\s+"\./App\.jsx";', 'import App from "./App.jsx";' `
    -replace 'import\s+"\./styles\/globals\.css";', 'import "./styles/globals.css";`nimport { Toaster } from "@/components/toaster";'

  # inject Toaster inside ThemeProvider
  $mainPatched = $mainPatched -replace '(</ThemeProvider>)', "  <Toaster />`n    </ThemeProvider>"

  Backup-IfExists $mainPath
  Set-Content -LiteralPath $mainPath -Value $mainPatched -Encoding UTF8
  Write-Step "Patched: src\main.jsx (added Toaster)"
} else {
  Write-Step "main.jsx already includes Toaster (skip)."
}

# --- Write DS expanded components
Write-TextFile (Join-Path $root "src\components\ui\badge.jsx") $badge
Write-TextFile (Join-Path $root "src\components\ui\table.jsx") $table
Write-TextFile (Join-Path $root "src\components\ui\dialog.jsx") $dialog
Write-TextFile (Join-Path $root "src\components\toaster.jsx") $toaster

# --- Patch scan listener
Write-TextFile (Join-Path $root "src\features\pos\hooks\useScanListener.js") $scanListener

# --- Patch POS page to demo dialog + toast
$posPath = Join-Path $root "src\pages\PosPage.jsx"
if (Test-Path -LiteralPath $posPath) {
  $posNew = @'
import * as React from "react";
import { Container } from "@/components/ui/grid";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableRoot, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

import { useCart } from "@/features/pos/hooks/useCart";
import { useScanListener } from "@/features/pos/hooks/useScanListener";

export function PosPage() {
  const cart = useCart();

  useScanListener((code) => {
    cart.addItem({ id: code, name: `Scanned: ${code}`, price: 0 }, 1);
    toast.success("Scanned", { description: code });
  });

  const totalItems = cart.items.reduce((sum, it) => sum + (it.qty || 0), 0);

  return (
    <Container className="py-10 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>POS v1 (Baseline)</CardTitle>
              <CardDescription>Real scan buffer + Dialog + Toast + Table.</CardDescription>
            </div>
            <Badge variant="secondary">Items: {totalItems}</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => cart.addItem({ id: "demo", name: "Demo item", price: 99 }, 1)}>
              Add Demo Item
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Checkout</Button>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Checkout</DialogTitle>
                  <DialogDescription>
                    This is a placeholder checkout dialog. Next step: payment + order creation.
                  </DialogDescription>
                </DialogHeader>

                <div className="text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Items</span>
                    <span className="font-medium">{totalItems}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-medium">฿{cart.items.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 0), 0)}</span>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => toast("Saved draft", { description: "Checkout draft saved (stub)" })}>
                    Save Draft
                  </Button>
                  <Button onClick={() => toast.success("Paid", { description: "Payment flow coming next" })}>
                    Confirm
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="destructive" onClick={() => { cart.clear(); toast("Cart cleared"); }}>
              Clear Cart
            </Button>
          </div>

          <Table className="border rounded-lg">
            <TableRoot>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-24 text-right">Qty</TableHead>
                  <TableHead className="w-32 text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.name}</TableCell>
                    <TableCell className="text-right">{it.qty}</TableCell>
                    <TableCell className="text-right">฿{it.price || 0}</TableCell>
                  </TableRow>
                ))}

                {!cart.items.length && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      Scan a barcode (keyboard wedge) or run: <code>window.__emitScan('8851234567890')</code>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </TableRoot>
          </Table>
        </CardContent>
      </Card>
    </Container>
  );
}
'@
  Write-TextFile $posPath $posNew
} else {
  Write-Step "PosPage not found (skip)."
}

Write-Step "Verifying build..."
& npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

Write-Step "DONE ✅ DS Expand Pack applied."
Write-Host ""
Write-Host "Run:"
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Scan test:"
Write-Host "  - Use barcode scanner OR"
Write-Host "  - Browser console: window.__emitScan('8851234567890')"
