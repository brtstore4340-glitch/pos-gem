import { useState } from 'react';
import { useAuth } from '@/modules/auth/AuthContext';
import { ServerStatus } from '@/components/ui/ServerStatus';
import { KeySquare, Loader2 } from 'lucide-react';

export default function PinReset() {
  const { session } = useAuth();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!currentPin || !newPin) {
      setError('Please enter PIN');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PIN confirmation does not match');
      return;
    }
    setLoading(true);
    try {
      // For demo, just verify current PIN and set session
      if (currentPin === '1234') {
        // PIN reset would be implemented here
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
      } else {
        setError('Current PIN is incorrect');
      }
    } catch (err) {
      setError(err?.message || 'Failed to set PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh w-full relative overflow-hidden bg-[#f8fafc] dark:bg-[#0f1014] flex flex-col items-center justify-center p-4 font-sans transition-colors duration-300">
      {/* Server Status */}
      <div className="absolute top-6 right-6 z-50">
        <ServerStatus />
      </div>

      <div className="glass-panel w-full max-w-md p-8 md:p-10 relative overflow-hidden">
        {/* Decorative gradient */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
        
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-6">
            <KeySquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Reset PIN</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Your PIN must be updated before continuing.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Current PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                className="glass-input tracking-widest text-lg font-bold"
                placeholder="••••"
                maxLength={6}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase ml-1">New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="glass-input tracking-widest text-lg font-bold"
                placeholder="••••"
                maxLength={6}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="glass-input tracking-widest text-lg font-bold"
                placeholder="••••"
                maxLength={6}
              />
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
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Set new PIN'}
            </button>
          </form>
        </div>
      </div>

      <div className="mt-8 text-xs text-slate-400 dark:text-slate-600 font-mono">
        Boots-POS Gemini • Secure Environment
      </div>
    </div>
  );
}
