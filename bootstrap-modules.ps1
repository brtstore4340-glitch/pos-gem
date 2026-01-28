<# 
BOOTSTRAP: Module Skeletons (feature-first) + lightweight routing
Target: D:\01 Main Work\Boots\Boots-POS Gemini

What it does:
- Adds react-router-dom
- Creates feature skeletons: auth, pos, products, orders, reports, settings
- Creates service adapters per feature (stubs)
- Creates pages + router + layout shell using DS components + ThemeToggle
- Updates src/App.jsx to use <AppRouter />

Run:
  Set-ExecutionPolicy -Scope Process Bypass -Force
  cd "D:\01 Main Work\Boots\Boots-POS Gemini"
  notepad .\bootstrap-modules.ps1   # paste + save
  .\bootstrap-modules.ps1
  npm run dev
#>

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "[MODULES] $msg" }
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
  if ($dir -and $dir -ne ".") { Ensure-Dir $dir }
  Set-Content -LiteralPath $path -Value $content -Encoding UTF8
  Write-Step "Wrote: $path"
}

$root = (Get-Location).Path
Write-Step "Repo root: $root"

# --- Ensure base dirs
Ensure-Dir "$root\src\features"
Ensure-Dir "$root\src\services"
Ensure-Dir "$root\src\pages"
Ensure-Dir "$root\src\components\layout"
Ensure-Dir "$root\src\router"

# --- Install router
Write-Step "Installing react-router-dom..."
& npm install react-router-dom
if ($LASTEXITCODE -ne 0) { throw "npm install react-router-dom failed" }

# --- Shared: AppShell layout (uses DS + ThemeToggle)
$appShell = @'
import * as React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Container } from "@/components/ui/grid";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/pos", label: "POS" },
  { to: "/products", label: "Products" },
  { to: "/orders", label: "Orders" },
  { to: "/reports", label: "Reports" },
  { to: "/settings", label: "Settings" }
];

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "text-sm px-3 py-2 rounded-md border transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          isActive ? "bg-accent text-accent-foreground" : "bg-background"
        )
      }
    >
      {label}
    </NavLink>
  );
}

