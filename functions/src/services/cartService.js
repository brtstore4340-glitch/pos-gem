/**
 * Safe Mapper to handle inconsistent field names from API/DB
 * Maps various casing to standard keys.
 */
// BEGIN: THAM:IMPORT_FIELD_MAPPER_V1
const { mapFields: thamMapFields } = require('../utils/fieldMapper');
// END:   THAM:IMPORT_FIELD_MAPPER_V1
const normalizeItem = (item) => {
  const getVal = (keys) => {
    for (const key of keys) {
      if (item[key] !== undefined && item[key] !== null) return item[key];
    }
    return undefined;
  };

  return {
    // Identity
    id: item.id || item.sku || item.GridProductCode || item.ProductCode,
    sku: item.sku || item.id || item.GridProductCode || item.ProductCode, // Standardize SKU
    name: item.name || item.ProductDesc || item.desc || item.description,
    
    // Price & Qty
    qty: parseInt(item.qty || 0),
    unitPrice: parseFloat(getVal(['unitPrice', 'UnitPrice', 'SellPrice', 'regPrice', 'RegPrice']) || 0),
    
    // Promotion Fields
    method: String(getVal(['method', 'Method', 'method_maint', 'Method_maint']) || '0').trim(),
    dealQty: parseInt(getVal(['dealQty', 'DealQty', 'dealQty_maint']) || 0),
    dealPrice: parseFloat(getVal(['dealPrice', 'DealPrice', 'dealPrice_maint']) || 0),
    
    // Manual Discount
    manualDiscountPercent: parseFloat(item.manualDiscountPercent || 0),
    
    // Pass through original
    originalItem: item
  };
};

/**
 * Generates the Thai Promotion Badge Text based on rules
 */
const getPromotionBadge = (item) => {
  const { method, dealQty, dealPrice, unitPrice } = item;

  if (method === '0' || !method) return null;

  // METHOD 8: Buy N Get 1 Free style
  if (method === '8') {
    if (dealQty <= 1) return null;
    if (dealQty === 2) return "ซื้อ 1 แถม 1";
    if (dealQty === 3) return "ซื้อ 3 แถม 1";
    return `ซื้อ ${dealQty} แถม 1`; 
  }

  // METHOD 9: Bundle Price
  if (method === '9') {
    if (dealQty <= 1 || dealPrice <= 0) return null;
    return `ซื้อ ${dealQty} ชิ้น ในราคา ${dealPrice.toLocaleString()}`;
  }

  // METHOD 1: Special Price
  if (method === '1') {
    if (dealPrice <= 0) return null;
    let percent = 0;
    if (unitPrice > 0) {
      percent = Math.round((1 - (dealPrice / unitPrice)) * 100);
    }
    if (percent <= 0) return `ราคาพิเศษ ${dealPrice.toLocaleString()}`;
    return `ราคาพิเศษ ${dealPrice.toLocaleString()} ลด ${percent}%`;
  }

  return null;
};

/**
 * Calculates the total price, discount, and line total for an item
 */
