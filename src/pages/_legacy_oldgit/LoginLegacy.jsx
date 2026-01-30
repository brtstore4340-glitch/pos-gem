import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { APP_VERSION, APP_UPDATED } from "../constants/appMeta";
import { User, Lock, Eye, EyeOff, LogIn, ShieldCheck, Activity, Server, Info } from "lucide-react";
import { cn } from "../utils/cn";

export default function LoginPage({ onLogin }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [promoText, setPromoText] = useState("โ€”");
  const [maintenanceText, setMaintenanceText] = useState("โ€”");
  const versionDisplay = APP_VERSION || "โ€”";
  const updatedDisplay = APP_UPDATED || "โ€”";
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
        setPromoText(promo || "โ€”");
        const maint = data.maintenanceLastUploadAt;
        if (maint?.toDate) {
          setMaintenanceText(maint.toDate().toLocaleString());
        } else if (typeof maint === "string" && maint) {
          setMaintenanceText(new Date(maint).toLocaleString());
        } else {
          setMaintenanceText("โ€”");
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
    <div className="min-h-screen w-full flex font-sans bg-slate-50 dark:bg-[#1a1b1e] text-slate-900 dark:text-white overflow-hidden">
      <Toaster position="top-center" />

      {/* LEFT PANEL - BRANDING */}
      <div className="hidden lg:flex w-1/2 relative bg-boots-base overflow-hidden flex-col justify-between p-12 text-white">
        {/* Background Patterns */}
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 pointer-events-none mix-blend-overlay"></div>

        <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-white rounded-xl text-boots-base flex items-center justify-center font-bold text-2xl shadow-lg">B</div>
                <div>
                    <h1 className="text-2xl font-bold leading-none">Boots POS</h1>
                    <p className="text-blue-200 text-sm font-medium">Enterprise System</p>
                </div>
            </div>
            
            <div className="mt-12 space-y-6">
                 <div>
                    <h2 className="text-4xl font-bold mb-2">Welcome Back</h2>
                    <p className="text-blue-100 text-lg opacity-90 max-w-md">Access your store dashboard, inventory, and sales reports in one secure place.</p>
                 </div>

                 <div className="grid grid-cols-2 gap-4 max-w-lg mt-8">
                     <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                         <div className="flex items-center gap-2 text-blue-200 mb-2">
                             <Activity size={18} />
                             <span className="text-xs font-bold uppercase tracking-wider">Status</span>
                         </div>
                         <div className="flex items-center gap-2">
                             <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                             <span className="font-semibold">{heartbeat}</span>
                         </div>
                     </div>
                     <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                         <div className="flex items-center gap-2 text-blue-200 mb-2">
                             <Server size={18} />
                             <span className="text-xs font-bold uppercase tracking-wider">Terminal</span>
                         </div>
                         <div className="font-semibold">{terminalId}</div>
                     </div>
                 </div>
            </div>
        </div>

        <div className="relative z-10 text-sm text-blue-200/60 flex flex-col gap-1">
             <div className="flex items-center justify-between border-t border-white/10 pt-6">
                <div>
                     <p>version {versionDisplay}</p>
                     <p>updated {updatedDisplay}</p>
                </div>
                <div className="text-right">
                    <p>{storeName}</p>
                    <p className="opacity-70">Authorized Personnel Only</p>
                </div>
             </div>
        </div>
      </div>

      {/* RIGHT PANEL - LOGIN FORM */}
      <div className="w-full lg:w-1/2 bg-slate-50 dark:bg-[#1a1b1e] flex items-center justify-center p-6 relative">
          
         {/* Mobile Header (Visible only on small screens) */}
         <div className="lg:hidden absolute top-0 left-0 right-0 p-6 flex justify-between items-center text-boots-base">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-boots-base text-white rounded-lg flex items-center justify-center font-bold">B</div>
                <span className="font-bold text-lg">Boots POS</span>
            </div>
         </div>

         <div className="w-full max-w-[420px]">
            <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 text-boots-base dark:text-blue-400 mb-4 ring-8 ring-blue-50/50 dark:ring-blue-900/10">
                    <LogIn size={32} />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Sign in</h2>
                <p className="text-slate-500 dark:text-slate-400">Enter your Employee ID and Password</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">User ID / Email</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-boots-base transition-colors">
                            <User size={20} />
                        </div>
                        <input
                            type="text"
                            value={loginId}
                            onChange={(e) => setLoginId(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-[#25262b] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-boots-base/20 focus:border-boots-base transition-all font-medium"
                            placeholder="e.g. 6705067"
                            required
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                         <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Password</label>
                    </div>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-boots-base transition-colors">
                            <Lock size={20} />
                        </div>
                        <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-12 pr-12 py-3.5 bg-white dark:bg-[#25262b] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-boots-base/20 focus:border-boots-base transition-all font-medium"
                            placeholder="โ€ขโ€ขโ€ขโ€ขโ€ขโ€ขโ€ขโ€ข"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={!canSubmit}
                    className={cn(
                        "w-full py-4 rounded-xl font-bold bg-boots-base text-white shadow-lg shadow-blue-900/20 hover:shadow-blue-900/30 hover:bg-boots-hover transition-all active:scale-[0.98] flex items-center justify-center gap-2",
                        !canSubmit && "opacity-70 cursor-not-allowed grayscale"
                    )}
                >
                    {isLoading ? (
                         <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        <>
                        <span>Secure Login</span>
                        <ShieldCheck size={20} className="opacity-80" />
                        </>
                    )}
                </button>
            </form>
            
            <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-3">
                    <div className="mt-1 min-w-[16px] text-blue-600 dark:text-blue-400">
                         <Info size={16} />
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        <p className="mb-1"><span className="font-semibold text-slate-700 dark:text-slate-300">Daily Promotion:</span> {promoText}</p>
                        <p><span className="font-semibold text-slate-700 dark:text-slate-300">Maintenance:</span> Last sync at {maintenanceText}</p>
                    </div>
                </div>
            </div>

         </div>
      </div>
    </div>
  );
}


