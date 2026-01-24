import React, { useState } from 'react';
import PosUI from './components/DemoUI';
import AdminSettings from './components/AdminSettings';
import ProductSearchPage from './pages/ProductSearchPage';
import {
  LayoutDashboard,
  Monitor,
  FileText,
  Search as SearchIcon,
  Settings,
  UploadCloud,
  ShieldCheck
} from 'lucide-react';

function App() {
  const [view, setView] = useState('pos'); // 'pos' | 'admin' | 'search'

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-gray-200 shadow-md">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <img
                src="https://store.boots.co.th/images/boots-logo.png"
                alt="Boots Logo"
                className="h-8 w-auto object-contain"
              />
              <div className="flex flex-col text-[10px] text-slate-400 font-mono leading-tight">
                <span>v1.4.0</span>
                <span>2026-01-01</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, view: null },
                { id: 'pos', label: 'POS', icon: <Monitor size={20} />, view: 'pos' },
                { id: 'report', label: 'Report', icon: <FileText size={20} />, view: null },
                { id: 'search', label: 'Search', icon: <SearchIcon size={20} />, view: 'search' },
                { id: 'upload', label: 'Upload', icon: <UploadCloud size={20} />, view: null },
                { id: 'management', label: 'Management', icon: <ShieldCheck size={20} />, view: 'admin' },
                { id: 'settings', label: 'Setting', icon: <Settings size={20} />, view: 'admin' }
              ].map((item) => {
                const active = view === item.view;
                const baseClasses =
                  'w-[86px] h-[74px] flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 font-semibold';
                const inactive =
                  'text-slate-500 hover:bg-slate-100 shadow-sm bg-white border border-slate-200';
                const activeCls =
                  'bg-blue-700 text-white shadow-lg border border-blue-800';
                return (
                  <button
                    key={item.id}
                    onClick={() => item.view && setView(item.view)}
                    className={`${baseClasses} ${active ? activeCls : inactive}`}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border transition-colors ${
                        active
                          ? 'bg-white/10 border-white/20'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="text-[11px] leading-none">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {view === 'pos' && (
        <div className="relative">
          <PosUI onAdminSettings={() => setView('admin')} onSearch={() => setView('search')} />
        </div>
      )}
      {view === 'search' && (
        <div className="relative">
          <ProductSearchPage onClose={() => setView('pos')} />
        </div>
      )}
      {view === 'admin' && <AdminSettings onBack={() => setView('pos')} />}
    </div>
  );
}

export default App;
