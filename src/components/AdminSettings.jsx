import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Upload, Database, FileText, CheckCircle, AlertCircle, RefreshCw, ArrowLeft, Trash2, Lock } from 'lucide-react';
import { posService } from '../services/posService';
import { cn } from '../utils/cn';

export default function AdminSettings({ onBack }) {
  const [stats, setStats] = useState({ count: 0, lastUpdated: null });
  const [hasMaster, setHasMaster] = useState(false);
  
  // State แยกสำหรับแต่ละ Uploader
  const [uploadStatus, setUploadStatus] = useState({
    master: { loading: false, progress: 0, log: null },
    print: { loading: false, progress: 0, log: null },
    maint: { loading: false, progress: 0, log: null }
  });

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    const s = await posService.getProductStats();
    setStats(s);
    setHasMaster(s.count > 0);
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
          if (data.length === 0) throw new Error('ไฟล์ว่างเปล่า');
          
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
      updateStatus('print', { loading: false, log: { type: 'success', msg: '✅ Updated ' + count + ' matched items' } });
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
      updateStatus('maint', { loading: false, log: { type: 'success', msg: '✅ Updated ' + count + ' matched items' } });
    } catch (err) {
      updateStatus('maint', { loading: false, log: { type: 'error', msg: err.message } });
    }
    e.target.value = '';
  };

  const updateStatus = (key, val) => {
    setUploadStatus(prev => ({ ...prev, [key]: { ...prev[key], ...val } }));
  };

  const handleClearDatabase = async () => {
    if (!window.confirm('⚠️ ลบข้อมูลทั้งหมด?')) return;
    updateStatus('master', { loading: true, log: { type: 'info', msg: 'Deleting...' } });
    await posService.clearDatabase();
    updateStatus('master', { loading: false, log: { type: 'success', msg: 'Deleted All' } });
    loadStats();
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm"><ArrowLeft size={24} /></button>
            <h1 className="text-2xl font-bold text-boots-base">Data Management Center</h1>
          </div>
          <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl shadow-sm">
             <Database size={20} className="text-blue-500"/>
             <span className="font-bold text-slate-700">{stats.count.toLocaleString()} Items</span>
             {hasMaster && <button onClick={handleClearDatabase} className="text-red-500 hover:bg-red-50 p-2 rounded-lg"><Trash2 size={18}/></button>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: ProductAllDept */}
          <UploadCard 
            title="1. ProductAllDept" 
            desc="Master File (.csv)" 
            accept=".csv"
            status={uploadStatus.master}
            onChange={handleMasterUpload}
            icon={<FileText size={32} />}
            active={true}
            required={!hasMaster}
          />

          {/* Card 2: ItemMasterPrintOnDeph */}
          <UploadCard 
            title="2. ItemMasterPrintOnDeph" 
            desc="Enrich Data (.xls)" 
            accept=".xls,.xlsx"
            status={uploadStatus.print}
            onChange={handlePrintUpload}
            icon={<FileText size={32} />}
            active={hasMaster}
          />

          {/* Card 3: ItemMaintananceEvent */}
          <UploadCard 
            title="3. ItemMaintananceEvent" 
            desc="Maintenance Data (.xls)" 
            accept=".xls,.xlsx"
            status={uploadStatus.maint}
            onChange={handleMaintUpload}
            icon={<FileText size={32} />}
            active={hasMaster}
          />

        </div>
      </div>
    </div>
  );
}

function UploadCard({ title, desc, accept, status, onChange, icon, active, required }) {
  return (
    <div className={cn("bg-white rounded-2xl shadow-sm border overflow-hidden relative transition-all", active ? "border-slate-200 hover:shadow-md" : "border-slate-100 opacity-60 grayscale")}>
      {!active && (
        <div className="absolute inset-0 z-10 bg-slate-100/50 flex flex-col items-center justify-center text-slate-400">
          <Lock size={32} className="mb-2" />
          <span className="text-sm font-semibold">Waiting for Master</span>
        </div>
      )}
      
      <div className="p-6 border-b border-slate-50 flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <p className="text-sm text-slate-500">{desc}</p>
          {required && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full mt-1 inline-block">Required First</span>}
        </div>
        <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", active ? "bg-boots-light text-boots-base" : "bg-slate-100 text-slate-400")}>{icon}</div>
      </div>

      <div className="p-6">
        {!status.loading ? (
          <div className="relative group cursor-pointer">
            <input type="file" accept={accept} onChange={onChange} disabled={!active} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center group-hover:bg-slate-50 transition-colors">
              <Upload size={24} className="mx-auto text-slate-400 mb-2" />
              <span className="text-sm font-medium text-slate-600">Select File</span>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <RefreshCw size={24} className="mx-auto animate-spin text-boots-base mb-2" />
            <div className="text-xl font-bold text-boots-base">{status.progress}%</div>
          </div>
        )}

        {status.log && (
          <div className={cn("mt-4 p-3 rounded-lg text-xs flex items-center gap-2", status.log.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
            {status.log.type === 'success' ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
            {status.log.msg}
          </div>
        )}
      </div>
    </div>
  );
}
