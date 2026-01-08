import React, { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { APP_VERSION, APP_UPDATED } from "../constants/appMeta";

export default function LoginPage({ onLogin }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [promoText, setPromoText] = useState("—");
  const [maintenanceText, setMaintenanceText] = useState("—");
  const versionDisplay = APP_VERSION || "—";
  const updatedDisplay = APP_UPDATED || "—";
  const storeName = "Store 4340";
  const terminalId = "4340";
  const heartbeat = "SYSTEM ONLINE";

  useEffect(() => {
    let active = true;
    const loadMeta = async () => {
      try {
        const snap = await getDoc(doc(db, "system_metadata", "login_ui"));
        if (!snap.exists()) return;
        const data = snap.data() || {};
        if (!active) return;
        const promo = String(data.promotionUpdateText || "").trim();
        setPromoText(promo || "—");
        const maint = data.maintenanceLastUploadAt;
        if (maint?.toDate) {
          setMaintenanceText(maint.toDate().toLocaleString());
        } else if (typeof maint === "string" && maint) {
          setMaintenanceText(new Date(maint).toLocaleString());
        } else {
          setMaintenanceText("—");
        }
      } catch {
        /* silent */
      }
    };
    loadMeta();
    return () => {
      active = false;
    };
  }, []);

  const canSubmit = useMemo(() => {
    return !!loginId.trim() && !!password.trim() && !isLoading;
  }, [loginId, password, isLoading]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginId.trim() || !password.trim()) {
      toast.error("Please enter ID/Email and Password");
      return;
    }

    try {
      setIsLoading(true);

      if (typeof onLogin === "function") {
        await onLogin(loginId.trim(), password);
        toast.success("Authentication Successful");
      } else {
        // fallback demo behavior
        await new Promise((r) => setTimeout(r, 900));
        toast.success("Authentication Successful");
      }
    } catch (err) {
      const msg =
        (err && (err.message || err?.code)) ? String(err.message || err.code) : "Login failed";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#050914] text-slate-50 overflow-hidden relative">
      <Toaster position="top-center" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-[#050914] to-[#040811]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(59,130,246,0.18),transparent_45%)]" />
      </div>

      <div className="relative mx-auto max-w-[1400px] px-4 py-10">
        <div className="flex flex-col md:flex-row gap-6">
          {/* LEFT PANEL */}
          <div className="flex-1 min-h-[420px] rounded-3xl border border-blue-900/40 bg-white/5 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-blue-900/10 pointer-events-none" />
            <div className="relative flex flex-col h-full gap-6">
              <div className="flex flex-col gap-4 rounded-2xl border border-blue-800/40 bg-[#0b1220]/70 px-6 py-5 shadow-inner">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-blue-100">Boots 4340 Web App</div>
                    <div className="text-xs text-slate-400 mt-1">Enterprise Access Portal</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-blue-100">
                    <span className="inline-flex items-center gap-2 rounded-full border border-blue-700/60 px-3 py-1 bg-blue-500/10">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      {heartbeat}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <InfoRow label="Version" value={versionDisplay} />
                  <InfoRow label="Date Update" value={updatedDisplay} />
                  <InfoRow label="Promotion" value={promoText} />
                  <InfoRow label="Last Upload (Maintenance)" value={maintenanceText} />
                </div>
              </div>

              <div className="flex-1 min-h-[300px] rounded-2xl border border-blue-800/40 bg-[#0b1220]/80 shadow-inner relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(59,130,246,0.12),transparent_50%)]" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0b1220]/40 to-[#050914]" />
                <div className="relative h-full flex flex-col items-start justify-center px-8 py-6 gap-2">
                  <div className="text-sm uppercase tracking-[0.2em] text-blue-200/80">Welcome</div>
                  <div className="text-4xl md:text-5xl font-bold text-white leading-tight">{storeName}</div>
                  <div className="text-sm text-slate-400">TERMINAL_ID: {terminalId}</div>
                  <div className="mt-6 grid grid-cols-2 gap-4 text-sm w-full max-w-xl">
                    <StatBlock label="Security" value="App Check enabled" />
                    <StatBlock label="Sync" value="All queues clear" />
                  </div>
                  <div className="absolute bottom-4 right-6 text-blue-200/15 text-4xl font-black tracking-wide select-none">
                    Boots 4340
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="w-full md:w-[420px]">
            <div className="bg-white/10 border border-blue-900/40 rounded-3xl shadow-2xl p-8 relative overflow-hidden backdrop-blur-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900/25 via-transparent to-blue-800/20 pointer-events-none" />
              <div className="relative">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-100 text-xs font-semibold border border-blue-700/50">
                    Staff Access
                  </div>
                  <div className="text-3xl font-bold text-white mt-3">Secure Login</div>
                  <div className="text-sm text-slate-400 mt-1">Sign in with your ID / email and password</div>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-300 uppercase ml-1">User ID / Email</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-3.5 text-slate-500">person</span>
                      <input
                        type="text"
                        autoComplete="username"
                        value={loginId}
                        onChange={(e) => setLoginId(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-[#0b1220]/80 border border-blue-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/60 transition-all text-sm"
                        placeholder="ID or email"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-300 uppercase ml-1">Password</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-3.5 text-slate-500">lock</span>
                      <input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-12 pr-12 py-3.5 bg-[#0b1220]/80 border border-blue-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/60 transition-all text-sm"
                        placeholder="Enter password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-4 top-3.5 text-slate-500 hover:text-white transition-colors"
                        aria-label="Toggle password visibility"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {showPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className={[
                      "w-full mt-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-3.5 rounded-lg shadow-lg",
                      "transform transition-all active:scale-[0.98] flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:ring-offset-2 focus:ring-offset-[#111827]",
                      (!canSubmit ? "opacity-60 cursor-not-allowed" : "")
                    ].join(" ")}
                  >
                    {isLoading ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Secure Login"
                    )}
                  </button>

                  <div className="text-[11px] text-gray-500 text-center pt-2">
                    By continuing you agree to internal security policy.
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-blue-800/40 bg-[#0c1426]/60 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-white truncate">{value || "—"}</div>
    </div>
  );
}

function StatBlock({ label, value }) {
  return (
    <div className="rounded-xl border border-blue-800/40 bg-[#0c1426]/60 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-white mt-1">{value}</div>
    </div>
  );
}
