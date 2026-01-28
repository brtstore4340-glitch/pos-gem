<# 
BOOTSTRAP: Tailwind Design System Baseline (Vite + React)
Target: D:\01 Main Work\Boots\Boots-POS Gemini

What it does:
- Creates a minimal Vite+React project skeleton (no prompts)
- Adds Tailwind + PostCSS config
- Adds Design System tokens (globals.css) + dark mode
- Adds UI components (Button/Card/Input/Label/Grid) using CVA + cn()
- Adds ThemeProvider + ThemeToggle
- Installs deps + runs build verification

Run (PowerShell):
  Set-ExecutionPolicy -Scope Process Bypass -Force
  cd "D:\01 Main Work\Boots\Boots-POS Gemini"
  .\bootstrap-ds.ps1
#>

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host ("[DS] " + $msg)
}

function Ensure-Dir($path) {
  if (-not (Test-Path -LiteralPath $path)) {
    New-Item -ItemType Directory -Path $path | Out-Null
  }
}

function Backup-IfExists($path) {
  if (Test-Path -LiteralPath $path) {
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    $bak = "$path.bak.$ts"
    Copy-Item -LiteralPath $path -Destination $bak -Force
    Write-Step "Backup: $path -> $bak"
  }
}

function Write-TextFile($path, $content) {
  Backup-IfExists $path
  $dir = Split-Path -Parent $path
  if ($dir -and $dir -ne ".") { Ensure-Dir $dir }
  Set-Content -LiteralPath $path -Value $content -Encoding UTF8
  Write-Step "Wrote: $path"
}

function Assert-EmptyOrSafe($root) {
  Ensure-Dir $root
  $items = Get-ChildItem -LiteralPath $root -Force | Where-Object { $_.Name -notin @(".", "..") }
  if ($items.Count -gt 0) {
    # We will "patch" by backing up individual files we overwrite.
    Write-Step "Directory is not empty. Script will patch (and backup) files it overwrites."
  } else {
    Write-Step "Directory is empty. Bootstrapping from scratch."
  }
}

$root = (Get-Location).Path
Write-Step "Repo root: $root"
Assert-EmptyOrSafe $root

# --- Create folder structure
Ensure-Dir "$root\src"
Ensure-Dir "$root\src\components\ui"
Ensure-Dir "$root\src\lib"
Ensure-Dir "$root\src\providers"
Ensure-Dir "$root\src\styles"

# --- package.json (minimal, production-friendly)
$packageJson = @'
{
  "name": "boots-pos-gemini",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "echo \"(optional) add eslint later\" && exit 0"
  },
  "dependencies": {
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.542.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^2.5.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "tailwindcss-animate": "^1.0.7",
    "vite": "^5.4.2"
  }
}
'@

# --- Vite config
$viteConfig = @'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
    },
  },
});
'@

# --- index.html
$indexHtml = @'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Boots POS Gemini</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
'@

# --- Tailwind config (tokens mapped to CSS vars; prevents border-border failures)
$tailwindConfig = @'
/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        // Semantic tokens -> CSS variables (HSL)
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },

        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",

        // Optional extra tokens
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        input: "hsl(var(--input))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
'@

# --- PostCSS config
$postcssConfig = @'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
'@

# --- globals.css (Design System baseline + dark mode)
$globalsCss = @'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Core semantic tokens */
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;

    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;

    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;

    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;

    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;

    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;

    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;

    --radius: 0.75rem;

    /* Optional pastel accents (HSL) */
    --mint: 152 76% 80%;     /* #A7F3D0 */
    --peach: 27 96% 72%;     /* #FDBA74 */
    --lavender: 265 67% 92%; /* #DDD6FE */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;

    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;

    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;

    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;

    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;

    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;

    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;

    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }

  * {
    border-color: hsl(var(--border));
  }

  body {
    @apply bg-background text-foreground antialiased;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji",
      "Segoe UI Emoji";
  }
}
'@

# --- utils: cn()
$utilsJs = @'
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
export const disabled = "disabled:pointer-events-none disabled:opacity-50";
'@

# --- UI: Button (CVA)
$buttonJsx = @'
import * as React from "react";
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
  { className, variant, size, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});

export { Button, buttonVariants };
'@

# --- UI: Card (compound)
$cardJsx = @'
import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef(function Card({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  );
});

const CardHeader = React.forwardRef(function CardHeader({ className, ...props }, ref) {
  return (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  );
});

