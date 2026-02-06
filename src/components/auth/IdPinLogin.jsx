import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, LogOut, KeySquare, User, Moon, Sun, Loader2 } from 'lucide-react';
import { useAuth } from '@/modules/auth/AuthContext';
import { bootstrapAdmin } from '@/services/rbacService';
import { ServerStatus } from '@/components/ui/ServerStatus';

export default function IdPinLogin() {
  // BEGIN: FUNCTION ZONE (DO NOT TOUCH)
  const { firebaseUser, ids, lastIdCode, loadIds, verifyPin, signOut } = useAuth();
  const [selectedId, setSelectedId] = useState(lastIdCode || '');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [idsLoading, setIdsLoading] = useState(true);
  const [bootstrapId, setBootstrapId] = useState('');
  const [bootstrapPin, setBootstrapPin] = useState('');
  const [bootstrapError, setBootstrapError] = useState('');
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [isDark, setIsDark] = useState(false); // Valid UI state

  useEffect(() => {
    let active = true;
    setIdsLoading(true);
    loadIds()
      .catch((err) => { console.error('loadIds failed:', err); setError(err?.message || 'Failed to load IDs'); })
      .finally(() => {
        if (active) setIdsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadIds]);

  useEffect(() => {
    if (!selectedId && lastIdCode) setSelectedId(lastIdCode);
  }, [lastIdCode, selectedId]);

  // Theme Sync Logic
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialDark = savedTheme === 'dark' || (!savedTheme && systemDark);
    setIsDark(initialDark);
    if (initialDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
    if (newDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const activeIds = useMemo(() => ids.filter((id) => id.status !== 'disabled'), [ids]);
  const showBootstrap = !idsLoading && activeIds.length === 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedId || !pin) {
      setError('Please select ID and enter PIN');
      return;
    }
    setLoading(true);
    try {
      await verifyPin(selectedId, pin);
      setPin('');
    } catch (err) {
      setError(err?.message || 'Invalid PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrap = async (e) => {
    e.preventDefault();
    setBootstrapError('');
    if (!bootstrapId || !bootstrapPin) {
      setBootstrapError('Please enter ID and PIN');
      return;
    }
    setBootstrapLoading(true);
    try {
      await bootstrapAdmin({ idCode: bootstrapId, pin: bootstrapPin });
      await loadIds();
      setSelectedId(bootstrapId);
      setBootstrapPin('');
    } catch (err) {
      setBootstrapError(err?.message || 'Failed to create admin ID');
    } finally {
      setBootstrapLoading(false);
    }
  };
  // END:   FUNCTION ZONE (DO NOT TOUCH)

  return (
    <div className="min-h-dvh w-full relative overflow-hidden bg-[#f8fafc] dark:bg-[#0f1014] flex flex-col items-center justify-center p-4 font-sans transition-colors duration-300">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[20%] w-[60%] h-[60%] bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-[120px] animate-float opacity-70" />
      </div>

      {/* Theme Toggle & Server Status */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-2">
        <ServerStatus />
        <button 
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          className="p-3 rounded-full bg-white/50 dark:bg-black/30 backdrop-blur-md border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 shadow-sm hover:scale-105 active:scale-95 transition-all"
        >
          {isDark ? <Moon size={20} className="fill-current" /> : <Sun size={20} className="fill-current" />}
        </button>
      </div>

      <div className="glass-panel w-full max-w-4xl grid md:grid-cols-2 overflow-hidden shadow-2xl relative z-10">
        
        {/* Left: Info & User Card */}
        <div className="p-8 md:p-10 flex flex-col justify-between bg-gradient-to-br from-blue-600 to-blue-800 text-white relative overflow-hidden">
           {/* Decor */}
           <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
           
           <div>
             <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold border border-white/20 mb-6">
                <ShieldCheck size={14} />
                <span>Secure Terminal Access</span>
             </div>
             
             <h1 className="text-3xl font-bold leading-tight mb-2">
               {showBootstrap ? 'Setup Admin' : 'Select Identifier'}
             </h1>
             <p className="text-blue-100/80 text-sm">
               Choose your profile to securely access the POS terminal.
             </p>
           </div>

           <div className="mt-12 space-y-6">
              <div className="p-4 rounded-xl bg-white/10 border border-white/10 backdrop-blur-sm">
                 <div className="text-xs text-blue-200 uppercase tracking-wider mb-2">Current Session</div>
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold">
                       {firebaseUser?.email?.[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="font-semibold truncate">{firebaseUser?.email}</div>
                       <div className="text-xs text-blue-200">Authenticated via Google</div>
                    </div>
                 </div>
                 <button 
                   onClick={signOut}
                   className="mt-4 w-full py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                 >
                   <LogOut size={14} /> Sign Out
                 </button>
              </div>

               <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-white/5 rounded-lg">
                     <div className="text-2xl font-bold">{ids.length}</div>
                     <div className="text-xs text-blue-200 uppercase">Profiles</div>
                  </div>
                   <div className="p-3 bg-white/5 rounded-lg">
                     <div className="text-2xl font-bold">{activeIds.length}</div>
                     <div className="text-xs text-blue-200 uppercase">Active</div>
                  </div>
               </div>
           </div>
        </div>

        {/* Right: Form */}
        <div className="p-8 md:p-10 bg-white/50 dark:bg-black/40 backdrop-blur-md flex flex-col justify-center">
            {idsLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                 <Loader2 className="animate-spin text-blue-600" size={32} />
                 <div className="text-sm text-slate-500" role="status" aria-live="polite">Loading authorized profiles...</div>
              </div>
            ) : showBootstrap ? (
              <form onSubmit={handleBootstrap} className="space-y-5">
                 <div className="space-y-1">
                   <label className="text-xs font-semibold text-slate-500 uppercase ml-1">New Admin ID</label>
                   <div className="relative">
                      <User className="absolute left-4 top-3.5 text-slate-400" size={18} />
                      <input 
                         className="glass-input pl-11" 
                         placeholder="Create an ID code"
                         value={bootstrapId}
                         onChange={(e) => setBootstrapId(e.target.value)}
                         autoFocus
                      />
                   </div>
                 </div>
                 <div className="space-y-1">
                   <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Set PIN</label>
                   <div className="relative">
                      <KeySquare className="absolute left-4 top-3.5 text-slate-400" size={18} />
                      <input 
                         type="password"
                         inputMode="numeric"
                         className="glass-input pl-11 tracking-widest" 
                         placeholder="••••••"
                         value={bootstrapPin}
                         onChange={(e) => setBootstrapPin(e.target.value)}
                         maxLength={20}
                      />
                   </div>
                 </div>
                 
                 {bootstrapError && (
                    <div className="text-xs text-red-500 font-medium px-1 pt-1">{bootstrapError}</div>
                 )}

                 <button
                   type="submit"
                   disabled={bootstrapLoading}
                   className="btn-primary w-full"
                 >
                   {bootstrapLoading ? <Loader2 className="animate-spin" size={20} /> : 'Create Admin Profile'}
                 </button>
              </form>
            ) : (
               <form onSubmit={handleSubmit} className="space-y-6">
                 <div className="space-y-2">
                   <label htmlFor="profile-select" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase ml-1">Select Profile</label>
                   <div className="relative">
                      <User className="absolute left-4 top-3.5 text-slate-400" size={18} />
                      <select 
                         id="profile-select"
                         className="glass-input pl-11 appearance-none cursor-pointer" 
                         value={selectedId}
                         onChange={(e) => setSelectedId(e.target.value)}
                      >
                         <option value="">Choose an ID...</option>
                         {activeIds.map((id) => (
                           <option key={id.idCode} value={id.idCode}>
                             {id.idCode} — {id.role}
                           </option>
                         ))}
                      </select>
                      <div className="absolute right-4 top-4 pointer-events-none border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-slate-400"></div>
                   </div>
                 </div>

                 <div className="space-y-2">
                   <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase ml-1">Security PIN</label>
                   <div className="relative">
                      <KeySquare className="absolute left-4 top-3.5 text-slate-400" size={18} />
                      <input 
                         type="password"
                         inputMode="numeric"
                         className="glass-input pl-11 tracking-widest text-lg font-bold" 
                         placeholder="••••••"
                         value={pin}
                         onChange={(e) => setPin(e.target.value)}
                         maxLength={20}
                         aria-label="Enter security PIN"
                      />
                   </div>
                 </div>

                 {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                       {error}
                    </div>
                 )}

                 <button
                   type="submit"
                   disabled={loading}
                   className="btn-primary w-full"
                 >
                   {loading ? <Loader2 className="animate-spin" size={20} /> : 'Access Terminal'}
                 </button>

                 <div className="text-center">
                    <span className="text-xs text-slate-400">
                       Forgot PIN? Contact Manager
                    </span>
                 </div>
               </form>
            )}
        </div>

      </div>
      
      <div className="mt-8 text-xs text-slate-400 dark:text-slate-600 font-mono">
         Boots-POS Gemini • Secure Environment
      </div>

    </div>
  );
}
