import React from 'react';
import { FileText, BarChart3 } from 'lucide-react';

export default function ReportPage() {
  return (
    <div className="h-full p-6 md:p-8 animate-fade-in-up">
      <div className="flex items-center justify-between mb-8">
         <div className="flex items-center gap-3">
             <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/30 flex items-center justify-center">
                 <FileText size={24} />
             </div>
             <div>
                 <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Reports & Analytics</h1>
                 <p className="text-sm text-slate-500 dark:text-slate-400">View sales performance and generate statements</p>
             </div>
         </div>
      </div>

      <div className="glass-panel p-12 flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-6">
              <BarChart3 size={32} className="text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Reporting Dashboard Coming Soon</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8">
              Advanced analytics, daily sales summaries, and exportable PDF reports will be available in the next update.
          </p>
          
          <div className="flex gap-4 opacity-50 pointer-events-none">
              <div className="h-32 w-24 rounded-lg bg-slate-100 dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/10"></div>
              <div className="h-32 w-24 rounded-lg bg-slate-100 dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/10"></div>
              <div className="h-32 w-24 rounded-lg bg-slate-100 dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/10"></div>
          </div>
      </div>
    </div>
  );
}

