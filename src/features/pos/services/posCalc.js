export function calcSubtotal(items) {
  return items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function calcDiscount(subtotal, discount) {
  // discount: { type: "percent"|"amount", value: number }
  if (!discount) return 0;
  const sub = Number(subtotal) || 0;
  const v = Number(discount.value) || 0;

  if (discount.type === "percent") {
    return clamp((sub * v) / 100, 0, sub);
  }
  if (discount.type === "amount") {
    return clamp(v, 0, sub);
  }
  return 0;
}

export function calcTotals(items, discount) {
  const subtotal = calcSubtotal(items);
  const discountValue = calcDiscount(subtotal, discount);
  const total = Math.max(0, subtotal - discountValue);
  return { subtotal, discountValue, total };
}
