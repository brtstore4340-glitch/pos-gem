const { COLLECTIONS } = require("../../../shared/constants");
const admin = require("firebase-admin");

exports.getProductBySku = async (sku) => {
  try {
    const db = admin.firestore();
    const snapshot = await db
      .collection(COLLECTIONS.PRODUCTS)
      .where("sku", "==", sku)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error("Error fetching product:", error);
    throw new Error("Database Error");
  }
};
