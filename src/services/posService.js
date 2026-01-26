import { db } from '../firebase';
import { functions } from '../firebase';
import { collection, doc, getDoc, getDocs, setDoc, writeBatch, getCountFromServer, serverTimestamp, query, limit, where/* , orderBy, startAt, endAt */ } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import * as XLSX from 'xlsx';

// --- Helpers ---
const generateKeywords = (text) => {
  if (!text) return [];
  const keywords = new Set();
  const words = text.toUpperCase().split(/[\s\-/().]+/);
  words.forEach(word => {
    const cleanWord = word.trim();
    if (cleanWord.length < 2) return;
    keywords.add(cleanWord);
    let temp = '';
    for (let i = 0; i < cleanWord.length; i++) {
      temp += cleanWord[i];
      if (temp.length >= 3) keywords.add(temp);
    }
  });
  return Array.from(keywords);
};

const calculateOrderFn = httpsCallable(functions, 'calculateOrder');
let __PRODUCT_ID_CACHE__ = null;
let __PRODUCT_ID_CACHE_AT__ = 0;
let __PRODUCT_DATE_CACHE__ = null;
let __PRODUCT_DATE_CACHE_AT__ = 0;
const PRODUCT_ID_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function getProductIdSetCached() {
  const now = Date.now();
  if (__PRODUCT_ID_CACHE__ && (now - __PRODUCT_ID_CACHE_AT__) < PRODUCT_ID_CACHE_TTL_MS) {
    return __PRODUCT_ID_CACHE__;
  }
  const ids = new Set();
  const qs = await getDocs(collection(db, 'products'));
  qs.forEach((d) => ids.add(d.id));
  __PRODUCT_ID_CACHE__ = ids;
  __PRODUCT_ID_CACHE_AT__ = now;
  return ids;
}

async function getProductDateMapCached() {
  const now = Date.now();
  if (__PRODUCT_DATE_CACHE__ && (now - __PRODUCT_DATE_CACHE_AT__) < PRODUCT_ID_CACHE_TTL_MS) {
    return __PRODUCT_DATE_CACHE__;
  }
  const dates = new Map();
  const qs = await getDocs(collection(db, 'products'));
  qs.forEach((d) => dates.set(d.id, d.data().DateLastAmended));
  __PRODUCT_DATE_CACHE__ = dates;
  __PRODUCT_DATE_CACHE_AT__ = now;
  return dates;
}

async function writeUploadMeta(uploadKey, lastUploadAtISO, count) {
  await setDoc(doc(db, 'upload_meta', uploadKey), {
    lastUploadAt: lastUploadAtISO,
    count: Number(count || 0),
    updatedAt: serverTimestamp()
  }, { merge: true });
}


// Helper: แปลง Column Letter เป็น Index (A=0, B=1, ...)
// แต่ใน XLSX แบบ Array of Arrays เรานับ Index ได้เลย
// B=1, F=5, L=11, N=13, R=17, U=20, V=21, Y=24, AB=27, AD=29, AF=31, AJ=35, AL=37, AO=40, AQ=42, AS=44, AT=45, AV=47, AY=50, BB=53

