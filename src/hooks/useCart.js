import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { posService } from '../services/posService';
import { calculateCartSummary as calculateClientSummary } from '../services/promotionEngine';
import { useAuth } from '../context/AuthContext';

export const useCart = () => {
  const { session } = useAuth();
  const [cartItems, setCartItems] = useState([]);

  const [billDiscount, setBillDiscount] = useState({ percent: 0, amount: 0 });
  const [coupons, setCoupons] = useState([]);
  const [allowance, setAllowance] = useState(0);
  const [topup, setTopup] = useState(0);

  const [lastScanned, setLastScanned] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [serverSummary, setServerSummary] = useState(null);
  const calculateTimeout = useRef(null);

  const triggerCalculation = useCallback(async () => {
    if (cartItems.length === 0) {
      setServerSummary(null);
      return;
    }
    if (!session?.idCode) {
      setServerSummary(null);
      return;
    }

    if (calculateTimeout.current) clearTimeout(calculateTimeout.current);

    calculateTimeout.current = setTimeout(async () => {
      try {
        const payload = {
          items: cartItems.map((item) => ({ ...item, qty: item.qty || 1 })),
          billDiscountPercent: billDiscount.percent,
          coupons,
          allowance,
          topup,
          actorIdCode: session?.idCode
        };

        const result = await posService.calculateOrder(payload);

        setCartItems((prev) =>
          result.items.map((serverItem) => {
            const local = prev.find((p) => (p.sku || p.id) === (serverItem.sku || serverItem.id));
            return { ...local, ...serverItem };
          })
        );

        setServerSummary(result.summary);
      } catch (err) {
        console.error('Calculation Error:', err);
      }
    }, 500);
  }, [cartItems, billDiscount, coupons, allowance, topup, session?.idCode]);

  useEffect(() => {
    triggerCalculation();
    return () => {
      if (calculateTimeout.current) clearTimeout(calculateTimeout.current);
    };
  }, [triggerCalculation]);

  const addToCart = async (skuOrItem, quantity = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      let product = skuOrItem;
      if (typeof skuOrItem === 'string') {
        product = await posService.scanItem(skuOrItem);
      }

      if (!product || (!product.sku && !product.id)) throw new Error('Invalid Product');

      setCartItems((prev) => {
        const key = product.sku || product.id;
        const existing = prev.find((item) => (item.sku || item.id) === key);
        if (existing) {
          return prev.map((item) => ((item.sku || item.id) === key ? { ...item, qty: item.qty + quantity } : item));
        }
        return [...prev, { ...product, qty: quantity, manualDiscountPercent: 0 }];
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
        return prev.map((item) => ((item.sku === sku || item.id === sku) ? { ...item, qty: item.qty - 1 } : item));
      }
      return prev.filter((item) => item.sku !== sku && item.id !== sku);
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
    setServerSummary(null);
  };

  const setManualItemDiscount = (id, percent) => {
    setCartItems((prev) =>
      prev.map((item) => ((item.id === id || item.sku === id) ? { ...item, manualDiscountPercent: parseFloat(percent) || 0 } : item))
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

  // Use client-side promotion calculation
  const clientCalculation = useMemo(
    () =>
      calculateClientSummary(
        cartItems,
        billDiscount.percent,
        coupons,
        allowance,
        topup
      ),
    [cartItems, billDiscount.percent, coupons, allowance, topup]
  );

  // Update cart items with calculated totals and badges from client calculation
  useEffect(() => {
    if (serverSummary) return;
    if (clientCalculation && clientCalculation.items) {
      setCartItems(prev => {
        return prev.map(item => {
          const calculated = clientCalculation.items.find(c =>
            (c.sku || c.id) === (item.sku || item.id)
          );
          if (calculated) {
            return {
              ...item,
              calculatedTotal: calculated.calculatedTotal,
              badgeText: calculated.badgeText,
              normalPrice: calculated.normalPrice
            };
          }
          return item;
        });
      });
    }
  }, [clientCalculation, serverSummary]);

  // Use server summary if available, otherwise use client calculation
  const displaySummary = serverSummary || clientCalculation.summary;

  return {
    cartItems,
    addToCart,
    decreaseItem,
    removeFromCart,
    clearCart,
    summary: displaySummary,
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
    topup,
  };
};
