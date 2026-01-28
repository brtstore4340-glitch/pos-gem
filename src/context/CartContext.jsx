/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useCallback } from 'react';
import { useCart as useCartLogic } from '../hooks/useCart';

// Context wrapper that exposes the rich cart state from hooks/useCart
const CartContext = createContext(null);

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};

export const CartProvider = ({ children }) => {
  const cart = useCartLogic();

  const getCartCount = useCallback(() => cart.summary.totalItems || 0, [cart.summary.totalItems]);

  const value = useMemo(() => ({
    ...cart,
    getCartCount
  }), [cart, getCartCount]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export default CartContext;

