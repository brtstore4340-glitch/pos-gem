import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { createId, getAuditLogs, resetPin, searchIds, updateId } from '../services/rbacService';
import AccessDenied from '../components/auth/AccessDenied';
import { Shield, Search, UserPlus, Edit, Key, History, Save, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '../utils/cn';

function __requireIdCodePin__(payload) {
  const idCode = payload?.idCode ?? payload?.id ?? payload?.code;
  const pin = payload?.pin ?? payload?.PIN;
  if (!idCode || !pin) {
    throw new Error("idCode and pin required");
  }
  return { idCode, pin };
}

const MENU_OPTIONS = ["dashboard", "pos", "report", "inventory", "orders", "settings", "Upload", "management"];
const ROLE_OPTIONS = ["admin", "SM-SGM", "user"];

// Additional Icon mapping for nice UI
export default function ManagementConsole() {
  // BEGIN: FUNCTION ZONE (DO NOT TOUCH)
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
    try {
        __requireIdCodePin__(payload);
        await createId(payload);
        setStatusMessage('Created ID successfully');
        setNewIdCode('');
        setNewPin('');
    } catch(e) {
        setStatusMessage('Error creating ID: ' + e.message);
    }
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
    try {
        await updateId(payload);
        setStatusMessage('Updated ID successfully');
    } catch(e) {
        setStatusMessage('Error updating ID: ' + e.message);
    }
  };

  const handleResetPin = async (idCode) => {
    try {
        const res = await resetPin({ actorIdCode: session.idCode, idCode });
        setStatusMessage(`Temporary PIN for ${idCode}: ${res.tempPin}`);
    } catch(e) {
        setStatusMessage('Error resetting PIN: ' + e.message);
    }
  };

  const handleLoadAudit = async () => {
    try {
        const logs = await getAuditLogs({ actorIdCode: session.idCode, email: isAdmin ? searchEmail || undefined : session.email });
        setAuditLogs(logs);
    } catch(e) {
        setAuditLogs([]);
        setStatusMessage('Error loading logs: ' + e.message);
    }
  };
  // END:   FUNCTION ZONE (DO NOT TOUCH)

  // Unity Theme UI
  return (
    <div className="h-full p-6 md:p-8 animate-fade-in-up flex flex-col gap-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div className="flex items-center gap-3">
             <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 dark:from-white/10 dark:to-white/5 text-white shadow-lg flex items-center justify-center">
                 <Shield size={24} />
             </div>
             <div>
                 <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                    {isAdmin ? 'Admin Console' : 'Management Console'}
                 </h1>
                 <p className="text-sm text-slate-500 dark:text-slate-400">Manage user IDs, roles, and system permissions</p>
             </div>
         </div>
         <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-full border border-slate-200 dark:border-white/10">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">Signed in as: <span className="font-bold text-slate-700 dark:text-slate-200">{session?.email}</span></span>
         </div>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 flex items-center gap-3 animate-fade-in-up">
            <AlertCircle size={20} />
            <span className="font-medium">{statusMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* SEARCH CARD */}
          <div className="glass-panel p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-white/5">
                  <Search size={20} className="text-slate-400" />
                  <h2 className="font-bold text-slate-700 dark:text-slate-200">Search Staff IDs</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                  <input
                    className="glass-input"
                    placeholder="Search by Email"
                    aria-label="Search by Email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                  />
                  <input
                    className="glass-input"
                    placeholder="Search by ID Code"
                    aria-label="Search by ID Code"
                    value={searchIdCode}
                    onChange={(e) => setSearchIdCode(e.target.value)}
                  />
              </div>
              
              <button onClick={handleSearch} className="btn-primary w-full">
                  <Search size={18} /> Search Database
              </button>
              
              {searchResults.length > 0 && (
                  <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-white/5 max-h-40 overflow-y-auto space-y-2">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Results ({searchResults.length})</div>
                      {searchResults.map((id, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm p-2 bg-white dark:bg-black/20 rounded-lg border border-slate-100 dark:border-white/5">
                              <div>
                                  <div className="font-semibold text-slate-800 dark:text-white">{id.idCode}</div>
                                  <div className="text-xs text-slate-500">{id.email}</div>
                              </div>
                              <div className="px-2 py-1 rounded bg-slate-100 dark:bg-white/10 text-xs font-bold uppercase">{id.role}</div>
                          </div>
                      ))}
                  </div>
              )}
          </div>

          {/* CREATE CARD */}
          <div className="glass-panel p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-white/5">
                  <UserPlus size={20} className="text-emerald-500" />
                  <h2 className="font-bold text-slate-700 dark:text-slate-200">Create New ID</h2>
              </div>

              <div className="space-y-3">
                  <input
                    className="glass-input"
                    placeholder="Email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    disabled={!isAdmin}
                  />
                  <div className="grid grid-cols-2 gap-3">
                      <input
                        className="glass-input"
                        placeholder="New ID Code"
                        value={newIdCode}
                        onChange={(e) => setNewIdCode(e.target.value)}
                      />
                      <input
                        type="password"
                        className="glass-input"
                        placeholder="Initial PIN"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        autoComplete="new-password"
                      />
                  </div>
                  <select 
                     className="glass-input"
                     value={newRole} 
                     onChange={(e) => setNewRole(e.target.value)}
                  >
                    {roleOptions.map((role) => <option key={role} value={role}>{role.toUpperCase()}</option>)}
                  </select>
                  
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Permissions</div>
                      <div className="flex flex-wrap gap-2">
                        {MENU_OPTIONS.map((menu) => (
                          <label key={menu} className={cn("text-xs border rounded-lg px-2 py-1.5 cursor-pointer flex items-center gap-2 transition-all", 
                              newMenus.includes(menu) 
                                ? "bg-blue-500 text-white border-blue-500 shadow-sm" 
                                : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                          )}>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={newMenus.includes(menu)}
                              onChange={(e) => setNewMenus((prev) => e.target.checked ? [...prev, menu] : prev.filter((m) => m !== menu))}
                            />
                            {newMenus.includes(menu) && <CheckCircle size={10} />} {menu}
                          </label>
                        ))}
                      </div>
                  </div>
                  
                  <button onClick={handleCreate} className="btn-primary w-full bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20">
                      <UserPlus size={18} /> Create Account
                  </button>
              </div>
          </div>

          {/* UPDATE CARD */}
          <div className="glass-panel p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-white/5">
                  <Edit size={20} className="text-blue-500" />
                  <h2 className="font-bold text-slate-700 dark:text-slate-200">Update Existing ID</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input 
                     className="glass-input" 
                     placeholder="Target ID Code" 
                     value={editIdCode} 
                     onChange={(e) => setEditIdCode(e.target.value)} 
                  />
                  <select 
                     className="glass-input" 
                     value={editRole} 
                     onChange={(e) => setEditRole(e.target.value)}
                  >
                    <option value="">Role (No Change)</option>
                    {roleOptions.map((role) => <option key={role} value={role}>{role.toUpperCase()}</option>)}
                  </select>
                  <select 
                     className="glass-input"
                     value={editStatus} 
                     onChange={(e) => setEditStatus(e.target.value)}
                  >
                    <option value="">Status (No Change)</option>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
              </div>

               <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Update Permissions</div>
                  <div className="flex flex-wrap gap-2">
                    {MENU_OPTIONS.map((menu) => (
                      <label key={menu} className={cn("text-xs border rounded-lg px-2 py-1.5 cursor-pointer flex items-center gap-2 transition-all", 
                          editMenus.includes(menu) 
                            ? "bg-blue-500 text-white border-blue-500 shadow-sm" 
                            : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                      )}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={editMenus.includes(menu)}
                          onChange={(e) => setEditMenus((prev) => e.target.checked ? [...prev, menu] : prev.filter((m) => m !== menu))}
                        />
                        {editMenus.includes(menu) && <CheckCircle size={10} />} {menu}
                      </label>
                    ))}
                  </div>
              </div>

              <div className="flex gap-3">
                  <button onClick={handleUpdate} className="btn-primary flex-1">
                      <Save size={18} /> Update ID
                  </button>
                  <button onClick={() => handleResetPin(editIdCode)} className="btn-secondary flex-1 border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-500/30 dark:text-orange-400 dark:hover:bg-orange-500/10">
                      <Key size={18} /> Reset PIN
                  </button>
              </div>
          </div>

          {/* AUDIT LOGS CARD */}
          <div className="glass-panel p-6 flex flex-col gap-4 relative overflow-hidden">
               <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-2">
                      <History size={20} className="text-purple-500" />
                      <h2 className="font-bold text-slate-700 dark:text-slate-200">System Logs</h2>
                  </div>
                  <button onClick={handleLoadAudit} className="text-xs font-bold px-2 py-1 rounded bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors flex items-center gap-1">
                      <RefreshCw size={12} /> Refresh
                  </button>
              </div>
              
              <div className="flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 min-h-[200px]">
                  {auditLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 opacity-60">
                        <History size={32} />
                        <span className="text-sm">No recent activity logs found</span>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 backdrop-blur-sm">
                        <tr>
                          <th className="p-3 font-semibold">Action</th>
                          <th className="p-3 font-semibold">Target</th>
                          <th className="p-3 font-semibold">Actor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="border-t border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            <td className="p-3 font-bold text-slate-700 dark:text-slate-300">{log.action}</td>
                            <td className="p-3 text-slate-500 dark:text-slate-400 font-mono">{log.targetIdCode || log.targetEmail}</td>
                            <td className="p-3 text-slate-500 dark:text-slate-400 relative">
                                {log.actorIdCode || log.actorEmail}
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </div>
          </div>

      </div>
    </div>
  );
}

