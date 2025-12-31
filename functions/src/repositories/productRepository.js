const { COLLECTIONS } = require('../../../shared/constants');
const admin = require('firebase-admin');

exports.getProductBySku = async (sku) => {
  try {
    const db = admin.firestore();
    // 1. Try direct ID lookup first (most efficient)
    const docRef = db.collection(COLLECTIONS.PRODUCTS).doc(sku);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      // Check status (ProductStatus starting with '0' means active)
      if (data.ProductStatus && data.ProductStatus.startsWith('0')) {
        return { 
          id: docSnap.id, 
          sku: docSnap.id, // Ensure sku is populated
          name: data.ProductDesc, 
          price: Number(data.SellPrice), 
          vatRate: Number(data.VatRate),
          ...data 
        };
      }
    }

    // 2. Try barcode lookup
    const snapshot = await db.collection(COLLECTIONS.PRODUCTS)
      .where('barcode', '==', sku)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();
      if (data.ProductStatus && data.ProductStatus.startsWith('0')) {
        return { 
          id: doc.id,
          sku: data.barcode, // Use barcode as sku if found by barcode? Or keep doc ID?
                             // Let's use doc.id as the canonical ID, but return scanned sku for reference if needed
          name: data.ProductDesc,
          price: Number(data.SellPrice),
          vatRate: Number(data.VatRate),
          ...data 
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching product:', error);
    throw new Error('Database Error');
  }
};
