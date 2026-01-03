import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { createId, getAuditLogs, resetPin, searchIds, updateId } from '../services/rbacService';
import AccessDenied from '../components/auth/AccessDenied';

const MENU_OPTIONS = ["dashboard", "pos", "report", "inventory", "orders", "settings", "Upload", "management"];
const ROLE_OPTIONS = ["admin", "SM-SGM", "user"];

export default function ManagementConsole() {
  const { session } = useAuth();
  const [searchEmail, setSearchEmail] = useState('');
  const [searchIdCode, setSearchIdCode] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');

  const [newEmail, setNewEmail] = useState(session?.email || '');
  const [newIdCode, setNewIdCode] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [newPin, setNewPin] = useState('');
  const [newMenus, setNewMenus] = useState([]);

  const [editIdCode, setEditIdCode] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editMenus, setEditMenus] = useState([]);

  const isAdmin = session?.role === 'admin';
  const isSgm = session?.role === 'SM-SGM';

  const canAccess = isAdmin || isSgm;
  const roleOptions = useMemo(() => (isAdmin ? ROLE_OPTIONS : ROLE_OPTIONS.filter((r) => r !== 'admin')), [isAdmin]);

  if (!canAccess) {
    return <AccessDenied message="You do not have access to management console." />;
  }

  const handleSearch = async () => {
    setStatusMessage('');
    const ids = await searchIds({
      actorIdCode: session.idCode,
      email: searchEmail || undefined,
      idCode: searchIdCode || undefined
    });
    setSearchResults(ids);
  };

  const handleCreate = async () => {
    setStatusMessage('');
    const payload = {
      actorIdCode: session.idCode,
      email: newEmail || session.email,
      idCode: newIdCode,
      role: newRole,
      pin: newPin,
      permissions: { allowedMenus: newMenus }
    };
    await createId(payload);
    setStatusMessage('Created ID successfully');
    setNewIdCode('');
    setNewPin('');
  };

  const handleUpdate = async () => {
    setStatusMessage('');
    const payload = {
      actorIdCode: session.idCode,
      idCode: editIdCode,
      role: editRole || undefined,
      status: editStatus || undefined,
      permissions: editMenus.length ? { allowedMenus: editMenus } : undefined
    };
    await updateId(payload);
    setStatusMessage('Updated ID successfully');
  };

  const handleResetPin = async (idCode) => {
    const res = await resetPin({ actorIdCode: session.idCode, idCode });
    setStatusMessage(`Temporary PIN for ${idCode}: ${res.tempPin}`);
  };

  const handleLoadAudit = async () => {
    const logs = await getAuditLogs({ actorIdCode: session.idCode, email: isAdmin ? searchEmail || undefined : session.email });
    setAuditLogs(logs);
  };

  return (
    <div className="max-w-6xl mx-auto w-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{isAdmin ? 'Admin Console' : 'SM-SGM Console'}</h1>
          <p className="text-slate-500 text-sm">Manage IDs, roles, and permissions</p>
        </div>
        <div className="text-xs text-slate-400">Signed in: {session?.email}</div>
      </div>

      {statusMessage && <div className="rounded-lg bg-blue-50 text-blue-700 px-4 py-2 text-sm">{statusMessage}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-700">Search IDs</h2>
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
            placeholder="Email"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
            placeholder="ID Code"
            value={searchIdCode}
            onChange={(e) => setSearchIdCode(e.target.value)}
          />
          <button onClick={handleSearch} className="w-full rounded-xl bg-slate-900 text-white py-2">Search</button>
          <div className="text-sm text-slate-500">Results: {searchResults.length}</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-700">Create ID</h2>
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
            placeholder="Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            disabled={!isAdmin}
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
            placeholder="ID Code"
            value={newIdCode}
            onChange={(e) => setNewIdCode(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-4 py-2"
            placeholder="PIN"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
          />
          <select className="w-full rounded-xl border border-slate-200 px-4 py-2" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
            {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <div className="flex flex-wrap gap-2">
            {MENU_OPTIONS.map((menu) => (
              <label key={menu} className="text-xs border border-slate-200 rounded-full px-3 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  className="mr-1"
                  checked={newMenus.includes(menu)}
                  onChange={(e) => setNewMenus((prev) => e.target.checked ? [...prev, menu] : prev.filter((m) => m !== menu))}
                />
                {menu}
              </label>
            ))}
          </div>
          <button onClick={handleCreate} className="w-full rounded-xl bg-blue-600 text-white py-2">Create</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-slate-700">Update ID</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input className="rounded-xl border border-slate-200 px-4 py-2" placeholder="ID Code" value={editIdCode} onChange={(e) => setEditIdCode(e.target.value)} />
          <select className="rounded-xl border border-slate-200 px-4 py-2" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
            <option value="">Role (no change)</option>
            {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <select className="rounded-xl border border-slate-200 px-4 py-2" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
            <option value="">Status (no change)</option>
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {MENU_OPTIONS.map((menu) => (
            <label key={menu} className="text-xs border border-slate-200 rounded-full px-3 py-1 cursor-pointer">
              <input
                type="checkbox"
                className="mr-1"
                checked={editMenus.includes(menu)}
                onChange={(e) => setEditMenus((prev) => e.target.checked ? [...prev, menu] : prev.filter((m) => m !== menu))}
              />
              {menu}
            </label>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={handleUpdate} className="flex-1 rounded-xl bg-slate-900 text-white py-2">Update</button>
          <button onClick={() => handleResetPin(editIdCode)} className="flex-1 rounded-xl bg-orange-500 text-white py-2">Reset PIN</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Audit Logs</h2>
          <button onClick={handleLoadAudit} className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm">Load Logs</button>
        </div>
        <div className="max-h-64 overflow-auto border border-slate-100 rounded-xl">
          {auditLogs.length === 0 ? (
            <div className="text-sm text-slate-400 p-4">No logs</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-2">Action</th>
                  <th className="p-2">Target</th>
                  <th className="p-2">Actor</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100">
                    <td className="p-2">{log.action}</td>
                    <td className="p-2">{log.targetIdCode || log.targetEmail}</td>
                    <td className="p-2">{log.actorIdCode || log.actorEmail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
