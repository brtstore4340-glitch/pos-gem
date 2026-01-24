import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Upload, Database, FileText, CheckCircle, AlertCircle, RefreshCw, ArrowLeft, Trash2, Lock, HelpCircle, Server, Settings, Save, HardDrive } from 'lucide-react';
import { posService } from '../services/posService';
import { cn } from '../utils/cn';

export default function AdminSettingsPage({ onBack }) {
  // BEGIN: FUNCTION ZONE (DO NOT TOUCH)
  const [activeSubTab, setActiveSubTab] = useState('uploads'); // Default to uploads as it has the main logic
  const [features, setFeatures] = useState({
    multiStoreMode: true,
    advancedPromotions: false,
    couponScanning: true,
    voidManagerOnly: false,
    autoReport: true,
    lowStockAlerts: false,
    thaiLanguagePriority: true,
  });

  const [stats, setStats] = useState({ count: 0, lastUpdated: null });
  const [hasMaster, setHasMaster] = useState(false);
  const [uploadMeta, setUploadMeta] = useState({});

  // Upload States
  const [uploadStatus, setUploadStatus] = useState({
    master: { loading: false, progress: 0, log: null },
    print: { loading: false, progress: 0, log: null },
    maint: { loading: false, progress: 0, log: null }
  });

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const s = await posService.getProductStats();
      setStats(s || { count: 0, lastUpdated: null });
      setHasMaster((s?.count || 0) > 0);
      setUploadMeta(s?.uploads || {});
    } catch (e) {
      console.error("Failed to load stats", e);
    }
  };

  const updateStatus = (key, val) => {
    setUploadStatus(prev => ({ ...prev, [key]: { ...prev[key], ...val } }));
  };

  // 1. Handle ProductAllDept (CSV)
  const handleMasterUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    updateStatus('master', { loading: true, progress: 0, log: null });

    Papa.parse(file, {
      header: true, skipEmptyLines: true, worker: true,
      complete: async (results) => {
        try {
          const data = results.data;
          if (data.length === 0) throw new Error('File is empty');
          
          const count = await posService.uploadProductAllDept(data, (curr, total) => {
            updateStatus('master', { progress: Math.round((curr/total)*100) });
          });
          
          updateStatus('master', { loading: false, log: { type: 'success', msg: '✅ Upload Complete: ' + count } });
          loadStats();
        } catch (err) {
          updateStatus('master', { loading: false, log: { type: 'error', msg: err.message } });
        }
      },
      error: () => updateStatus('master', { loading: false, log: { type: 'error', msg: 'Read CSV Failed' } })
    });
    e.target.value = '';
  };

  // 2. Handle ItemMasterPrintOnDeph (XLS)
  const handlePrintUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    updateStatus('print', { loading: true, progress: 0, log: null });
    
    try {
      const count = await posService.uploadItemMasterPrint(file, (curr, total) => {
         updateStatus('print', { progress: Math.round((curr/total)*100) });
      });
      updateStatus('print', { loading: false, log: { type: 'success', msg: '✅ Updated ' + count + ' items' } });
    } catch (err) {
      updateStatus('print', { loading: false, log: { type: 'error', msg: err.message } });
    }
    e.target.value = '';
  };

  // 3. Handle ItemMaintananceEvent (XLS)
  const handleMaintUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    updateStatus('maint', { loading: true, progress: 0, log: null });

    try {
      const count = await posService.uploadItemMaintenance(file, (curr, total) => {
         updateStatus('maint', { progress: Math.round((curr/total)*100) });
      });
      updateStatus('maint', { loading: false, log: { type: 'success', msg: '✅ Updated ' + count + ' items' } });
    } catch (err) {
      updateStatus('maint', { loading: false, log: { type: 'error', msg: err.message } });
    }
    e.target.value = '';
  };

  const handleClearDatabase = async () => {
    if (!window.confirm('⚠️ Are you sure you want to DELETE ALL DATA?')) return;
    updateStatus('master', { loading: true, log: { type: 'info', msg: 'Deleting...' } });
    try {
      await posService.clearDatabase();
      updateStatus('master', { loading: false, log: { type: 'success', msg: 'Database Cleared' } });
      loadStats();
    } catch (e) {
      console.error('clearDatabase failed:', e);
      updateStatus('master', { loading: false, log: { type: 'error', msg: e?.message || 'Failed to clear database' } });
    }
  };

  const handleFeatureToggle = (featureName) => {
    setFeatures(prev => ({ ...prev, [featureName]: !prev[featureName] }));
  };
  
  const handleSaveFeatures = () => {
      alert("Feature settings saved locally (demo).");
  };

  const formatDate = (value) => {
    if (!value) return 'Not available';
    try {
      const date = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
      if (isNaN(date.getTime())) return 'Not available';
      return date.toLocaleString();
    } catch {
      return 'Not available';
    }
  };

  const uploadEntries = [
    { key: 'master', title: 'ProductAllDept', hint: 'Master dataset' },
    { key: 'print', title: 'Print Data', hint: 'Label & print details' },
    { key: 'maint', title: 'Maintenance', hint: 'Event triggers' },
  ];
  // END:   FUNCTION ZONE (DO NOT TOUCH)


  // Unity Theme UI
  return (
    <div className="h-full p-6 md:p-8 animate-fade-in-up flex flex-col gap-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center gap-4">
         <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 dark:from-white/10 dark:to-white/5 text-white shadow-lg flex items-center justify-center">
             <Settings size={28} />
         </div>
         <div className="flex-1">
             <h1 className="text-3xl font-bold text-slate-800 dark:text-white">System Settings</h1>
             <p className="text-slate-500 dark:text-slate-400">Configure global POS features and manage data</p>
         </div>
         {onBack && (
            <button onClick={onBack} className="btn-secondary">
                <ArrowLeft size={18} /> Back
            </button>
         )}
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-100 dark:bg-white/5 rounded-xl self-start">
         <button
           onClick={() => setActiveSubTab('uploads')}
           className={cn("px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2", 
             activeSubTab === 'uploads' 
               ? "bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm" 
               : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
           )}
         >
           <Database size={18} /> Data Management
         </button>
         <button
           onClick={() => setActiveSubTab('features')}
           className={cn("px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2", 
             activeSubTab === 'features' 
               ? "bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm" 
               : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
           )}
         >
           <Server size={18} /> Features
         </button>
      </div>

      {/* Content Area */}
      <div className="glass-panel flex-1 p-8 rounded-3xl min-h-[500px]">
        
        {/* Data Uploads & Overview */}
        {activeSubTab === 'uploads' && (
          <div className="animate-fade-in-up space-y-8">
             
             {/* Stats & Last Uploads */}
             <div className="grid lg:grid-cols-2 gap-6">
                 {/* Last Uploads */}
                 <div className="p-6 rounded-2xl bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 shadow-sm flex flex-col gap-4">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <RefreshCw size={20} className="text-blue-500" /> Data Sync Activity
                    </h2>
                    <div className="space-y-3">
                      {uploadEntries.map((entry) => {
                        const meta = uploadMeta?.[entry.key];
                        return (
                          <div key={entry.key} className="p-3 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-slate-800 dark:text-white">{entry.title}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">{entry.hint}</div>
                              </div>
                              <span className="text-[11px] px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 font-semibold border border-blue-100 dark:border-blue-500/30">
                                {meta?.count ? `${meta.count.toLocaleString()} rows` : "Pending"}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500/80"></span>
                              <span className="font-medium">Last upload:</span>
                              <span className="font-mono">{formatDate(meta?.lastUploadAt)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                 </div>

                 {/* System Stats */}
                 <div className="p-6 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex flex-col justify-between relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Database size={120} />
                     </div>
                     
                     <div className="relative z-10">
                         <div className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Database Stats</div>
                         <div className="flex items-baseline gap-2">
                             <div className="text-4xl font-extrabold text-slate-800 dark:text-white">{stats.count.toLocaleString()}</div>
                             <div className="text-slate-500 dark:text-slate-400 font-medium">products</div>
                         </div>
                         <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            Last updated: <span className="font-mono">{formatDate(stats.lastUpdated)}</span>
                         </div>
                     </div>
                     
                     <div className="flex flex-wrap gap-2 mt-6 relative z-10">
                         {hasMaster && (
                            <button onClick={handleClearDatabase} className="btn-secondary border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10 text-sm py-2">
                                <Trash2 size={16} /> Clear Database
                            </button>
                         )}
                         <a href="/readme.html" target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm py-2 ml-auto">
                             <HelpCircle size={16} /> Help
                         </a>
                     </div>
                 </div>
             </div>
             
             {/* Upload Cards */}
             <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <HardDrive size={20} className="text-blue-500" /> Data Imports
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <UploadCard 
                        title="1. ProductAllDept" 
                        desc="Master CSV File - Required First" 
                        accept=".csv"
                        status={uploadStatus.master}
                        meta={uploadMeta.master}
                        onChange={handleMasterUpload}
                        icon={<FileText size={32} />}
                        active={true}
                        required={!hasMaster}
                    />

                    <UploadCard 
                        title="2. Print Data" 
                        desc="Label Printing Details (.xls)" 
                        accept=".xls,.xlsx"
                        status={uploadStatus.print}
                        meta={uploadMeta.print}
                        onChange={handlePrintUpload}
                        icon={<FileText size={32} />}
                        active={hasMaster} // Only active if master exists
                    />

                    <UploadCard 
                        title="3. Maintenance" 
                        desc="Event Triggers (.xls)" 
                        accept=".xls,.xlsx"
                        status={uploadStatus.maint}
                        meta={uploadMeta.maint}
                        onChange={handleMaintUpload}
                        icon={<FileText size={32} />}
                        active={hasMaster} // Only active if master exists
                    />
                </div>
             </div>

          </div>
        )}
        
        {/* Feature Toggles */}
        {activeSubTab === 'features' && (
          <div className="max-w-3xl animate-fade-in-up">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
               <Server size={22} className="text-blue-500" /> Feature Configuration
            </h2>
            
            <div className="grid gap-4">
              {[
                { key: 'multiStoreMode', label: 'Multi-Store Mode', desc: 'Enable syncing data across multiple branch locations' },
                { key: 'advancedPromotions', label: 'Advanced Promotions', desc: 'Allow complex discount rules and buy-1-get-1 logic' },
                { key: 'couponScanning', label: 'Coupon Scanning', desc: 'Enable barcode scanner support for physical coupons' },
                { key: 'voidManagerOnly', label: 'Manager Void Approval', desc: 'Require manager PIN to void items (Security)' },
                { key: 'autoReport', label: 'Auto-Send Reports', desc: 'Automatically email daily sales reports at closing' },
                { key: 'lowStockAlerts', label: 'Low Stock Alerts', desc: 'Notify cashier when inventory drops below threshold' },
                { key: 'thaiLanguagePriority', label: 'Thai Language Priority', desc: 'Default to Thai language for product names and receipts' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                   <div className="pr-0 sm:pr-4 min-w-0 space-y-1">
                      <div className="font-bold text-slate-800 dark:text-white leading-snug break-words">{label}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 leading-snug break-words">{desc}</div>
                   </div>
                   <button 
                     onClick={() => handleFeatureToggle(key)}
                     className={cn("relative inline-flex h-7 w-12 items-center rounded-full transition-colors self-start sm:self-center", 
                        features[key] ? "bg-blue-600" : "bg-slate-200 dark:bg-white/10"
                     )}
                   >
                     <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md", 
                        features[key] ? "translate-x-6" : "translate-x-1"
                     )} />
                   </button>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/10">
              <button onClick={handleSaveFeatures} className="btn-primary shadow-blue-500/20">
                <Save size={20} /> Save Configuration
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const formatUploadDate = (value) => {
  if (!value) return 'Not available';
  try {
    const date = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
    if (isNaN(date.getTime())) return 'Not available';
    return date.toLocaleString();
  } catch {
    return 'Not available';
  }
};

function UploadCard({ title, desc, accept, status, onChange, icon, active, required, meta }) {
  return (
    <div className={cn("bg-white dark:bg-black/20 rounded-2xl shadow-sm border overflow-hidden relative transition-all h-full flex flex-col", active ? "border-slate-200 dark:border-white/10 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-500/30" : "border-slate-100 dark:border-white/5 opacity-60 grayscale")}>
      {!active && (
        <div className="absolute inset-0 z-10 bg-slate-100/50 dark:bg-black/50 flex flex-col items-center justify-center text-slate-400 backdrop-blur-[1px]">
          <Lock size={32} className="mb-2" />
          <span className="text-sm font-semibold">Waiting for Master Data</span>
        </div>
      )}
      
      <div className="p-6 border-b border-slate-50 dark:border-white/5 flex justify-between items-start bg-slate-50/50 dark:bg-white/5">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h3>
          {required && <span className="text-[10px] bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full mt-1 inline-block font-bold">REQUIRED FIRST</span>}
        </div>
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-sm", active ? "bg-white dark:bg-white/10 text-boots-base dark:text-blue-400 border border-blue-100 dark:border-white/10" : "bg-slate-100 dark:bg-white/5 text-slate-400")}>{icon}</div>
      </div>

      <div className="p-6 flex-1 flex flex-col min-w-0">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 flex-1 leading-relaxed break-words">{desc}</p>
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2 flex-wrap">
          <RefreshCw size={14} className="text-blue-500" />
          <span className="font-medium">Last upload:</span>
          <span className="font-mono">{formatUploadDate(meta?.lastUploadAt)}</span>
          {meta?.count ? <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 font-semibold text-[11px] text-slate-700 dark:text-slate-200">{meta.count.toLocaleString()} rows</span> : null}
        </div>
        
        {!status.loading ? (
          <div className="relative group cursor-pointer">
            <input type="file" accept={accept} onChange={onChange} disabled={!active} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
            <div className="border-2 border-dashed border-slate-300 dark:border-white/10 rounded-xl p-6 text-center group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 group-hover:border-blue-300 dark:group-hover:border-blue-500/30 transition-all bg-slate-50 dark:bg-white/5">
              <Upload size={24} className="mx-auto text-slate-400 mb-2 group-hover:text-blue-500" />
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">Click to Upload</span>
              <div className="text-xs text-slate-400 mt-1">{accept}</div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
            <RefreshCw size={24} className="mx-auto animate-spin text-boots-base dark:text-blue-400 mb-3" />
            <div className="text-2xl font-bold text-slate-800 dark:text-white">{status.progress}%</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Processing data...</div>
          </div>
        )}

        {status.log && (
          <div className={cn("mt-4 p-3 rounded-lg text-xs flex items-center gap-2 animate-in slide-in-from-bottom-2", status.log.type === 'success' ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-500/20" : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-500/20")}>
            {status.log.type === 'success' ? <CheckCircle size={16} className="shrink-0"/> : <AlertCircle size={16} className="shrink-0"/>}
            <span className="font-medium">{status.log.msg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