export function AppShell() {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Container className="py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-9 w-9 rounded-md border bg-accent shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Boots POS Gemini</div>
              <div className="text-xs text-muted-foreground truncate">Feature-first modules + DS baseline</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <nav className="hidden md:flex items-center gap-2">
              {navItems.map((it) => (
                <NavItem key={it.to} to={it.to} label={it.label} />
              ))}
            </nav>
            <ThemeToggle />
          </div>
        </Container>

        <Container className="pb-3 md:hidden">
          <nav className="flex flex-wrap gap-2">
            {navItems.map((it) => (
              <NavItem key={it.to} to={it.to} label={it.label} />
            ))}
          </nav>
        </Container>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
'@

# --- Router
$appRouter = @'
import * as React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";

import { HomePage } from "@/pages/HomePage";
import { PosPage } from "@/pages/PosPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "pos", element: <PosPage /> },
      { path: "products", element: <ProductsPage /> },
      { path: "orders", element: <OrdersPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
'@

# --- Pages (placeholders)
$homePage = @'
import * as React from "react";
import { Container } from "@/components/ui/grid";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function HomePage() {
  return (
    <Container className="py-10 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Baseline Ready ✅</CardTitle>
          <CardDescription>Modules created: auth, pos, products, orders, reports, settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Next: implement Auth + Products import + POS cart flow.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild={false} onClick={() => location.assign("/pos")}>Go to POS</Button>
            <Button variant="outline" onClick={() => location.assign("/products")}>Products</Button>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}
'@

$posPage = @'
import * as React from "react";
import { Container } from "@/components/ui/grid";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCart } from "@/features/pos/hooks/useCart";
import { useScanListener } from "@/features/pos/hooks/useScanListener";

export function PosPage() {
  const cart = useCart();
  const scan = useScanListener((code) => {
    // stub: in future, lookup by barcode and add to cart
    cart.addItem({ id: code, name: `Scanned: ${code}`, price: 0 }, 1);
  });

  return (
    <Container className="py-10 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>POS (Skeleton)</CardTitle>
          <CardDescription>Hook stubs ready. Barcode listener stub attached.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => cart.addItem({ id: "demo", name: "Demo item", price: 99 }, 1)}>Add Demo Item</Button>
            <Button variant="outline" onClick={cart.clear}>Clear Cart</Button>
          </div>

          <div className="text-sm">
            <div className="font-medium">Cart items: {cart.items.length}</div>
            <ul className="mt-2 space-y-1">
              {cart.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                  <span className="truncate">{it.name}</span>
                  <span className="text-xs text-muted-foreground">x{it.qty}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            Tip: try typing in the console: <code>window.__emitScan?.("8851234567890")</code>
          </p>
        </CardContent>
      </Card>
    </Container>
  );
}
'@

$productsPage = @'
import * as React from "react";
import { Container } from "@/components/ui/grid";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { productService } from "@/features/products/services/productService";

export function ProductsPage() {
  const [items, setItems] = React.useState([]);

  async function load() {
    const res = await productService.listProducts({ q: "" });
    setItems(res.items);
  }

  React.useEffect(() => { load(); }, []);

  return (
    <Container className="py-10 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Products (Skeleton)</CardTitle>
          <CardDescription>Service adapter stub in place. Replace with Firestore later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={load}>Reload</Button>
            <Button variant="outline" onClick={() => alert("Next: import products + categories")}>Next Step</Button>
          </div>

          <ul className="space-y-2">
            {items.map((p) => (
              <li key={p.id} className="border rounded-md px-3 py-2">
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.category} • ฿{p.price}</div>
              </li>
            ))}
          </ul>

          {!items.length && (
            <div className="text-sm text-muted-foreground">No products yet (stub returns demo data).</div>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
'@

$ordersPage = @'
import * as React from "react";
import { Container } from "@/components/ui/grid";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export function OrdersPage() {
  return (
    <Container className="py-10">
      <Card>
        <CardHeader>
          <CardTitle>Orders (Skeleton)</CardTitle>
          <CardDescription>Next: order history, refunds, status.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Placeholder page.
        </CardContent>
      </Card>
    </Container>
  );
}
'@

$reportsPage = @'
import * as React from "react";
import { Container } from "@/components/ui/grid";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export function ReportsPage() {
  return (
    <Container className="py-10">
      <Card>
        <CardHeader>
          <CardTitle>Reports (Skeleton)</CardTitle>
          <CardDescription>Next: daily report + cashier report.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Placeholder page.
        </CardContent>
      </Card>
    </Container>
  );
}
'@

$settingsPage = @'
import * as React from "react";
import { Container } from "@/components/ui/grid";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export function SettingsPage() {
  return (
    <Container className="py-10">
      <Card>
        <CardHeader>
          <CardTitle>Settings (Skeleton)</CardTitle>
          <CardDescription>Next: store profile, devices, printers.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Placeholder page.
        </CardContent>
      </Card>
    </Container>
  );
}
'@

$notFoundPage = @'
import * as React from "react";
import { Container } from "@/components/ui/grid";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <Container className="py-10">
      <Card>
        <CardHeader>
          <CardTitle>404</CardTitle>
          <CardDescription>Page not found.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => location.assign("/")}>Go Home</Button>
        </CardContent>
      </Card>
    </Container>
  );
}
'@

# --- Feature skeletons
$featureReadme = @'
# Feature

## Structure
- pages/ (route-level components)
- components/ (feature UI components)
- hooks/ (feature hooks)
- services/ (feature service adapters)

## Rules
- Use DS components in src/components/ui
- No UI imports inside services
'@

# auth (minimal placeholders)
$authService = @'
export const authService = {
  async signIn(email, password) {
    // TODO: replace with Firebase Auth
    if (!email || !password) throw new Error("Missing credentials");
    return { userId: "demo", role: "cashier", email };
  },
  async signOut() {
    return true;
  },
  async getSession() {
    return null;
  }
};
'@

# products service (demo data)
$productService = @'
const demo = [
  { id: "p1", name: "Cleansing Gel", category: "Skincare", price: 390, is_active: true },
  { id: "p2", name: "Vitamin C Serum", category: "Skincare", price: 990, is_active: true },
  { id: "p3", name: "Sunscreen SPF50", category: "Suncare", price: 690, is_active: true }
];

export const productService = {
  async listProducts({ q = "", category } = {}) {
    const query = String(q).toLowerCase();
    let items = demo.filter((x) => x.is_active);
    if (category) items = items.filter((x) => x.category === category);
    if (query) items = items.filter((x) => x.name.toLowerCase().includes(query));
    return { items };
  },
  async getProductByBarcode(barcode) {
    // TODO: lookup in Firestore by barcode array
    return null;
  },
  async upsertProduct(product) {
    // TODO: Firestore upsert with validation
    return { ok: true, product };
  }
};
'@

# pos: hooks + service stub
$useCart = @'
import * as React from "react";

export function useCart() {
  const [items, setItems] = React.useState([]);

  const addItem = React.useCallback((product, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, { ...product, qty }];
    });
  }, []);

  const removeItem = React.useCallback((id) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const clear = React.useCallback(() => setItems([]), []);

  return { items, addItem, removeItem, clear };
}
'@

