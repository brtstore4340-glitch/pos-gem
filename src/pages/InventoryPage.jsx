import { Package, Plus, Search, Filter } from 'lucide-react';

export default function InventoryPage() {
  return (
    <div className="h-full p-6 md:p-8 animate-fade-in-up flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div className="flex items-center gap-3">
             <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30 flex items-center justify-center">
                 <Package size={24} />
             </div>
             <div>
                 <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Inventory</h1>
                 <p className="text-sm text-slate-500 dark:text-slate-400">Manage stock levels and products</p>
             </div>
         </div>
         
         <button className="btn-primary shadow-orange-500/20 bg-orange-600 hover:bg-orange-500">
             <Plus size={18} />
             <span>Add Product</span>
         </button>
      </div>

      {/* Toolbar */}
      <div className="glass-panel p-2 flex items-center gap-2">
         <div className="relative flex-1">
             <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input className="w-full pl-10 pr-4 py-2.5 bg-transparent outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400" placeholder="Search inventory..." />
         </div>
         <div className="h-8 w-[1px] bg-slate-200 dark:bg-white/10"></div>
         <button className="p-2.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
            <Filter size={18} />
         </button>
      </div>

      {/* Main Content (Placeholder Table) */}
      <div className="glass-panel flex-1 overflow-hidden flex flex-col">
         
         {/* Table Header */}
         <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
             <div className="col-span-2">SKU</div>
             <div className="col-span-4">Product Name</div>
             <div className="col-span-2 text-right">Price</div>
             <div className="col-span-2 text-center">Stock</div>
             <div className="col-span-2 text-center">Actions</div>
         </div>

         {/* Empty State / Placeholder Rows */}
         <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 gap-4 opacity-60">
             <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                 <Package size={40} />
             </div>
             <div className="text-center">
                 <h3 className="font-bold text-lg text-slate-600 dark:text-slate-300">No Products Found</h3>
                 <p className="max-w-xs mt-1 text-sm">Upload your product catalog in Admin Settings to populate inventory.</p>
             </div>
         </div>

      </div>
    </div>
  );
}

