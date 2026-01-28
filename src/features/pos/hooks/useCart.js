import * as React from "react";

export function useCart() {
  const [items, setItems] = React.useState([]);

  const addItem = React.useCallback((product, qty = 1) => {
    const q = Math.max(1, Number(qty) || 1);
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: (Number(next[idx].qty) || 0) + q };
        return next;
      }
      return [...prev, { ...product, qty: q }];
    });
  }, []);

  const setQty = React.useCallback((id, qty) => {
    const q = Number(qty) || 0;
    setItems((prev) => {
      if (q <= 0) return prev.filter((x) => x.id !== id);
      return prev.map((x) => (x.id === id ? { ...x, qty: q } : x));
    });
  }, []);

  const inc = React.useCallback((id) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, qty: (Number(x.qty) || 0) + 1 } : x)));
  }, []);

  const dec = React.useCallback((id) => {
    setItems((prev) =>
      prev
        .map((x) => (x.id === id ? { ...x, qty: (Number(x.qty) || 0) - 1 } : x))
        .filter((x) => (Number(x.qty) || 0) > 0)
    );
  }, []);

  const removeItem = React.useCallback((id) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const clear = React.useCallback(() => setItems([]), []);

  return { items, addItem, setQty, inc, dec, removeItem, clear };
}
