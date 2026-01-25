exports.calculateCartSummary = (items) => {
  let subtotal = 0;
  let totalItems = 0;

  const processedItems = items.map((item) => {
    const total = item.price * item.qty;
    subtotal += total;
    totalItems += item.qty;
    return { ...item, total };
  });

  const vatRate = 7;
  const grandTotal = subtotal;
  const netTotal = grandTotal / (1 + vatRate / 100);
  const vatTotal = grandTotal - netTotal;

  return {
    items: processedItems,
    summary: {
      totalItems,
      subtotal: Number(subtotal.toFixed(2)),
      vatTotal: Number(vatTotal.toFixed(2)),
      grandTotal: Number(grandTotal.toFixed(2)),
    },
  };
};