const calculateLine = (rawItem) => {
  const item = normalizeItem(rawItem);
// BEGIN: THAM:APPLY_FIELD_MAP_TO_LINE_V2
const __thamMapped = (typeof thamMapFields === 'function') ? thamMapFields(rawItem || {}) : null;
if (__thamMapped) {
const __n = String(__thamMapped.name ?? '').trim();
if ((!item.name || String(item.name).trim() === '') && __n) item.name = __n;

`
const __u = Number.isFinite(+__thamMapped.unitPrice) ? +__thamMapped.unitPrice : 0;
if ((!Number.isFinite(+item.unitPrice) || +item.unitPrice <= 0) && __u > 0) item.unitPrice = __u;

const __dp = Number.isFinite(+__thamMapped.dealPrice) ? +__thamMapped.dealPrice : 0;
if ((!Number.isFinite(+item.dealPrice) || +item.dealPrice <= 0) && __dp > 0) item.dealPrice = __dp;

const __dq = parseInt(String(__thamMapped.dealQty ?? 0).trim(), 10);
const __curDq = parseInt(String(item.dealQty ?? 0).trim(), 10) || 0;
if (__curDq <= 0 && Number.isFinite(__dq) && __dq > 0) item.dealQty = __dq;

const __baseMethod = String(item.method ?? '0').trim();
const __mappedMethod = String(__thamMapped.method ?? 0).trim();
if ((__baseMethod === '' || __baseMethod === '0') && __mappedMethod !== '' && __mappedMethod !== '0') item.method = __mappedMethod;
`

}

const __thamMethodNum = parseInt(String(item.method ?? '0').trim(), 10);
item.method = Number.isFinite(__thamMethodNum) ? String(__thamMethodNum) : '0';
// END:   THAM:APPLY_FIELD_MAP_TO_LINE_V2
// BEGIN: THAM:APPLY_FIELD_MAP_TO_LINE_V1
const mapped = thamMapFields(rawItem || {});
if (mapped) {
const mappedName = String(mapped.name ?? '').trim();
if ((!item.name || String(item.name).trim() === '') && mappedName) item.name = mappedName;

const mappedUnit = Number.isFinite(+mapped.unitPrice) ? +mapped.unitPrice : 0;
if ((!Number.isFinite(+item.unitPrice) || +item.unitPrice <= 0) && mappedUnit > 0) item.unitPrice = mappedUnit;

const mappedDealPrice = Number.isFinite(+mapped.dealPrice) ? +mapped.dealPrice : 0;
if ((!Number.isFinite(+item.dealPrice) || +item.dealPrice <= 0) && mappedDealPrice > 0) item.dealPrice = mappedDealPrice;

const mappedDealQty = parseInt(String(mapped.dealQty ?? 0).trim(), 10);
if ((parseInt(String(item.dealQty ?? 0).trim(), 10) || 0) <= 0 && Number.isFinite(mappedDealQty) && mappedDealQty > 0) item.dealQty = mappedDealQty;

const baseMethod = String(item.method ?? '0').trim();
const mappedMethod = String(mapped.method ?? 0).trim();
if ((baseMethod === '' || baseMethod === '0') && mappedMethod !== '' && mappedMethod !== '0') item.method = mappedMethod;

}
// END:   THAM:APPLY_FIELD_MAP_TO_LINE_V1
// BEGIN: THAM:CANON_METHOD_V1
const __thamMethodNum = parseInt(String(item.method ?? '0').trim(), 10);
item.method = Number.isFinite(__thamMethodNum) ? String(__thamMethodNum) : '0';
item.qty = Math.max(0, parseInt(String(item.qty ?? 0).trim(), 10) || 0);
item.dealQty = Math.max(0, parseInt(String(item.dealQty ?? 0).trim(), 10) || 0);
item.unitPrice = Number.isFinite(+item.unitPrice) ? +item.unitPrice : 0;
item.dealPrice = Number.isFinite(+item.dealPrice) ? +item.dealPrice : 0;
// END:   THAM:CANON_METHOD_V1
  const { qty, unitPrice, method, dealQty, dealPrice } = item;

  let total = 0;
  let discountAmount = 0; // Should be <= 0

  // Default: Normal Price
  total = qty * unitPrice;

  // --- LOGIC IMPLEMENTATION ---
  
  if (method === '8' && dealQty > 0) {
    // Rule: Pick <dealQty>, Pay for (<dealQty> - 1)
    const freeCount = Math.floor(qty / dealQty);
    const paidQty = qty - freeCount;
    const calculatedTotal = paidQty * unitPrice;
    
    discountAmount = calculatedTotal - (qty * unitPrice);
    total = calculatedTotal;

  } else if (method === '9' && dealQty > 0 && dealPrice > 0) {
    // Rule: Buy dealQty items for dealPrice
    const groups = Math.floor(qty / dealQty);
    const remainder = qty % dealQty;
    const calculatedTotal = (groups * dealPrice) + (remainder * unitPrice);
    
    discountAmount = calculatedTotal - (qty * unitPrice);
    total = calculatedTotal;

  } else if (method === '1' && dealPrice > 0) {
    // Rule: Immediate price change
    const calculatedTotal = qty * dealPrice;
    
    discountAmount = calculatedTotal - (qty * unitPrice);
    total = calculatedTotal;
  }

  // Safety
  total = Math.max(0, total);

  return {
    finalTotal: total,
    discountAmount: discountAmount,
    badgeText: getPromotionBadge(item),
    normalizedItem: item
  };
};

