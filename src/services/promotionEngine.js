/**
 * Client-Side Promotion Engine
 * Safe Mapper to handle inconsistent field names from API/DB
 * Maps various casing to standard keys.
 */
const normalizeItem = (item) => {
  // Helper to find value case-insensitively
  const getVal = (keys) => {
    for (const key of keys) {
      if (item[key] !== undefined && item[key] !== null) return item[key];
    }
    return undefined;
  };

  return {
    // Identity
    id: item.id || item.sku || item.GridProductCode || item.ProductCode,
    sku: item.sku || item.id || item.GridProductCode || item.ProductCode,
    name: item.name || item.ProductDesc || item.desc || item.description,

    // Price & Qty
    qty: parseInt(item.qty || 0),
    unitPrice: parseFloat(
      getVal(["unitPrice", "UnitPrice", "SellPrice", "regPrice", "RegPrice"]) ||
        0,
    ),

    // Promotion Fields
    method: String(
      getVal(["method", "Method", "method_maint", "Method_maint"]) || "0",
    ).trim(),
    dealQty: parseInt(getVal(["dealQty", "DealQty", "dealQty_maint"]) || 0),
    dealPrice: parseFloat(
      getVal(["dealPrice", "DealPrice", "dealPrice_maint"]) || 0,
    ),

    // Manual Discount
    manualDiscountPercent: parseFloat(item.manualDiscountPercent || 0),

    // For reference
    originalItem: item,
  };
};

/**
 * Generates the Thai Promotion Badge Text based on rules
 */
export const getPromotionBadge = (rawItem) => {
  const item = normalizeItem(rawItem);
  const { method, dealQty, dealPrice, unitPrice } = item;

  if (method === "0" || !method) return null;

  // METHOD 8: Buy N Get 1 Free style
  // dealQty = N means: buy (N-1) items, get 1 free
  if (method === "8") {
    if (dealQty <= 1) return null;

    // Specific text rules from requirements
    if (dealQty === 2) return "ซื้อ 1 แถม 1"; // จำนวนครบ 2 ชิ้นคิดราคา 1 ชิ้น ส่วนลด 1x price
    if (dealQty === 3) return "ซื้อ 2 แถม 1"; // จำนวนครบ 3 ชิ้นคิดราคา 2 ชิ้น ส่วนลด 1x price

    // Fallback for other quantities
    return `ซื้อ ${dealQty - 1} แถม 1`;
  }

  // METHOD 9: Bundle Price
  if (method === "9") {
    if (dealQty <= 1 || dealPrice <= 0) return null;
    return `ซื้อ ${dealQty} ชิ้น ในราคา ${dealPrice.toLocaleString()}`;
  }

  // METHOD 1: Special Price
  if (method === "1") {
    if (dealPrice <= 0) return null;
    let percent = 0;
    if (unitPrice > 0) {
      percent = Math.round((1 - dealPrice / unitPrice) * 100);
    }
    // Safety check for display
    if (percent <= 0) return `ราคาพิเศษ ${dealPrice.toLocaleString()}`;
    return `ราคาพิเศษ ${dealPrice.toLocaleString()} ลด ${percent}%`;
  }

  return null;
};

/**
 * Calculates the total price, discount, and line total for an item
 */
export const calculateLine = (rawItem) => {
  const item = normalizeItem(rawItem);
  const { qty, unitPrice, method, dealQty, dealPrice } = item;

  let total = 0;
  let discountAmount = 0; // Should be <= 0

  // Default: Normal Price
  total = qty * unitPrice;

  // --- LOGIC IMPLEMENTATION ---

  if (method === "8" && dealQty > 0) {
    // Rule: Pick <dealQty>, Pay for (<dealQty> - 1)
    // For every dealQty items, customer gets 1 free
    // freeCount = floor(qty / dealQty)
    const freeCount = Math.floor(qty / dealQty);
    const paidQty = qty - freeCount;

    const calculatedTotal = paidQty * unitPrice;

    // Difference is the discount (should be negative)
    discountAmount = calculatedTotal - qty * unitPrice;
    total = calculatedTotal;
  } else if (method === "9" && dealQty > 0 && dealPrice > 0) {
    // Rule: Buy dealQty items for dealPrice
    const groups = Math.floor(qty / dealQty);
    const remainder = qty % dealQty;

    const calculatedTotal = groups * dealPrice + remainder * unitPrice;

    discountAmount = calculatedTotal - qty * unitPrice;
    total = calculatedTotal;
  } else if (method === "1" && dealPrice > 0) {
    // Rule: Immediate price change
    const calculatedTotal = qty * dealPrice;

    discountAmount = calculatedTotal - qty * unitPrice;
    total = calculatedTotal;
  }

  // Safety: Ensure total is not negative
  total = Math.max(0, total);

  return {
    finalTotal: total,
    discountAmount: discountAmount,
    badgeText: getPromotionBadge(rawItem),
    normalizedItem: item,
  };
};

