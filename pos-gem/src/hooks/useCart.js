import { useState, useMemo } from "react";
import { calculateLine } from "../services/promotionEngine";

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
export const useCart = () => {
  const [cartItems, setCartItems] = useState([]);

  // Discount States
  const [billDiscount, setBillDiscount] = useState({ percent: 0, amount: 0 });
  const [coupons, setCoupons] = useState([]);
  const [allowance, setAllowance] = useState(0);
  const [topup, setTopup] = useState(0); // [FIX] Added State

  const [lastScanned, setLastScanned] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // --- 🧠 CALCULATION ENGINE ---
  const { summary, enrichedItems } = useMemo(() => {
    let sumPromoTotal = 0;
    let sumTotalItems = 0;
    let sumPromoDiscount = 0;
    let sumManualItemDiscount = 0;

    // 1. Calculate Per-Item
    const processedItems = cartItems.map((item) => {
      const newItem = { ...item };

      // A. Promotion
      const promoResult = calculateLine(newItem);
      const promoPrice = promoResult.finalTotal;

      // B. Manual Item Discount
      const manualPercent = newItem.manualDiscountPercent || 0;
      const manualDiscAmount = (promoPrice * manualPercent) / 100;
      const finalLineTotal = promoPrice - manualDiscAmount;

      newItem.calculatedTotal = finalLineTotal;
      newItem.badgeText = promoResult.badgeText;
      newItem.promoDiscount = promoResult.discountAmount;
      newItem.manualDiscountAmount = -manualDiscAmount;

      sumPromoTotal += finalLineTotal;
      sumTotalItems += newItem.qty;
      sumPromoDiscount += promoResult.discountAmount;
      sumManualItemDiscount += -manualDiscAmount;

      return newItem;
    });

    // 2. Bill-Wide Discount
    const billDiscAmount = (sumPromoTotal * billDiscount.percent) / 100;
    const totalAfterBillDisc = sumPromoTotal - billDiscAmount;

    // 3. Coupons
    const totalCouponValue = coupons.reduce(
      (sum, c) => sum + (c.couponValue || 0),
      0,
    );
    const totalAfterCoupons = totalAfterBillDisc - totalCouponValue;

    // 4. Allowance & Topup
    const totalAfterAllowance = totalAfterCoupons - allowance;
    const finalNetTotal = totalAfterAllowance - topup; // Apply Topup

    return {
      enrichedItems: processedItems,
      summary: {
        subtotal: toNumber(subtotal),
        totalItems: sumTotalItems,
        discount: sumPromoDiscount + sumManualItemDiscount,
        netTotal: Math.max(0, finalNetTotal),

        // Breakdown
        promoDiscount: sumPromoDiscount,
        manualItemDiscount: sumManualItemDiscount,
        billDiscountAmount: -billDiscAmount,
        couponTotal: -totalCouponValue,
        allowance: -allowance,
        topup: -topup,
      },
    };
  }, [cartItems, billDiscount, coupons, allowance, topup]);

  // --- Actions ---
  const addToCart = async (skuOrItem, quantity = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const product = skuOrItem;
      if (!product || (!product.sku && !product.id))
        throw new Error("Invalid Product");

      setCartItems((prev) => {
        const key = product.sku || product.id;
        const existing = prev.find((item) => (item.sku || item.id) === key);
        if (existing) {
          return prev.map((item) =>
            (item.sku || item.id) === key
              ? { ...item, qty: item.qty + quantity }
              : item,
          );
        }
        return [
          ...prev,
          { ...product, qty: quantity, manualDiscountPercent: 0 },
        ];
      });
      setLastScanned(product.sku || product.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const decreaseItem = (sku) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.sku === sku || item.id === sku);
      if (!existing) return prev;
      if (existing.qty > 1) {
        return prev.map((item) =>
          item.sku === sku || item.id === sku
            ? { ...item, qty: item.qty - 1 }
            : item,
        );
      } else {
        return prev.filter((item) => item.sku !== sku && item.id !== sku);
      }
    });
    setLastScanned(sku);
  };

  const removeFromCart = (id) => {
    setCartItems((prev) => prev.filter((item) => (item.id || item.sku) !== id));
  };

  const clearCart = () => {
    setCartItems([]);
    setBillDiscount({ percent: 0, amount: 0 });
    setCoupons([]);
    setAllowance(0);
    setTopup(0);
    setLastScanned(null);
  };

  const setManualItemDiscount = (id, percent) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === id || item.sku === id
          ? { ...item, manualDiscountPercent: parseFloat(percent) || 0 }
          : item,
      ),
    );
  };

  const updateBillDiscount = (percent) => {
    setBillDiscount({ percent: parseFloat(percent) || 0, amount: 0 });
  };

  const addCoupon = (couponData) => {
    setCoupons((prev) => [...prev, { ...couponData, createdAt: new Date() }]);
  };

  const removeCoupon = (code) => {
    setCoupons((prev) => prev.filter((c) => c.couponCode !== code));
  };

  const updateAllowance = (amount) => {
    setAllowance(parseFloat(amount) || 0);
  };

  const updateTopup = (amount) => {
    setTopup(parseFloat(amount) || 0);
  };

  return {
    cartItems: enrichedItems,
    addToCart,
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
    updateTopup,
    topup, // [FIX] Return topup
  };
};
