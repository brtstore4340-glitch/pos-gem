import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function PinReset() {
  const { session, setPin } = useAuth();
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
      await setPin(session?.idCode, currentPin, newPin);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (err) {
      setError(err?.message || 'Failed to set PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg border border-slate-200 p-8">
        <h1 className="text-2xl font-bold text-slate-800">Reset PIN</h1>
        <p className="text-slate-500 mt-2">Your PIN must be updated before continuing.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-600">Current PIN</label>
            <input
              type="password"
              inputMode="numeric"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-700"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-600">New PIN</label>
            <input
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-700"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-600">Confirm PIN</label>
            <input
              type="password"
              inputMode="numeric"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-700"
            />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 text-white font-semibold py-3 hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Set new PIN'}
          </button>
        </form>
      </div>
    </div>
  );
}
