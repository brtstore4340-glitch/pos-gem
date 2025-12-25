import { db } from '../lib/firebase';
import { collection, doc, getDoc, getDocs, updateDoc, addDoc, writeBatch, getCountFromServer, serverTimestamp, query, limit, where, orderBy, startAt, endAt, Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';

// --- Helpers ---
const generateKeywords = (text) => {
  if (!text) return [];
  const keywords = new Set();
  const words = text.toUpperCase().split(/[\s\-\/\(\)\.\,]+/);
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

export const posService = {
  // --- 📊 REPORT ---
  getSalesReport: async (startDate, endDate) => {
    try {
      const start = Timestamp.fromDate(startDate);
      const end = Timestamp.fromDate(endDate);

      const q = query(
        collection(db, 'invoices'), 
        where('createdAt', '>=', start),
        where('createdAt', '<=', end),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const orders = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        orders.push({ 
          id: doc.id, 
          ...data, 
          timestamp: data.createdAt?.toDate ? data.createdAt.toDate() : new Date() 
        });
      });
      return orders;
    } catch (e) {
      console.error('Report Error:', e);
      return [];
    }
  },

  voidInvoice: async (orderId, reason) => {
    try {
      const docRef = doc(db, 'invoices', orderId);
      await updateDoc(docRef, {
        status: 'void',
        voidReason: reason || 'Cashier Request',
        voidedAt: serverTimestamp()
      });
      return true;
    } catch (e) {
      throw new Error('Void Failed: ' + e.message);
    }
  },

  // --- SEARCH ---
  searchProducts: async (keyword) => {
    if (!keyword || keyword.length < 2) return [];
    try {
      const searchKey = keyword.toUpperCase().trim();
      const productsRef = collection(db, 'products');
      let results = [];
      const seenIds = new Set(); 

      try {
        const q1 = query(productsRef, where('keywords', 'array-contains', searchKey), where('ProductStatus', '>=', '0'), limit(10));
        const snap1 = await getDocs(q1);
        snap1.forEach(doc => {
          const d = doc.data();
          if (d.ProductStatus && d.ProductStatus.startsWith('0')) {
             const id = d.GridProductCode || d.ProductCode || doc.id;
             if (!seenIds.has(id)) { results.push({ sku: id, name: d.ProductDesc, price: Number(d.SellPrice), ...d }); seenIds.add(id); }
          }
        });
      } catch (e) { console.warn('Strategy 1 failed:', e.code); }

      if (results.length < 5) {
        try {
          const q2 = query(productsRef, orderBy('ProductDesc'), startAt(searchKey), endAt(searchKey + '\uf8ff'), limit(10));
          const snap2 = await getDocs(q2);
          snap2.forEach(doc => {
            const d = doc.data();
            if (d.ProductStatus && d.ProductStatus.startsWith('0')) {
               const id = d.GridProductCode || d.ProductCode || doc.id;
               if (!seenIds.has(id)) { results.push({ sku: id, name: d.ProductDesc, price: Number(d.SellPrice), ...d }); seenIds.add(id); }
            }
          });
        } catch (e) { console.warn('Strategy 2 failed:', e.code); }
      }

      if (results.length === 0 && /^\d+$/.test(searchKey)) {
         const q3 = query(productsRef, where('barcode', '==', searchKey), limit(1));
         const snap3 = await getDocs(q3);
         snap3.forEach(doc => {
            const d = doc.data();
            const id = d.GridProductCode || d.ProductCode || doc.id;
            if (!seenIds.has(id)) { results.push({ sku: id, name: d.ProductDesc, price: Number(d.SellPrice), ...d }); seenIds.add(id); }
         });
      }
      return results;
    } catch (err) { console.error(err); return []; }
  },

  scanItem: async (keyword) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    const cleanKey = keyword.trim();
    if (!cleanKey) throw new Error('กรุณาระบุคำค้นหา');
    try {
      const docRef = doc(db, 'products', cleanKey);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().ProductStatus?.startsWith('0')) { 
          const data = docSnap.data(); 
          return { sku: docSnap.id, name: data.ProductDesc, price: Number(data.SellPrice), ...data }; 
      }
      const qBarcode = query(collection(db, 'products'), where('barcode', '==', cleanKey), limit(1));
      const barcodeSnap = await getDocs(qBarcode);
      if (!barcodeSnap.empty) { 
          const data = barcodeSnap.docs[0].data(); 
          if (data.ProductStatus?.startsWith('0')) 
              return { sku: data.barcode, name: data.ProductDesc, price: Number(data.SellPrice), ...data }; 
      }
      const results = await posService.searchProducts(cleanKey);
      if (results.length > 0) return results[0];
      throw new Error('ไม่พบสินค้า: ' + cleanKey);
    } catch (error) { if (error.message.includes('ไม่พบสินค้า')) throw error; throw new Error('เกิดข้อผิดพลาดในการค้นหา'); }
  },

  uploadProductAllDept: async (products, onProgress) => {
    const existingMap = new Map();
    const querySnapshot = await getDocs(collection(db, 'products'));
    querySnapshot.forEach((doc) => existingMap.set(doc.id, doc.data().DateLastAmended));
    const toUpdate = products.filter((row) => {
      const status = row.ProductStatus ? row.ProductStatus.trim() : '';
      if (!status.startsWith('0')) return false;
      const id = row.GridProductCode?.trim() || row.ProductCode?.trim();
      if (!id) return false;
      const oldDate = existingMap.get(id);
      const newDate = row.DateLastAmended;
      if (!oldDate) return true;
      if (oldDate !== newDate) return true;
      return false; 
    });
    const BATCH_SIZE = 400; let processed = 0; const total = toUpdate.length; const chunks = []; for (let i = 0; i < total; i += BATCH_SIZE) chunks.push(toUpdate.slice(i, i + BATCH_SIZE));
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]; const batch = writeBatch(db);
      chunk.forEach(row => {
        const productCode = row.GridProductCode?.trim() || row.ProductCode?.trim();
        const docRef = doc(db, 'products', productCode);
        const searchKeywords = generateKeywords(row.ProductDesc); 
        if (row.Barcode) searchKeywords.push(row.Barcode.trim());
        if (productCode) searchKeywords.push(productCode.trim());
        batch.set(docRef, { ...row, keywords: searchKeywords, SellPrice: parseFloat(row.SellPrice || 0), VatRate: parseFloat(row.VatRate || 0), barcode: row.Barcode?.trim(), ProductDesc: row.ProductDesc?.trim(), updatedAt: serverTimestamp() }, { merge: true });
      });
      await batch.commit(); processed += chunk.length; if (onProgress) onProgress(processed, total); await new Promise(r => setTimeout(r, 50));
    }
    return processed;
  },
  
  hasMasterData: async () => { try { const coll = collection(db, 'products'); const snapshot = await getCountFromServer(coll); return snapshot.data().count > 0; } catch (e) { return false; } },
  uploadExcelUpdate: async (file, mappingLogic, onProgress) => { const buffer = await file.arrayBuffer(); const workbook = XLSX.read(buffer); const firstSheetName = workbook.SheetNames[0]; const worksheet = workbook.Sheets[firstSheetName]; const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }); const existingIds = new Set(); const querySnapshot = await getDocs(collection(db, 'products')); querySnapshot.forEach((doc) => existingIds.add(doc.id)); const updates = []; for (let i = 1; i < rows.length; i++) { const row = rows[i]; const itemCode = String(row[1]).trim(); if (itemCode && existingIds.has(itemCode)) { const updateData = mappingLogic(row); if (updateData) updates.push({ id: itemCode, data: updateData }); } } if (updates.length === 0) return 0; const BATCH_SIZE = 400; let processed = 0; const total = updates.length; for (let i = 0; i < total; i += BATCH_SIZE) { const chunk = updates.slice(i, i + BATCH_SIZE); const batch = writeBatch(db); chunk.forEach(item => { const docRef = doc(db, 'products', item.id); batch.set(docRef, { ...item.data, updatedAt: serverTimestamp() }, { merge: true }); }); await batch.commit(); processed += chunk.length; if (onProgress) onProgress(processed, total); await new Promise(r => setTimeout(r, 50)); } return processed; },
  uploadItemMasterPrint: async (file, onProgress) => { return posService.uploadExcelUpdate(file, (row) => ({ description_print: row[5], dept: row[11], class: row[13], merchandise: row[20], regPrice_print: row[24], method_print: row[29], unitPrice_print: row[31], dealPrice_print: row[35], dealQty_print: row[40], limit_print: row[44], mpg_print: row[47], tax_print: row[50], brand_print: row[53] }), onProgress); },
  uploadItemMaintenance: async (file, onProgress) => { return posService.uploadExcelUpdate(file, (row) => ({ description_maint: row[5], type_maint: row[11], dept_maint: row[13], class_maint: row[17], regPrice_maint: row[21], method_maint: row[24], unitPrice_maint: row[27], dealPrice_maint: row[31], dealQty_maint: row[37], limitQty_maint: row[42], mpGroup_maint: row[45] }), onProgress); },
  getProductStats: async () => { try { const coll = collection(db, 'products'); const snapshot = await getCountFromServer(coll); return { count: snapshot.data().count, lastUpdated: new Date() }; } catch (e) { return { count: 0, lastUpdated: null }; } },
  clearDatabase: async (onProgress) => { const BATCH_SIZE = 400; let totalDeleted = 0; while (true) { const q = query(collection(db, 'products'), limit(BATCH_SIZE)); const snapshot = await getDocs(q); if (snapshot.empty) break; const batch = writeBatch(db); snapshot.forEach((doc) => batch.delete(doc.ref)); await batch.commit(); totalDeleted += snapshot.size; if (onProgress) onProgress(totalDeleted); await new Promise(r => setTimeout(r, 50)); } return totalDeleted; },
  createOrder: async (orderData) => { const { addDoc, collection, serverTimestamp } = await import('firebase/firestore'); const docRef = await addDoc(collection(db, 'invoices'), { ...orderData, createdAt: serverTimestamp(), status: 'paid' }); return docRef.id; }
};
