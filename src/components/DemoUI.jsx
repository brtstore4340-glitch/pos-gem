import React, { useState, useEffect } from "react";
import {
  ShoppingCart,
  Search,
  ScanBarcode,
  User,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  Tag,
  Package,
  Box,
  MinusCircle,
  FileText,
  Settings,
  Hash,
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
import { posService } from "../services/posService";

export default function PosUI({ onAdminSettings }) {
  const {
    cartItems,
    addToCart: originalAddToCart,
    decreaseItem,
    removeFromCart,
    clearCart,
    summary,
    lastScanned,
    isLoading,
    error,
    setManualItemDiscount,
    updateBillDiscount,
    billDiscount,
    addCoupon,
    removeCoupon,
    coupons,
    updateAllowance,
    allowance,
  } = useCart();

  const [lastOrder, setLastOrder] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isVoidMode, setIsVoidMode] = useState(false);
  const [nextQty, setNextQty] = useState(1);

  // Modal States
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProductLookup, setShowProductLookup] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  // Discount Modal Inner State
  const [activeTab, setActiveTab] = useState("discount"); // discount, coupon, allowance
  const [discountSubTab, setDiscountSubTab] = useState("bill"); // bill, items

  // Coupon Input State
  const [couponInput, setCouponInput] = useState({
    type: "",
    value: "",
    code: "",
  });
  const [showCouponInput, setShowCouponInput] = useState(false);

  // Helper for Button Animation
  const btnEffect =
    "active:scale-95 transition-transform duration-100 ease-in-out shadow-sm hover:shadow-md active:shadow-none select-none";

  const lastItemDetail = lastScanned
    ? cartItems.find((i) => i.sku === lastScanned || i.id === lastScanned)
    : null;

  // --- Handlers ---

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
      adjustments: {
        billDiscount,
        coupons,
        allowance,
      },
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

  // โ… New Setting Handler
  const handleAdminSettings = () => {
    if (onAdminSettings) {
      onAdminSettings();
    } else {
      alert("Admin Settings: Feature coming soon");
    }
  };

  const {
    inputRef,
    inputValue,
    setInputValue,
    handleInputKeyDown,
    handleInputChange,
  } = useScanListener(
    handleScanAction,
    !lastOrder ? handleCheckout : undefined,
  );

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
          alert("เธเธณเธเธงเธเธ•เนเธญเธเธกเธฒเธเธเธงเนเธฒ 0");
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
      if (inputValue.length >= 2 && !isVoidMode && !showDiscountModal) {
        const results = await posService.searchProducts(inputValue);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, isVoidMode, showDiscountModal]);

  const handleSelectSuggestion = (sku) => {
    posService.scanItem(sku).then((item) => {
      handleScanAction(item);
    });
  };

  const openCouponInput = (type) => {
    setCouponInput({ type, value: "", code: "" });
    setShowCouponInput(true);
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

  return (
    <div
      className="h-screen w-full bg-slate-100 p-4 font-sans flex gap-4 overflow-hidden"
      onClick={() => setShowDropdown(false)}
    >
      {/* Modals */}
      {lastOrder && (
        <ReceiptModal order={lastOrder} onClose={() => setLastOrder(null)} />
      )}
      {showProductLookup && (
        <ProductLookupModal onClose={() => setShowProductLookup(false)} />
      )}
      {showReport && <DailyReportModal onClose={() => setShowReport(false)} />}

      {/* --- Discount Menu Modal --- */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl flex overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-slate-100 p-4 border-r border-slate-200 flex flex-col gap-2">
              <h2 className="text-xl font-bold text-slate-800 mb-4 px-2">
                เน€เธกเธเธนเธชเนเธงเธเธฅเธ”
              </h2>
              <button
                onClick={() => setActiveTab("discount")}
                className={cn(
                  "text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors",
                  activeTab === "discount"
                    ? "bg-white shadow text-boots-base"
                    : "text-slate-500 hover:bg-slate-200",
                )}
              >
                <Percent size={20} /> เธชเนเธงเธเธฅเธ” (Discount)
              </button>
              <button
                onClick={() => setActiveTab("coupon")}
                className={cn(
                  "text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors",
                  activeTab === "coupon"
                    ? "bg-white shadow text-boots-base"
                    : "text-slate-500 hover:bg-slate-200",
                )}
              >
                <Ticket size={20} /> เธเธนเธเธญเธ (Coupons)
              </button>
              <button
                onClick={() => setActiveTab("allowance")}
                className={cn(
                  "text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors",
                  activeTab === "allowance"
                    ? "bg-white shadow text-boots-base"
                    : "text-slate-500 hover:bg-slate-200",
                )}
              >
                <Gift size={20} /> Allowance
              </button>
              <div className="mt-auto">
                <button
                  onClick={() => setShowDiscountModal(false)}
                  className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold"
                >
                  เธเธดเธ”เธซเธเนเธฒเธ•เนเธฒเธ
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-8 bg-white overflow-y-auto">
              {/* --- TAB: DISCOUNT --- */}
              {activeTab === "discount" && (
                <div>
                  <div className="flex gap-4 mb-6 border-b border-slate-200 pb-4">
                    <button
                      onClick={() => setDiscountSubTab("bill")}
                      className={cn(
                        "px-6 py-2 rounded-lg font-bold transition-all",
                        discountSubTab === "bill"
                          ? "bg-boots-base text-white shadow-md"
                          : "bg-slate-100 text-slate-500",
                      )}
                    >
                      เธฅเธ”เธ—เธฑเนเธเธเธดเธฅ
                    </button>
                    <button
                      onClick={() => setDiscountSubTab("items")}
                      className={cn(
                        "px-6 py-2 rounded-lg font-bold transition-all",
                        discountSubTab === "items"
                          ? "bg-boots-base text-white shadow-md"
                          : "bg-slate-100 text-slate-500",
                      )}
                    >
                      เธฅเธ”เธเธฒเธเธฃเธฒเธขเธเธฒเธฃ
                    </button>
                  </div>

                  {discountSubTab === "bill" && (
                    <div className="max-w-sm">
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        เธชเนเธงเธเธฅเธ”เธ—เธฑเนเธเธเธดเธฅ (%)
                      </label>
                      <div className="flex gap-4">
                        <input
                          type="number"
                          value={billDiscount.percent}
                          onChange={(e) => updateBillDiscount(e.target.value)}
                          className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-2xl font-bold focus:border-boots-base outline-none"
                          placeholder="0"
                        />
                        <div className="flex items-center text-slate-400 font-bold text-xl">
                          %
                        </div>
                      </div>
                      <p className="text-sm text-slate-400 mt-2">
                        *
                        เธเธณเธเธงเธ“เธเธฒเธเธขเธญเธ”เธซเธฅเธฑเธเธซเธฑเธเนเธเธฃเนเธกเธเธฑเนเธเนเธฅเนเธง
                      </p>
                    </div>
                  )}

                  {discountSubTab === "items" && (
                    <div>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 text-sm">
                            <th className="p-3">เธชเธดเธเธเนเธฒ</th>
                            <th className="p-3 text-right">
                              เธขเธญเธ”เธเนเธญเธเธฅเธ”
                            </th>
                            <th className="p-3 text-center w-32">
                              เธฅเธ”เน€เธเธดเนเธก (%)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {cartItems.map((item, idx) => (
                            <tr key={idx} className="border-b border-slate-100">
                              <td className="p-3 font-medium">
                                {item.name}{" "}
                                <span className="text-slate-400 text-xs">
                                  x{item.qty}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono">
                                {(item.price * item.qty).toLocaleString()}
                              </td>
                              <td className="p-3">
                                <input
                                  type="number"
                                  value={item.manualDiscountPercent || ""}
                                  onChange={(e) =>
                                    setManualItemDiscount(
                                      item.id || item.sku,
                                      e.target.value,
                                    )
                                  }
                                  className="w-full border border-slate-300 rounded-lg px-2 py-1 text-center font-bold focus:border-boots-base outline-none"
                                  placeholder="0"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* --- TAB: COUPON --- */}
              {activeTab === "coupon" && (
                <div>
                  <h3 className="text-2xl font-bold mb-6 text-slate-800">
                    เน€เธฅเธทเธญเธเธเธฃเธฐเน€เธ เธ—เธเธนเธเธญเธ
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <button
                      onClick={() => openCouponInput("store")}
                      className={cn(
                        "h-40 rounded-2xl flex flex-col items-center justify-center gap-4 text-white text-xl font-bold bg-sky-400 hover:bg-sky-500 shadow-lg",
                        btnEffect,
                      )}
                    >
                      <Ticket size={40} /> Store Coupon
                    </button>
                    <button
                      onClick={() => openCouponInput("vendor")}
                      className={cn(
                        "h-40 rounded-2xl flex flex-col items-center justify-center gap-4 text-white text-xl font-bold bg-pink-400 hover:bg-pink-500 shadow-lg",
                        btnEffect,
                      )}
                    >
                      <Tag size={40} /> Vendor Coupon
                    </button>
                    <button
                      onClick={() => openCouponInput("boots")}
                      className={cn(
                        "h-40 rounded-2xl flex flex-col items-center justify-center gap-4 text-white text-xl font-bold bg-blue-900 hover:bg-blue-800 shadow-lg",
                        btnEffect,
                      )}
                    >
                      <CheckCircle size={40} /> Boots Coupon
                    </button>
                  </div>

                  <div className="mt-8">
                    <h4 className="font-bold text-slate-700 mb-4">
                      เธเธนเธเธญเธเธ—เธตเนเนเธเนเนเธ ({coupons.length})
                    </h4>
                    {coupons.length === 0 ? (
                      <p className="text-slate-400">
                        เธขเธฑเธเนเธกเนเธกเธตเธเธนเธเธญเธ
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        {coupons.map((c, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200"
                          >
                            <div className="text-sm">
                              <span className="font-bold uppercase text-slate-700">
                                {c.couponType}
                              </span>
                              <span className="mx-2 text-slate-400">|</span>
                              Code: {c.couponCode}
                              <span className="ml-2 font-bold text-red-500">
                                -เธฟ{c.couponValue}
                              </span>
                            </div>
                            <button
                              onClick={() => removeCoupon(c.couponCode)}
                              className="text-slate-400 hover:text-red-500"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --- TAB: ALLOWANCE --- */}
              {activeTab === "allowance" && (
                <div className="max-w-sm">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    เธเธณเธเธงเธเน€เธเธดเธ Allowance
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      เธฟ
                    </span>
                    <input
                      type="number"
                      value={allowance}
                      onChange={(e) => updateAllowance(e.target.value)}
                      className="w-full border-2 border-slate-200 rounded-xl pl-10 pr-4 py-3 text-2xl font-bold focus:border-boots-base outline-none"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-sm text-slate-400 mt-2">
                    * เธฅเธ”เธเธฒเธเธขเธญเธ”เธชเธธเธ—เธเธดเธ—เนเธฒเธขเธเธดเธฅ
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* --- Coupon Input Sub-Modal --- */}
          {showCouponInput && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50">
              <div className="bg-white p-6 rounded-xl w-96 shadow-2xl animate-in zoom-in-95">
                <h3 className="text-lg font-bold mb-4 uppercase text-slate-700">
                  Add {couponInput.type} Coupon
                </h3>

                {couponInput.type !== "boots" && (
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      เธกเธนเธฅเธเนเธฒเธเธนเธเธญเธ (เธเธฒเธ—)
                    </label>
                    <input
                      autoFocus
                      type="number"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold text-lg"
                      value={couponInput.value}
                      onChange={(e) =>
                        setCouponInput({
                          ...couponInput,
                          value: e.target.value,
                        })
                      }
                    />
                  </div>
                )}

                <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    เธฃเธซเธฑเธชเธเธนเธเธญเธ / Barcode
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono"
                    value={couponInput.code}
                    onChange={(e) =>
                      setCouponInput({ ...couponInput, code: e.target.value })
                    }
                    placeholder="Scan or type..."
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCouponInput(false)}
                    className="flex-1 py-2 bg-slate-200 rounded-lg font-bold text-slate-600"
                  >
                    เธขเธเน€เธฅเธดเธ
                  </button>
                  <button
                    onClick={handleSaveCoupon}
                    className="flex-1 py-2 bg-boots-base text-white rounded-lg font-bold"
                  >
                    เธเธฑเธเธ—เธถเธ
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LEFT SIDE */}
      <div className="w-[35%] min-h-0 flex flex-col gap-4">
        {/* Input Section */}
        <div
          className={cn(
            "p-6 rounded-2xl shadow-sm border-2 relative z-40 transition-colors",
            isVoidMode
              ? "bg-red-50 border-red-300"
              : "bg-white border-slate-200",
          )}
        >
          <div className="flex justify-between items-center mb-2">
            <h2
              className={cn(
                "text-sm font-bold uppercase tracking-wider flex items-center gap-2",
                isVoidMode ? "text-red-600" : "text-slate-400",
              )}
            >
              {isVoidMode ? (
                <>
                  <MinusCircle size={16} /> VOID MODE
                  (เธชเนเธเธเน€เธเธทเนเธญเธฅเธ)
                </>
              ) : (
                <>
                  <ScanBarcode size={16} /> SCAN PRODUCT
                </>
              )}
            </h2>
            <button
              onClick={() => {
                setIsVoidMode(!isVoidMode);
                inputRef.current?.focus();
              }}
              className={cn(
                "text-xs font-bold px-3 py-1.5 rounded-lg border",
                btnEffect,
                isVoidMode
                  ? "bg-red-600 text-white border-red-600 shadow-red-200"
                  : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200",
              )}
            >
              {isVoidMode ? "EXIT VOID MODE" : "SCAN TO VOID"}
            </button>
          </div>

          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors">
              {isLoading ? (
                <Loader2 size={24} className="animate-spin text-boots-base" />
              ) : isVoidMode ? (
                <Trash2 size={24} className="text-red-500" />
              ) : (
                <Search size={24} className="text-slate-400" />
              )}
            </div>

            <input
              ref={inputRef}
              value={inputValue}
              onChange={onInputChangeWrapper}
              onKeyDown={handleInputKeyDown}
              disabled={isLoading || lastOrder || isSaving || showDiscountModal}
              type="text"
              placeholder={
                isVoidMode
                  ? "เธชเนเธเธเธชเธดเธเธเนเธฒเน€เธเธทเนเธญเธฅเธเธญเธญเธ..."
                  : "เธชเนเธเธเธเธฒเธฃเนเนเธเนเธ”... (เธเธดเธกเธเน 3* เน€เธเธทเนเธญเธฃเธฐเธเธธเธเธณเธเธงเธ)"
              }
              autoComplete="off"
              className={cn(
                "w-full pl-12 pr-4 py-4 rounded-xl border-2 outline-none transition-all shadow-inner text-xl font-bold placeholder:font-normal",
                isVoidMode
                  ? "bg-white border-red-300 text-red-600 placeholder:text-red-200 focus:ring-4 focus:ring-red-500/10 focus:border-red-500"
                  : "bg-slate-50 border-slate-200 text-boots-text placeholder:text-slate-300 focus:ring-4 focus:ring-boots-base/10 focus:border-boots-base",
              )}
            />
            {inputValue && (
              <button
                onClick={() => setInputValue("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
              >
                <X size={20} />
              </button>
            )}

            {nextQty > 1 && (
              <div className="absolute -top-3 right-0 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md flex items-center gap-1 animate-in zoom-in">
                <Hash size={12} /> Next Qty: {nextQty}
              </div>
            )}

            {showDropdown && !isVoidMode && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 max-h-[300px] overflow-y-auto z-50">
                {suggestions.map((item) => (
                  <div
                    key={item.sku}
                    onClick={() => handleSelectSuggestion(item.sku)}
                    className="p-4 border-b border-slate-50 hover:bg-boots-light/30 cursor-pointer flex justify-between items-center group"
                  >
                    <div>
                      <div className="text-slate-800 font-bold">
                        {item.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        SKU: {item.sku}
                      </div>
                    </div>
                    <div className="text-boots-base font-bold">
                      เธฟ{item.price.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {error && (
            <div className="mt-4 bg-red-50 text-red-600 px-4 py-3 rounded-xl border border-red-100 flex items-center gap-3 animate-in slide-in-from-top-2">
              <AlertCircle size={20} />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}
        </div>

        {/* Monitor Section */}
        <div
          className={cn(
            "flex-1 rounded-2xl shadow-sm border p-6 flex flex-col relative overflow-hidden transition-colors",
            isVoidMode
              ? "bg-red-50/30 border-red-200"
              : "bg-white border-slate-200",
          )}
        >
          <div className="absolute top-0 right-0 p-6 opacity-5 text-slate-400 pointer-events-none">
            <Package size={180} />
          </div>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-auto flex items-center gap-2">
            <Box size={16} /> {isVoidMode ? "Void Monitor" : "Last Scanned"}
          </h2>

          {lastItemDetail ? (
            <div className="mt-4 animate-in slide-in-from-right-4 duration-300 text-center relative z-10">
              <div
                className={cn(
                  "w-24 h-24 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-inner text-white",
                  isVoidMode ? "bg-red-500" : "bg-boots-light text-boots-base",
                )}
              >
                {isVoidMode ? <MinusCircle size={48} /> : <Package size={48} />}
              </div>
              <h3 className="text-2xl font-bold text-slate-800 leading-tight mb-2 line-clamp-2">
                {lastItemDetail.name}
              </h3>
              <div className="text-slate-400 font-mono mb-6">
                {lastItemDetail.sku}
              </div>

              {isVoidMode ? (
                <div className="text-red-600 font-bold text-xl animate-pulse">
                  REMOVED -1
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="text-6xl font-bold text-boots-base tracking-tighter">
                    เธฟ
                    {
                      // [Safe Fix] Fallback if calculatedTotal is undefined (e.g. initial add)
                      (
                        (lastItemDetail.calculatedTotal !== undefined
                          ? lastItemDetail.calculatedTotal
                          : lastItemDetail.price * lastItemDetail.qty) /
                        lastItemDetail.qty
                      ).toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })
                    }
                  </div>
                  <div className="text-sm text-slate-400 mt-1 font-medium">
                    (เธฃเธฒเธเธฒเธเธเธ•เธด)
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
              <ScanBarcode size={64} className="mb-4 opacity-50" />
              <p className="text-lg font-medium">เธเธฃเนเธญเธกเนเธเนเธเธฒเธ</p>
            </div>
          )}
          <div className="mt-auto pt-6 border-t border-slate-100 flex gap-2">
            <button
              onClick={() => setShowProductLookup(true)}
              className={cn(
                "flex-1 py-3 bg-slate-50 hover:bg-boots-light text-slate-600 hover:text-boots-base rounded-xl font-bold flex items-center justify-center gap-2",
                btnEffect,
              )}
            >
              <Search size={20} /> เธเนเธเธซเธฒเธชเธดเธเธเนเธฒ
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="w-[65%] flex flex-col bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden relative">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <img
              src="https://store.boots.co.th/images/boots-logo.png"
              alt="Boots Logo"
              className="h-8 w-auto object-contain"
            />
            <div className="h-6 w-px bg-slate-300"></div>
            <span className="font-bold text-slate-800 text-2xl">
              เธฃเธฒเธขเธเธฒเธฃเธเธฒเธข
            </span>
          </div>

          {/* BUTTON GROUP */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
              <User size={16} /> Staff #01
            </div>

            {/* Daily Report Button */}
            <button
              onClick={() => setShowReport(true)}
              className={cn(
                "px-4 py-1.5 bg-white text-slate-700 rounded-lg border border-slate-200 text-sm font-bold hover:bg-slate-50 hover:text-boots-base shadow-sm transition-all flex items-center gap-2",
                btnEffect,
              )}
              title="Daily Report"
            >
              <FileText size={16} /> Daily Report
            </button>

            {/* โ… SETTING BUTTON MOVED HERE */}
            <button
              onClick={handleAdminSettings}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 rounded-lg border border-slate-200 text-sm font-bold hover:bg-slate-50 hover:text-boots-base shadow-sm transition-all",
                btnEffect,
              )}
              title="Admin Settings"
            >
              <Settings size={16} />
              <span>Setting</span>
            </button>
          </div>
        </div>

        {/* Table Head */}
        <div className="grid grid-cols-12 gap-2 px-6 py-3 bg-slate-100/50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
          <div className="col-span-1 text-center">No.</div>
          <div className="col-span-4">เธชเธดเธเธเนเธฒ</div>
          <div className="col-span-2 text-right">เธฃเธฒเธเธฒ/เธซเธเนเธงเธข</div>
          <div className="col-span-2 text-center">เธเธณเธเธงเธ</div>
          <div className="col-span-1 text-right text-red-600">
            เธชเนเธงเธเธฅเธ”
          </div>
          <div className="col-span-2 text-right">เธฃเธงเธก</div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
              <ShoppingCart size={64} className="mb-4 opacity-50" />
              <p className="text-xl font-medium">
                เธ•เธฐเธเธฃเนเธฒเธงเนเธฒเธเน€เธเธฅเนเธฒ
              </p>
            </div>
          ) : (
            cartItems.map((item, index) => {
              // [Safe Fix] Fallback to prevent NaN
              const price = item.price || 0;
              const qty = item.qty || 0;
              const normalTotal = price * qty;
              const lineTotal =
                item.calculatedTotal !== undefined
                  ? item.calculatedTotal
                  : normalTotal;
              const discountVal = normalTotal - lineTotal;

              return (
                <div
                  key={item.id || item.sku}
                  className={cn(
                    "grid grid-cols-12 gap-2 p-3 border-b border-slate-50 items-center hover:bg-slate-50 transition-colors group relative",
                    lastScanned === item.sku && "bg-blue-50/60",
                  )}
                >
                  <div className="col-span-1 flex justify-center">
                    <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">
                      {cartItems.length - index}
                    </div>
                  </div>

                  <div className="col-span-4">
                    <div className="font-bold text-slate-800 text-base line-clamp-1">
                      {item.name}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mb-1">
                      {item.sku}
                    </div>

                    {item.badgeText ? (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] text-white px-2 py-0.5 rounded-md font-semibold shadow-sm mt-0.5"
                        style={{ backgroundColor: "#184290" }}
                      >
                        <Tag size={10} className="text-white" />{" "}
                        {item.badgeText}
                      </span>
                    ) : (
                      item.promoTag && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold mt-0.5">
                          <Tag size={10} /> {item.promoTag}
                        </span>
                      )
                    )}
                  </div>

                  <div className="col-span-2 text-right">
                    <div className="text-lg font-bold text-slate-600">
                      ราคาสินค้า{price.toLocaleString()}
                    </div>
                  </div>

                  <div className="col-span-2 flex justify-center">
                    <div className="bg-white border border-slate-200 px-2 py-1 rounded-lg font-bold text-slate-700 shadow-sm min-w-[3.5rem] text-center text-xl">
                      {qty}
                    </div>
                  </div>

                  <div className="col-span-1 text-right">
                    {discountVal > 0 ? (
                      <div className="text-sm font-bold text-red-600">
                        ลดราคา
                        {discountVal.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    ) : (
                      <div className="text-slate-300">-</div>
                    )}
                  </div>

                  <div className="col-span-2 text-right relative pr-8">
                    <div className="text-xl font-bold text-boots-base">
                      ชิ้น
                      {lineTotal.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id || item.sku)}
                      className={cn(
                        "absolute right-0 top-1/2 -translate-y-1/2 p-2 bg-white text-red-500 rounded-full shadow border border-red-100 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50",
                        btnEffect,
                      )}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-900 text-white p-6 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] z-20">
          {/* Detailed Summary */}
          <div className="flex justify-between items-end mb-4 border-b border-slate-700 pb-4">
            <div className="flex gap-8 text-sm">
              <div>
                <div className="text-slate-400 mb-1">ราคาสินคา</div>
                <div className="font-bold">
                  {(summary?.subtotal ?? 0).toLocaleString()}
                </div>
              </div>
              {summary.billDiscountAmount < 0 && (
                <div>
                  <div className="text-slate-400 mb-1">ส่วนลด</div>
                  <div className="font-bold text-orange-400">
                    {summary.billDiscountAmount.toLocaleString()}
                  </div>
                </div>
              )}
              {summary.couponTotal < 0 && (
                <div>
                  <div className="text-slate-400 mb-1">ลดคูปอง</div>
                  <div className="font-bold text-orange-400">
                    {summary.couponTotal.toLocaleString()}
                  </div>
                </div>
              )}
              {summary.allowance < 0 && (
                <div>
                  <div className="text-slate-400 mb-1">Allowance</div>
                  <div className="font-bold text-orange-400">
                    {summary.allowance.toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            {/* Discount Menu Button */}
            <button
              onClick={() => setShowDiscountModal(true)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-sm shadow-md transition-all",
                btnEffect,
              )}
            >
              <Tag size={18} /> ส่วนลด” (Discount)
            </button>
          </div>

          <div className="flex justify-between items-start mb-6">
            <div className="flex gap-8">
              <div>
                <div className="text-slate-400 text-sm font-medium mb-1">
                  จำนวนสินค้า
                </div>
                <div className="text-4xl font-bold text-white">
                  {summary.totalItems}{" "}
                  <span className="text-lg text-slate-500 font-normal">
                    Items
                  </span>
                </div>
              </div>
              {(summary.discount > 0 ||
                summary.billDiscountAmount < 0 ||
                summary.couponTotal < 0 ||
                summary.allowance < 0) && (
                <div>
                  <div className="text-orange-400 text-sm font-medium mb-1">
                    ส่วนลด
                  </div>
                  <div className="text-4xl font-bold text-orange-400">
                    -เธฟ
                    {Math.abs(
                      summary.discount +
                        summary.billDiscountAmount +
                        summary.couponTotal +
                        summary.allowance,
                    ).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-slate-400 text-sm font-medium mb-1">
                เธขเธญเธ”เธชเธธเธ—เธเธด (Net Total)
              </div>
              <div className="text-7xl font-bold tracking-tighter text-white leading-none">
                เธฟ
                {summary.netTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cartItems.length === 0 || isLoading || isSaving}
            className={cn(
              "w-full bg-boots-base hover:bg-blue-600 text-white h-20 rounded-xl text-2xl font-bold flex items-center justify-center gap-4 shadow-lg shadow-boots-base/30 disabled:opacity-50 disabled:cursor-not-allowed",
              btnEffect,
            )}
          >
            {isSaving ? (
              <Loader2 className="animate-spin w-8 h-8" />
            ) : (
              <ShoppingCart className="w-8 h-8" />
            )}
            <span>ชำระเงิน(Checkout)</span>
            <span className="bg-white/20 text-white text-sm px-3 py-1 rounded font-normal">
              F12
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
