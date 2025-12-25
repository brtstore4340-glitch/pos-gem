const functions = require('firebase-functions');
const { getProductBySku } = require('../repositories/productRepository');
const { calculateCartSummary } = require('../services/cartService');

// API 1: Scan Item
exports.scanItem = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  const { sku } = data;
  if (!sku) throw new functions.https.HttpsError('invalid-argument', 'SKU is required');

  const product = await getProductBySku(sku);
  
  if (!product) {
    throw new functions.https.HttpsError('not-found', 'Product not found');
  }

  return product;
});

// API 2: Calculate Cart
exports.calculateOrder = functions.region('asia-southeast1').https.onCall((data, context) => {
  const { items } = data;
  return calculateCartSummary(items);
});
