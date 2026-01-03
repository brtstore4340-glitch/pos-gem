import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { bootstrapAdmin } from '../../services/rbacService';

export default function IdPinLogin() {
  const { firebaseUser, ids, lastIdCode, setLastIdCode, loadIds, verifyPin, signOut } = useAuth();
  const [selectedId, setSelectedId] = useState(lastIdCode || '');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [idsLoading, setIdsLoading] = useState(true);
  const [bootstrapId, setBootstrapId] = useState('');
  const [bootstrapPin, setBootstrapPin] = useState('');
  const [bootstrapError, setBootstrapError] = useState('');
  const [bootstrapLoading, setBootstrapLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setIdsLoading(true);
    loadIds()
      .catch(() => {})
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
      setLastIdCode(selectedId);
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

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-lg border border-slate-200 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{showBootstrap ? 'Set up Admin ID' : 'Select ID'}</h1>
            <p className="text-slate-500 mt-1">Signed in as {firebaseUser?.email}</p>
          </div>
          <button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-700">
            Sign out
          </button>
        </div>

        {idsLoading ? (
          <div className="mt-6 text-sm text-slate-500">Loading IDs...</div>
        ) : showBootstrap ? (
          <form onSubmit={handleBootstrap} className="mt-6 space-y-4">
            <p className="text-sm text-slate-500">
              No IDs found for this email. Create the first admin ID to continue.
            </p>
            <div>
              <label className="text-sm font-semibold text-slate-600">Admin ID</label>
              <input
                value={bootstrapId}
                onChange={(e) => setBootstrapId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-700"
                placeholder="ID Code"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-600">PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={bootstrapPin}
                onChange={(e) => setBootstrapPin(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-700"
                placeholder="Set PIN"
              />
            </div>
            {bootstrapError && <div className="text-sm text-red-600">{bootstrapError}</div>}
            <button
              type="submit"
              disabled={bootstrapLoading}
              className="w-full rounded-xl bg-blue-600 text-white font-semibold py-3 hover:bg-blue-500 disabled:opacity-50"
            >
              {bootstrapLoading ? 'Creating...' : 'Create Admin ID'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-600">ID</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-700"
              >
                <option value="">Select ID</option>
                {activeIds.map((id) => (
                  <option key={id.idCode} value={id.idCode}>
                    {id.idCode} ({id.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-600">PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-700"
                placeholder="Enter PIN"
              />
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 text-white font-semibold py-3 hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
