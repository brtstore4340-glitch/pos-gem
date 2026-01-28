import { useState, useMemo, useCallback } from "react";
import { calculateLine } from "../services/promotionEngine";

/**
 * Minimal + safe cart hook for pos-gem.
 * Goal (Phase 1): fix parsing error + keep behavior reasonable.
 */

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const clampQty = (qty) => {
  const q = Math.floor(toNumber(qty));
  return q < 0 ? 0 : q;
};

export const useCart = () => {
  // Items
  const [cartItems, setCartItems] = useState([]);

  // Discount / misc states
  const [billDiscount, setBillDiscount] = useState({ percent: 0, amount: 0 });
  const [coupons, setCoupons] = useState([]);
  const [allowance, setAllowance] = useState(0);
  const [topup, setTopup] = useState(0);

  const [lastScanned, setLastScanned] = useState(null);
  const [isLoading] = useState(false);
  const [error, setError] = useState(null);

  // ---- actions ----
  const addToCart = useCallback((item, qty = 1) => {
    try {
      const addQty = clampQty(qty) || 1;
      const id = item?.id ?? item?.sku ?? item?.barcode;
      if (!id) return;

      setCartItems((prev) => {
        const idx = prev.findIndex((x) => (x?.id ?? x?.sku ?? x?.barcode) === id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], qty: clampQty(toNumber(next[idx]?.qty) + addQty) };
          return next;
        }
        return [...prev, { ...item, qty: addQty }];
      });

      setLastScanned(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const decreaseItem = useCallback((idOrItem, qty = 1) => {
    try {
      const decQty = clampQty(qty) || 1;
      const id = typeof idOrItem === "object" ? (idOrItem?.id ?? idOrItem?.sku ?? idOrItem?.barcode) : idOrItem;

      setCartItems((prev) =>
        prev
          .map((it) => {
            const itId = it?.id ?? it?.sku ?? it?.barcode;
            if (itId !== id) return it;
            const nextQty = clampQty(toNumber(it?.qty) - decQty);
            return { ...it, qty: nextQty };
          })
          .filter((it) => clampQty(it?.qty) > 0)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const removeFromCart = useCallback((idOrItem) => {
    try {
      const id = typeof idOrItem === "object" ? (idOrItem?.id ?? idOrItem?.sku ?? idOrItem?.barcode) : idOrItem;
      setCartItems((prev) => prev.filter((it) => (it?.id ?? it?.sku ?? it?.barcode) !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setBillDiscount({ percent: 0, amount: 0 });
    setCoupons([]);
    setAllowance(0);
    setTopup(0);
    setLastScanned(null);
    setError(null);
  }, []);

  // ---- derived ----
  const { enrichedItems, summary } = useMemo(() => {
    const items = Array.isArray(cartItems) ? cartItems : [];

    const computed = items.map((it) => {
      // If calculateLine exists, use it. Otherwise fallback to simple calc.
      if (typeof calculateLine === "function") {
        try {
          return calculateLine(it);
        } catch {
          // ignore and fallback
        }
      }

      const price = toNumber(it?.price);
      const qty = clampQty(it?.qty);
      return { ...it, price, qty, lineTotal: price * qty };
    });

    const subtotal = computed.reduce((sum, it) => sum + toNumber(it?.lineTotal ?? (toNumber(it?.price) * clampQty(it?.qty))), 0);

    const bdPercent = toNumber(billDiscount?.percent);
    const bdAmount = toNumber(billDiscount?.amount);
    const discountFromPercent = bdPercent > 0 ? (subtotal * bdPercent) / 100 : 0;

    const discount = Math.max(0, discountFromPercent + bdAmount);
    const netBeforeCredits = Math.max(0, subtotal - discount);

    const allow = Math.max(0, toNumber(allowance));
    const tp = Math.max(0, toNumber(topup));

    const total = Math.max(0, netBeforeCredits - allow - tp);

    return {
      enrichedItems: computed,
      summary: {
        subtotal,
        discount,
        netBeforeCredits,
        allowance: allow,
        topup: tp,
        total,
        itemCount: computed.reduce((sum, it) => sum + clampQty(it?.qty), 0),
      },
    };
  }, [cartItems, billDiscount, allowance, topup]);

  return {
    // data
    cartItems,
    enrichedItems,
    summary,

    // actions
    addToCart,
    decreaseItem,
    removeFromCart,
    clearCart,

    // states + setters
    billDiscount,
    setBillDiscount,
    coupons,
    setCoupons,
    allowance,
    setAllowance,
    topup,
    setTopup,
    lastScanned,
    setLastScanned,
    isLoading,
    error,
  };
};

export default useCart;
