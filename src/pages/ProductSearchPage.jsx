import { useEffect, useState, useRef } from "react";
import { Search, Package, Tag, Barcode, Layers, Archive, Info } from "lucide-react";
import { posService } from "../services/posService";
import { cn } from "../utils/cn";

/**
 * Custom hook to encapsulate product search logic, state, and effects.
 * Handles debouncing, race conditions, loading/error states, and accessibility.
 */
function useProductSearch() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const searchProducts = async () => {
      if (keyword.length < 2) {
        setResults([]);
        setSelectedItem(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const items = await posService.searchProducts(keyword, { signal });
        if (!signal.aborted) {
          setResults(items);
          setSelectedItem(items.length > 0 ? items[0] : null);
        }
      } catch (err) {
        if (err.name !== 'AbortError' && !signal.aborted) {
          console.error("Search failed:", err);
          setError("Search failed. Please try again.");
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    };

    const timeoutId = setTimeout(searchProducts, 250);

    // Cleanup function to abort fetch and clear timeout
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [keyword]);

  return { keyword, setKeyword, results, selectedItem, setSelectedItem, loading, error, inputRef };
}


export default function ProductSearchPage() {
  const { keyword, setKeyword, results, selectedItem, setSelectedItem, loading, error, inputRef } = useProductSearch();

  // Unity Theme Redesign
  return (
    <div className="h-full flex flex-col gap-6 p-6 md:p-8 animate-fade-in-up">
      {/* Header & Search */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
           <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center">
             <Search size={22} />
           </div>
           <div>
             <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Product Search</h1>
             <p className="text-sm text-slate-500 dark:text-slate-400">Find items by name, barcode, or SKU ID</p>
           </div>
        </div>
        
        <div className="relative max-w-2xl">
           <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
             <Search size={16} />
           </div>
           <input
             ref={inputRef}
             value={keyword}
             onChange={(e) => setKeyword(e.target.value)}
             placeholder="Search products..."
             aria-label="Search products by name, barcode, or SKU"
             className="glass-input pl-14 text-lg font-medium"
             aria-busy={loading}
           />
           {loading && (
             <div className="absolute right-4 top-1/2 -translate-y-1/2">
               <span className="flex h-3 w-3 relative" role="status" aria-live="polite">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                  <span className="sr-only">Searching...</span>
               </span>
             </div>
           )}
        </div>
      </div>

      <div className="flex-1 grid lg:grid-cols-[380px_1fr] gap-6 min-h-0">
        
        {/* Results List */}
        <div className="glass-panel flex flex-col overflow-hidden">
           <div className="p-4 border-b border-slate-200/50 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 backdrop-blur-sm">
             <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
               Results ({results.length})
             </div>
           </div>
           
           <div className="flex-1 overflow-y-auto p-2 space-y-1">
             {loading ? (
                <div className="py-12 flex flex-col items-center text-slate-400 gap-3">
                   <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
                   <span className="text-sm font-medium" role="status">Searching database...</span>
                </div>
             ) : error ? (
                <div className="py-20 flex flex-col items-center text-red-500 gap-4 opacity-80">
                  <Info size={48} strokeWidth={1.5} />
                  <span className="text-sm font-medium text-center">{error}</span>
                </div>
             ) : results.length === 0 ? (
                <div className="py-20 flex flex-col items-center text-slate-400 gap-4 opacity-70">
                   <Search size={48} strokeWidth={1.5} />
                   <span className="text-sm font-medium">{keyword.length < 2 ? "Enter keywords to start" : "No products found"}</span>
                </div>
             ) : (
                results.map((item) => (
                   <button
                     key={item.sku}
                     onClick={() => setSelectedItem(item)}
                     className={cn(
                       "w-full text-left p-3 rounded-xl transition-all border border-transparent group relative overflow-hidden",
                       selectedItem?.sku === item.sku
                         ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                         : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300"
                     )}
                   >
                     <div className="flex justify-between items-start gap-2 relative z-10">
                        <div className="flex-1 min-w-0">
                           <div className="font-bold truncate text-sm">{item.ProductDesc || item.name}</div>
                           <div className={cn("text-xs font-mono mt-0.5 flex items-center gap-1", selectedItem?.sku === item.sku ? "text-blue-200" : "text-slate-400")}>
                             <Barcode size={10} /> {item.sku}
                           </div>
                        </div>
                        <div className={cn("font-bold text-sm", selectedItem?.sku === item.sku ? "text-white" : "text-blue-600 dark:text-blue-400")}>
                           ฿{item.SellPrice?.toLocaleString()}
                        </div>
                     </div>
                   </button>
                ))
             )}
           </div>
        </div>

        {/* Detail View */}
        <div className="glass-panel text-slate-800 dark:text-white relative overflow-hidden flex flex-col">
            {selectedItem ? (
               <div className="h-full flex flex-col p-6 md:p-8 overflow-y-auto">
                  
                  {/* Hero Header */}
                  <div className="flex items-start justify-between mb-8">
                     <div>
                        <div className="flex items-center gap-2 mb-2">
                           {selectedItem.ProductStatus === "Active" ? (
                              <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-bold uppercase tracking-wide border border-green-500/20">Active</span>
                           ) : (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wide">Inactive</span>
                           )}
                           <span className="text-xs text-slate-400 font-mono">#{selectedItem.sku}</span>
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold leading-tight">{selectedItem.ProductDesc || selectedItem.name}</h2>
                     </div>
                     
                     <div className="text-right">
                        <div className="text-sm text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">Price</div>
                        <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 tracking-tight">
                           ฿{selectedItem.SellPrice?.toLocaleString()}
                        </div>
                     </div>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                     <InfoCard icon={Barcode} label="Barcode" value={selectedItem.barcode} />
                     <InfoCard icon={Layers} label="Department" value={selectedItem.DeptDesc || selectedItem.dept} />
                     <InfoCard icon={Tag} label="Class" value={selectedItem.class} />
                     <InfoCard icon={Package} label="Brand" value={selectedItem.brand_print} />
                     <InfoCard icon={Archive} label="Merchandise" value={selectedItem.merchandise} />
                     <InfoCard icon={Info} label="Tax Type" value={selectedItem.tax_print} />
                  </div>

                  {/* Actions / Scannable Area Placeholder */}
                  <div className="mt-auto p-6 rounded-2xl bg-slate-50 dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/10 flex flex-col items-center justify-center text-center gap-2">
                      <Barcode size={48} className="opacity-20" />
                      <div className="text-sm font-bold text-slate-400">Scan Code Visualization</div>
                      <div className="text-xs font-mono text-slate-300">{selectedItem.barcode || selectedItem.sku}</div>
                  </div>

               </div>
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                  <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-6 rotate-12">
                     <Package size={48} strokeWidth={1} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-600 dark:text-slate-300">Select a Product</h3>
                  <p className="max-w-xs text-center mt-2">Choose an item from the list to view detailed specifications and pricing.</p>
               </div>
            )}
        </div>

      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex items-start gap-3">
       <div className="p-2 rounded-lg bg-white dark:bg-black/20 text-slate-400 shadow-sm">
          <Icon size={16} />
       </div>
       <div>
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">{label}</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">{value || "-"}</div>
       </div>
    </div>
  );
}

