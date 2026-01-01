import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Search, ScanBarcode, Trash2, Loader2, Tag, Package, Percent, Ticket, Gift, CheckCircle } from 'lucide-react';
import { cn } from '../utils/cn';
import { useCart } from '../hooks/useCart';
import { useScanListener } from '../hooks/useScanListener';
import ReceiptModal from './ReceiptModal';
import ProductLookupModal from './ProductLookupModal';
import DailyReportModal from './DailyReportModal';
import PosUploadModal from "./PosUploadModal"; 
import { posService } from '../services/posService';
import { useTheme } from '../context/ThemeContext';

export default function PosUI({ isDarkMode: externalDarkMode }) {
  const theme = useTheme();
  const { 
    cartItems, addToCart: originalAddToCart, decreaseItem, removeFromCart, clearCart, 
    summary, lastScanned, isLoading,
    setManualItemDiscount, updateBillDiscount, billDiscount,
    addCoupon, coupons, allowance, topup
  } = useCart();

  const [lastOrder, setLastOrder] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isVoidMode, setIsVoidMode] = useState(false);
  const [nextQty, setNextQty] = useState(1);
  
  // Theme State
  const isDarkMode = externalDarkMode ?? theme?.isDark ?? false;

  // Modal States
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // --- Search UX Enhancements (Arrow select + Enter pick + Search Hits) ---
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [searchHits, setSearchHits] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pos_search_hits") || "{}"); }
    catch { return {}; }
  });

  const bumpSearchHit = (sku) => {
    try {
      const key = (sku || "").toString();
      if (!key) return;
      const next = { ...(searchHits || {}) };
      next[key] = (next[key] || 0) + 1;
      setSearchHits(next);
      localStorage.setItem("pos_search_hits", JSON.stringify(next));
    } catch {}
  };

  const handleInputKeyDownWrapper = async (e) => {
    if (showDropdown && suggestions.length > 0 && !isVoidMode && !showDiscountModal) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedSuggestionIndex(i => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelectedSuggestionIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter") {
        e.preventDefault();
        const sel = suggestions[selectedSuggestionIndex];
        if (sel?.sku) { bumpSearchHit(sel.sku); await handleSelectSuggestion(sel.sku); }
        return;
      }
    }
    handleInputKeyDown(e);
  };
  const [showProductLookup, setShowProductLookup] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Discount Modal Inner State
  const [activeTab, setActiveTab] = useState('discount'); 
  const [discountSubTab, setDiscountSubTab] = useState('bill'); 
  const [discountCheckedItems, setDiscountCheckedItems] = useState(new Set());
  
  // Coupon Input State
  const [couponInput, setCouponInput] = useState({ type: '', value: '', code: '' });
  const [showCouponInput, setShowCouponInput] = useState(false); 

  const iconButtonStyle = cn(
  "p-2.5 rounded-xl transition-all shadow-sm border flex items-center justify-center relative",
  isDarkMode 
    ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" 
    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50" 
  );

  const lastItemDetail = lastScanned ? cartItems.find(i => (i.sku === lastScanned || i.id === lastScanned)) : null;
  const totalDiscountDisplay = Math.abs(summary.discount + summary.billDiscountAmount + summary.couponTotal + summary.allowance);

  // --- Handlers ---
  const toggleDiscountCheck = (id) => {
    setDiscountCheckedItems(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  };

  const handleScanAction = async (skuOrItem) => {
    if (showCouponInput) {
        setCouponInput(prev => ({ ...prev, code: typeof skuOrItem === 'string' ? skuOrItem : skuOrItem.sku }));
        return;
    }
    const quantityToApply = nextQty;
    
    if (isVoidMode) {
       const sku = typeof skuOrItem === 'string' ? skuOrItem : (skuOrItem.sku || skuOrItem.id);
       decreaseItem(sku); 
       setShowDropdown(false);
       setInputValue('');
       if (nextQty !== 1) setNextQty(1);
       return;
    }
    
    if (typeof skuOrItem === 'string') {
        try {
          const item = await posService.scanItem(skuOrItem);
          await originalAddToCart(item, quantityToApply);
        } catch (e) { console.error(e); }
    } else {
        await originalAddToCart(skuOrItem, quantityToApply);
    }
    
    if (nextQty !== 1) setNextQty(1);
    setShowDropdown(false);
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    const orderData = { 
        items: [...cartItems], 
        summary: summary, 
        cashier: 'Staff #01', 
        device: 'POS-Web',
        adjustments: { billDiscount, coupons, allowance, topup }
    };
    setIsSaving(true);
    try {
      const orderId = await posService.createOrder(orderData);
      setLastOrder({ ...orderData, id: orderId, timestamp: new Date().toISOString() });
      clearCart();
    } catch (err) { alert('Error: ' + err.message); } 
    finally { setIsSaving(false); }
  };

  const { inputRef, inputValue, setInputValue, handleInputKeyDown, handleInputChange } = useScanListener(handleScanAction, !lastOrder ? handleCheckout : undefined);

  const onInputChangeWrapper = (e) => {
    const val = e.target.value;
    if (val.endsWith('*')) {
      const numberPart = val.slice(0, -1);
      if (/^\d+$/.test(numberPart)) {
        const qty = parseInt(numberPart, 10);
        if (qty > 0) { setNextQty(qty); setInputValue(''); } 
        else { alert('จำนวนต้องมากกว่า 0'); setInputValue(''); }
      } else { setInputValue(''); }
      return; 
    }
    handleInputChange(e);
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (inputValue.length >= 2 && !isVoidMode && !showDiscountModal) { 
        const results = await posService.searchProducts(inputValue);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } else { setSuggestions([]); setShowDropdown(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, isVoidMode, showDiscountModal]);

  const handleSelectSuggestion = (sku) => {
    posService.scanItem(sku).then(item => { handleScanAction(item); });
  };

  const handleSaveCoupon = () => {
      if (!couponInput.value && couponInput.type !== 'boots') return;
      let finalValue = parseFloat(couponInput.value) || 0;
      let finalCode = couponInput.code;
      if (couponInput.type === 'boots') {
          if (finalValue === 0) {
             const numbers = finalCode.match(/\d+/);
             finalValue = numbers ? parseInt(numbers[0]) : 50; 
          }
      }
      addCoupon({ couponType: couponInput.type, couponValue: finalValue, couponCode: finalCode });
      setShowCouponInput(false);
  };

  return (
    <div className={cn(
         "h-full min-h-0 w-full font-['Noto_Sans_Thai'] flex overflow-hidden relative transition-colors duration-300",
         isDarkMode ? "bg-slate-950 text-slate-100" : "bg-[#F3F5F9] text-slate-900"
    )} onClick={() => setShowDropdown(false)}>

      {/* --- LEFT SIDE: SCANNER & FOOTAGE --- */}
      <div className="w-[35%] max-w-[450px] flex flex-col p-4 gap-4">
        
        {/* 1. SCAN PRODUCT BOX */}
        <div className={cn("p-5 rounded-2xl shadow-sm border relative transition-colors", 
             isVoidMode 
                ? "border-red-500 bg-red-50" 
                : (isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-white")
        )}>
            <div className="flex justify-between items-center mb-4">
               <div className="flex items-center gap-2 text-slate-500">
                  <ScanBarcode size={20} />
                  <span className="text-xs font-bold tracking-widest uppercase">Scan Product</span>
               </div>
               {isVoidMode && <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded">VOID MODE</span>}
               
               <button 
                  onClick={() => { setIsVoidMode(!isVoidMode); inputRef.current?.focus(); }}
                  className={cn("text-[10px] font-bold px-2 py-1 rounded border transition-all leading-normal", 
                     isVoidMode ? "bg-white text-red-500 border-red-200" : "bg-slate-100 text-slate-500"
                  )}
               >
                  {isVoidMode ? 'CANCEL' : 'VOID ITEM'}
               </button>
            </div>
            
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                ref={inputRef}
                value={inputValue}
                onChange={onInputChangeWrapper}
                onKeyDown={handleInputKeyDownWrapper}
                disabled={isLoading || lastOrder || isSaving || showDiscountModal}
                type="text" 
                placeholder={isVoidMode ? "สแกนเพื่อลบ..." : "สแกนบาร์โค้ด หรือใส่จำนวน (เช่น 5*)"}
                autoComplete="off"
                className={cn("w-full pl-12 pr-4 py-3.5 rounded-xl border-2 outline-none transition-all text-lg font-bold placeholder:font-normal placeholder:text-base leading-normal", 
                  isVoidMode 
                    ? "border-red-300 text-red-600 bg-white" 
                    : (isDarkMode ? "bg-slate-950 border-slate-700 text-white focus:border-blue-500" : "border-slate-200 text-slate-800 focus:border-[#0B2A97] bg-white")
                )}
              />
              {/* Qty Indicator */}
              {nextQty > 1 && (
                    <div className="absolute top-1/2 -translate-y-1/2 right-3 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-md animate-in zoom-in">
                       x{nextQty}
                    </div>
              )}
            </div>

            {/* Hint */}
            <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400 leading-normal">
               <span className="bg-yellow-100 text-yellow-700 px-1 rounded">Tip:</span> พิมพ์ 5* เพื่อสแกน 5 ชิ้น
            </div>
            
            {/* Search Dropdown */}
            {showDropdown && !isVoidMode && (
                  <div className={cn("absolute top-full left-0 right-0 mt-2 rounded-xl shadow-xl border overflow-hidden z-50 max-h-[300px] overflow-y-auto", isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200")}>
                    {suggestions.map((item) => (
                      <div key={item.sku} onClick={() => handleSelectSuggestion(item.sku)} className={cn("p-3 border-b cursor-pointer flex justify-between items-center hover:bg-blue-50 dark:hover:bg-slate-700", isDarkMode ? "border-slate-700" : "border-slate-50")}>
                        <div><div className="font-bold leading-normal">{item.name}</div><div className="text-xs text-slate-400">SKU: {item.sku}</div></div>
                        <div className="text-blue-600 font-bold">{item.price}</div>
                      </div>
                    ))}
                  </div>
            )}
        </div>

        {/* 2. LAST SCANNED */}
        <div className={cn(
            "h-[280px] rounded-2xl shadow-sm border relative overflow-hidden flex flex-col items-center justify-center p-6 transition-colors",
            isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-white"
        )}>
            <div className="absolute top-4 left-4 flex items-center gap-2 text-slate-400">
               <Package size={16} />
               <span className="text-[10px] font-bold tracking-widest uppercase">Last Scanned</span>
            </div>

            {lastItemDetail ? (
               <div className="text-center w-full animate-in slide-in-from-bottom-4 fade-in duration-300">
                  <div className="mb-4 relative inline-block">
                     <div className={cn("w-24 h-24 rounded-2xl flex items-center justify-center shadow-lg mx-auto", 
                        isVoidMode ? "bg-red-100 text-red-500" : "bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600"
                     )}>
                        <Package size={48} strokeWidth={1.5} />
                     </div>
                     <div className="absolute -bottom-2 -right-2 bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-md">
                        x{lastItemDetail.qty}
                     </div>
                  </div>
                  
                  <h3 className={cn("text-lg font-bold leading-normal mb-2 line-clamp-2 px-4 min-h-[3.5rem] flex items-center justify-center", isDarkMode ? "text-white" : "text-slate-800")}>
                     {lastItemDetail.name}
                  </h3>
                  
                  <div className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
                     {((lastItemDetail.calculatedTotal !== undefined ? lastItemDetail.calculatedTotal : (lastItemDetail.price * lastItemDetail.qty))).toLocaleString()}
                  </div>
                  <div className="text-sm text-slate-400 mt-1">
                     {lastItemDetail.sku}
                  </div>
               </div>
            ) : (
               <div className="flex flex-col items-center justify-center opacity-30">
                  <ScanBarcode size={64} className="mb-4" />
                  <span className="text-sm font-bold leading-normal">พร้อมใช้งาน</span>
               </div>
            )}
            
            <div className="absolute bottom-4 left-4 right-4">
               <div className="grid grid-cols-1 gap-2">
                 <button
                   onClick={() => setShowProductLookup(true)}
                   className={cn(
                     "w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors leading-normal",
                     isDarkMode ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-[#F3F5F9] text-slate-600 hover:bg-slate-200"
                   )}
                 >
                   <Search size={16} /> ค้นหาสินค้า
                 </button>
               </div>
           </div>
        </div>
      </div>

      {/* --- RIGHT SIDE --- */}
      <div className={cn("flex-1 flex flex-col m-4 ml-0 rounded-3xl overflow-hidden shadow-xl border relative",
          isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-white shadow-slate-200"
      )}>
         
         {/* CART HEADER */}
         <div className={cn(
             "grid grid-cols-12 px-6 py-4 text-[13px] font-extrabold tracking-wider border-b",
             isDarkMode ? "border-slate-800 text-slate-400 bg-slate-900" : "border-slate-100 text-slate-500 bg-white"
         )}>
             <div className="col-span-1">No.</div>
             <div className="col-span-4 leading-normal">สินค้า</div>
             <div className="col-span-2 text-right leading-normal">ราคา/หน่วย</div>
             <div className="col-span-1 text-center leading-normal">จำนวน</div>
             <div className="col-span-2 text-center leading-normal">ส่วนลด</div>
             <div className="col-span-2 text-right leading-normal">รวม</div>
         </div>

         {/* CART LIST */}
         <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-hide">
            {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 pb-10">
                   <ShoppingCart size={48} className="mb-4 opacity-20" />
                   <p className="font-medium leading-normal">ตะกร้าว่างเปล่า</p>
                </div>
            ) : (
                cartItems.map((item, index) => {
                    const lineTotal = item.calculatedTotal !== undefined ? item.calculatedTotal : (item.price * item.qty); 
                    const normalPrice = item.normalPrice || item.price;
                    const discountVal = (normalPrice - item.price) * item.qty;

                    return (
                       <div key={item.id || item.sku} className={cn("grid grid-cols-12 px-2 py-4 border-b items-center text-sm group hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors", isDarkMode ? "border-slate-800 text-slate-200" : "border-slate-50 text-slate-700")}>
                          <div className="col-span-1 text-slate-400 text-xs">{cartItems.length - index}</div>
                          
                          <div className="col-span-4 pr-2">
                             <div className="font-bold truncate text-base leading-normal">{item.name}</div>
                             <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-slate-400 font-mono">{item.sku}</span>
                                {item.badgeText && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded font-bold leading-normal">{item.badgeText}</span>}
                             </div>
                          </div>
                          
                          <div className="col-span-2 text-right font-medium text-slate-500">
                             {item.price.toLocaleString()}
                          </div>
                          
                          <div className="col-span-1 flex justify-center">
                             <div className="w-8 h-8 rounded-lg border flex items-center justify-center bg-white dark:bg-slate-700 dark:border-slate-600 text-xs font-bold shadow-sm">
                                {item.qty}
                             </div>
                          </div>
                          
                          <div className="col-span-2 text-center">
                              {discountVal > 0 ? (
                                  <span className="text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded text-xs font-bold">
                                      -{discountVal.toLocaleString()}
                                  </span>
                              ) : (
                                  <span className="text-slate-300">-</span>
                              )}
                          </div>

                          <div className="col-span-2 text-right font-bold text-lg relative group">
                             {lineTotal.toLocaleString()}
                             <button 
                                onClick={() => removeFromCart(item.id || item.sku)}
                                className="absolute right-full mr-2 top-1/2 -translate-y-1/2 p-2 bg-red-50 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white shadow-sm"
                             >
                                <Trash2 size={16} />
                             </button>
                          </div>
                       </div>
                    );
                })
            )}
         </div>

         {/* FOOTER */}
         <div className="bg-[#0B1221] text-white p-6 shrink-0 relative overflow-hidden">
             <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>

             <div className="flex justify-between items-end relative z-10">
                 <div className="flex flex-col gap-1">
                     <span className="text-slate-400 text-sm font-medium leading-normal">จำนวนชิ้นรวม</span>
                     <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold tracking-tight">{summary.totalItems}</span>
                        <span className="text-slate-500 text-lg">Items</span>
                     </div>
                     {totalDiscountDisplay > 0 && (
                        <div className="text-red-400 text-sm mt-1 animate-pulse leading-normal">
                           ประหยัดไป ฿{totalDiscountDisplay.toLocaleString()}
                        </div>
                     )}
                 </div>

                 <div className="flex flex-col items-end gap-4">
                     <div className="text-right">
                        <span className="text-slate-400 text-sm font-medium block mb-1 leading-normal">ยอดสุทธิ (Net Total)</span>
                        <span className="text-5xl font-bold tracking-tighter">
                           <span className="text-2xl align-top mr-1"></span>
                           {summary.netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                     </div>
                 </div>
             </div>

             <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between">
                 
                 <button 
                    onClick={() => setShowDiscountModal(true)}
                    className={cn(
                        "px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors leading-normal",
                        "bg-white/10 text-white hover:bg-white/20 border border-white/10"
                    )}
                 >
                    <Tag size={18} />
                    <span>ส่วนลด</span>
                    {totalDiscountDisplay > 0 && <span className="ml-1 w-2 h-2 bg-red-500 rounded-full"></span>}
                 </button>

                 <button 
                    onClick={handleCheckout} 
                    disabled={cartItems.length === 0 || isLoading || isSaving}
                    className="bg-[#1D4ED8] hover:bg-blue-600 text-white px-10 py-3 rounded-xl font-bold shadow-lg shadow-blue-900/50 flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed leading-normal"
                 >
                    {isSaving ? <Loader2 className="animate-spin" size={20}/> : <ShoppingCart size={20} />}
                    <span className="text-lg">ชำระเงิน (Checkout)</span>
                    <span className="bg-black/20 px-2 py-0.5 rounded text-xs ml-2">F12</span>
                 </button>
             </div>
         </div>
      </div>

      {/* --- MODALS (Simplified for display) --- */}
      {lastOrder && <ReceiptModal order={lastOrder} onClose={() => setLastOrder(null)} />}
      {showProductLookup && <ProductLookupModal onClose={() => setShowProductLookup(false)} />}
      {showReport && <DailyReportModal onClose={() => setShowReport(false)} />}
      <PosUploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        isDarkMode={isDarkMode}
        pricingReady={true} 
      />

      {showDiscountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
            <div className={cn("w-full max-w-4xl h-[80vh] rounded-3xl shadow-2xl flex overflow-hidden border transition-colors", isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                
                <div className={cn("w-64 p-6 border-r flex flex-col gap-3 transition-colors", isDarkMode ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200")}>
                    <h2 className={cn("text-2xl font-bold mb-6 flex items-center gap-3", isDarkMode ? "text-white" : "text-slate-800")}>
                        <span className={iconButtonStyle}><Tag size={20} /></span> <span className="leading-normal">ส่วนลด</span>
                    </h2>
                    
                    <button onClick={() => setActiveTab('discount')} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all leading-normal", activeTab === 'discount' ? "bg-blue-600 text-white shadow-md" : (isDarkMode ? "text-slate-400 hover:bg-slate-900" : "text-slate-500 hover:bg-slate-100"))}>
                        <Percent size={20}/> ส่วนลดทั่วไป
                    </button>
                    <button onClick={() => setActiveTab('coupon')} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all leading-normal", activeTab === 'coupon' ? "bg-blue-600 text-white shadow-md" : (isDarkMode ? "text-slate-400 hover:bg-slate-900" : "text-slate-500 hover:bg-slate-100"))}>
                        <Ticket size={20}/> คูปอง
                    </button>
                    <button onClick={() => setActiveTab('allowance')} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all leading-normal", activeTab === 'allowance' ? "bg-blue-600 text-white shadow-md" : (isDarkMode ? "text-slate-400 hover:bg-slate-900" : "text-slate-500 hover:bg-slate-100"))}>
                        <Gift size={20}/> Allowance
                    </button>
                    <div className="mt-auto">
                        <button onClick={() => setShowDiscountModal(false)} className={cn("w-full py-4 rounded-xl font-bold shadow-lg transition-colors text-lg leading-normal", isDarkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-800 text-white hover:bg-slate-700 shadow-slate-300")}>ปิดหน้าต่าง</button>
                    </div>
                </div>

                <div className={cn("flex-1 p-10 overflow-y-auto transition-colors", isDarkMode ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800")}>
                    {activeTab === 'discount' && (
                        <div>
                            <div className={cn("flex gap-4 mb-8 border-b pb-6", isDarkMode ? "border-slate-800" : "border-slate-100")}>
                                <button onClick={() => setDiscountSubTab('bill')} className={cn("px-8 py-3 rounded-xl font-bold transition-all text-lg leading-normal", discountSubTab === 'bill' ? "bg-blue-600 text-white shadow-md" : (isDarkMode ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"))}>ลดทั้งบิล</button>
                                <button onClick={() => setDiscountSubTab('items')} className={cn("px-8 py-3 rounded-xl font-bold transition-all text-lg leading-normal", discountSubTab === 'items' ? "bg-blue-600 text-white shadow-md" : (isDarkMode ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"))}>ลดรายสินค้า</button>
                            </div>

                            {discountSubTab === 'bill' && (
                                <div className="max-w-md">
                                    <label className={cn("block text-lg font-bold mb-3 leading-normal", isDarkMode ? "text-slate-300" : "text-slate-700")}>ส่วนลดทั้งบิล (%)</label>
                                    <div className="flex gap-4 items-center">
                                        <input 
                                            type="number" 
                                            value={billDiscount.percent} 
                                            onChange={(e) => updateBillDiscount(e.target.value)}
                                            className={cn("w-full border-2 rounded-2xl px-6 py-4 text-3xl font-bold focus:border-blue-600 outline-none transition-colors", isDarkMode ? "bg-slate-950 border-slate-700 text-white placeholder:text-slate-600" : "border-slate-200 bg-slate-50 focus:bg-white")}
                                            placeholder="0"
                                        />
                                        <div className="flex items-center text-slate-400 font-bold text-3xl">%</div>
                                    </div>
                                </div>
                            )}

                            {discountSubTab === 'items' && (
                                <div>
                                    <h3 className={cn("font-bold mb-4 text-lg leading-normal", isDarkMode ? "text-slate-400" : "text-slate-500")}>เลือกสินค้าที่ต้องการลดราคา</h3>
                                    <div className="space-y-3">
                                        {cartItems.map((item, idx) => {
                                            const isChecked = discountCheckedItems.has(item.id || item.sku);
                                            return (
                                                <div key={idx} 
                                                     onClick={() => toggleDiscountCheck(item.id || item.sku)}
                                                     className={cn("flex items-center gap-6 p-4 rounded-2xl border-2 cursor-pointer transition-all", isChecked ? "border-blue-600 bg-blue-50/10" : (isDarkMode ? "border-slate-800 bg-slate-950 hover:border-slate-700" : "border-slate-100 bg-white hover:border-slate-300"))}
                                                >
                                                    <div className={cn("w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-colors", isChecked ? "bg-blue-600 border-blue-600 text-white" : (isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-white"))}>
                                                        {isChecked && <CheckCircle size={20} />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className={cn("font-bold text-lg leading-normal", isDarkMode ? "text-white" : "text-slate-800")}>{item.name}</div>
                                                        <div className="text-sm text-slate-400 font-mono">{item.sku}</div>
                                                    </div>
                                                    <div className={cn("font-bold text-xl", isDarkMode ? "text-slate-300" : "text-slate-600")}>{(item.price * item.qty).toLocaleString()}</div>
                                                    
                                                    {isChecked && (
                                                        <div className="flex items-center gap-2 animate-in zoom-in">
                                                            <input 
                                                                type="number" autoFocus
                                                                onClick={(e) => e.stopPropagation()}
                                                                value={item.manualDiscountPercent || ''}
                                                                onChange={(e) => setManualItemDiscount(item.id || item.sku, e.target.value)}
                                                                className="w-20 border-2 border-orange-300 rounded-lg px-2 py-1 text-center font-bold text-lg focus:border-orange-500 outline-none bg-orange-50 text-slate-900"
                                                                placeholder="%"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {cartItems.length === 0 && <p className="text-slate-400 text-center py-8 text-xl leading-normal">ไม่มีสินค้าในตะกร้า</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {/* Coupon Input */}
            {showCouponInput && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50">
                    <div className={cn("p-8 w-[450px] animate-in zoom-in-95 rounded-2xl shadow-2xl", isDarkMode ? "bg-slate-900 text-white" : "bg-white text-slate-800")}>
                        <h3 className="text-xl font-bold mb-4 leading-normal">Add Coupon ({couponInput.type})</h3>
                        <input className="w-full border p-2 rounded mb-2 text-black" placeholder="Code" value={couponInput.code} onChange={e=>setCouponInput({...couponInput, code:e.target.value})} />
                        {couponInput.type !== 'boots' && <input className="w-full border p-2 rounded mb-4 text-black" type="number" placeholder="Value" value={couponInput.value} onChange={e=>setCouponInput({...couponInput, value:e.target.value})} />}
                        <div className="flex gap-2">
                             <button onClick={()=>setShowCouponInput(false)} className="flex-1 p-2 bg-gray-200 rounded text-black">Cancel</button>
                             <button onClick={handleSaveCoupon} className="flex-1 p-2 bg-blue-600 text-white rounded">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
}
