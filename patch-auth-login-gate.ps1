# patch-auth-login-gate.ps1
# SafeMode patch: adds AuthProvider + AuthGate (Login + PIN unlock) and wires to AppRouter

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Find-RepoRoot([string]$start) {
  $dir = Resolve-Path $start
  while ($true) {
    if (Test-Path (Join-Path $dir "package.json")) { return $dir }
    $parent = Split-Path $dir -Parent
    if ($parent -eq $dir) { return (Resolve-Path $start) }
    $dir = $parent
  }
}

function Ensure-Dir([string]$p) {
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
}

function Backup-File([string]$repoRoot, [string]$backupRoot, [string]$filePath) {
  $abs = Join-Path $repoRoot $filePath
  if (-not (Test-Path $abs)) { return }
  $relDir = Split-Path $filePath -Parent
  $destDir = if ($relDir) { Join-Path $backupRoot $relDir } else { $backupRoot }
  Ensure-Dir $destDir
  $dest = Join-Path $backupRoot $filePath
  Copy-Item -LiteralPath $abs -Destination $dest -Force
}

function Write-TextFile([string]$path, [string]$content) {
  $dir = Split-Path $path -Parent
  if ($dir) { Ensure-Dir $dir }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
}

function Read-TextFile([string]$path) {
  if (-not (Test-Path $path)) { return "" }
  return [System.IO.File]::ReadAllText($path)
}

$repoRoot = Find-RepoRoot (Get-Location).Path
$ts = Get-Date -Format "yyMMdd-HHmmss"
$backupRoot = Join-Path $repoRoot (".backup-auth-login-gate-$ts")
$toolsDir = Join-Path $repoRoot "tools"
$logsDir = Join-Path $toolsDir "logs"
Ensure-Dir $backupRoot
Ensure-Dir $logsDir

$summaryPath = Join-Path $logsDir "summary.txt"
$logPath = Join-Path $logsDir ("patch-auth-login-gate-$ts.log")
$lastBackup = Join-Path $toolsDir "LAST_BACKUP_DIR.txt"

$log = New-Object System.Collections.Generic.List[string]
function Log([string]$m) {
  $line = "[AUTH-GATE] $m"
  $log.Add($line) | Out-Null
  Write-Host $line
}