/**
 * Calculate full cart summary with promotions
 */
export const calculateCartSummary = (
  items,
  billDiscountPercent = 0,
  coupons = [],
  allowance = 0,
  topup = 0,
) => {
  let sumPromoTotal = 0;
  let sumTotalItems = 0;
  let sumPromoDiscount = 0;
  let sumManualItemDiscount = 0;

  const processedItems = items.map((rawItem) => {
    // 1. Promotion Calculation
    const {
      finalTotal: promoPrice,
      discountAmount: promoDisc,
      badgeText,
      normalizedItem,
    } = calculateLine(rawItem);

    // 2. Manual Item Discount
    const manualPercent = normalizedItem.manualDiscountPercent || 0;
    const manualDiscAmount = (promoPrice * manualPercent) / 100;
    const finalLineTotal = promoPrice - manualDiscAmount;

    sumPromoTotal += finalLineTotal;
    sumTotalItems += normalizedItem.qty;
    sumPromoDiscount += promoDisc;
    sumManualItemDiscount += -manualDiscAmount;

    return {
      ...rawItem, // Keep original fields
      calculatedTotal: Number(finalLineTotal.toFixed(2)),
      normalPrice: Number(
        (normalizedItem.qty * normalizedItem.unitPrice).toFixed(2),
      ),
      badgeText,
      promoDiscount: Number(promoDisc.toFixed(2)),
      manualDiscountAmount: Number((-manualDiscAmount).toFixed(2)),
    };
  });

  // 3. Bill-Wide Discount
  const billDiscAmount = (sumPromoTotal * billDiscountPercent) / 100;
  const totalAfterBillDisc = sumPromoTotal - billDiscAmount;

  // 4. Coupons
  const totalCouponValue = coupons.reduce(
    (sum, c) => sum + (c.couponValue || 0),
    0,
  );
  const totalAfterCoupons = totalAfterBillDisc - totalCouponValue;

  // 5. Allowance & Topup
  const totalAfterAllowance = totalAfterCoupons - allowance;
  const grandTotal = totalAfterAllowance - topup;

  // VAT Calculation (Inclusive 7%)
  const vatRate = 7;
  const safeGrandTotal = Math.max(0, grandTotal);
  const netBeforeVat = safeGrandTotal / (1 + vatRate / 100);
  const vatTotal = safeGrandTotal - netBeforeVat;

  return {
    items: processedItems,
    summary: {
      totalItems: sumTotalItems,
      subtotal: Number(sumPromoTotal.toFixed(2)),

      // Discount Breakdown
      promoDiscount: Number(sumPromoDiscount.toFixed(2)),
      manualItemDiscount: Number(sumManualItemDiscount.toFixed(2)),
      billDiscountAmount: Number((-billDiscAmount).toFixed(2)),
      couponTotal: Number((-totalCouponValue).toFixed(2)),
      allowance: Number((-allowance).toFixed(2)),
      topup: Number((-topup).toFixed(2)),
      discount: Number((sumPromoDiscount + sumManualItemDiscount).toFixed(2)),

      // Final
      vatTotal: Number(vatTotal.toFixed(2)),
      netTotal: Number(safeGrandTotal.toFixed(2)), // Total payable (inclusive VAT)
      grandTotal: Number(safeGrandTotal.toFixed(2)),
    },
  };
};
