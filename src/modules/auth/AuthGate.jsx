
import { useAuth } from "./AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import GoogleSignIn from "@/components/auth/GoogleSignIn";
import IdPinLogin from "@/components/auth/IdPinLogin";
import PinReset from "@/components/auth/PinReset";
import { ServerStatus } from "@/components/ui/ServerStatus";

export function AuthGate({ children }) {
  const { firebaseUser, session, loading, authLoading } = useAuth();

  // Show loading spinner while checking auth state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <LoadingSpinner label="Preparing secure session..." />
      </div>
    );
  }

  if (!firebaseUser) {
    return <GoogleSignIn />;
  }

  if (!session) {
    return <IdPinLogin />;
  }

  if (session.pinResetRequired) {
    return <PinReset />;
  }

  return <>{children}</>;
}

export default AuthGate;

    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-sm text-muted-foreground">Loadingโ€ฆ</div>
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
      <div className="absolute top-4 right-4">
        <ServerStatus />
      </div>
      <Card
        title="Sign in"
        subtitle="ลงชื่อเข้าใช้ด้วยรหัสที่คุณได้รับ (Google / Email)"
      >
        <div className="space-y-3">
          <Button type="button" onClick={onGoogle} disabled={busy} className="w-full">
            Continue with Google
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <div className="text-xs text-muted-foreground">เธซเธฃเธทเธญ</div>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            {mode === "signup" ? (
              <Field label="Display name">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  placeholder="เธเธทเนเธญเธ—เธตเนเนเธชเธ”เธ"
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
                placeholder="โ€ขโ€ขโ€ขโ€ขโ€ขโ€ขโ€ขโ€ข"
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
      <div className="absolute top-4 right-4">
        <ServerStatus />
      </div>
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