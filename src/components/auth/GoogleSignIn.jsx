import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Loader2, Sun, Moon, CheckCircle2 } from "lucide-react";

export default function GoogleSignIn() {
  // BEGIN: FUNCTION ZONE (DO NOT TOUCH)
  const { signInWithGoogle, loginEmail, signupEmail, loginAnonymous } =
    useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState("signin"); // signin | signup
  const [isDark, setIsDark] = useState(false); // UI State for theme

  // Theme Sync Logic (Purely presentational, allowed in function zone to keep it clean)
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const systemDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const initialDark = savedTheme === "dark" || (!savedTheme && systemDark);
    setIsDark(initialDark);
    if (initialDark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    localStorage.setItem("theme", newDark ? "dark" : "light");
    if (newDark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  };

  const handleSignIn = async () => {
    console.log("🔍 GoogleSignIn: Button clicked");
    setIsLoading(true);
    setError(null);

    try {
      const result = await signInWithGoogle();
      console.log("🔍 GoogleSignIn: Result from signInWithGoogle:", result);

      if (!result.success) {
        setError(result.error || "Failed to sign in");
      }
    } catch (err) {
      console.error("🔍 GoogleSignIn: Caught error:", err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (!email || !password) {
        setError("กรุณากรอกอีเมลและรหัสผ่าน");
        return;
      }
      const res =
        mode === "signup"
          ? await signupEmail({ email, password, displayName })
          : await loginEmail(email, password);
      if (!res?.success) setError(res?.error || "Login failed");
    } catch (err) {
      setError(err?.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuest = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await loginAnonymous();
      if (!res?.success) setError(res?.error || "Guest login failed");
    } catch (err) {
      setError(err?.message || "Guest login failed");
    } finally {
      setIsLoading(false);
    }
  };
  // END:   FUNCTION ZONE (DO NOT TOUCH)

  return (
    <div className="min-h-dvh w-full relative overflow-hidden bg-[#f8fafc] dark:bg-[#0f1014] flex flex-col lg:flex-row font-sans transition-colors duration-300">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-500/20 dark:bg-blue-600/10 rounded-full blur-[120px] animate-float opacity-70" />
        <div
          className="absolute top-[40%] -right-[10%] w-[40%] h-[60%] bg-cyan-400/20 dark:bg-cyan-600/10 rounded-full blur-[100px] animate-float opacity-60"
          style={{ animationDelay: "2s" }}
        />
      </div>

      {/* Theme Toggle */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-3 rounded-full bg-white/50 dark:bg-black/30 backdrop-blur-md border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 shadow-sm hover:scale-105 active:scale-95 transition-all"
        >
          {isDark ? (
            <Moon size={20} className="fill-current" />
          ) : (
            <Sun size={20} className="fill-current" />
          )}
        </button>
      </div>

      {/* Left Panel: Branding & Features */}
      <div className="hidden lg:flex lg:w-[45%] flex-col relative z-10 p-12 justify-between">
        <div>
          <div className="flex items-center gap-3">
            {/* Logo Placeholder */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-600/30">
              B
            </div>
            <div className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">
              Boots <span className="text-blue-600 font-light">POS</span>
            </div>
          </div>
        </div>

        <div className="max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100/50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            System Online v2.5
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white leading-tight mb-6">
            Manage your store with{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
              Confidence.
            </span>
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
            Fast, secure, and reliable Point of Sale system designed for modern
            retail performance.
          </p>

          <div className="space-y-4">
            {[
              "Real-time Inventory Sync",
              "Secure Staff Authentication",
              "Smart Sales Reporting",
              "Daily Automated Backups",
            ].map((feature, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 text-slate-700 dark:text-slate-300 font-medium"
              >
                <div className="p-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <CheckCircle2 size={16} />
                </div>
                {feature}
              </div>
            ))}
          </div>
        </div>

        <div className="text-sm text-slate-500 dark:text-slate-500">
          © 2026 Boots POS System. All rights reserved.
        </div>
      </div>

      {/* Right Panel: Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 w-full sm:max-w-md mx-auto lg:max-w-none">
        {/* Mobile Logo (Visible only on small screens) */}
        <div className="lg:hidden mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-600/30">
            B
          </div>
          <div className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">
            Boots POS
          </div>
        </div>

        <div className="glass-panel w-full max-w-[440px] p-8 md:p-10 relative overflow-hidden">
          {/* Decorative gradients inside card */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10" />

          <div className="relative">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
              {mode === "signup" ? "Create Account" : "Welcome Back"}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">
              {mode === "signup"
                ? "Register a new account to get started"
                : "Sign in to access your terminal"}
            </p>

            {/* Google Login */}
            <button
              onClick={handleSignIn}
              disabled={isLoading}
              aria-busy={isLoading}
              className="w-full bg-white dark:bg-[#2c2e33] text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-[#32343a] active:bg-slate-100 dark:active:bg-[#25262b] relative h-[52px] rounded-xl font-semibold transition-all shadow-sm flex items-center justify-center gap-3 mb-6 group overflow-hidden"
            >
              {isLoading ? (
                <span
                  className="flex items-center gap-2"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 className="animate-spin text-blue-600" size={20} />
                  <span className="text-sm text-slate-500">Signing in…</span>
                </span>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>Sign in with Google</span>
                </>
              )}
            </button>

            <div className="relative flex py-4 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase tracking-wider font-medium">
                Or continue with
              </span>
              <div className="flex-grow border-t border-slate-200 dark:border-white/10"></div>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-1">
                  <label
                    className="text-xs font-semibold text-slate-500 uppercase ml-1"
                    htmlFor="gs-display-name"
                  >
                    Display Name
                  </label>
                  <input
                    id="gs-display-name"
                    className="glass-input"
                    placeholder="Enter your name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1">
                <label
                  className="text-xs font-semibold text-slate-500 uppercase ml-1"
                  htmlFor="gs-email"
                >
                  Email Address
                </label>
                <input
                  id="gs-email"
                  className="glass-input"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label
                  className="text-xs font-semibold text-slate-500 uppercase ml-1"
                  htmlFor="gs-password"
                >
                  Password
                </label>
                <input
                  id="gs-password"
                  className="glass-input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
                  <div className="mt-0.5">⚠️</div>
                  <div>{error}</div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                aria-busy={isLoading}
                className="btn-primary w-full mt-2"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin text-white" size={20} />
                ) : mode === "signup" ? (
                  "Create Account"
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleGuest}
                disabled={isLoading}
                className="btn-ghost w-full text-sm"
              >
                {isLoading ? "Processing..." : "Continue as Guest"}
              </button>

              <div className="text-center text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  {mode === "signup"
                    ? "Already have an account?"
                    : "Don't have an account?"}
                </span>{" "}
                <button
                  className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                  onClick={() =>
                    setMode(mode === "signup" ? "signin" : "signup")
                  }
                  type="button"
                >
                  {mode === "signup" ? "Sign in" : "Sign up"}
                </button>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/5 flex items-center justify-center gap-4 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center w-full">
                Trusted Access
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