try {
  Log "Repo root: $repoRoot"
  Log "Backup dir: $backupRoot"
  Write-TextFile -path $lastBackup -content $backupRoot

  # Targets
  $mainRel = "src\main.jsx"
  $appRel  = "src\App.jsx"
  $gateRel = "src\modules\auth\AuthGate.jsx"

  # Backup
  Backup-File $repoRoot $backupRoot $mainRel
  Backup-File $repoRoot $backupRoot $appRel
  Backup-File $repoRoot $backupRoot $gateRel

  # 1) Write AuthGate.jsx
  $gateAbs = Join-Path $repoRoot $gateRel
  $gateContent = @'
/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { useAuth } from "@/modules/auth/AuthContext";

function Field({ label, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Button({ children, ...props }) {
  return (
    <button
      {...props}
      className={
        "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium " +
        "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none " +
        (props.className ? " " + props.className : "")
      }
    >
      {children}
    </button>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-sm">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-sm text-muted-foreground">Loading…</div>
    </div>
  );
}

function LoginScreen() {
  const { signInWithGoogle, loginEmail, signupEmail, loginAnonymous } = useAuth();
  const [mode, setMode] = React.useState("login"); // login | signup
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  const onGoogle = async () => {
    setBusy(true); setErr("");
    const res = await signInWithGoogle();
    if (!res?.success && res?.error) setErr(res.error);
    setBusy(false);
  };

  const onAnon = async () => {
    setBusy(true); setErr("");
    const res = await loginAnonymous();
    if (!res?.success && res?.error) setErr(res.error);
    setBusy(false);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    if (mode === "login") {
      const res = await loginEmail(email, password);
      if (!res?.success) setErr(res?.error || "Login failed");
    } else {
      const res = await signupEmail({ email, password, displayName });
      if (!res?.success) setErr(res?.error || "Signup failed");
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <Card
        title="Sign in"
        subtitle="เข้าสู่ระบบเพื่อใช้งาน (Google / Email / Anonymous)"
      >
        <div className="space-y-3">
          <Button type="button" onClick={onGoogle} disabled={busy} className="w-full">
            Continue with Google
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <div className="text-xs text-muted-foreground">หรือ</div>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            {mode === "signup" ? (
              <Field label="Display name">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  placeholder="ชื่อที่แสดง"
                />
              </Field>
            ) : null}

            <Field label="Email">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
              />
            </Field>

            <Field label="Password">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                placeholder="••••••••"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </Field>

            <Button type="submit" disabled={busy} className="w-full">
              {mode === "login" ? "Login" : "Create account"}
            </Button>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <button
                type="button"
                className="underline underline-offset-4"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                disabled={busy}
              >
                {mode === "login" ? "Create account" : "Back to login"}
              </button>

              <button
                type="button"
                className="underline underline-offset-4"
                onClick={onAnon}
                disabled={busy}
              >
                Anonymous
              </button>
            </div>

            {err ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                {err}
              </div>
            ) : null}
          </form>
        </div>
      </Card>
    </div>
  );
}

function UnlockPinScreen() {
  const { firebaseUser, ids, loadIds, verifyPin, lastIdCode, signOut } = useAuth();
  const [idCode, setIdCode] = React.useState(lastIdCode || "");
  const [pin, setPin] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadIds();
      } catch {
        // ignore; UI will show empty list
      }
      if (!mounted) return;
    })();
    return () => { mounted = false; };
  }, [loadIds]);

  const onUnlock = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await verifyPin(idCode, pin);
    } catch (ex) {
      setErr(ex?.message || "Invalid PIN");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <Card
        title="Unlock terminal"
        subtitle={firebaseUser?.email ? `Signed in: ${firebaseUser.email}` : "Signed in"}
      >
        <form onSubmit={onUnlock} className="space-y-3">
          <Field label="ID Code">
            <select
              value={idCode}
              onChange={(e) => setIdCode(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">-- Select ID --</option>
              {(ids || []).map((x) => (
                <option key={x.idCode || x.code || String(x)} value={x.idCode || x.code || String(x)}>
                  {x.label || x.name || x.idCode || x.code || String(x)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="PIN">
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="****"
              type="password"
              inputMode="numeric"
            />
          </Field>

          <Button type="submit" disabled={busy || !idCode || !pin} className="w-full">
            Unlock
          </Button>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() => loadIds()}
              disabled={busy}
            >
              Refresh IDs
            </button>
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() => signOut()}
              disabled={busy}
            >
              Sign out
            </button>
          </div>

          {err ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {err}
            </div>
          ) : null}
        </form>
      </Card>
    </div>
  );
}

export function AuthGate({ children }) {
  const { firebaseUser, session, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!firebaseUser) return <LoginScreen />;
  if (!session) return <UnlockPinScreen />;

  return <>{children}</>;
}
'@
  Write-TextFile -path $gateAbs -content $gateContent
  Log "Wrote: $gateRel"

  # 2) Patch App.jsx to wrap AppRouter with AuthGate
  $appAbs = Join-Path $repoRoot $appRel
  $newApp = @'
import * as React from "react";
import { AppRouter } from "@/router/AppRouter";
import { AuthGate } from "@/modules/auth/AuthGate";

export default function App() {
  return (
    <AuthGate>
      <AppRouter />
    </AuthGate>
  );
}
'@
  Write-TextFile -path $appAbs -content $newApp
  Log "Patched: $appRel (AuthGate wraps AppRouter)"

  # 3) Patch main.jsx to include AuthProvider
  $mainAbs = Join-Path $repoRoot $mainRel
  $mainOld = Read-TextFile $mainAbs

  if (-not $mainOld) { throw "Missing $mainRel" }

  # If already wrapped, skip
  if ($mainOld -match "AuthProvider" -and $mainOld -match "modules/auth/AuthContext") {
    Log "Skip: $mainRel already imports AuthProvider"
  } else {
    $mainNew = $mainOld

    # Insert import
    if ($mainNew -notmatch 'AuthProvider') {
      $mainNew = $mainNew -replace '(import\s+\{?\s*ThemeProvider.*\n)', ('$1' + "import { AuthProvider } from `"`@/modules/auth/AuthContext`"`n")
      if ($mainNew -notmatch 'AuthProvider') {
        # fallback: append after css import
        $mainNew = $mainNew -replace '(import\s+["'']\.\/styles\/globals\.css["''];\s*\n)', ('$1' + "import { AuthProvider } from `"`@/modules/auth/AuthContext`"`n")
      }
    }

    # Wrap App/Toaster with AuthProvider inside ThemeProvider
    if ($mainNew -match '<ThemeProvider[^>]*>') {
      $mainNew = $mainNew -replace '(<ThemeProvider[^>]*>\s*)\r?\n\s*(<App\s*\/>\s*\r?\n\s*<Toaster\s*\/>\s*)', "`$1`n      <AuthProvider>`n        `$2`n      </AuthProvider>`n"
      # If pattern didn't match, do a broader wrap
      if ($mainNew -notmatch "<AuthProvider>") {
        $mainNew = $mainNew -replace '(<ThemeProvider[^>]*>\s*)', "`$1`n      <AuthProvider>`n"
        $mainNew = $mainNew -replace '(\s*</ThemeProvider>)', "      </AuthProvider>`n`$1"
      }
    } else {
      throw "Could not find <ThemeProvider> block in $mainRel"
    }

    Write-TextFile -path $mainAbs -content $mainNew
    Log "Patched: $mainRel (AuthProvider added)"
  }

  # Write logs
  Write-TextFile -path $logPath -content ($log -join "`n")

  $summary = @"
PATCH OK: Auth Login Gate wired

- Added: $gateRel
- Patched: $appRel (AuthGate wraps AppRouter)
- Patched: $mainRel (AuthProvider wraps App + Toaster)

Next:
  npm run lint
  npm run dev

Backup:
  $backupRoot
"@
  Write-TextFile -path $summaryPath -content $summary
  Log "Wrote summary: tools/logs/summary.txt"
  Log "DONE"
}
catch {
  $msg = $_.Exception.Message
  Log "ERROR: $msg"
  try { Write-TextFile -path $logPath -content ($log -join "`n") } catch {}
  try {
    $failSummary = "PATCH FAILED: $msg`nBackup: $backupRoot`nSee log: $logPath`n"
    Write-TextFile -path $summaryPath -content $failSummary
  } catch {}
  throw
}
finally {
  # Always ensure summary exists (done above)
}
