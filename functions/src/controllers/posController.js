const functions = require('firebase-functions');
const { getProductBySku } = require('../repositories/productRepository');
const { calculateCartSummary } = require('../services/cartService');

// API 1: Scan Item
exports.scanItem = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  // 1. Auth Check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }

  // 2. Input Validation
  const { sku } = data;
  if (!sku) throw new functions.https.HttpsError('invalid-argument', 'SKU is required');

  // 3. Logic
  const product = await getProductBySku(sku);
  
  if (!product) {
    throw new functions.https.HttpsError('not-found', 'Product not found');
  }

  return product;
});

// API 2: Calculate Cart
exports.calculateOrder = functions.region('asia-southeast1').https.onCall((data, context) => {
  // 1. Auth Check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }

  const { items, billDiscountPercent, coupons, allowance, topup } = data;
  return calculateCartSummary(items, billDiscountPercent, coupons, allowance, topup);
});

// API 3: Void Bill (Stub)
exports.voidBill = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  // TODO: Check RBAC for 'void' permission
  
  const { orderId, reason } = data;
  return { success: true, message: `Voided order ${orderId}: ${reason}` };
});

// API 4: Apply Discount (Stub)
exports.applyDiscount = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  // TODO: Check RBAC for 'discount' permission
  
  const { type, value } = data; 
  return { success: true, applied: { type, value } };
});

// API 5: Save Invoice (Stub)
exports.saveInvoice = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  
  const { cart, summary } = data;
  // TODO: Write to Firestore 'invoices'
  return { success: true, invoiceId: 'STUB-INVOICE-123' };
});

// API 6: Get Daily Report (Stub)
exports.getDailyReport = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  // TODO: Check RBAC for 'report' permission

  return { 
    date: new Date().toISOString(), 
    totalSales: 0, 
    orders: [] 
  };
});
