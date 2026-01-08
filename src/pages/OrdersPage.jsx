import React from 'react';
import { ShoppingCart, Filter, Search, Calendar, FileText } from 'lucide-react';

export default function OrdersPage() {
  return (
    <div className="h-full p-6 md:p-8 animate-fade-in-up flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div className="flex items-center gap-3">
             <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/30 flex items-center justify-center">
                 <ShoppingCart size={24} />
             </div>
             <div>
                 <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Orders & Transactions</h1>
                 <p className="text-sm text-slate-500 dark:text-slate-400">View and manage past sales</p>
             </div>
         </div>

         <div className="flex items-center gap-2">
             <button className="btn-secondary text-sm h-10" aria-label="Filter by date" disabled>
                <Calendar size={16} /> <span>Today</span>
             </button>
             <button className="btn-secondary text-sm h-10" aria-label="Open filters" disabled>
                <Filter size={16} /> <span>Filter</span>
             </button>
         </div>
      </div>

       {/* Main Content (Placeholder Table) */}
      <div className="glass-panel flex-1 overflow-hidden flex flex-col">
         
         {/* Table Header */}
         <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
             <div className="col-span-2">Order ID</div>
             <div className="col-span-3">Date & Time</div>
             <div className="col-span-2">Cashier</div>
             <div className="col-span-1 text-center">Items</div>
             <div className="col-span-2 text-right">Total</div>
             <div className="col-span-2 text-center">Status</div>
         </div>

         {/* Empty State */}
         <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 gap-4 opacity-60">
             <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                 <FileText size={40} />
             </div>
             <div className="text-center">
                 <h3 className="font-bold text-lg text-slate-600 dark:text-slate-300">No Transactions Found</h3>
                 <p className="max-w-xs mt-1 text-sm">Sales history for the selected period will appear here.</p>
             </div>
         </div>

      </div>
    </div>
  );
}
