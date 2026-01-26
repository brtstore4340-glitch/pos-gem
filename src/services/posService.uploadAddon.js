/*
  posService.uploadAddon.js
  ✅ Copy functions below into your existing src/services/posService.js

  What it adds:
  - Fast scanItem(): barcode_index -> products (1-2 reads)
  - Lightweight searchProducts(): keywordsText range query (practical)
*/

import { db } from "../firebase";
import { doc, getDoc, query, collection, limit, where, getDocs } from "firebase/firestore";

const memCache = new Map();
function cacheGet(k) { return memCache.get(k); }
function cacheSet(k, v) { memCache.set(k, v); if (memCache.size > 500) memCache.delete(memCache.keys().next().value); }

async function getByItemCode(itemCode) {
  const ck = `p:${itemCode}`;
  const c = cacheGet(ck);
  if (c) return c;

  const snap = await getDoc(doc(db, "products", itemCode));
  if (!snap.exists()) throw new Error("Item not found");
  const data = snap.data();
  cacheSet(ck, data);
  return data;
}

async function resolveBarcodeToItemCode(barcode) {
  const ck = `b:${barcode}`;
  const c = cacheGet(ck);
  if (c) return c;

  const snap = await getDoc(doc(db, "barcode_index", barcode));
  if (!snap.exists()) return null;
  const itemCode = snap.data().itemCode;
  cacheSet(ck, itemCode);
  return itemCode;
}

export async function scanItemFast(skuOrBarcode) {
  const code = String(skuOrBarcode).trim();

  // 1) Try itemCode direct
  try {
    const p = await getByItemCode(code);
    return {
      id: p.itemCode,
      sku: p.itemCode,
      name: p.name || p.description || "Unknown",
      price: Number(p.dealPrice || p.price || p.regPrice || 0),
      badgeText: p.dealPrice ? "DEAL" : ""
    };
  } catch {}

  // 2) Resolve barcode
  const itemCode = await resolveBarcodeToItemCode(code);
  if (!itemCode) throw new Error("Barcode not found");

  const p = await getByItemCode(itemCode);
  return {
    id: p.itemCode,
    sku: p.itemCode,
    name: p.name || p.description || "Unknown",
    price: Number(p.dealPrice || p.price || p.regPrice || 0),
    badgeText: p.dealPrice ? "DEAL" : ""
  };
}

export async function searchProductsLight(text) {
  const qtext = String(text || "").trim();
  if (qtext.length < 2) return [];

  // barcode exact shortcut
  const itemCode = await resolveBarcodeToItemCode(qtext);
  if (itemCode) {
    const p = await getByItemCode(itemCode);
    return [{ sku: p.itemCode, name: p.name || p.description, price: Number(p.dealPrice || p.price || 0) }];
  }

  // keywordsText range query
  const start = qtext.toLowerCase();
  const end = start + "\uf8ff";

  const qr = query(
    collection(db, "products"),
    where("keywordsText", ">=", start),
    where("keywordsText", "<=", end),
    limit(20)
  );

  const snaps = await getDocs(qr);
  return snaps.docs.map(d => {
    const p = d.data();
    return { sku: p.itemCode, name: p.name || p.description, price: Number(p.dealPrice || p.price || 0) };
  });
}