$useScanListener = @'
import * as React from "react";

/**
 * Minimal scan listener stub.
 * - For now: exposes window.__emitScan(code) for testing
 * - Later: replace with real keyboard scan buffer (POS scanner emits keyboard events)
 */
export function useScanListener(onScan) {
  React.useEffect(() => {
    window.__emitScan = (code) => onScan?.(String(code));
    return () => {
      if (window.__emitScan) delete window.__emitScan;
    };
  }, [onScan]);

  return { attached: true };
}
'@

$posService = @'
export const posService = {
  async checkout({ items, paymentMethod }) {
    // TODO: create order + payment record (Cloud Function preferred)
    return { ok: true, orderId: "order_demo", items, paymentMethod };
  }
};
'@

# orders/reports/settings service placeholders
$orderService = @'
export const orderService = {
  async listOrders({ storeId, dateFrom, dateTo } = {}) {
    // TODO: Firestore query by storeId + createdAt
    return { items: [] };
  }
};
'@

$reportService = @'
export const reportService = {
  async getDailyReport({ storeId, date } = {}) {
    // TODO: aggregate orders; likely Cloud Function
    return { ok: true, storeId, date, totals: { sales: 0, orders: 0 } };
  }
};
'@

$settingsService = @'
export const settingsService = {
  async getStoreSettings(storeId) {
    return { storeId, timezone: "Asia/Bangkok" };
  },
  async updateStoreSettings(storeId, patch) {
    return { ok: true, storeId, patch };
  }
};
'@

# --- Update App.jsx to use router
$appJsx = @'
import * as React from "react";
import { AppRouter } from "@/router/AppRouter";

export default function App() {
  return <AppRouter />;
}
'@

# --- Write files
Write-TextFile "$root\src\components\layout\AppShell.jsx" $appShell
Write-TextFile "$root\src\router\AppRouter.jsx" $appRouter

Write-TextFile "$root\src\pages\HomePage.jsx" $homePage
Write-TextFile "$root\src\pages\PosPage.jsx" $posPage
Write-TextFile "$root\src\pages\ProductsPage.jsx" $productsPage
Write-TextFile "$root\src\pages\OrdersPage.jsx" $ordersPage
Write-TextFile "$root\src\pages\ReportsPage.jsx" $reportsPage
Write-TextFile "$root\src\pages\SettingsPage.jsx" $settingsPage
Write-TextFile "$root\src\pages\NotFoundPage.jsx" $notFoundPage

# Feature dirs + readmes
$features = @("auth","pos","products","orders","reports","settings")
foreach ($f in $features) {
  Ensure-Dir "$root\src\features\$f"
  Ensure-Dir "$root\src\features\$f\pages"
  Ensure-Dir "$root\src\features\$f\components"
  Ensure-Dir "$root\src\features\$f\hooks"
  Ensure-Dir "$root\src\features\$f\services"
  Write-TextFile "$root\src\features\$f\README.md" $featureReadme
}

# Feature services/hooks
Write-TextFile "$root\src\features\auth\services\authService.js" $authService
Write-TextFile "$root\src\features\products\services\productService.js" $productService
Write-TextFile "$root\src\features\pos\hooks\useCart.js" $useCart
Write-TextFile "$root\src\features\pos\hooks\useScanListener.js" $useScanListener
Write-TextFile "$root\src\features\pos\services\posService.js" $posService
Write-TextFile "$root\src\features\orders\services\orderService.js" $orderService
Write-TextFile "$root\src\features\reports\services\reportService.js" $reportService
Write-TextFile "$root\src\features\settings\services\settingsService.js" $settingsService

# App.jsx swap
Write-TextFile "$root\src\App.jsx" $appJsx

# --- Verify build
Write-Step "Verifying build..."
& npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

Write-Step "DONE ✅ Module skeleton created."
Write-Host ""
Write-Host "Run:"
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Test scan stub:"
Write-Host "  open POS page then in browser console:"
Write-Host "    window.__emitScan('8851234567890')"
