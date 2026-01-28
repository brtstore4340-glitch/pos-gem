const demo = [
  { id: "p1", sku: "SKU-001", name: "Cleansing Gel", category: "Skincare", price: 390, is_active: true, barcode: ["8850000000001"] },
  { id: "p2", sku: "SKU-002", name: "Vitamin C Serum", category: "Skincare", price: 990, is_active: true, barcode: ["8850000000002"] },
  { id: "p3", sku: "SKU-003", name: "Sunscreen SPF50", category: "Suncare", price: 690, is_active: true, barcode: ["8850000000003"] },
  { id: "p4", sku: "SKU-004", name: "Moisturizer Cream", category: "Skincare", price: 790, is_active: true, barcode: ["8850000000004"] },
  { id: "p5", sku: "SKU-005", name: "Lip Balm", category: "Makeup", price: 199, is_active: true, barcode: ["8850000000005"] }
];

export const productService = {
  async listProducts({ q = "", category } = {}) {
    const query = String(q).toLowerCase().trim();
    let items = demo.filter((x) => x.is_active);
    if (category && category !== "All") items = items.filter((x) => x.category === category);
    if (query) items = items.filter((x) => x.name.toLowerCase().includes(query) || x.sku?.toLowerCase().includes(query));
    return { items };
  },

  async getProductByBarcode(barcode) {
    const code = String(barcode || "").trim();
    if (!code) return null;
    return demo.find((p) => Array.isArray(p.barcode) && p.barcode.includes(code)) || null;
  },

  async upsertProduct(product) {
    // TODO: Firestore upsert with validation
    return { ok: true, product };
  },

  async listCategories() {
    const set = new Set(demo.filter((x) => x.is_active).map((x) => x.category));
    return ["All", ...Array.from(set).sort()];
  }
};