export const posService = {
  calculateOrder: async (payload) => {
    const result = await calculateOrderFn(payload);
    return result.data;
  },
  
  // 1. เช็คว่ามี Master Data หรือยัง
  hasMasterData: async () => {
    try {
      const coll = collection(db, 'products');
      const snapshot = await getCountFromServer(coll);
      return snapshot.data().count > 0;
    } catch {
      return false;
    }
  },

  // 2. Upload ProductAllDept (CSV - Master)
  uploadProductAllDept: async (products, onProgress) => {
    console.log('🔄 Uploading Master Data...');
    const existingMap = await getProductDateMapCached();

    // Filter Logic:
    // 1. Must be ProductStatus = "0 - Normal Product" (Check startsWith "0")
    // 2. Delta Check (DateLastAmended changed)
    const toUpdate = products.filter((row) => {
      // Check Product Status
      const rawStatus = row.ProductStatus ? row.ProductStatus.toString().trim() : '';
      if (!rawStatus.startsWith('0')) return false;

      // Identify ID
      const id = row.GridProductCode?.trim() || row.ProductCode?.trim();
      if (!id) return false;

      // Delta Check
      const oldDate = existingMap.get(id);
      const newDate = row.DateLastAmended;
      // If new item (no oldDate) or date changed -> Update
      if (!oldDate) return true;
      if (oldDate !== newDate) return true;
      
      return false; 
    });

    const BATCH_SIZE = 400;
    let processed = 0;
    const total = toUpdate.length;
    const chunks = [];
    for (let i = 0; i < total; i += BATCH_SIZE) chunks.push(toUpdate.slice(i, i + BATCH_SIZE));

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const batch = writeBatch(db);
      chunk.forEach(row => {
        const productCode = row.GridProductCode?.trim() || row.ProductCode?.trim();
        const docRef = doc(db, 'products', productCode);
        
        // Generate Keywords for Universal Search
        const searchKeywords = generateKeywords(row.ProductDesc);
        if (row.Barcode) searchKeywords.push(row.Barcode.trim());
        if (productCode) searchKeywords.push(productCode.trim());
        
        // Save to Firestore
        batch.set(docRef, {
          ...row,
          keywords: searchKeywords,
          // Parse numeric fields safely
          SellPrice: parseFloat(row.SellPrice || 0),
          VatRate: parseFloat(row.VatRate || 0),
          LatestCost: parseFloat(row.LatestCost || 0),
          
          // Ensure critical fields are trimmed
          barcode: row.Barcode?.trim(),
          ProductDesc: row.ProductDesc?.trim(),
          
          updatedAt: serverTimestamp(),
          _source: 'ProductAllDept' // Track source
        }, { merge: true });
      });
      await batch.commit();
      processed += chunk.length;
      if (onProgress) onProgress(processed, total);
      await new Promise(r => setTimeout(r, 50));
    }
    await writeUploadMeta('master', new Date().toISOString(), processed);
    __PRODUCT_ID_CACHE__ = null;
    __PRODUCT_DATE_CACHE__ = null;
    return processed;
  },

  // 3. Upload Excel Helper (Generic)
  uploadExcelUpdate: async (file, mappingLogic, onProgress, uploadKey) => {
    // 3.1 Read File
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to Array of Arrays (Row 0 = Header)
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    const lastUpdateISO = new Date().toISOString();

    // 3.2 Load Existing IDs to ensure we only update existing products
    const existingIds = await getProductIdSetCached();
    
    console.log('✅ Loaded ' + existingIds.size + ' master items for matching.');

    // 3.3 Process Rows
    const updates = [];
    // Start loop from index 1 (skip header)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // Column B is Index 1 (0-based)
      const itemCode = String(row[1]).trim(); 
      
      if (itemCode && existingIds.has(itemCode)) {
        // Apply Mapping Logic
        const updateData = mappingLogic(row);
        if (updateData) {
          updates.push({ id: itemCode, data: updateData });
        }
      }
    }

    if (updates.length === 0) return 0;

    // 3.4 Batch Update
    const BATCH_SIZE = 400;
    let processed = 0;
    const total = updates.length;
    
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const chunk = updates.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      
      chunk.forEach(item => {
        const docRef = doc(db, 'products', item.id);
        batch.set(docRef, { ...item.data, lastUpdate: lastUpdateISO, updatedAt: serverTimestamp() }, { merge: true });
      });

      await batch.commit();
      processed += chunk.length;
      if (onProgress) onProgress(processed, total);
      await new Promise(r => setTimeout(r, 50));
    }

    if (uploadKey) {
      await writeUploadMeta(uploadKey, lastUpdateISO, processed);
    }
    __PRODUCT_ID_CACHE__ = null;
    __PRODUCT_DATE_CACHE__ = null;

    return processed;
  },

  // 4. Wrapper: ItemMasterPrintOnDeph
  uploadItemMasterPrint: async (file, onProgress) => {
    return posService.uploadExcelUpdate(file, (row) => {
      // Column Mapping (0-based index)
      // B=1, F=5, L=11, N=13, U=20, Y=24, AD=29, AF=31, AJ=35, AO=40, AS=44, AV=47, AY=50, BB=53
      return {
        // Enriched Fields
        description_print: row[5],
        dept_print: row[11],
        class_print: row[13],
        merchandise_print: row[20],
        regPrice_print: row[24],
        method_print: row[29],
        unitPrice_print: row[31],
        dealPrice_print: row[35],
        dealQty_print: row[40],
        limit_print: row[44],
        mpg_print: row[47],
        tax_print: row[50],
        brand_print: row[53],
        _source_enriched: 'ItemMasterPrintOnDeph'
      };
    }, onProgress, 'print');
  },

  // 5. Wrapper: ItemMaintananceEvent
  uploadItemMaintenance: async (file, onProgress) => {
    return posService.uploadExcelUpdate(file, (row) => {
      // Column Mapping (0-based index)
      // B=1, F=5, L=11, N=13, R=17, V=21, Y=24, AB=27, AF=31, AL=37, AQ=42, AT=45
      return {
        // Maintenance Fields
        description_maint: row[5],
        type_maint: row[11],
        dept_maint: row[13],
        class_maint: row[17],
        regPrice_maint: row[21],
        method_maint: row[24],
        unitPrice_maint: row[27],
        dealPrice_maint: row[31],
        dealQty_maint: row[37],
        limitQty_maint: row[42],
        mpGroup_maint: row[45],
        _source_maintenance: 'ItemMaintananceEvent'
      };
    }, onProgress, 'maint');
  },

  // --- Common ---
  getProductStats: async () => {
    try {
      const coll = collection(db, 'products');
      const snapshot = await getCountFromServer(coll);
      const uploads = await posService.getUploadMeta();
      return { count: snapshot.data().count, lastUpdated: new Date(), uploads };
    } catch { return { count: 0, lastUpdated: null, uploads: {} }; }
  },

  getUploadMeta: async () => {
    const keys = ['master', 'print', 'maint'];
    const result = {};
    await Promise.all(keys.map(async (key) => {
      try {
        const snap = await getDoc(doc(db, 'upload_meta', key));
        if (snap.exists()) result[key] = snap.data();
      } catch (e) {
        console.warn('getUploadMeta read failed for', key, e?.message || e);
      }
    }));
    return result;
  },
  
  clearDatabase: async (onProgress) => { /* Code เดิม */ 
    const BATCH_SIZE = 400;
    const MAX_BATCHES = 500;
    let totalDeleted = 0;
    let batches = 0;
    while (true) // eslint-disable-line no-constant-condition // eslint-disable-line no-constant-condition {
      const q = query(collection(db, 'products'), limit(BATCH_SIZE));
      const snapshot = await getDocs(q);
      if (snapshot.empty) break;
      const batch = writeBatch(db);
      snapshot.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      totalDeleted += snapshot.size;
      batches += 1;
      if (onProgress) onProgress(totalDeleted);
      if (batches >= MAX_BATCHES) {
        throw new Error('clearDatabase aborted: exceeded max batch limit.');
      }
      await new Promise(r => setTimeout(r, 50));
    }
    return totalDeleted;
  },

  // Search & Scan (Code เดิม)
  searchProducts: async (keyword) => {
    if (!keyword || keyword.length < 2) return [];
    const searchKey = keyword.toUpperCase().trim();
    const buildResults = (snapshot) => {
      const results = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        if (d.ProductStatus?.startsWith('0')) {
          results.push({ sku: d.GridProductCode || d.ProductCode || doc.id, name: d.ProductDesc, price: Number(d.SellPrice), ...d });
        }
      });
      return results;
    };

    try {
      const primaryQuery = query(
        collection(db, 'products'),
        where('keywords', 'array-contains', searchKey),
        where('ProductStatus', '>=', '0'),
        limit(15)
      );
      const primarySnap = await getDocs(primaryQuery);
      return buildResults(primarySnap);
    } catch (err) {
      console.warn('searchProducts primary query failed, falling back without status filter:', err?.message || err);
      try {
        const fallbackQuery = query(
          collection(db, 'products'),
          where('keywords', 'array-contains', searchKey),
          limit(20)
        );
        const fallbackSnap = await getDocs(fallbackQuery);
        return buildResults(fallbackSnap);
      } catch (error) {
        console.error('searchProducts failed:', error);
        return [];
      }
    }
  },
  scanItem: async (keyword) => {
    const cleanKey = keyword.trim();
    if (!cleanKey) throw new Error('กรุณาระบุคำค้นหา');
    try {
      const docRef = doc(db, 'products', cleanKey);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().ProductStatus?.startsWith('0')) { const data = docSnap.data(); return { sku: docSnap.id, name: data.ProductDesc, price: Number(data.SellPrice), ...data }; }
      const qBarcode = query(collection(db, 'products'), where('barcode', '==', cleanKey), limit(1));
      const barcodeSnap = await getDocs(qBarcode);
      if (!barcodeSnap.empty) { const data = barcodeSnap.docs[0].data(); if (data.ProductStatus?.startsWith('0')) return { sku: data.barcode, name: data.ProductDesc, price: Number(data.SellPrice), ...data }; }
      const results = await posService.searchProducts(cleanKey);
      if (results.length > 0) return results[0];
      throw new Error('ไม่พบสินค้า: ' + cleanKey);
    } catch (error) { if (error.message.includes('ไม่พบสินค้า')) throw error; throw new Error('เกิดข้อผิดพลาดในการค้นหา'); }
  },
  createOrder: async (orderData) => { /*...*/ }
};



