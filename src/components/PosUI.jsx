import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Search, ScanBarcode, Trash2, Loader2, AlertCircle, X, Tag, Package, MinusCircle, FileText, Hash, Percent, Ticket, Gift, CheckCircle } from 'lucide-react';
import { cn } from '../utils/cn';
import { useCart } from '../hooks/useCart';
import { useScanListener } from '../hooks/useScanListener';
import ReceiptModal from './ReceiptModal';
import ProductLookupModal from './ProductLookupModal';
import DailyReportModal from './DailyReportModal';
import { posService } from '../services/posService';
import { useTheme } from '../context/ThemeContext';
import PosUploadModal from "./PosUploadModal";

// รับ props isDarkMode จากข้างนอก (ถ้ามี)
export default function PosUI({ isDarkMode: externalDarkMode }) {
  const theme = useTheme();
  const { 
    cartItems, addToCart: originalAddToCart, decreaseItem, removeFromCart, clearCart, 
    summary, lastScanned, isLoading, error,
    setManualItemDiscount, updateBillDiscount, billDiscount,
    addCoupon, removeCoupon, coupons,
    updateAllowance, allowance,
    topup
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

  // --- Styles Helper ---
  const headerIconStyle = cn(
    "p-2 rounded-lg transition-all shadow-sm border",
    isDarkMode 
      ? "bg-white border-white text-slate-900 shadow-[0_0_12px_rgba(255,255,255,0.3)]" 
      : "bg-white border-slate-200 text-slate-600" 
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
      try {
        const results = await posService.searchProducts(inputValue);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } catch (e) {
        console.error(e);
        setSuggestions([]);
        setShowDropdown(false);
      }
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }, 300);

  return () => clearTimeout(timer);
}, [inputValue, isVoidMode, showDiscountModal]);

  const handleSelectSuggestion = (sku) => {
    posService.scanItem(sku).then(item => { handleScanAction(item); });
  };

  const openCouponInput = (type) => {
      setCouponInput({ type, value: '', code: '' });
      setShowCouponInput(true);
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
         "min-h-0 h-full w-full font-['Noto_Sans_Thai'] flex flex-col overflow-hidden relative transition-colors duration-300",
         isDarkMode ? "bg-slate-950 text-slate-100 selection:bg-blue-900" : "bg-slate-50 text-slate-900 selection:bg-blue-100"
    )} onClick={() => setShowDropdown(false)}>

      {/* --- Main Content Area --- */}
      <div className="flex-1 flex gap-4 overflow-hidden p-3 pb-0 pt-4 min-h-0 items-start">
          
          {/* LEFT SIDE (Scanner & Monitor) */}
          <div className="w-[35%] flex flex-col gap-3 h-full min-h-0 self-start">
            
            {/* 1. Scanner Input Card */}
            <div className={cn("p-4 rounded-2xl shadow-sm border relative transition-colors shrink-0", 
                isVoidMode 
                    ? "border-red-500 bg-red-50" 
                    : (isDarkMode ? "bg-slate-900 border-slate-800 shadow-slate-900/10" : "bg-white border-slate-200")
            )}>
               <div className="flex justify-between items-center mb-3">
                 <div className="flex items-center gap-2">
                     {/* ใช้ headerIconStyle: พื้นขาวใน Dark Mode */}
                     <div className={cn(headerIconStyle, isVoidMode && "bg-red-100 text-red-500 border-red-200 shadow-none")}>
                        {isVoidMode ? <MinusCircle size={18}/> : <ScanBarcode size={18}/>}
                     </div>
                     <h2 className={cn("text-sm font-bold uppercase tracking-wider", isVoidMode ? "text-red-600" : (isDarkMode ? "text-slate-400" : "text-slate-600"))}>
                       {isVoidMode ? 'VOID MODE' : 'SCANNER'}
                     </h2>
                 </div>
                 
                 <button 
                   onClick={() => { setIsVoidMode(!isVoidMode); inputRef.current?.focus(); }}
                   className={cn("text-xs font-bold px-3 py-1.5 rounded-lg border transition-all shadow-sm", 
                      isVoidMode ? "bg-red-500 text-white border-red-500" : (isDarkMode ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50")
                   )}
                 >
                   {isVoidMode ? 'EXIT VOID' : 'VOID ITEM'}
                 </button>
               </div>
               
               <div className="relative">
                <input 
                  ref={inputRef}
                  value={inputValue}
                  onChange={onInputChangeWrapper}
                  onKeyDown={handleInputKeyDown}
                  disabled={isLoading || lastOrder || isSaving || showDiscountModal}
                  type="text" 
                  placeholder={isVoidMode ? "สแกนเพื่อลบ..." : "สแกนบาร์โค้ด..."}
                  autoComplete="off"
                  className={cn("w-full pl-4 pr-4 py-3 rounded-xl border-2 outline-none transition-all shadow-inner text-xl font-bold placeholder:font-normal placeholder:text-base", 
                      isVoidMode 
                        ? "border-red-300 text-red-600 bg-white" 
                        : (isDarkMode ? "bg-slate-950 border-slate-700 text-white focus:border-boots-base placeholder:text-slate-600" : "border-slate-200 text-slate-800 focus:border-boots-base bg-slate-50 focus:bg-white")
                  )}
                />
                
                {nextQty > 1 && (
                   <div className="absolute -top-2 right-0 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 animate-in zoom-in">
                      <Hash size={10} /> {'Qty: ' + nextQty}
                   </div>
                )}
                
                {showDropdown && !isVoidMode && (
                  <div className={cn("absolute top-full left-0 right-0 mt-2 rounded-xl shadow-xl border overflow-hidden z-50 max-h-[300px] overflow-y-auto", isDarkMode ? "bg-slate-800 border-slate-700 shadow-slate-950/50" : "bg-white border-slate-200")}>
                    {suggestions.map((item) => (
                      <div key={item.sku} onClick={() => handleSelectSuggestion(item.sku)} className={cn("p-3 border-b cursor-pointer flex justify-between items-center", isDarkMode ? "border-slate-700 hover:bg-slate-700" : "border-slate-50 hover:bg-blue-50")}>
                        <div><div className={cn("font-bold", isDarkMode ? "text-white" : "text-slate-800")}>{item.name}</div><div className="text-xs text-slate-400">{'SKU: ' + item.sku}</div></div><div className="text-boots-base font-bold">{'฿' + item.price.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
               </div>
               {error && (<div className="mt-2 bg-red-50 text-red-600 px-3 py-2 rounded-lg border border-red-100 flex items-center gap-2"><AlertCircle size={16} /><span className="text-xs font-medium">{error}</span></div>)}
            </div>

            {/* 2. Monitor Card (Last Scanned) */}
            <div className={cn("flex-1 p-4 flex flex-col relative overflow-hidden transition-colors rounded-2xl border shadow-sm", 
                isVoidMode 
                    ? "border-red-200 bg-red-50/50" 
                    : (isDarkMode ? "bg-slate-900 border-slate-800 shadow-slate-900/10" : "bg-white border-slate-200")
            )}>
               <div className="flex items-center gap-2 mb-2 z-10">
                     {/* Icon Header: พื้นขาวใน Dark Mode */}
                     <div className={cn(headerIconStyle, !isDarkMode && "text-amber-600 bg-amber-50 border-amber-100")}>
                        {/* Inventory icon */}
                        <Package size={18} className={isDarkMode ? "text-slate-900" : ""} />
                     </div>
                    <h2 className={cn("text-sm font-bold uppercase tracking-wider", isDarkMode ? "text-slate-400" : "text-slate-500")}>Inventory Monitor</h2>
               </div>

               {lastItemDetail ? (
                 <div className="flex-1 flex flex-col items-center justify-center animate-in slide-in-from-right-4 duration-300 text-center relative z-10">
                    <div className={cn("w-36 h-36 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg border-4", 
                        isVoidMode 
                            ? "bg-red-500 border-white text-white" 
                            : "bg-gradient-to-br from-amber-200 to-amber-500 border-white text-amber-900"
                    )}>
                       {isVoidMode ? <MinusCircle size={64}/> : <Package size={72} strokeWidth={1.5} className="drop-shadow-md text-white/90" />}
                    </div>
                    
                    <h3 className={cn("text-2xl font-bold leading-tight mb-2 line-clamp-2 px-2 min-h-[4rem] flex items-center justify-center", isDarkMode ? "text-white" : "text-slate-800")}>{lastItemDetail.name}</h3>
                    
                    <div className={cn("text-sm font-mono mb-6 px-3 py-1 rounded-full border", isDarkMode ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-500")}>{lastItemDetail.sku}</div>
                    
                    {isVoidMode ? (
                      <div className="text-red-600 font-bold text-3xl animate-pulse bg-red-100 px-6 py-2 rounded-xl border border-red-200">REMOVED -1</div>
                    ) : (
                      <div className={cn("flex flex-col items-center w-full rounded-xl py-3 border", isDarkMode ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100")}>
                        <div className="text-sm text-slate-400 font-medium mb-1">ราคาต่อหน่วย</div>
                        <div className={cn("text-5xl font-bold tracking-tighter drop-shadow-sm", isDarkMode ? "text-white" : "text-slate-800")}>
                            {'฿' + ((lastItemDetail.calculatedTotal !== undefined ? lastItemDetail.calculatedTotal : (lastItemDetail.price * lastItemDetail.qty)) / lastItemDetail.qty).toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:2})}
                        </div>
                      </div>
                    )}
                 </div>
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                     <div className={cn("w-32 h-32 rounded-full flex items-center justify-center mb-4 border-2 border-dashed", isDarkMode ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200")}>
                        <Package size={60} className={cn("opacity-40", isDarkMode ? "text-slate-600" : "text-slate-400")} />
                     </div>
                     <p className="text-xl font-medium text-slate-400">Ready to Scan</p>
                 </div>
               )}
               
               <div className={cn("absolute bottom-0 right-0 pointer-events-none transition-opacity", isDarkMode ? "opacity-[0.02] text-white" : "opacity-5 text-slate-900")}>
                   <Package size={200} />
               </div>

               <div className="mt-auto pt-4 z-10">
                  <button onClick={() => setShowProductLookup(true)} className={cn("w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-base transition-colors border shadow-sm", 
                      isDarkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700" : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
                  )}><Search size={20} /> ค้นหาสินค้า (Lookup)</button>
               </div>
            </div>
          </div>

          {/* RIGHT SIDE (Cart) */}
          <div className={cn("w-[65%] flex flex-col rounded-t-2xl shadow-xl border overflow-hidden relative h-full min-h-0 self-start", 
              isDarkMode ? "bg-slate-900 border-slate-800 shadow-slate-950/50" : "bg-white border-slate-200 shadow-slate-200/50"
          )}>
            
            {/* Table Head */}
            <div className={cn("grid grid-cols-12 gap-2 px-4 py-4 border-b text-base font-bold shadow-sm z-20 shrink-0", 
                isDarkMode ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700"
            )}>
               <div className="col-span-1 text-center">#</div>
               <div className="col-span-4 pl-2">รายการสินค้า</div>
               <div className="col-span-2 text-right">ราคา</div>
               <div className="col-span-2 text-center">จำนวน</div>
               <div className="col-span-1 text-right text-red-500">ลด</div>
               <div className="col-span-2 text-right pr-4">รวม</div>
            </div>

            {/* Table Body - DYNAMIC SCROLL */}
            <div className={cn("flex-1 overflow-y-auto px-2 py-2 scrollbar-hide content-start", isDarkMode ? "bg-slate-900" : "bg-white")}>
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 pb-20">
                    <div className={cn("p-8 rounded-full mb-4 border", isDarkMode ? "bg-white border-white text-slate-900 shadow-[0_0_12px_rgba(255,255,255,0.25)]" : "bg-slate-50 border-slate-100")}>
                        <ShoppingCart size={64} className={cn("opacity-20", isDarkMode ? "text-slate-900" : "text-slate-500")} />
                    </div>
                    <p className="text-xl font-medium text-slate-400">ตะกร้าว่างเปล่า</p>
                    <p className="text-sm text-slate-500 mt-2">เริ่มสแกนสินค้าเพื่อเพิ่มรายการ</p>
                </div>
              ) : (
                cartItems.map((item, index) => {
                  const price = item.price || 0;
                  const qty = item.qty || 0;
                  const normalTotal = price * qty;
                  const lineTotal = item.calculatedTotal !== undefined ? item.calculatedTotal : normalTotal; 
                  const discountVal = normalTotal - lineTotal;
                  const isItemChecked = discountCheckedItems.has(item.id || item.sku);

                  return (
                  <div key={item.id || item.sku} className={cn("grid grid-cols-12 gap-2 p-3 border-b items-center transition-colors group relative rounded-lg mx-1", 
                      isDarkMode ? "border-slate-800 hover:bg-slate-800 text-slate-200" : "border-slate-50 hover:bg-blue-50 text-slate-800",
                      lastScanned === item.sku && (isDarkMode ? "bg-slate-800 border-slate-700" : "bg-blue-50 border-blue-100")
                  )}>
                      <div className="col-span-1 flex justify-center"><div className={cn("w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold shadow-sm", isDarkMode ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-500")}>{cartItems.length - index}</div></div>
                      
                      <div className="col-span-4 pl-2">
                         <div className="font-bold text-base line-clamp-1">{item.name}</div>
                         <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn("text-[11px] font-mono px-1.5 rounded border", isDarkMode ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-500")}>{item.sku}</span>
                            {item.badgeText && <span className="text-[10px] bg-blue-600 text-white px-1.5 rounded-sm font-bold shadow-sm">{item.badgeText}</span>}
                         </div>
                         {isItemChecked && (
                            <div className="mt-1 flex items-center gap-2 animate-in slide-in-from-left-2">
                                <input 
                                    type="number" autoFocus
                                    value={item.manualDiscountPercent || ''}
                                    onChange={(e) => setManualItemDiscount(item.id || item.sku, e.target.value)}
                                    className="w-16 border border-orange-300 rounded px-1 py-0.5 text-center font-bold text-xs focus:border-orange-500 outline-none bg-orange-50 text-slate-900"
                                    placeholder="%"
                                />
                            </div>
                         )}
                      </div>

                      <div className="col-span-2 text-right font-medium text-base">{'฿' + price.toLocaleString()}</div>

                      <div className="col-span-2 flex justify-center">
                         <div className={cn("border px-4 py-1 rounded-lg font-bold shadow-sm min-w-[3.5rem] text-center text-base", isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-800")}>
                            {qty}
                         </div>
                      </div>

                      <div className="col-span-1 text-right">
                         {discountVal > 0 ? <div className="text-xs font-bold text-red-500 bg-red-500/10 px-1 py-0.5 rounded inline-block">{'-' + discountVal.toLocaleString()}</div> : <div className="text-slate-400 text-xs">-</div>}
                      </div>

                      <div className="col-span-2 text-right relative pr-4"> 
                         <div className="text-lg font-bold">{'฿' + lineTotal.toLocaleString()}</div>
                         <button 
                            onClick={() => removeFromCart(item.id || item.sku)} 
                            className="absolute -right-2 top-1/2 -translate-y-1/2 p-2 bg-transparent border border-red-500/30 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white shadow-sm z-10"
                         >
                            <Trash2 size={16} />
                         </button>
                      </div>
                  </div>
                )})
              )}
            </div>

            {/* Footer Summary - FIXED BOTTOM */}
            <div className={cn("p-4 z-30 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] shrink-0", isDarkMode ? "bg-slate-950 text-white" : "bg-slate-900 text-white")}>
               <div className="flex justify-between items-center mb-4 px-2">
                    <div className="flex gap-8">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Items</span>
                            <span className="text-2xl font-bold text-white leading-none">{summary.totalItems}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subtotal</span>
                            <span className="text-2xl font-bold text-white leading-none">{summary.subtotal.toLocaleString()}</span>
                        </div>
                        {(totalDiscountDisplay > 0) && (
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Savings</span>
                                <span className="text-2xl font-bold text-red-500 leading-none">{'-' + totalDiscountDisplay.toLocaleString()}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-end">
                        <span className="text-[11px] font-bold text-blue-300 uppercase tracking-widest mb-1">Net Total Payment</span>
                        <div className="text-5xl font-bold text-white leading-none tracking-tight">{'฿' + summary.netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
               </div>
               
               <button onClick={handleCheckout} disabled={cartItems.length === 0 || isLoading || isSaving} className="w-full bg-boots-base hover:bg-blue-600 text-white h-16 rounded-2xl text-2xl font-bold flex items-center justify-center gap-4 shadow-lg shadow-boots-base/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99] border border-white/10">
                  {isSaving ? <Loader2 className="animate-spin w-6 h-6" /> : <ShoppingCart size={28} className="fill-white/20" />}
                  <span>ชำระเงิน (Checkout)</span>
               </button>
            </div>
          </div>
      </div>

      {/* Modals */}
      {lastOrder && <ReceiptModal order={lastOrder} onClose={() => setLastOrder(null)} />}
      {showProductLookup && <ProductLookupModal onClose={() => setShowProductLookup(false)} />}
      {showReport && <DailyReportModal onClose={() => setShowReport(false)} />}
      <PosUploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        isDarkMode={isDarkMode}
        pricingReady={true}
      />

      {/* --- Discount Menu Modal (ปรับ Logo พื้นขาวใน Dark Mode) --- */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
            <div className={cn("w-full max-w-4xl h-[80vh] rounded-3xl shadow-2xl flex overflow-hidden border transition-colors", isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                
                {/* Sidebar */}
                <div className={cn("w-64 p-6 border-r flex flex-col gap-3 transition-colors", isDarkMode ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200")}>
                    <h2 className={cn("text-2xl font-bold mb-6 flex items-center gap-3", isDarkMode ? "text-white" : "text-slate-800")}>
                        {/* ไอคอน Tag ใน Modal: พื้นขาวใน Dark Mode */}
                        <span className={headerIconStyle}><Tag size={20} /></span> ส่วนลด
                    </h2>
                    
                    <button onClick={() => setActiveTab('discount')} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all", activeTab === 'discount' ? (isDarkMode ? "bg-slate-800 text-boots-base shadow-sm" : "bg-white shadow-md text-boots-base ring-2 ring-boots-base border-transparent") : (isDarkMode ? "text-slate-400 hover:bg-slate-900" : "text-slate-500 hover:bg-slate-100"))}>
                        <Percent size={20}/> ส่วนลดทั่วไป
                    </button>
                    <button onClick={() => setActiveTab('coupon')} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all", activeTab === 'coupon' ? (isDarkMode ? "bg-slate-800 text-boots-base shadow-sm" : "bg-white shadow-md text-boots-base ring-2 ring-boots-base border-transparent") : (isDarkMode ? "text-slate-400 hover:bg-slate-900" : "text-slate-500 hover:bg-slate-100"))}>
                        <Ticket size={20}/> คูปอง
                    </button>
                    <button onClick={() => setActiveTab('allowance')} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all", activeTab === 'allowance' ? (isDarkMode ? "bg-slate-800 text-boots-base shadow-sm" : "bg-white shadow-md text-boots-base ring-2 ring-boots-base border-transparent") : (isDarkMode ? "text-slate-400 hover:bg-slate-900" : "text-slate-500 hover:bg-slate-100"))}>
                        <Gift size={20}/> Allowance
                    </button>
                    <div className="mt-auto">
                        <button onClick={() => setShowDiscountModal(false)} className={cn("w-full py-4 rounded-xl font-bold shadow-lg transition-colors text-lg", isDarkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-800 text-white hover:bg-slate-700 shadow-slate-300")}>ปิดหน้าต่าง</button>
                    </div>
                </div>

                {/* Content Area */}
                <div className={cn("flex-1 p-10 overflow-y-auto transition-colors", isDarkMode ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800")}>
                    {activeTab === 'discount' && (
                        <div>
                            <div className={cn("flex gap-4 mb-8 border-b pb-6", isDarkMode ? "border-slate-800" : "border-slate-100")}>
                                <button onClick={() => setDiscountSubTab('bill')} className={cn("px-8 py-3 rounded-xl font-bold transition-all text-lg", discountSubTab === 'bill' ? "bg-boots-base text-white shadow-md" : (isDarkMode ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"))}>ลดทั้งบิล</button>
                                <button onClick={() => setDiscountSubTab('items')} className={cn("px-8 py-3 rounded-xl font-bold transition-all text-lg", discountSubTab === 'items' ? "bg-boots-base text-white shadow-md" : (isDarkMode ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"))}>ลดรายสินค้า</button>
                            </div>

                            {discountSubTab === 'bill' && (
                                <div className="max-w-md">
                                    <label className={cn("block text-lg font-bold mb-3", isDarkMode ? "text-slate-300" : "text-slate-700")}>ส่วนลดทั้งบิล (%)</label>
                                    <div className="flex gap-4 items-center">
                                        <input 
                                            type="number" 
                                            value={billDiscount.percent} 
                                            onChange={(e) => updateBillDiscount(e.target.value)}
                                            className={cn("w-full border-2 rounded-2xl px-6 py-4 text-3xl font-bold focus:border-boots-base outline-none transition-colors", isDarkMode ? "bg-slate-950 border-slate-700 text-white placeholder:text-slate-600" : "border-slate-200 bg-slate-50 focus:bg-white")}
                                            placeholder="0"
                                        />
                                        <div className="flex items-center text-slate-400 font-bold text-3xl">%</div>
                                    </div>
                                </div>
                            )}

                            {discountSubTab === 'items' && (
                                <div>
                                    <h3 className={cn("font-bold mb-4 text-lg", isDarkMode ? "text-slate-400" : "text-slate-500")}>เลือกสินค้าที่ต้องการลดราคา</h3>
                                    <div className="space-y-3">
                                        {cartItems.map((item, idx) => {
                                            const isChecked = discountCheckedItems.has(item.id || item.sku);
                                            return (
                                                <div key={idx} 
                                                     onClick={() => toggleDiscountCheck(item.id || item.sku)}
                                                     className={cn("flex items-center gap-6 p-4 rounded-2xl border-2 cursor-pointer transition-all", isChecked ? "border-boots-base bg-blue-50/10" : (isDarkMode ? "border-slate-800 bg-slate-950 hover:border-slate-700" : "border-slate-100 bg-white hover:border-slate-300"))}
                                                >
                                                    <div className={cn("w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-colors", isChecked ? "bg-boots-base border-boots-base text-white" : (isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-white"))}>
                                                        {isChecked && <CheckCircle size={20} />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className={cn("font-bold text-lg", isDarkMode ? "text-white" : "text-slate-800")}>{item.name}</div>
                                                        <div className="text-sm text-slate-400 font-mono">{item.sku}</div>
                                                    </div>
                                                    <div className={cn("font-bold text-xl", isDarkMode ? "text-slate-300" : "text-slate-600")}>{'฿' + (item.price * item.qty).toLocaleString()}</div>
                                                </div>
                                            );
                                        })}
                                        {cartItems.length === 0 && <p className="text-slate-400 text-center py-8 text-xl">ไม่มีสินค้าในตะกร้า</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'coupon' && (
                        <div>
                            <h3 className={cn("text-3xl font-bold mb-8", isDarkMode ? "text-white" : "text-slate-800")}>เลือกประเภทคูปอง</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <button onClick={() => openCouponInput('store')} className="h-48 rounded-3xl flex flex-col items-center justify-center gap-4 text-white text-2xl font-bold bg-gradient-to-br from-sky-400 to-sky-500 shadow-xl hover:scale-105 transition-transform">
                                    <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm"><Ticket size={48} /></div> Store Coupon
                                </button>
                                <button onClick={() => openCouponInput('vendor')} className="h-48 rounded-3xl flex flex-col items-center justify-center gap-4 text-white text-2xl font-bold bg-gradient-to-br from-pink-400 to-pink-500 shadow-xl hover:scale-105 transition-transform">
                                    <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm"><Tag size={48} /></div> Vendor Coupon
                                </button>
                                <button onClick={() => openCouponInput('boots')} className="h-48 rounded-3xl flex flex-col items-center justify-center gap-4 text-white text-2xl font-bold bg-gradient-to-br from-blue-900 to-blue-800 shadow-xl hover:scale-105 transition-transform">
                                    <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm"><CheckCircle size={48} /></div> Mobile Coupon
                                </button>
                            </div>
                            {/* ... Coupon list ... */}
                             <div className="mt-10">
                                <h4 className={cn("font-bold mb-6 text-xl", isDarkMode ? "text-slate-300" : "text-slate-700")}>คูปองที่เพิ่ม ({coupons.length})</h4>
                                {coupons.length === 0 ? <p className="text-slate-400 text-lg">ยังไม่มีคูปอง</p> : (
                                    <div className="flex flex-wrap gap-4">
                                        {coupons.map((c, i) => (
                                            <div key={i} className={cn("flex items-center gap-3 px-5 py-3 rounded-xl border-2 shadow-sm", isDarkMode ? "bg-slate-950 border-slate-800" : "bg-white border-slate-100")}>
                                                <div className="text-base">
                                                    <span className={cn("font-bold uppercase", isDarkMode ? "text-slate-300" : "text-slate-700")}>{c.couponType}</span> 
                                                    <span className="mx-3 text-slate-500">|</span> 
                                                    <span className="font-mono text-slate-500">{c.couponCode}</span>
                                                    <span className="ml-3 font-bold text-red-500 text-lg">{'-฿' + c.couponValue}</span>
                                                </div>
                                                <button onClick={() => removeCoupon(c.couponCode)} className="text-slate-400 hover:text-red-500 ml-2"><X size={20}/></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'allowance' && (
                        <div className="max-w-md">
                            <label className={cn("block text-lg font-bold mb-3", isDarkMode ? "text-slate-300" : "text-slate-700")}>จำนวนเงิน Allowance</label>
                            <div className="relative">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-2xl">฿</span>
                                <input 
                                    type="number" 
                                    value={allowance}
                                    onChange={(e) => updateAllowance(e.target.value)}
                                    className={cn("w-full border-2 rounded-2xl pl-12 pr-6 py-4 text-3xl font-bold focus:border-boots-base outline-none transition-colors", isDarkMode ? "bg-slate-950 border-slate-700 text-white placeholder:text-slate-600" : "border-slate-200 bg-slate-50 focus:bg-white")} 
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Coupon Input Sub-Modal */}
            {showCouponInput && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50">
                    <div className={cn("p-8 w-[450px] animate-in zoom-in-95 rounded-2xl shadow-2xl", isDarkMode ? "bg-slate-900 text-white" : "bg-white text-slate-800")}>
                        <h3 className={cn("text-xl font-bold mb-6 uppercase flex items-center gap-2", isDarkMode ? "text-slate-300" : "text-slate-700")}>
                             Add {couponInput.type} Coupon
                        </h3>
                        {couponInput.type !== 'boots' && (
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-slate-500 mb-2">มูลค่าคูปอง (บาท)</label>
                                <input autoFocus type="number" className={cn("w-full border-2 rounded-xl px-4 py-3 font-bold text-2xl focus:border-boots-base outline-none", isDarkMode ? "bg-slate-950 border-slate-700 text-white" : "border-slate-200")} 
                                    value={couponInput.value} onChange={e => setCouponInput({...couponInput, value: e.target.value})} />
                            </div>
                        )}
                        <div className="mb-8">
                            <label className="block text-sm font-bold text-slate-500 mb-2">รหัสคูปอง / Barcode</label>
                            <input type="text" className={cn("w-full border-2 rounded-xl px-4 py-3 font-mono text-lg focus:border-boots-base outline-none", isDarkMode ? "bg-slate-950 border-slate-700 text-white placeholder:text-slate-600" : "border-slate-200 placeholder:text-slate-400")}
                                value={couponInput.code} onChange={e => setCouponInput({...couponInput, code: e.target.value})} 
                                placeholder="Scan or type..."
                            />
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setShowCouponInput(false)} className={cn("flex-1 py-3 rounded-xl font-bold text-lg transition-colors", isDarkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>ยกเลิก</button>
                            <button onClick={handleSaveCoupon} className="flex-1 py-3 bg-boots-base text-white rounded-xl font-bold hover:bg-blue-700 text-lg">บันทึก</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
}




