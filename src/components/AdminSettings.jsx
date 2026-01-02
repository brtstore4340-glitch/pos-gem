import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Upload, Database, FileText, CheckCircle, AlertCircle, RefreshCw, ArrowLeft, Trash2, Lock, Search, HelpCircle } from 'lucide-react';
import { posService } from '../services/posService';
import { cn } from '../utils/cn';

export default function AdminSettings({ onBack }) {
  const [stats, setStats] = useState({ count: 0, lastUpdated: null });
  const [hasMaster, setHasMaster] = useState(false);
  
  // Universal Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Upload States
  const [uploadStatus, setUploadStatus] = useState({
    master: { loading: false, progress: 0, log: null },
    print: { loading: false, progress: 0, log: null },
    maint: { loading: false, progress: 0, log: null }
  });

  useEffect(() => { loadStats(); }, []);

  // Universal Search Handler
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length >= 2) {
        setIsSearching(true);
        try {
          const results = await posService.searchProducts(searchTerm);
          setSearchResults(results);
        } catch (error) {
          console.error("Search failed:", error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

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
        
        {/* Header Section */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={24} className="text-slate-600" /></button>
            <div>
              <h1 className="text-2xl font-bold text-boots-base">Data Management Center</h1>
              <p className="text-sm text-slate-500">จัดการข้อมูลสินค้าและอัพเดทฐานข้อมูล</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-slate-50 px-5 py-3 rounded-xl border border-slate-100">
             <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Items</span>
                <span className="font-bold text-slate-800 text-xl">{stats.count.toLocaleString()}</span>
             </div>
             <a
               href="/readme.html"
               target="_blank"
               rel="noreferrer"
               className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-white/70 backdrop-blur border border-white/60 text-slate-500 hover:text-boots-base hover:bg-white/90 transition-colors shadow-sm"
               aria-label="Open readme menu"
               title="Readme menu"
             >
               <HelpCircle size={18} />
             </a>
             <Database size={24} className="text-blue-500"/>
             {hasMaster && <button onClick={handleClearDatabase} className="ml-4 text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={20}/></button>}
          </div>
        </div>

        {/* Universal Search Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Search size={20} className="text-boots-base" /> Universal Search
            </h2>
            <div className="relative">
                <input 
                    type="text" 
                    placeholder="ค้นหาสินค้าด้วย ชื่อ, รหัส, บาร์โค้ด..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-slate-200 focus:border-boots-base outline-none transition-colors text-lg"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                {isSearching && <div className="absolute right-4 top-1/2 -translate-y-1/2"><RefreshCw className="animate-spin text-boots-base" size={20} /></div>}
            </div>
            
            {/* Search Results */}
            {searchTerm.length >= 2 && (
                <div className="mt-4 border rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-500 text-sm uppercase">
                            <tr>
                                <th className="p-3 border-b">SKU</th>
                                <th className="p-3 border-b">Description</th>
                                <th className="p-3 border-b text-right">Price</th>
                                <th className="p-3 border-b text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {searchResults.length > 0 ? (
                                searchResults.map((item) => (
                                    <tr key={item.sku} className="border-b last:border-0 hover:bg-blue-50 transition-colors">
                                        <td className="p-3 font-mono text-sm text-slate-600">{item.sku}</td>
                                        <td className="p-3 font-medium text-slate-800">{item.name}</td>
                                        <td className="p-3 text-right font-bold text-slate-700">฿{item.price.toLocaleString()}</td>
                                        <td className="p-3 text-center">
                                            <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold">Active</span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-400">
                                        {isSearching ? 'Searching...' : 'ไม่พบสินค้าที่ค้นหา'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>

        {/* Upload Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: ProductAllDept */}
          <UploadCard 
            title="1. ProductAllDept" 
            desc="Master File (.csv) - Contains core product data. Upload this first." 
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
            desc="Enrich Data (.xls) - Additional details for printing and display." 
            accept=".xls,.xlsx"
            status={uploadStatus.print}
            onChange={handlePrintUpload}
            icon={<FileText size={32} />}
            active={hasMaster}
          />

          {/* Card 3: ItemMaintananceEvent */}
          <UploadCard 
            title="3. ItemMaintananceEvent" 
            desc="Maintenance Data (.xls) - Update specific event triggers." 
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
    <div className={cn("bg-white rounded-2xl shadow-sm border overflow-hidden relative transition-all h-full flex flex-col", active ? "border-slate-200 hover:shadow-md hover:border-blue-200" : "border-slate-100 opacity-60 grayscale")}>
      {!active && (
        <div className="absolute inset-0 z-10 bg-slate-100/50 flex flex-col items-center justify-center text-slate-400 backdrop-blur-[1px]">
          <Lock size={32} className="mb-2" />
          <span className="text-sm font-semibold">Waiting for Master Data</span>
        </div>
      )}
      
      <div className="p-6 border-b border-slate-50 flex justify-between items-start bg-slate-50/50">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          {required && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full mt-1 inline-block font-bold">REQUIRED FIRST</span>}
        </div>
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-sm", active ? "bg-white text-boots-base border border-blue-100" : "bg-slate-100 text-slate-400")}>{icon}</div>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <p className="text-sm text-slate-500 mb-6 flex-1">{desc}</p>
        
        {!status.loading ? (
          <div className="relative group cursor-pointer">
            <input type="file" accept={accept} onChange={onChange} disabled={!active} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center group-hover:bg-blue-50 group-hover:border-blue-300 transition-all bg-slate-50">
              <Upload size={24} className="mx-auto text-slate-400 mb-2 group-hover:text-blue-500" />
              <span className="text-sm font-bold text-slate-600 group-hover:text-blue-600">Click to Upload</span>
              <div className="text-xs text-slate-400 mt-1">{accept}</div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center bg-slate-50 rounded-xl border border-slate-100">
            <RefreshCw size={24} className="mx-auto animate-spin text-boots-base mb-3" />
            <div className="text-2xl font-bold text-slate-800">{status.progress}%</div>
            <div className="text-xs text-slate-500 mt-1">Processing data...</div>
          </div>
        )}

        {status.log && (
          <div className={cn("mt-4 p-3 rounded-lg text-xs flex items-center gap-2 animate-in slide-in-from-bottom-2", status.log.type === 'success' ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100")}>
            {status.log.type === 'success' ? <CheckCircle size={16} className="shrink-0"/> : <AlertCircle size={16} className="shrink-0"/>}
            <span className="font-medium">{status.log.msg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
