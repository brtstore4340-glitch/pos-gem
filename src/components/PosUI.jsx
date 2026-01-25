import React, { useState, useEffect } from "react";
import {
  ShoppingCart,
  Search,
  ScanBarcode,
  Trash2,
  Loader2,
  Tag,
  Package,
  Percent,
  Ticket,
  Gift,
  CheckCircle,
} from "lucide-react";
import { cn } from "../utils/cn";
import { useCart } from "../hooks/useCart";
import { useScanListener } from "../hooks/useScanListener";
import ReceiptModal from "./ReceiptModal";
import ProductLookupModal from "./ProductLookupModal";
import DailyReportModal from "./DailyReportModal";
import PosUploadModal from "./PosUploadModal";
import { posService } from "../services/posService";
import { useTheme } from "../context/ThemeContext";

export default function PosUI({ isDarkMode: externalDarkMode }) {
  // BEGIN: FUNCTION ZONE (DO NOT TOUCH)
  const theme = useTheme();
  const {
    cartItems,
    addToCart: originalAddToCart,
    decreaseItem,
    removeFromCart,
    clearCart,
    summary,
    lastScanned,
    isLoading,
    setManualItemDiscount,
    updateBillDiscount,
    billDiscount,
    addCoupon,
    coupons,
    allowance,
    topup,
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
    try {
      return JSON.parse(localStorage.getItem("pos_search_hits") || "{}");
    } catch {
      return {};
    }
  });

  const bumpSearchHit = (sku) => {
    try {
      const key = (sku || "").toString();
      if (!key) return;
      const next = { ...(searchHits || {}) };
      next[key] = (next[key] || 0) + 1;
      setSearchHits(next);
      localStorage.setItem("pos_search_hits", JSON.stringify(next));
    } catch (err) {
      console.debug("persist search hit failed", err);
    }
  };

  const [showProductLookup, setShowProductLookup] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Discount Modal Inner State
  const [activeTab, setActiveTab] = useState("discount");
  const [discountSubTab, setDiscountSubTab] = useState("bill");
  const [discountCheckedItems, setDiscountCheckedItems] = useState(new Set());

  // Coupon Input State
  const [couponInput, setCouponInput] = useState({
    type: "",
    value: "",
    code: "",
  });
  const [showCouponInput, setShowCouponInput] = useState(false);

  const lastItemDetail = lastScanned
    ? cartItems.find((i) => i.sku === lastScanned || i.id === lastScanned)
    : null;
  const totalDiscountDisplay = Math.abs(
    (summary?.discount || 0) +
      (summary?.billDiscountAmount || 0) +
      (summary?.couponTotal || 0) +
      (summary?.allowance || 0),
  );

  // --- Handlers ---
  const toggleDiscountCheck = (id) => {
    setDiscountCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleScanAction = async (skuOrItem) => {
    if (showCouponInput) {
      setCouponInput((prev) => ({
        ...prev,
        code: typeof skuOrItem === "string" ? skuOrItem : skuOrItem.sku,
      }));
      return;
    }
    const quantityToApply = nextQty;

    if (isVoidMode) {
      const sku =
        typeof skuOrItem === "string"
          ? skuOrItem
          : skuOrItem.sku || skuOrItem.id;
      decreaseItem(sku);
      setShowDropdown(false);
      setInputValue("");
      if (nextQty !== 1) setNextQty(1);
      return;
    }

    if (typeof skuOrItem === "string") {
      try {
        const item = await posService.scanItem(skuOrItem);
        await originalAddToCart(item, quantityToApply);
      } catch (e) {
        console.error(e);
      }
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
      cashier: "Staff #01",
      device: "POS-Web",
      adjustments: { billDiscount, coupons, allowance, topup },
    };
    setIsSaving(true);
    try {
      const orderId = await posService.createOrder(orderData);
      setLastOrder({
        ...orderData,
        id: orderId,
        timestamp: new Date().toISOString(),
      });
      clearCart();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const scanEnabled =
    !showDiscountModal &&
    !showCouponInput &&
    !showProductLookup &&
    !showReport &&
    !showUploadModal &&
    !lastOrder;

  const {
    inputRef,
    inputValue,
    setInputValue,
    handleInputKeyDown,
    handleInputChange,
  } = useScanListener(
    handleScanAction,
    scanEnabled ? handleCheckout : undefined,
    () => setShowProductLookup(true),
    { enabled: scanEnabled },
  );

  const handleInputKeyDownWrapper = async (e) => {
    if (scanEnabled && showDropdown && suggestions.length > 0 && !isVoidMode) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIndex((i) =>
          Math.min(i + 1, suggestions.length - 1),
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const sel = suggestions[selectedSuggestionIndex];
        if (sel?.sku) {
          bumpSearchHit(sel.sku);
          await handleSelectSuggestion(sel.sku);
        }
        return;
      }
    }
    handleInputKeyDown(e);
  };

  const onInputChangeWrapper = (e) => {
    const val = e.target.value;
    if (val.endsWith("*")) {
      const numberPart = val.slice(0, -1);
      if (/^\d+$/.test(numberPart)) {
        const qty = parseInt(numberPart, 10);
        if (qty > 0) {
          setNextQty(qty);
          setInputValue("");
        } else {
          alert("จำนวนต้องมากกว่า 0");
          setInputValue("");
        }
      } else {
        setInputValue("");
      }
      return;
    }
    handleInputChange(e);
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (inputValue.length >= 2 && scanEnabled && !isVoidMode) {
        const results = await posService.searchProducts(inputValue);
        const hits = (() => {
          try {
            return JSON.parse(localStorage.getItem("pos_search_hits") || "{}");
          } catch {
            return {};
          }
        })();
        const sorted = [...(results || [])].sort((a, b) => {
          const ak = (a?.sku || a?.id || "").toString();
          const bk = (b?.sku || b?.id || "").toString();
          const ah = hits?.[ak] || 0;
          const bh = hits?.[bk] || 0;
          if (bh !== ah) return bh - ah;
          const an = (a?.name || "").toString();
          const bn = (b?.name || "").toString();
          return an.localeCompare(bn, undefined, { sensitivity: "base" });
        });
        setSuggestions(sorted);
        setSelectedSuggestionIndex(0);
        setShowDropdown(sorted.length > 0);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, isVoidMode, scanEnabled]);

  const handleSelectSuggestion = async (sku) => {
    if (!sku) return;
    setInputValue("");
    setShowDropdown(false);
    try {
      const item = await posService.scanItem(sku);
      await handleScanAction(item);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveCoupon = () => {
    if (!couponInput.value && couponInput.type !== "boots") return;
    let finalValue = parseFloat(couponInput.value) || 0;
    let finalCode = couponInput.code;
    if (couponInput.type === "boots") {
      if (finalValue === 0) {
        const numbers = finalCode.match(/\d+/);
        finalValue = numbers ? parseInt(numbers[0]) : 50;
      }
    }
    addCoupon({
      couponType: couponInput.type,
      couponValue: finalValue,
      couponCode: finalCode,
    });
    setShowCouponInput(false);
  };
  // END:   FUNCTION ZONE (DO NOT TOUCH)

  // Unity Theme UI
  return (
    <div
      className={cn(
        "h-full min-h-0 w-full font-sans flex gap-4 p-4 overflow-visible relative transition-colors duration-300",
        isDarkMode
          ? "bg-[#0f1014] text-slate-100"
          : "bg-[#f8fafc] text-slate-800",
      )}
      onClick={() => setShowDropdown(false)}
    >
      {/* --- LEFT SIDE: SCANNER & FOOTAGE --- */}
      <div className="w-[35%] max-w-[450px] flex flex-col gap-4 min-h-0">
        {/* 1. SCAN PRODUCT BOX (Glass Card) */}
        <div
          className={cn(
            "glass-panel p-5 relative transition-all duration-300 z-20",
            isVoidMode && "border-red-500/50 bg-red-500/5",
          )}
        >
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/10">
                <ScanBarcode size={18} />
              </div>
              <span className="text-[11px] font-bold tracking-widest uppercase">
                Scanner
              </span>
            </div>

            {isVoidMode && (
              <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-1 rounded shadow-sm shadow-red-500/20">
                VOID MODE
              </span>
            )}

            <button
              onClick={() => {
                setIsVoidMode(!isVoidMode);
                if (scanEnabled) inputRef.current?.focus();
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                isVoidMode
                  ? "bg-white/10 text-red-500 border-red-500/30 hover:bg-red-500 hover:text-white"
                  : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10",
              )}
            >
              {isVoidMode ? "CANCEL VOID" : "VOID ITEM"}
            </button>
          </div>

          <div className="relative group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-blue-500 transition-colors"
              size={20}
            />
            <input
              ref={inputRef}
              value={inputValue}
              onChange={onInputChangeWrapper}
              onKeyDown={handleInputKeyDownWrapper}
              disabled={
                isLoading ||
                lastOrder ||
                isSaving ||
                showDiscountModal ||
                showCouponInput ||
                showProductLookup ||
                showReport ||
                showUploadModal
              }
              type="text"
              placeholder={isVoidMode ? "Scan to remove..." : "Scan barcode..."}
              autoComplete="off"
              aria-label="Scan or search product"
              className={cn(
                "glass-input pl-12 pr-12 text-lg font-bold placeholder:font-medium placeholder:text-base",
                isVoidMode &&
                  "border-red-500/50 text-red-600 focus:border-red-500 focus:ring-red-500/30",
              )}
            />
            {/* Qty Badge */}
            {nextQty > 1 && (
              <div className="absolute top-1/2 -translate-y-1/2 right-3 bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-bold px-2 py-1 rounded-md shadow-sm animate-in zoom-in">
                x{nextQty}
              </div>
            )}
          </div>

          {/* Hint */}
          <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
            <span className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20">
              Tip
            </span>{" "}
            Enter number + * for quantity (e.g. 5*)
          </div>

          {/* Search Dropdown (Glass) */}
          {showDropdown && !isVoidMode && (
            <div
              className="absolute top-full left-0 right-0 mt-2 mx-1 rounded-2xl shadow-2xl overflow-hidden z-[80] max-h-[300px] overflow-y-auto bg-white/90 dark:bg-[#1e2025]/95 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {suggestions.map((item, idx) => (
                <div
                  key={item.sku}
                  onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                  onClick={() => {
                    bumpSearchHit(item.sku);
                    handleSelectSuggestion(item.sku);
                  }}
                  className={cn(
                    "p-3 border-b border-slate-100 dark:border-white/5 cursor-pointer flex justify-between items-center transition-colors",
                    idx === selectedSuggestionIndex
                      ? "bg-blue-50 dark:bg-white/5"
                      : "hover:bg-slate-50 dark:hover:bg-white/5",
                  )}
                >
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                      {item.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {item.sku}
                    </div>
                  </div>
                  <div className="text-blue-600 dark:text-blue-400 font-bold text-sm">
                    ฿{item.price}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. LAST SCANNED (Glass Card) */}
        <div className="glass-panel flex-1 min-h-0 relative overflow-hidden flex flex-col items-center justify-center p-6 bg-gradient-to-b from-white/60 to-white/40 dark:from-white/5 dark:to-transparent">
          <div className="absolute top-4 left-4 flex items-center gap-2 text-slate-400/80">
            <Package size={16} />
            <span className="text-[10px] font-bold tracking-widest uppercase">
              Review
            </span>
          </div>

          {lastItemDetail ? (
            <div className="text-center w-full animate-in slide-in-from-bottom-4 fade-in duration-300 relative z-10">
              <div className="mb-6 relative inline-block">
                <div
                  className={cn(
                    "w-28 h-28 rounded-3xl flex items-center justify-center shadow-xl mx-auto border border-white/20 dark:border-white/5",
                    isVoidMode
                      ? "bg-red-500/10 text-red-500"
                      : "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-600 dark:text-blue-400",
                  )}
                >
                  <Package size={56} strokeWidth={1.5} />
                </div>
                <div className="absolute -bottom-3 -right-3 bg-slate-800 dark:bg-white text-white dark:text-slate-900 text-sm font-bold w-8 h-8 flex items-center justify-center rounded-xl shadow-lg border-2 border-slate-50 dark:border-[#0f1014]">
                  {lastItemDetail.qty}
                </div>
              </div>

              <h3 className="text-lg font-bold leading-tight mb-2 line-clamp-2 px-2 text-slate-800 dark:text-white">
                {lastItemDetail.name}
              </h3>

              <div className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-slate-800 to-slate-600 dark:from-white dark:to-slate-400 tracking-tight mt-2">
                ฿
                {(lastItemDetail.calculatedTotal !== undefined
                  ? lastItemDetail.calculatedTotal
                  : lastItemDetail.price * lastItemDetail.qty
                ).toLocaleString()}
              </div>
              <div className="text-xs font-mono text-slate-400 mt-2 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-md inline-block">
                {lastItemDetail.sku}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center opacity-30 select-none">
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-400 flex items-center justify-center mb-4">
                <ScanBarcode size={32} />
              </div>
              <span className="text-sm font-bold uppercase tracking-widest">
                Ready to Scan
              </span>
            </div>
          )}
        </div>
      </div>

      {/* --- RIGHT SIDE: CART (Glass Panel) --- */}
      <div className="glass-panel flex-1 flex flex-col min-h-0 overflow-hidden shadow-2xl relative">
        {/* CART HEADER */}
        <div className="grid grid-cols-12 px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/50 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 backdrop-blur-sm z-20">
          <div className="col-span-1">#</div>
          <div className="col-span-4">Item</div>
          <div className="col-span-2 text-right">Unit Price</div>
          <div className="col-span-1 text-center">Qty</div>
          <div className="col-span-2 text-center">Discount</div>
          <div className="col-span-2 text-right">Total</div>
        </div>

        {/* CART LIST */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 pb-10 select-none">
              <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-6">
                <ShoppingCart size={40} className="opacity-50" />
              </div>
              <p className="font-medium">Cart is empty</p>
              <p className="text-xs mt-2 opacity-60">
                Scan items to start transaction
              </p>
            </div>
          ) : (
            cartItems.map((item, index) => {
              const lineTotal =
                item.calculatedTotal !== undefined
                  ? item.calculatedTotal
                  : item.price * item.qty;
              const normalTotal = item.normalPrice || item.price * item.qty;
              const discountVal = Math.max(0, normalTotal - lineTotal);

              return (
                <div
                  key={item.id || item.sku}
                  className="grid grid-cols-12 px-4 py-3.5 items-center text-sm group hover:bg-white/40 dark:hover:bg-white/5 rounded-xl transition-colors border-b border-transparent hover:border-slate-200/50 dark:hover:border-white/5"
                >
                  <div className="col-span-1 text-slate-400 text-xs font-mono">
                    {cartItems.length - index}
                  </div>

                  <div className="col-span-4 pr-2">
                    <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {item.name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {item.sku}
                      </span>
                      {item.badgeText && (
                        <span className="text-[9px] bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-1.5 rounded-sm font-bold uppercase">
                          {item.badgeText}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 text-right font-medium text-slate-600 dark:text-slate-400 font-mono">
                    {item.price.toLocaleString()}
                  </div>

                  <div className="col-span-1 flex justify-center">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white dark:bg-white/10 border border-slate-200 dark:border-white/5 text-xs font-bold shadow-sm">
                      {item.qty}
                    </div>
                  </div>

                  <div className="col-span-2 text-center">
                    {discountVal > 0 ? (
                      <span className="text-[10px] text-red-500 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-2 py-0.5 rounded-full font-bold">
                        -{discountVal.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-700">
                        -
                      </span>
                    )}
                  </div>

                  <div className="col-span-2 text-right font-bold text-slate-800 dark:text-white font-mono text-base relative group-hover:pr-8 transition-all">
                    {lineTotal.toLocaleString()}

                    {/* Delete Action (Hover) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromCart(item.id || item.sku);
                      }}
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center bg-red-50 dark:bg-red-500/10 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                      title="Remove Item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER (Glass Gradient) */}
        <div className="relative z-20 bg-white/80 dark:bg-[#15171e]/90 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 p-5 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
          <div className="flex justify-between items-end mb-5">
            <div className="flex flex-col gap-1">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Total (Items: {summary?.totalItems || 0})
              </div>
              {totalDiscountDisplay > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-md self-start">
                  <Tag size={12} />
                  Saved ฿{totalDiscountDisplay.toLocaleString()}
                </div>
              )}
            </div>

            <div className="flex flex-col items-end">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                Net Total
              </div>
              <div className="flex items-baseline gap-1 text-slate-800 dark:text-white leading-none">
                <span className="text-2xl font-bold">฿</span>
                <span className="text-5xl font-extrabold tracking-tighter">
                  {Number(summary?.netTotal || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-3">
            <button
              onClick={() => setShowDiscountModal(true)}
              className="btn-secondary px-4 min-w-[100px]"
            >
              <Tag size={18} />
              <span>Discounts</span>
              {totalDiscountDisplay > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 ml-1" />
              )}
            </button>

            <button
              onClick={handleCheckout}
              disabled={cartItems.length === 0 || isLoading || isSaving}
              className="btn-primary w-full text-lg shadow-blue-500/25"
            >
              {isSaving ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <ShoppingCart size={24} />
              )}
              <span>Checkout</span>
              <kbd className="hidden md:inline-flex items-center h-6 px-2 ml-3 text-[10px] font-sans font-medium text-blue-100 bg-blue-500/20 rounded">
                F12
              </kbd>
            </button>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}
      {lastOrder && (
        <ReceiptModal order={lastOrder} onClose={() => setLastOrder(null)} />
      )}
      {showProductLookup && (
        <ProductLookupModal onClose={() => setShowProductLookup(false)} />
      )}
      {showReport && <DailyReportModal onClose={() => setShowReport(false)} />}
      <PosUploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        isDarkMode={isDarkMode}
        pricingReady={true}
      />

      {/* Simplified Inline Modal for Discounts (Redesigned) */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="glass-panel w-full max-w-4xl h-[80vh] flex overflow-hidden shadow-2xl relative">
            {/* Modal Sidebar */}
            <div className="w-64 p-6 border-r border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 flex flex-col gap-2">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-white">
                <Tag size={20} className="text-blue-500" /> Discounts
              </h2>

              {[
                { id: "discount", label: "General", icon: Percent },
                { id: "coupon", label: "Coupons", icon: Ticket },
                { id: "allowance", label: "Allowance", icon: Gift },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all text-sm",
                    activeTab === tab.id
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                      : "text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-white/5",
                  )}
                >
                  <tab.icon size={18} /> {tab.label}
                </button>
              ))}

              <div className="mt-auto">
                <button
                  onClick={() => setShowDiscountModal(false)}
                  className="w-full py-3 rounded-xl font-bold bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-white/20 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-8 overflow-y-auto bg-white/50 dark:bg-black/20">
              {activeTab === "discount" && (
                <div>
                  <div className="flex gap-4 mb-8 border-b border-slate-200 dark:border-white/10 pb-6">
                    <button
                      onClick={() => setDiscountSubTab("bill")}
                      className={cn(
                        "px-6 py-2.5 rounded-xl font-bold transition-all text-sm",
                        discountSubTab === "bill"
                          ? "bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-lg"
                          : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5",
                      )}
                    >
                      Bill Discount
                    </button>
                    <button
                      onClick={() => setDiscountSubTab("items")}
                      className={cn(
                        "px-6 py-2.5 rounded-xl font-bold transition-all text-sm",
                        discountSubTab === "items"
                          ? "bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-lg"
                          : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5",
                      )}
                    >
                      Item Discount
                    </button>
                  </div>

                  {discountSubTab === "bill" && (
                    <div className="max-w-xs">
                      <label className="block text-sm font-bold mb-3 text-slate-500 uppercase tracking-wide">
                        Percentage (%)
                      </label>
                      <div className="flex gap-4 items-center">
                        <input
                          type="number"
                          value={billDiscount.percent}
                          onChange={(e) => updateBillDiscount(e.target.value)}
                          className="glass-input text-4xl font-bold py-4 text-center"
                          placeholder="0"
                        />
                        <div className="text-2xl font-bold text-slate-400">
                          %
                        </div>
                      </div>
                    </div>
                  )}

                  {discountSubTab === "items" && (
                    <div>
                      <h3 className="font-bold mb-4 text-sm text-slate-500 uppercase">
                        Select items to discount
                      </h3>
                      <div className="space-y-3">
                        {cartItems.map((item, idx) => {
                          const isChecked = discountCheckedItems.has(
                            item.id || item.sku,
                          );
                          return (
                            <div
                              key={idx}
                              onClick={() =>
                                toggleDiscountCheck(item.id || item.sku)
                              }
                              className={cn(
                                "flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all",
                                isChecked
                                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-500/10"
                                  : "border-slate-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-white/20",
                              )}
                            >
                              <div
                                className={cn(
                                  "w-6 h-6 rounded border flex items-center justify-center transition-colors",
                                  isChecked
                                    ? "bg-blue-500 border-blue-500 text-white"
                                    : "border-slate-300 dark:border-slate-600",
                                )}
                              >
                                {isChecked && <CheckCircle size={14} />}
                              </div>
                              <div className="flex-1">
                                <div className="font-bold text-slate-800 dark:text-white">
                                  {item.name}
                                </div>
                                <div className="text-xs text-slate-400 font-mono">
                                  {item.sku}
                                </div>
                              </div>
                              <div className="font-bold text-slate-600 dark:text-slate-400">
                                ฿{(item.price * item.qty).toLocaleString()}
                              </div>

                              {isChecked && (
                                <div className="animate-in zoom-in ml-4">
                                  <input
                                    type="number"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    value={item.manualDiscountPercent || ""}
                                    onChange={(e) =>
                                      setManualItemDiscount(
                                        item.id || item.sku,
                                        e.target.value,
                                      )
                                    }
                                    className="w-16 h-10 rounded-lg border-2 border-orange-400 text-center font-bold outline-none focus:ring-2 focus:ring-orange-200"
                                    placeholder="%"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {cartItems.length === 0 && (
                          <p className="text-slate-400 text-center py-8">
                            Cart is empty
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Coupon Input Modal */}
      {showCouponInput && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md p-8 animate-in zoom-in-95">
            <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-white">
              Add Coupon ({couponInput.type})
            </h3>
            <div className="space-y-4">
              <input
                className="glass-input"
                placeholder="Coupon Code"
                value={couponInput.code}
                onChange={(e) =>
                  setCouponInput({ ...couponInput, code: e.target.value })
                }
                autoFocus
              />
              {couponInput.type !== "boots" && (
                <input
                  className="glass-input"
                  type="number"
                  placeholder="Value"
                  value={couponInput.value}
                  onChange={(e) =>
                    setCouponInput({ ...couponInput, value: e.target.value })
                  }
                />
              )}
            </div>
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowCouponInput(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button onClick={handleSaveCoupon} className="btn-primary flex-1">
                Apply Coupon
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
