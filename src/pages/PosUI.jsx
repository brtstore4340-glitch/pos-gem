// src/pages/PosUI.jsx
import React, { useState, useEffect } from "react";
import {
  ShoppingCart,
  Search,
  ScanBarcode,
  Trash2,
  Loader2,
  UploadCloud,
  FileText,
  Monitor,
  Package,
  Percent,
} from "lucide-react";
import { cn } from "../utils/cn";
import { useCart } from "../hooks/useCart";
import { useScanListener } from "../hooks/useScanListener";
import ReceiptModal from "./ReceiptModal";
import ProductLookupModal from "./ProductLookupModal";
import DailyReportModal from "./DailyReportModal";
import PosUploadModal from "./PosUploadModal";
import NeuClock from "../components/NeuClock";
import { posService } from "../services/posService";
import { useTheme } from "../context/ThemeContext";

export default function PosUI({ isDarkMode: externalDarkMode }) {
  const theme = useTheme();
  const {
    cartItems,
    addToCart: originalAddToCart,
    decreaseItem,
    clearCart,
    summary,
    lastScanned,
    isLoading,
    updateBillDiscount,
    billDiscount,

    removeCoupon,
    coupons,
    updateAllowance,
    allowance,
    topup,
  } = useCart();

  const [lastOrder, setLastOrder] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isVoidMode, setIsVoidMode] = useState(false);
  const [nextQty, setNextQty] = useState(1);

  const isDarkMode = externalDarkMode ?? theme?.isDark ?? false;

  // Navigation State
  const [activeTab, setActiveTab] = useState("POS");

  // Modal States
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProductLookup, setShowProductLookup] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Discount modal states
  const [activeTabDiscount, setActiveTabDiscount] = useState("discount");

  const navItemStyle = (isActive) =>
    cn(
      "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 cursor-pointer select-none shrink-0 btn-press shadow-orange-500/20",
      isActive
        ? "bg-[#0B2A97] text-white"
        : isDarkMode
          ? "text-slate-400 hover:bg-slate-800 hover:text-white"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
    );

  const lastItemDetail = lastScanned
    ? cartItems.find((i) => i.sku === lastScanned || i.id === lastScanned)
    : null;

  const handleScanAction = async (skuOrItem) => {
    // Removed showCouponInput check

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
      summary,
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
      alert("Error: " + (err?.message || err));
    } finally {
      setIsSaving(false);
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
      if (inputValue.length >= 2 && !isVoidMode && !showDiscountModal) {
        let results = await posService.searchProducts(inputValue);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, isVoidMode, showDiscountModal]);

  const handleSelectSuggestion = async (sku) => {
    const item = await posService.scanItem(sku);
    await handleScanAction(item);
    setInputValue("");
    setShowDropdown(false);
  };

  useEffect(() => {
    const canFocus =
      !lastOrder &&
      !isSaving &&
      !showDiscountModal &&
      !showProductLookup &&
      !showReport;
    if (!canFocus) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [
    lastOrder,
    isSaving,
    showDiscountModal,
    showProductLookup,
    showReport,
    inputRef,
  ]);

  return (
    <div
      className={cn(
        "min-h-screen w-full font-sans flex flex-col overflow-hidden transition-colors duration-300",
        isDarkMode ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-900",
      )}
    >
      {/* Modals */}
      {lastOrder && (
        <ReceiptModal
          order={lastOrder}
          onClose={() => setLastOrder(null)}
          isDarkMode={isDarkMode}
        />
      )}
      {showProductLookup && (
        <ProductLookupModal
          onClose={() => setShowProductLookup(false)}
          isDarkMode={isDarkMode}
        />
      )}
      {showReport && (
        <DailyReportModal
          onClose={() => setShowReport(false)}
          isDarkMode={isDarkMode}
        />
      )}
      {showUploadModal && (
        <PosUploadModal
          open={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Discount Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div
            className={cn(
              "w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh]",
              isDarkMode ? "bg-slate-800" : "bg-white",
            )}
          >
            {/* Header */}
            <div
              className={cn(
                "p-6 border-b",
                isDarkMode ? "border-slate-700" : "border-slate-200",
              )}
            >
              <h2
                className={cn(
                  "text-2xl font-bold",
                  isDarkMode ? "text-white" : "text-slate-900",
                )}
              >
                ส่วนลด & คูปอง
              </h2>
            </div>

            {/* Tabs */}
            <div
              className={cn(
                "flex border-b",
                isDarkMode
                  ? "border-slate-700 bg-slate-700"
                  : "border-slate-200 bg-slate-100",
              )}
            >
              <button
                onClick={() => setActiveTabDiscount("discount")}
                className={cn(
                  "flex-1 px-6 py-3 font-bold transition-colors",
                  activeTabDiscount === "discount"
                    ? isDarkMode
                      ? "bg-blue-600 text-white"
                      : "bg-blue-500 text-white"
                    : isDarkMode
                      ? "text-slate-300"
                      : "text-slate-600",
                )}
              >
                <Percent className="inline mr-2" size={18} /> Discount
              </button>
              <button
                onClick={() => setActiveTabDiscount("coupon")}
                className={cn(
                  "flex-1 px-6 py-3 font-bold transition-colors",
                  activeTabDiscount === "coupon"
                    ? isDarkMode
                      ? "bg-blue-600 text-white"
                      : "bg-blue-500 text-white"
                    : isDarkMode
                      ? "text-slate-300"
                      : "text-slate-600",
                )}
              >
                <FileText className="inline mr-2" size={18} /> Coupon
              </button>
              <button
                onClick={() => setActiveTabDiscount("allowance")}
                className={cn(
                  "flex-1 px-6 py-3 font-bold transition-colors",
                  activeTabDiscount === "allowance"
                    ? isDarkMode
                      ? "bg-blue-600 text-white"
                      : "bg-blue-500 text-white"
                    : isDarkMode
                      ? "text-slate-300"
                      : "text-slate-600",
                )}
              >
                <Package className="inline mr-2" size={18} /> Allowance
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTabDiscount === "discount" && (
                <div className="space-y-4">
                  <div>
                    <label
                      className={cn(
                        "block text-sm font-bold mb-2",
                        isDarkMode ? "text-slate-300" : "text-slate-700",
                      )}
                    >
                      Discount %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={billDiscount.percent}
                      onChange={(e) =>
                        updateBillDiscount({
                          ...billDiscount,
                          percent: parseFloat(e.target.value) || 0,
                        })
                      }
                      className={cn(
                        "w-full px-4 py-2 rounded-lg border transition-colors",
                        isDarkMode
                          ? "bg-slate-700 border-slate-600 text-white"
                          : "bg-white border-slate-300 text-slate-900",
                      )}
                    />
                  </div>
                  <div>
                    <label
                      className={cn(
                        "block text-sm font-bold mb-2",
                        isDarkMode ? "text-slate-300" : "text-slate-700",
                      )}
                    >
                      Fixed Amount
                    </label>
                    <input
                      type="number"
                      value={billDiscount.amount}
                      onChange={(e) =>
                        updateBillDiscount({
                          ...billDiscount,
                          amount: parseFloat(e.target.value) || 0,
                        })
                      }
                      className={cn(
                        "w-full px-4 py-2 rounded-lg border transition-colors",
                        isDarkMode
                          ? "bg-slate-700 border-slate-600 text-white"
                          : "bg-white border-slate-300 text-slate-900",
                      )}
                    />
                  </div>
                </div>
              )}

              {activeTabDiscount === "coupon" && (
                <div className="space-y-4">
                  {coupons.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {coupons.map((c, i) => (
                        <div
                          key={i}
                          className={cn(
                            "p-3 rounded-lg flex justify-between items-center",
                            isDarkMode ? "bg-slate-700" : "bg-slate-100",
                          )}
                        >
                          <span className="font-bold">
                            {c.couponCode} - ${c.couponValue}
                          </span>
                          <button
                            onClick={() => removeCoupon(i)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Coupon input removed */}
                </div>
              )}

              {activeTabDiscount === "allowance" && (
                <div className="space-y-4">
                  <div>
                    <label
                      className={cn(
                        "block text-sm font-bold mb-2",
                        isDarkMode ? "text-slate-300" : "text-slate-700",
                      )}
                    >
                      Allowance Amount
                    </label>
                    <input
                      type="number"
                      value={allowance}
                      onChange={(e) =>
                        updateAllowance(parseFloat(e.target.value) || 0)
                      }
                      className={cn(
                        "w-full px-4 py-2 rounded-lg border transition-colors",
                        isDarkMode
                          ? "bg-slate-700 border-slate-600 text-white"
                          : "bg-white border-slate-300 text-slate-900",
                      )}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className={cn(
                "p-6 border-t flex gap-3",
                isDarkMode ? "border-slate-700" : "border-slate-200",
              )}
            >
              <button
                onClick={() => setShowDiscountModal(false)}
                className={cn(
                  "flex-1 px-4 py-3 rounded-lg font-bold transition-colors",
                  isDarkMode
                    ? "bg-slate-700 hover:bg-slate-600 text-white"
                    : "bg-slate-200 hover:bg-slate-300",
                )}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main POS Layout */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Toolbar */}
        <div
          className={cn(
            "p-4 border-b flex items-center gap-3",
            isDarkMode
              ? "border-slate-700 bg-slate-800"
              : "border-slate-200 bg-white",
          )}
        >
          <div className="flex gap-2 flex-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab("POS")}
              className={navItemStyle(activeTab === "POS")}
            >
              <Monitor size={18} /> POS
            </button>
            <button
              onClick={() => setShowProductLookup(true)}
              className={navItemStyle(false)}
            >
              <Search size={18} /> Search
            </button>
            <button
              onClick={() => setShowReport(true)}
              className={navItemStyle(false)}
            >
              <FileText size={18} /> Report
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className={navItemStyle(false)}
            >
              <UploadCloud size={18} /> Upload
            </button>
          </div>
          <NeuClock isDarkMode={isDarkMode} />
        </div>

        {/* Content Area */}
        <div className="flex-1 flex gap-4 p-4 overflow-hidden">
          {/* Left: Scan Section */}
          <div className="w-[35%] max-w-[500px] flex flex-col gap-4 overflow-hidden">
            <div
              className={cn(
                "p-4 rounded-xl border",
                isDarkMode
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-slate-200",
              )}
            >
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <ScanBarcode size={18} /> Scan / Search
              </h3>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={onInputChangeWrapper}
                  onKeyDown={handleInputKeyDown}
                  placeholder="ค้นหาหรือสแกน..."
                  className={cn(
                    "w-full px-4 py-3 rounded-lg border transition-colors",
                    isDarkMode
                      ? "bg-slate-700 border-slate-600 text-white"
                      : "bg-white border-slate-300",
                  )}
                  disabled={isLoading}
                />
                {showDropdown && (
                  <div
                    className={cn(
                      "absolute top-full left-0 right-0 mt-2 rounded-lg border shadow-lg z-10 max-h-64 overflow-y-auto",
                      isDarkMode
                        ? "bg-slate-700 border-slate-600"
                        : "bg-white border-slate-300",
                    )}
                  >
                    {suggestions.map((item) => (
                      <button
                        key={item.sku}
                        onClick={() => handleSelectSuggestion(item.sku)}
                        className={cn(
                          "w-full text-left px-4 py-2 border-b hover:opacity-80 transition-opacity",
                          isDarkMode ? "border-slate-600" : "border-slate-200",
                        )}
                      >
                        <div className="font-bold">{item.name}</div>
                        <div className="text-sm opacity-75">{item.sku}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Last Item */}
            {lastItemDetail && (
              <div
                className={cn(
                  "p-4 rounded-xl border",
                  isDarkMode
                    ? "bg-slate-800 border-slate-700"
                    : "bg-white border-slate-200",
                )}
              >
                <h4 className="font-bold text-sm mb-2">Last Scanned</h4>
                <div className="text-sm">
                  <div className="font-bold">{lastItemDetail.name}</div>
                  <div className="opacity-75">{lastItemDetail.sku}</div>
                </div>
              </div>
            )}

            {/* Modes */}
            <div
              className={cn(
                "p-4 rounded-xl border space-y-2",
                isDarkMode
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-slate-200",
              )}
            >
              <button
                onClick={() => setIsVoidMode(!isVoidMode)}
                className={cn(
                  "w-full py-2 rounded-lg font-bold transition-colors",
                  isVoidMode
                    ? "bg-red-500 text-white"
                    : isDarkMode
                      ? "bg-slate-700 text-slate-300"
                      : "bg-slate-200",
                )}
              >
                {isVoidMode ? "🚫 VOID MODE" : "Void Mode"}
              </button>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={nextQty}
                  onChange={(e) => setNextQty(parseInt(e.target.value) || 1)}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg border",
                    isDarkMode
                      ? "bg-slate-700 border-slate-600 text-white"
                      : "bg-white border-slate-300",
                  )}
                />
                <span
                  className={cn(
                    "py-2 px-3 rounded-lg font-bold",
                    isDarkMode ? "bg-slate-700" : "bg-slate-200",
                  )}
                >
                  Qty: {nextQty}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Cart Section */}
          <div className="flex-1 flex flex-col gap-4 overflow-hidden min-w-0">
            {/* Cart Items */}
            <div
              className={cn(
                "flex-1 rounded-xl border p-4 overflow-y-auto flex flex-col gap-2",
                isDarkMode
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-slate-200",
              )}
            >
              <h3 className="font-bold sticky top-0 flex items-center gap-2">
                <ShoppingCart size={18} /> Cart ({cartItems.length})
              </h3>
              {cartItems.length === 0 ? (
                <div
                  className={cn(
                    "flex items-center justify-center h-32 opacity-50",
                    isDarkMode ? "text-slate-400" : "text-slate-500",
                  )}
                >
                  No items
                </div>
              ) : (
                cartItems.map((item, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-3 rounded-lg border flex items-center justify-between group",
                      isDarkMode
                        ? "bg-slate-700 border-slate-600 hover:bg-slate-600"
                        : "bg-slate-100 border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{item.name}</div>
                      <div className="text-xs opacity-75">
                        {item.qty} × ฿{item.price?.toFixed(2) || "0.00"} = ฿
                        {(item.qty * (item.price || 0)).toFixed(2)}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => decreaseItem(item.sku || item.id)}
                        className="p-1 hover:bg-red-500 hover:text-white rounded transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Summary */}
            <div
              className={cn(
                "p-4 rounded-xl border space-y-2",
                isDarkMode
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-slate-200",
              )}
            >
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>฿{summary.subtotal?.toFixed(2) || "0.00"}</span>
              </div>
              {billDiscount.percent > 0 && (
                <div className="flex justify-between text-sm text-orange-500">
                  <span>Discount ({billDiscount.percent}%):</span>
                  <span>-฿{summary.discountAmount?.toFixed(2) || "0.00"}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total:</span>
                <span>฿{summary.total?.toFixed(2) || "0.00"}</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDiscountModal(true)}
                className={cn(
                  "flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors",
                  isDarkMode
                    ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                    : "bg-yellow-500 hover:bg-yellow-600 text-white",
                )}
              >
                <Percent size={18} /> Discount
              </button>
              <button
                onClick={handleCheckout}
                disabled={isSaving || cartItems.length === 0}
                className={cn(
                  "flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50",
                  isDarkMode
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-green-500 hover:bg-green-600 text-white",
                )}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <ShoppingCart size={18} /> Checkout
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
