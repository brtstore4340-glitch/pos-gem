import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { posService } from '../services/posService';


const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const lineTotalOf = (item) => {
  const price = toNumber(item?.price);
  const qty = toNumber(item?.qty || 0);
  const normalTotal = price * qty;
  if (item?.calculatedTotal !== undefined && item?.calculatedTotal !== null) {
    const lt = toNumber(item.calculatedTotal);
    return lt > 0 ? lt : normalTotal;
  }
  return normalTotal;
};export const useCart = () => {
  const [cartItems, setCartItems] = useState([]);
  
  // Discount States
  const [billDiscount, setBillDiscount] = useState({ percent: 0, amount: 0 });
  const [coupons, setCoupons] = useState([]);
  const [allowance, setAllowance] = useState(0);
  const [topup, setTopup] = useState(0);
  
  const [lastScanned, setLastScanned] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Server-side summary state
  const [serverSummary, setServerSummary] = useState(null);

  // Debounce for calculation to avoid spamming Cloud Functions
  const calculateTimeout = useRef(null);

  // --- 🧠 SERVER CALCULATION ENGINE ---
  const triggerCalculation = useCallback(async () => {
    // If empty, reset summary
    if (cartItems.length === 0) {
      setServerSummary(null);
      return;
    }

    // Debounce
    if (calculateTimeout.current) clearTimeout(calculateTimeout.current);

    calculateTimeout.current = setTimeout(async () => {
      try {
        const payload = {
          items: cartItems.map(i => ({ ...i, qty: i.qty || 1 })),
          billDiscountPercent: billDiscount.percent,
          coupons,
          allowance,
          topup
        };

        const result = await posService.calculateOrder(payload);
        
        // Update both items (for badge/promo text) and summary
        // We merge result items back to cartItems to show badges/discounts
        // BUT we must be careful not to override local state like "qty" if user is typing fast
        // For "Thin Client", source of truth is Server, so we SHOULD update.
        // However, to keep UI snappy, maybe just update "enrichment" fields.
        
        // Let's update the cartItems with enriched data from server (badges, prices)
        // We trust the server's calculation for "calculatedTotal" etc.
        setCartItems(prev => {
           // Map server items back to local items order? 
           // Or just replace? Replacing is safer for sync.
           // But if user added item while request in flight? 
           // Optimistic UI implies we keep local changes.
           // For V1.1, let's just replace and see if it feels laggy.
           // Ideally, we match by ID.
           
           return result.items.map(serverItem => {
             const local = prev.find(p => (p.sku || p.id) === (serverItem.sku || serverItem.id));
             // If local has changed qty since request, we might have a sync issue.
             // But usually for "calculate", we just display result.
             return { ...local, ...serverItem };
           });
        });

        setServerSummary(result.summary);
      } catch (err) {
        console.error("Calculation Error:", err);
        // Don't block UI, just keep old summary or show warning?
      }
    }, 500); // 500ms debounce
  }, [cartItems, billDiscount, coupons, allowance, topup]);

  // Trigger calculation when dependencies change
  useEffect(() => {
    triggerCalculation();
    return () => {
        if (calculateTimeout.current) clearTimeout(calculateTimeout.current);
    };
  }, [triggerCalculation]);


  // --- Actions ---
  const addToCart = async (skuOrItem, quantity = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Resolve Item (if string SKU passed) - though UI usually passes object from scan
      let product = skuOrItem;
      if (typeof skuOrItem === 'string') {
          // It's a SKU scan
          product = await posService.scanItem(skuOrItem);
      }
      
      if (!product || (!product.sku && !product.id)) throw new Error('Invalid Product');

      setCartItems(prev => {
        const key = product.sku || product.id;
        const existing = prev.find(item => (item.sku || item.id) === key);
        if (existing) {
          return prev.map(item => 
            (item.sku || item.id) === key ? { ...item, qty: item.qty + quantity } : item
          );
        }
        return [...prev, { ...product, qty: quantity, manualDiscountPercent: 0 }];
      });
      setLastScanned(product.sku || product.id);
      
      // Calculation will trigger via useEffect
      
    } catch (err) {
      setError(err.message);
      // Optional: Play error sound here
    } finally {
      setIsLoading(false);
    }
  };

  const decreaseItem = (sku) => {
    setCartItems(prev => {
      const existing = prev.find(item => (item.sku === sku || item.id === sku));
      if (!existing) return prev;
      if (existing.qty > 1) {
        return prev.map(item => (item.sku === sku || item.id === sku) ? { ...item, qty: item.qty - 1 } : item);
      } else {
        return prev.filter(item => (item.sku !== sku && item.id !== sku));
      }
    });
    setLastScanned(sku);
  };

  const removeFromCart = (id) => {
    setCartItems(prev => prev.filter(item => (item.id || item.sku) !== id));
  };

  const clearCart = () => {
    setCartItems([]);
    setBillDiscount({ percent: 0, amount: 0 });
    setCoupons([]);
    setAllowance(0);
    setTopup(0);
    setLastScanned(null);
    setServerSummary(null);
  };

  const setManualItemDiscount = (id, percent) => {
    setCartItems(prev => prev.map(item => 
      (item.id === id || item.sku === id) ? { ...item, manualDiscountPercent: parseFloat(percent) || 0 } : item
    ));
  };

  const updateBillDiscount = (percent) => {
    setBillDiscount({ percent: parseFloat(percent) || 0, amount: 0 });
  };

  const addCoupon = (couponData) => {
    setCoupons(prev => [...prev, { ...couponData, createdAt: new Date() }]);
  };

  const removeCoupon = (code) => {
    setCoupons(prev => prev.filter(c => c.couponCode !== code));
  };

  const updateAllowance = (amount) => {
    setAllowance(parseFloat(amount) || 0);
  };
  
  const updateTopup = (amount) => {
    setTopup(parseFloat(amount) || 0);
  };

  // --- Local fallback totals (when serverSummary not ready) ---
  const subtotalLocal = useMemo(() => {
    return (cartItems ?? []).reduce((sum, it) => sum + lineTotalOf(it), 0);
  }, [cartItems]);

  const totalItemsLocal = useMemo(() => {
    return (cartItems ?? []).reduce((a, b) => a + toNumber(b?.qty ?? 0), 0);
  }, [cartItems]);

  // For fallback UI only: assume discount/vat not computed locally
  const netTotalLocal = useMemo(() => Math.max(0, subtotalLocal), [subtotalLocal]);
  // Construct Summary Object (Fallback to local simple calc if server not ready?)
  // For thin client, we prefer waiting for server, but we can show "Calculating..."
    const displaySummary = serverSummary || {
    subtotal: subtotalLocal,
    totalItems: totalItemsLocal,
    discount: 0,
    netTotal: netTotalLocal,
    vatTotal: 0,
    grandTotal: netTotalLocal,

    // Breakdown
    promoDiscount: 0,
    manualItemDiscount: 0,
    billDiscountAmount: 0,
    couponTotal: 0,
    allowance: toNumber(allowance),
    topup: toNumber(topup),
  };

  return { 
    cartItems,
    addToCart, decreaseItem, removeFromCart, clearCart, 
    summary: displaySummary, 
    lastScanned, isLoading, error,
    setManualItemDiscount, updateBillDiscount, billDiscount,
    addCoupon, removeCoupon, coupons,
    updateAllowance, allowance,
    updateTopup, topup
  };
};



