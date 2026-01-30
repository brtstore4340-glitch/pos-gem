import { useState, useEffect, useRef } from 'react';
import { X, Search, Package, Database, FileText, Layers, Box } from 'lucide-react';
import { posService } from '../services/posService';
import { cn } from '../utils/cn';

export default function ProductLookupModal({ onClose, variant = 'modal' }) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const isPage = variant === 'page';

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (keyword.length >= 2) {
        setLoading(true);
        try {
          const items = await posService.searchProducts(keyword);
          setResults(items);
          if (items.length > 0 && !selectedItem) {
            setSelectedItem(items[0]);
          } else if (items.length === 0) {
            setSelectedItem(null);
          }
        } catch (e) { console.error(e); } finally { setLoading(false); }
      } else {
        setResults([]);
        setSelectedItem(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  return (
    <div
      className={cn(
        'animate-in fade-in duration-200',
        isPage
          ? 'min-h-screen bg-slate-50 flex items-center justify-center p-4'
          : 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4'
      )}
    >
      <div
        className={cn(
          'bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-row relative ring-1 ring-white/20',
          isPage ? 'w-full h-[90vh] max-w-7xl' : 'w-[95vw] h-[90vh] max-w-7xl'
        )}
      >

        {/* --- LEFT PANEL --- */}
        <div className="w-[350px] flex flex-col border-r border-slate-200 bg-white shrink-0">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Search className="text-boots-base" size={20} /> ค้นหาสินค้า
            </h2>
            <div className="relative group">
              <input 
                ref={inputRef}
                type="text" 
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="พิมพ์ชื่อ, บาร์โค้ด, หรือรหัส..." 
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-boots-base focus:border-boots-base outline-none shadow-sm transition-all text-base"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-boots-base transition-colors" size={18} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50 p-2 space-y-2">
            {loading ? (
              <div className="text-center py-10 text-slate-400 animate-pulse">กำลังค้นหา...</div>
            ) : results.length === 0 ? (
              <div className="text-center py-20 text-slate-400 flex flex-col items-center">
                <Box size={48} className="mb-2 opacity-20" />
                <span>{keyword.length < 2 ? 'พิมพ์เพื่อค้นหา' : 'ไม่พบสินค้า'}</span>
              </div>
            ) : (
              results.map((item) => (
                <div 
                  key={item.sku}
                  onClick={() => setSelectedItem(item)}
                  className={cn(
                    'p-3 rounded-lg cursor-pointer border transition-all relative overflow-hidden group',
                    selectedItem?.sku === item.sku 
                      ? 'bg-white border-boots-base shadow-md ring-1 ring-boots-base/20' 
                      : 'bg-white border-slate-200 hover:border-boots-base/50 hover:shadow-sm'
                  )}
                >
                  {selectedItem?.sku === item.sku && <div className="absolute left-0 top-0 bottom-0 w-1 bg-boots-base"></div>}
                  <div className="pl-2">
                    <div className={cn('font-bold text-sm line-clamp-1', selectedItem?.sku === item.sku ? 'text-boots-base' : 'text-slate-700')}>
                      {item.ProductDesc}
                    </div>
                    <div className="flex justify-between items-end mt-1">
                      <div className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{item.sku}</div>
                      <div className="font-bold text-slate-800">฿{item.SellPrice?.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-2 border-t border-slate-200 bg-white text-center text-xs text-slate-500 font-medium">
            พบข้อมูลทั้งหมด {results.length} รายการ
          </div>
        </div>

        {/* --- RIGHT PANEL (DETAILS) --- */}
        <div className="flex-1 flex flex-col bg-slate-50/30 overflow-hidden relative">

          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 p-2 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full shadow-sm border border-slate-100 transition-all hover:rotate-90"
            >
              <X size={24} />
            </button>
          )}

          {selectedItem ? (
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
              <div className="max-w-5xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                
                {/* 1. MASTER INFO */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5 text-boots-base pointer-events-none"><Package size={200} /></div>
                  <div className="relative z-10 flex flex-col md:flex-row gap-6 justify-between items-start border-b border-slate-100 pb-6 mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-boots-base text-white text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide uppercase">Master Product</span>
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-bold', selectedItem.ProductStatus?.startsWith('0') ? 'text-green-600 border-green-200 bg-green-50' : 'text-red-600 border-red-200 bg-red-50')}>{selectedItem.ProductStatus || 'Unknown'}</span>
                      </div>
                      <h1 className="text-2xl md:text-3xl font-bold text-slate-800 leading-tight mb-2">{selectedItem.ProductDesc}</h1>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-500 font-mono mt-2">
                        <span className="flex items-center gap-1"><Database size={14}/> ID: {selectedItem.sku}</span>
                        <span className="w-px h-4 bg-slate-300"></span>
                        <span className="flex items-center gap-1">Barcode: {selectedItem.barcode || '-'}</span>
                      </div>
                    </div>
                    <div className="text-right bg-slate-50 p-4 rounded-xl border border-slate-100 min-w-[140px]">
                      <div className="text-xs text-slate-400 mb-1">ราคาขายปกติ</div>
                      <div className="text-4xl font-bold text-boots-base tracking-tight">฿{selectedItem.SellPrice?.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-400 mt-1">Vat ({selectedItem.VatRate}%)</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                    <DetailItem label="Department" value={selectedItem.DeptCode} sub={selectedItem.DeptDesc} />
                    <DetailItem label="Group" value={selectedItem.GroupCode} sub={selectedItem.GroupDesc} />
                    <DetailItem label="Sub Group" value={selectedItem.SubGroupCode} />
                    <DetailItem label="Supplier" value={selectedItem.SupplierCode} sub={selectedItem.SupplierName} />
                  </div>
                </div>

                {/* 2. PRINT ON DEPT (FILE 2) - FULL FIELDS */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-blue-50/30 flex items-center gap-2">
                    <FileText size={18} className="text-blue-500" />
                    <h3 className="font-bold text-slate-800">ข้อมูล Print On Dept (ครบทุกฟิลด์)</h3>
                  </div>
                  <div className="p-6">
                    {/* Description Print */}
                    <div className="mb-4 pb-4 border-b border-slate-50">
                      <DetailItem label="Description (Print)" value={selectedItem.description_print} fullWidth />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4">
                      <DetailItem label="Dept" value={selectedItem.dept} />
                      <DetailItem label="Class" value={selectedItem.class} />
                      <DetailItem label="Brand" value={selectedItem.brand_print} />
                      <DetailItem label="Merchandise" value={selectedItem.merchandise} />

                      <DetailItem label="Reg Price" value={selectedItem.regPrice_print} />
                      <DetailItem label="Unit Price" value={selectedItem.unitPrice_print} />
                      <DetailItem label="Tax Code" value={selectedItem.tax_print} />
                      <DetailItem label="Method" value={selectedItem.method_print} />

                      <div className="col-span-2 bg-yellow-50 p-3 rounded-lg border border-yellow-100 flex justify-between items-center">
                        <DetailItem label="Deal Price" value={selectedItem.dealPrice_print} highlight />
                        <DetailItem label="Deal Qty" value={selectedItem.dealQty_print} highlight />
                        <DetailItem label="Limit" value={selectedItem.limit_print} />
                      </div>
                      <DetailItem label="MPG" value={selectedItem.mpg_print} />
                    </div>
                  </div>
                </div>

                {/* 3. MAINTENANCE EVENT (FILE 3) - FULL FIELDS */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-orange-50/30 flex items-center gap-2">
                    <Layers size={18} className="text-orange-500" />
                    <h3 className="font-bold text-slate-800">ข้อมูล Maintenance Event (ครบทุกฟิลด์)</h3>
                  </div>
                  <div className="p-6">
                    {/* Description Maint */}
                    <div className="mb-4 pb-4 border-b border-slate-50">
                      <DetailItem label="Description (Maint)" value={selectedItem.description_maint} fullWidth />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4">
                      <DetailItem label="Event Type" value={selectedItem.type_maint} />
                      <DetailItem label="Dept" value={selectedItem.dept_maint} />
                      <DetailItem label="Class" value={selectedItem.class_maint} />
                      <DetailItem label="MP Group" value={selectedItem.mpGroup_maint} />

                      <DetailItem label="Reg Price" value={selectedItem.regPrice_maint} />
                      <DetailItem label="Unit Price" value={selectedItem.unitPrice_maint} />
                      <DetailItem label="Method" value={selectedItem.method_maint} />
                      <div className="hidden md:block"></div>

                      <div className="col-span-2 bg-orange-50 p-3 rounded-lg border border-orange-100 flex justify-between items-center">
                        <DetailItem label="Deal Price" value={selectedItem.dealPrice_maint} highlight />
                        <DetailItem label="Deal Qty" value={selectedItem.dealQty_maint} highlight />
                        <DetailItem label="Limit Qty" value={selectedItem.limitQty_maint} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Search size={40} className="text-slate-300" /></div>
              <p className="text-lg font-medium text-slate-500">เลือกสินค้าจากรายการทางซ้าย</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, sub, highlight, fullWidth }) {
  return (
    <div className={cn('min-w-0', fullWidth && 'w-full')}>
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">{label}</div>
      <div className={cn('text-sm font-bold truncate', highlight ? 'text-orange-600' : 'text-slate-800')}>{value || '-'}</div>
      {sub && <div className="text-xs text-slate-400 truncate">{sub}</div>}
    </div>
  );
}