exports.calculateCartSummary = (items, billDiscountPercent = 0, coupons = [], allowance = 0, topup = 0) => {
  let sumPromoTotal = 0;
  let sumTotalItems = 0;
  let sumPromoDiscount = 0;
  let sumManualItemDiscount = 0;

  const processedItems = items.map(rawItem => {
    // 1. Promotion Calculation
    const { finalTotal: promoPrice, discountAmount: promoDisc, badgeText, normalizedItem } = calculateLine(rawItem);

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
      badgeText,
      promoDiscount: Number(promoDisc.toFixed(2)),
      manualDiscountAmount: Number((-manualDiscAmount).toFixed(2))
    };
  });

  // 3. Bill-Wide Discount
  const billDiscAmount = (sumPromoTotal * billDiscountPercent) / 100;
  const totalAfterBillDisc = sumPromoTotal - billDiscAmount;

  // 4. Coupons
  const totalCouponValue = coupons.reduce((sum, c) => sum + (c.couponValue || 0), 0);
  const totalAfterCoupons = totalAfterBillDisc - totalCouponValue;

  // 5. Allowance & Topup
  const totalAfterAllowance = totalAfterCoupons - allowance;
  const grandTotal = totalAfterAllowance - topup; 

  // VAT Calculation (Inclusive 7%)
  // grandTotal = net + vat
  // net = grandTotal / 1.07
  const vatRate = 7;
  const safeGrandTotal = Math.max(0, grandTotal);
  const netTotal = safeGrandTotal / (1 + (vatRate / 100));
  const vatTotal = safeGrandTotal - netTotal;

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

      // Final
      vatTotal: Number(vatTotal.toFixed(2)),
      netTotal: Number(netTotal.toFixed(2)), // Base amount before VAT
      grandTotal: Number(safeGrandTotal.toFixed(2))
    }
  };
};

// BEGIN: THAM:METHOD8_HELPERS_V1
/**

* Method 8 โ€” Buy N Get 1 Free
* Interpretation A (DEFAULT):
* dealQty = N
* freeItems = floor(qty / dealQty)
* payable = qty - freeItems
*
* Alternative Interpretation B (DOCUMENTED ONLY, tested):
* For every (N + 1) items, 1 is free:
* freeItems = floor(qty / (dealQty + 1))
* payable = qty - freeItems
  */
  function tham_calcMethod8_A(qty, dealQty) {
  const q = Math.max(0, parseInt(String(qty ?? 0).trim(), 10) || 0);
  const n = Math.max(0, parseInt(String(dealQty ?? 0).trim(), 10) || 0);
  if (n <= 0) return { freeItems: 0, payableQty: q };
  const freeItems = Math.floor(q / n);
  const payableQty = Math.max(0, q - freeItems);
  return { freeItems, payableQty };
  }

function tham_calcMethod8_B(qty, dealQty) {
const q = Math.max(0, parseInt(String(qty ?? 0).trim(), 10) || 0);
const n = Math.max(0, parseInt(String(dealQty ?? 0).trim(), 10) || 0);
const denom = n + 1;
if (denom <= 0) return { freeItems: 0, payableQty: q };
const freeItems = Math.floor(q / denom);
const payableQty = Math.max(0, q - freeItems);
return { freeItems, payableQty };
}

exports.**THAM** = exports.**THAM** || {};
exports.**THAM**.calcMethod8_A = tham_calcMethod8_A;
exports.**THAM**.calcMethod8_B = tham_calcMethod8_B;
// END:   THAM:METHOD8_HELPERS_V1

/* BEGIN: THAM:WRAP_CARTSUMMARY_NETTOTAL_V1 */
(() => {
const __orig = exports.calculateCartSummary;
if (typeof __orig !== 'function') return;

exports.calculateCartSummary = function (...args) {
const res = __orig.apply(this, args);
try {
if (res && res.summary) {
const gt = res.summary.grandTotal;
const oldNet = res.summary.netTotal;
if (typeof oldNet === 'number' && Number.isFinite(oldNet) && res.summary.netBeforeVat === undefined) {
res.summary.netBeforeVat = oldNet;
}
if (typeof gt === 'number' && Number.isFinite(gt)) {
res.summary.netTotal = gt; // payable amount (inclusive VAT)
}
}
} catch (_) {}
return res;
};
})();
/* END:   THAM:WRAP_CARTSUMMARY_NETTOTAL_V1 */
