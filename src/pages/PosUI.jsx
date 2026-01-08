import React, { useState, useEffect } from 'react';
import { ShoppingCart, Search, ScanBarcode, Trash2, Loader2, UploadCloud, User, FileText, LayoutGrid, Settings, Box, Monitor, Package, Percent, CheckCircle, AlertCircle, Power } from 'lucide-react';
import { cn } from '../utils/cn';
import { useCart } from '../hooks/useCart';
import { useScanListener } from '../hooks/useScanListener';
import ReceiptModal from './ReceiptModal';
import ProductLookupModal from './ProductLookupModal';
import DailyReportModal from './DailyReportModal';
import PosUploadModal from "./PosUploadModal";
import NeuClock from "../components/NeuClock"; 
import { posService } from '../services/posService';
import { useTheme } from '../context/ThemeContext';

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

  const isDarkMode = externalDarkMode ?? theme?.isDark ?? false;

  // Navigation State
  const [activeTab, setActiveTab] = useState('POS');

  // Modal States
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProductLookup, setShowProductLookup] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Discount modal states
  const [activeTabDiscount, setActiveTabDiscount] = useState('discount');
  const [discountSubTab, setDiscountSubTab] = useState('bill');
  const [discountCheckedItems, setDiscountCheckedItems] = useState(new Set());

  // Coupon input
  const [couponInput, setCouponInput] = useState({ type: '', value: '', code: '' });
  const [showCouponInput, setShowCouponInput] = useState(false);

  const navItemStyle = (isActive) => cn(
    "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 cursor-pointer select-none shrink-0 btn-press shadow-orange-500/20",
    isActive 
      ? "bg-[#0B2A97] text-white" 
      : (isDarkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900")
  );

  const lastItemDetail = lastScanned ? cartItems.find(i => (i.sku === lastScanned || i.id === lastScanned)) : null;

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
      summary,
      cashier: 'Staff #01',
      device: 'POS-Web',
      adjustments: { billDiscount, coupons, allowance, topup }
    };

    setIsSaving(true);
    try {
      const orderId = await posService.createOrder(orderData);
      setLastOrder({ ...orderData, id: orderId, timestamp: new Date().toISOString() });
      clearCart();
    } catch (err) {
      alert('Error: ' + (err?.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  const { inputRef, inputValue, setInputValue, handleInputKeyDown, handleInputChange } =
    useScanListener(handleScanAction, !lastOrder ? handleCheckout : undefined);

  const onInputChangeWrapper = (e) => {
    const val = e.target.value;
    if (val.endsWith('*')) {
      const numberPart = val.slice(0, -1);
      if (/^\d+$/.test(numberPart)) {
        const qty = parseInt(numberPart, 10);
        if (qty > 0) { setNextQty(qty); setInputValue(''); }
        else { alert('จำนวนต้องมากกว่า 0'); setInputValue(''); }
      } else {
        setInputValue('');
      }
      return;
    }
    handleInputChange(e);
  };

  // Search suggestions (SAFE)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (inputValue.length >= 2 && !isVoidMode && !showDiscountModal) {
        try {
          const results = await posService.searchProducts(inputValue);
          setSuggestions(results || []);
          setShowDropdown((results || []).length > 0);
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
    posService.scanItem(sku).then(item => handleScanAction(item)).catch(console.error);
  };

  const openCouponInput = (type) => {
    setCouponInput({ type, value: '', code: '' });
    setShowCouponInput(true);
  };

  const handleSaveCoupon = () => {
    if (!couponInput.value && couponInput.type !== 'boots') return;

    let finalValue = parseFloat(couponInput.value) || 0;
    let finalCode = couponInput.code;

    if (couponInput.type === 'boots' && finalValue === 0) {
      const numbers = finalCode?.match(/\d+/);
      finalValue = numbers ? parseInt(numbers[0], 10) : 50;
    }

    addCoupon({ couponType: couponInput.type, couponValue: finalValue, couponCode: finalCode });
    setShowCouponInput(false);
  };

  return (
    <div className={cn(
      "h-full min-h-0 w-full font-['Noto_Sans_Thai'] flex flex-col overflow-hidden transition-colors duration-300",
      isDarkMode ? "bg-slate-950 text-slate-100" : "bg-[#F3F5F9] text-slate-900"
    )} onClick={() => setShowDropdown(false)}>

      {/* HEADER */}
      <div className={cn(
        "h-20 px-6 flex items-center justify-between shrink-0 z-50 shadow-sm relative",
        isDarkMode ? "bg-slate-900 border-b border-slate-800" : "bg-white border-b border-slate-200"
      )}>
        <div className="flex items-center gap-4">
            <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">POS System</span>
            <span className="text-[10px] font-bold text-slate-300">v1.2.0</span>
          </div>
        </div>

        <div className="flex items-center gap-1 mx-4 overflow-x-auto scrollbar-hide">
          <div onClick={() => setActiveTab('Dashboard')} className={navItemStyle(activeTab === 'Dashboard')}>
            <LayoutGrid size={18} /> Dashboard
          </div>
          <div onClick={() => setActiveTab('POS')} className={navItemStyle(activeTab === 'POS')}>
            <Monitor size={18} /> POS
          </div>
          <div onClick={() => setActiveTab('Report')} className={navItemStyle(activeTab === 'Report')}>
            <FileText size={18} /> Report
          </div>
          <div onClick={() => setActiveTab('Inventory')} className={navItemStyle(activeTab === 'Inventory')}>
            <Box size={18} /> Inventory
          </div>
          <div onClick={() => setActiveTab('Setting')} className={navItemStyle(activeTab === 'Setting')}>
            <Settings size={18} /> Setting
          </div>
          <div onClick={() => setActiveTab('Order')} className={navItemStyle(activeTab === 'Order')}>
            <ShoppingCart size={18} /> Order
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold border transition-all btn-press shadow-orange-500/20",
              isDarkMode
                ? "border-slate-700 hover:bg-slate-800 text-slate-300"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            <UploadCloud size={18} />
            <span>Upload Data</span>
          </button>

          <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700 mx-2"></div>

          <NeuClock />

          <div className="ml-2 w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center cursor-pointer hover:ring-2 ring-offset-2 ring-blue-500 transition-all">
            <User size={20} className="text-slate-500 dark:text-slate-400" />
          </div>
        </div>
      </div>

      {/* MAIN: lock alignment + prevent columns drifting */}
      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden p-4 items-start">

        {/* LEFT */}
        <div className="w-[35%] max-w-[450px] flex flex-col gap-4 h-full min-h-0 self-start">

          <div className={cn(
            "p-5 rounded-2xl shadow-sm border relative transition-colors shrink-0",
            isVoidMode ? "border-red-500 bg-red-50" : (isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-white")
          )}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-slate-500">
                <ScanBarcode size={20} />
                <span className="text-xs font-bold tracking-widest uppercase">Scan Product</span>
              </div>

              <button
                onClick={() => { setIsVoidMode(!isVoidMode); inputRef.current?.focus(); }}
                className={cn(
                  "text-[10px] font-bold px-2 py-1 rounded border transition-all",
                  isVoidMode ? "bg-white text-red-500 border-red-200" : "bg-slate-100 text-slate-500"
                )}
              >
                {isVoidMode ? 'CANCEL' : 'VOID ITEM'}
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
                className={cn(
                  "w-full pl-4 pr-4 py-3.5 rounded-xl border-2 outline-none transition-all text-lg font-bold placeholder:font-normal placeholder:text-base",
                  isVoidMode
                    ? "border-red-300 text-red-600 bg-white"
                    : (isDarkMode ? "bg-slate-950 border-slate-700 text-white focus:border-blue-500" : "border-slate-200 text-slate-800 focus:border-[#0B2A97] bg-white")
                )}
              />

              {nextQty > 1 && (
                <div className="absolute top-1/2 -translate-y-1/2 right-3 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-md animate-in zoom-in">
                  x{nextQty}
                </div>
              )}

              {showDropdown && !isVoidMode && (
                <div className={cn(
                  "absolute top-full left-0 right-0 mt-2 rounded-xl shadow-xl border overflow-hidden z-50 max-h-[300px] overflow-y-auto",
                  isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                )}>
                  {suggestions.map((item) => (
                    <div
                      key={item.sku}
                      onClick={() => handleSelectSuggestion(item.sku)}
                      className={cn("p-3 border-b cursor-pointer flex justify-between items-center hover:bg-blue-50 dark:hover:bg-slate-700", isDarkMode ? "border-slate-700" : "border-slate-50")}
                    >
                      <div>
                        <div className="font-bold">{item.name}</div>
                        <div className="text-xs text-slate-400">SKU: {item.sku}</div>
                      </div>
                      <div className="text-blue-600 font-bold">฿{Number(item.price || 0).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="mt-3 bg-red-50 text-red-600 px-3 py-2 rounded-lg border border-red-100 flex items-center gap-2">
                <AlertCircle size={16} />
                <span className="text-xs font-medium">{error}</span>
              </div>
            )}
          </div>

          <div className={cn(
            "flex-1 min-h-0 rounded-2xl shadow-sm border relative overflow-hidden flex flex-col items-center justify-center p-6 transition-colors",
            isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-white"
          )}>
            <div className="absolute top-4 left-4 flex items-center gap-2 text-slate-400">
              <Box size={16} />
              <span className="text-[10px] font-bold tracking-widest uppercase">Inventory Monitor</span>
            </div>

            {lastItemDetail ? (
              <div className="text-center w-full animate-in slide-in-from-bottom-4 fade-in duration-300">
                <div className="mb-4 relative inline-block">
                  <div className={cn(
                    "w-32 h-32 rounded-2xl flex items-center justify-center shadow-lg mx-auto",
                    isVoidMode ? "bg-red-100 text-red-500" : "bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600"
                  )}>
                    <Package size={64} strokeWidth={1.5} />
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-slate-800 text-white text-sm font-bold px-3 py-1 rounded-lg shadow-md">
                    x{lastItemDetail.qty}
                  </div>
                </div>

                <h3 className={cn(
                  "text-xl font-bold leading-tight mb-2 line-clamp-2 px-4 h-16 flex items-center justify-center",
                  isDarkMode ? "text-white" : "text-slate-800"
                )}>
                  {lastItemDetail.name}
                </h3>

                <div className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">
                  ฿{Number((lastItemDetail.calculatedTotal ?? (Number(lastItemDetail.price||0) * Number(lastItemDetail.qty||0))) || 0).toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center opacity-30">
                <Box size={80} className="mb-4" />
                <span className="text-lg font-bold">Ready to Scan</span>
              </div>
            )}

            <div className="absolute bottom-4 left-4 right-4">
              <button
                onClick={() => setShowProductLookup(true)}
                className={cn(
                  "w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors",
                  isDarkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-[#F3F5F9] text-slate-600 hover:bg-slate-200"
                )}
              >
                <Search size={16} /> ค้นหาสินค้า
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className={cn(
          "flex-1 min-h-0 self-start flex flex-col rounded-3xl overflow-hidden shadow-xl border relative h-full",
          isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-white shadow-slate-200"
        )}>
          <div className={cn(
            "grid grid-cols-12 px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b shrink-0",
            isDarkMode ? "border-slate-800" : "border-slate-50"
          )}>
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-5">รายการสินค้า</div>
            <div className="col-span-2 text-right">ราคา</div>
            <div className="col-span-2 text-center">จำนวน</div>
            <div className="col-span-1 text-red-500 text-center">ลด</div>
            <div className="col-span-1 text-right">รวม</div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 scrollbar-hide">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 pb-10">
                <ShoppingCart size={64} className="mb-4 opacity-20" />
                <p className="font-medium text-lg">ยังไม่มีการเลือกซื้อสินค้า</p>
              </div>
            ) : (
              cartItems.map((item, index) => {
                const price = Number(item.price || 0);
                const qty = Number(item.qty || 0);
                const normal = price * qty;
                const lineTotal = (item.calculatedTotal ?? normal);
                const discount = Math.max(0, normal - Number(lineTotal || 0));

                return (
                  <div key={item.id || item.sku} className={cn(
                    "grid grid-cols-12 px-2 py-3 border-b items-center text-sm group hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors rounded-lg",
                    isDarkMode ? "border-slate-800 text-slate-200" : "border-slate-50 text-slate-700"
                  )}>
                    <div className="col-span-1 text-slate-400 text-xs text-center">{cartItems.length - index}</div>

                    <div className="col-span-5 pr-2">
                      <div className="font-bold truncate text-base">{item.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 rounded">{item.sku}</span>
                        {item.badgeText && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded font-bold">{item.badgeText}</span>}
                      </div>
                    </div>

                    <div className="col-span-2 text-right font-medium text-base">{price.toLocaleString()}</div>

                    <div className="col-span-2 flex justify-center">
                      <div className="w-10 h-8 rounded-lg border flex items-center justify-center bg-white dark:bg-slate-700 dark:border-slate-600 font-bold shadow-sm">
                        {qty}
                      </div>
                    </div>

                    <div className="col-span-1 text-center">
                      {discount > 0 ? <span className="text-xs text-red-500 font-bold bg-red-50 px-1 rounded">-{discount.toLocaleString()}</span> : <span className="text-xs text-slate-400">-</span>}
                    </div>

                    <div className="col-span-1 text-right font-bold text-lg relative group pr-2">
                      {Number(lineTotal || 0).toLocaleString()}
                      <button
                        onClick={() => removeFromCart(item.id || item.sku)}
                        className="absolute -right-2 top-1/2 -translate-y-1/2 p-2 bg-red-50 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white shadow-md z-10"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="bg-[#0B1221] text-white p-6 shrink-0 relative overflow-hidden mt-auto">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex justify-between items-end relative z-10 mb-4">
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">จำนวนชิ้นรวม</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight">{summary.totalItems}</span>
                  <span className="text-slate-500 text-sm">Items</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-0">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">ยอดสุทธิ (Net Total)</span>
                <span className="text-6xl font-black tracking-tighter leading-none">
                  <span className="text-2xl align-top mr-2 text-slate-400 font-medium">฿</span>
                  {Number(summary.netTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={cartItems.length === 0 || isLoading || isSaving}
              className="w-full bg-[#1D4ED8] hover:bg-blue-600 text-white h-16 rounded-xl font-bold shadow-lg shadow-blue-900/50 flex items-center justify-center gap-4 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
            >
              {isSaving ? <Loader2 className="animate-spin" size={24} /> : <ShoppingCart size={24} />}
              <span className="text-2xl">ชำระเงิน (Checkout)</span>
              <span className="bg-black/20 px-2 py-1 rounded text-xs ml-2 font-mono opacity-70">F12</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {lastOrder && <ReceiptModal order={lastOrder} onClose={() => setLastOrder(null)} />}
      {showProductLookup && <ProductLookupModal onClose={() => setShowProductLookup(false)} />}
      {showReport && <DailyReportModal onClose={() => setShowReport(false)} />}

      <PosUploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        isDarkMode={isDarkMode}
        pricingReady={true}
      />

      {/* Discount modal placeholder (keep yours) */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={cn("w-full max-w-3xl h-[70vh] rounded-3xl shadow-2xl flex overflow-hidden border", isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
            <div className={cn("w-64 p-6 border-r flex flex-col gap-3", isDarkMode ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200")}>
              <h2 className={cn("text-2xl font-bold mb-6", isDarkMode ? "text-white" : "text-slate-800")}>ส่วนลด</h2>

              <button onClick={() => setActiveTabDiscount('discount')} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all",
                activeTabDiscount === 'discount' ? "bg-blue-600 text-white shadow-md" : (isDarkMode ? "text-slate-400 hover:bg-slate-900" : "text-slate-600 hover:bg-slate-100")
              )}>
                <Percent size={20}/> ส่วนลดทั่วไป
              </button>

              <div className="mt-auto">
                <button onClick={() => setShowDiscountModal(false)} className={cn("w-full py-4 rounded-xl font-bold", isDarkMode ? "bg-slate-800 text-white" : "bg-slate-800 text-white")}>ปิดหน้าต่าง</button>
              </div>
            </div>

            <div className={cn("flex-1 p-8 overflow-y-auto", isDarkMode ? "text-white" : "text-slate-800")}>
              <div className="text-slate-400">Discount modal content… (use your full version here)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