const CardTitle = React.forwardRef(function CardTitle({ className, ...props }, ref) {
  return (
    <h3
      ref={ref}
      className={cn("text-xl font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
});

const CardDescription = React.forwardRef(function CardDescription({ className, ...props }, ref) {
  return (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
});

const CardContent = React.forwardRef(function CardContent({ className, ...props }, ref) {
  return <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />;
});

const CardFooter = React.forwardRef(function CardFooter({ className, ...props }, ref) {
  return <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />;
});

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
'@

# --- UI: Label
$labelJsx = @'
import * as React from "react";
import { cn } from "@/lib/utils";

const Label = React.forwardRef(function Label({ className, ...props }, ref) {
  return (
    <label
      ref={ref}
      className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
      {...props}
    />
  );
});

export { Label };
'@

# --- UI: Input
$inputJsx = @'
import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef(function Input({ className, error, id, ...props }, ref) {
  const describedBy = error && id ? `${id}-error` : undefined;

  return (
    <div className="relative">
      <input
        ref={ref}
        id={id}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background " +
            "file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
            "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-destructive focus-visible:ring-destructive",
          className
        )}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        {...props}
      />
      {error && id && (
        <p id={`${id}-error`} className="mt-1 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

export { Input };
'@

# --- UI: Grid + Container (responsive)
$gridJsx = @'
import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const gridVariants = cva("grid", {
  variants: {
    cols: {
      1: "grid-cols-1",
      2: "grid-cols-1 sm:grid-cols-2",
      3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
      4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
      5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
      6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
    },
    gap: {
      none: "gap-0",
      sm: "gap-2",
      md: "gap-4",
      lg: "gap-6",
      xl: "gap-8"
    }
  },
  defaultVariants: {
    cols: 3,
    gap: "md"
  }
});

function Grid({ className, cols, gap, ...props }) {
  return <div className={cn(gridVariants({ cols, gap }), className)} {...props} />;
}

const containerVariants = cva("mx-auto w-full px-4 sm:px-6 lg:px-8", {
  variants: {
    size: {
      sm: "max-w-screen-sm",
      md: "max-w-screen-md",
      lg: "max-w-screen-lg",
      xl: "max-w-screen-xl",
      "2xl": "max-w-screen-2xl",
      full: "max-w-full"
    }
  },
  defaultVariants: {
    size: "xl"
  }
});

function Container({ className, size, ...props }) {
  return <div className={cn(containerVariants({ size }), className)} {...props} />;
}

export { Grid, Container };
'@

# --- ThemeProvider + ThemeToggle
$themeProviderJsx = @'
import * as React from "react";

const ThemeContext = React.createContext(null);

export function ThemeProvider({ children, defaultTheme = "system", storageKey = "theme" }) {
  const [theme, setTheme] = React.useState(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = React.useState("light");

  React.useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) setTheme(stored);
  }, [storageKey]);

  React.useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    let resolved = "light";
    if (theme === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      resolved = theme;
    }

    root.classList.add(resolved);
    setResolvedTheme(resolved);
  }, [theme]);

  const value = React.useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (newTheme) => {
        localStorage.setItem(storageKey, newTheme);
        setTheme(newTheme);
      }
    }),
    [theme, resolvedTheme, storageKey]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
'@

$themeToggleJsx = @'
import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
'@

# --- App + main
$appJsx = @'
import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Container, Grid } from "@/components/ui/grid";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function App() {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState("");

  function onSubmit(e) {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }
    setError("");
    alert("OK: " + email);
  }

  return (
    <div className="min-h-screen">
      <div className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Container className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md border bg-accent" />
            <div>
              <div className="text-sm font-semibold">Boots POS Gemini</div>
              <div className="text-xs text-muted-foreground">Tailwind Design System baseline</div>
            </div>
          </div>
          <ThemeToggle />
        </Container>
      </div>

      <Container className="py-10">
        <Grid cols={3} gap="lg">
          <Card>
            <CardHeader>
              <CardTitle>Tokens ✅</CardTitle>
              <CardDescription>Semantic tokens mapped to CSS variables.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="h-8 w-8 rounded-md" style={{ background: "hsl(var(--mint))" }} />
                <div className="h-8 w-8 rounded-md" style={{ background: "hsl(var(--peach))" }} />
                <div className="h-8 w-8 rounded-md" style={{ background: "hsl(var(--lavender))" }} />
              </div>
              <p className="text-sm text-muted-foreground">
                Dark mode is class-based. Try the toggle in the header.
              </p>
            </CardContent>
            <CardFooter className="gap-2">
              <Button>Primary</Button>
              <Button variant="outline">Outline</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Form ✅</CardTitle>
              <CardDescription>Accessible input with error state.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={error}
                    placeholder="name@company.com"
                  />
                </div>
                <Button type="submit" className="w-full">Submit</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>States ✅</CardTitle>
              <CardDescription>Variants + sizes + disabled.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm">Small</Button>
                <Button>Default</Button>
                <Button size="lg">Large</Button>
                <Button variant="destructive">Danger</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button disabled>Disabled</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                If you ever see <code>border-border</code> errors, this baseline prevents it by defining <code>border</code> token in tailwind config.
              </p>
            </CardContent>
          </Card>
        </Grid>
      </Container>
    </div>
  );
}
'@

$mainJsx = @'
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/globals.css";
import { ThemeProvider } from "@/providers/ThemeProvider";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="theme">
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
'@

# --- Write files
Write-TextFile "$root\package.json" $packageJson
Write-TextFile "$root\vite.config.js" $viteConfig
Write-TextFile "$root\index.html" $indexHtml
Write-TextFile "$root\tailwind.config.js" $tailwindConfig
Write-TextFile "$root\postcss.config.js" $postcssConfig

Write-TextFile "$root\src\styles\globals.css" $globalsCss
Write-TextFile "$root\src\lib\utils.js" $utilsJs

Write-TextFile "$root\src\components\ui\button.jsx" $buttonJsx
Write-TextFile "$root\src\components\ui\card.jsx" $cardJsx
Write-TextFile "$root\src\components\ui\input.jsx" $inputJsx
Write-TextFile "$root\src\components\ui\label.jsx" $labelJsx
Write-TextFile "$root\src\components\ui\grid.jsx" $gridJsx

Write-TextFile "$root\src\providers\ThemeProvider.jsx" $themeProviderJsx
Write-TextFile "$root\src\components\ThemeToggle.jsx" $themeToggleJsx

Write-TextFile "$root\src\App.jsx" $appJsx
Write-TextFile "$root\src\main.jsx" $mainJsx

# --- Install deps (idempotent-ish)
Write-Step "Installing dependencies (npm install)..."
& npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

# --- Build verification
Write-Step "Verifying build (npm run build)..."
& npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

Write-Step "DONE ✅"
Write-Host ""
Write-Host "Next:"
Write-Host "  npm run dev"
Write-Host "Open:"
Write-Host "  http://localhost:5173"
