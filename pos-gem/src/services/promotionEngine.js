// src/services/promotionEngine.js

/**
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
  if (method === "8") {
    if (dealQty <= 1) return null;

    // Specific text rules from requirements
    if (dealQty === 2) return "ซื้อ 1 แถม 1";
    if (dealQty === 3) return "ซื้อ 3 แถม 1";

    // Fallback for other quantities as per display instruction
    return `ซื้อ ${dealQty} แถม 1`;
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
    // freeCount = floor(qty / dealQty)
    const freeCount = Math.floor(qty / dealQty);
    const paidQty = qty - freeCount;

    const calculatedTotal = paidQty * unitPrice;

    // Difference is the discount
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

  // Safety: Ensure discount is not positive (price increase) unless intended,
  // but usually promotions reduce price. We allow negative discountAmount.
  // Ensure total is not negative.
  total = Math.max(0, total);

  return {
    finalTotal: total,
    discountAmount: discountAmount,
    badgeText: getPromotionBadge(rawItem),
  };
};
