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
  // --- REPORT ---
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
      await updateDoc(docRef, { status: 'void', voidReason: reason || 'Cashier Request', voidedAt: serverTimestamp() });
      return true;
    } catch (e) { throw new Error('Void Failed: ' + e.message); }
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

  // [FIX] Aliases to prevent "function missing" errors
  search: async (keyword) => { return posService.searchProducts(keyword); },

  // --- SCAN ITEM ---
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
    } catch (error) { 
        if (error.message.includes('ไม่พบสินค้า')) throw error; 
        throw new Error('เกิดข้อผิดพลาดในการค้นหา'); 
    }
  },

  // [FIX] Restore getLastDBUpdate to prevent PosUI crash
  getLastDBUpdate: async () => {
    try {
      const q = query(collection(db, 'products'), orderBy('updatedAt', 'desc'), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        return data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date();
      }
      return null;
    } catch (e) { console.warn("Failed to get DB update time", e); return null; }
  },

  // --- OPTIMIZED MULTI-TYPE UPLOAD ---
  uploadFileOptimized: async (file, type, onProgress) => {
    const startTime = Date.now();
    if (onProgress) onProgress({ phase: 'Parsing', percent: 0, total: 0, success: 0, failed: 0, errors: [] });
    
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
    
    if (rows.length > 0) rows.shift(); // Remove header

    const total = rows.length;
    if (total === 0) return { success: 0, failed: 0, errors: ['File is empty'] };

    if (onProgress) onProgress({ phase: 'Processing', percent: 5, total, success: 0, failed: 0, errors: [] });

    const batches = [];
    const BATCH_SIZE = 500;
    let currentBatch = writeBatch(db);
    let countInBatch = 0;
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    const processRow = (row, index) => {
        let code = '';
        let data = {};
        const itemCode = String(row[1] || '').trim();
        if (!itemCode) throw new Error(`Row ${index + 2}: Missing Code`);
        code = itemCode;

        if (type === 'PRINT') {
            data = {
                description_print: row[5], dept: row[11], class: row[13], merchandise: row[20],
                regPrice_print: row[24], method_print: row[29], unitPrice_print: row[31],
                dealPrice_print: row[35], dealQty_print: row[40], limit_print: row[44],
                mpg_print: row[47], tax_print: row[50], brand_print: row[53],
                updatedAt: serverTimestamp()
            };
        } else if (type === 'MAINT') {
            data = {
                description_maint: row[5], type_maint: row[11], dept_maint: row[13],
                class_maint: row[17], regPrice_maint: row[21], method_maint: row[24],
                unitPrice_maint: row[27], dealPrice_maint: row[31], dealQty_maint: row[37],
                limitQty_maint: row[42], mpGroup_maint: row[45],
                updatedAt: serverTimestamp()
            };
        }
        return { code, data };
    };

    let rowsToProcess = rows;
    if (type === 'MASTER') {
        const rowsObj = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        rowsToProcess = rowsObj;
    }

    rowsToProcess.forEach((row, index) => {
      try {
        let docRef, updateData;

        if (type === 'MASTER') {
            const status = String(row['ProductStatus'] || row['Product Status'] || '').trim();
            if (!status.startsWith('0')) return; 

            const rawCode = row['ProductCode'] || row['GridProductCode'] || row['Product Code'] || '';
            const cleanCode = String(rawCode).trim();
            if (!cleanCode) throw new Error(`Row ${index + 2}: Missing Code`);

            docRef = doc(db, 'products', cleanCode);
            updateData = {
                ProductCode: cleanCode,
                Barcode: String(row['Barcode'] || row['Bar Code'] || '').trim(),
                ProductDesc: String(row['ProductDesc'] || row['Description'] || '').trim(),
                SellPrice: parseFloat(row['SellPrice'] || row['Price'] || 0),
                VatRate: parseFloat(row['VatRate'] || row['Vat'] || 0),
                ...row,
                updatedAt: serverTimestamp()
            };
            const keywords = generateKeywords(updateData.ProductDesc);
            if (updateData.Barcode) keywords.push(updateData.Barcode);
            if (cleanCode) keywords.push(cleanCode);
            updateData.keywords = keywords;

        } else {
            const result = processRow(row, index);
            docRef = doc(db, 'products', result.code);
            updateData = result.data;
        }

        currentBatch.set(docRef, updateData, { merge: true });
        countInBatch++;
        successCount++;

        if (countInBatch >= BATCH_SIZE) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          countInBatch = 0;
        }
      } catch (err) {
        failCount++;
        if (errors.length < 20) errors.push(err.message);
      }
    });

    if (countInBatch > 0) batches.push(currentBatch);

    const CONCURRENCY_LIMIT = 5;
    
    async function runBatches() {
        const executing = [];
        let completed = 0;
        for (const batch of batches) {
            const p = batch.commit().then(() => {
                completed++;
                const percent = 10 + Math.floor((completed / batches.length) * 90);
                if (onProgress) onProgress({ phase: 'Uploading', percent, total, success: successCount, failed: failCount, errors });
            });
            executing.push(p);
            if (executing.length >= CONCURRENCY_LIMIT) await Promise.race(executing);
        }
        await Promise.all(executing);
    }

    await runBatches();
    if (onProgress) onProgress({ phase: 'Done', percent: 100, total, success: successCount, failed: failCount, errors });
    return { success: successCount, failed: failCount, time: Date.now() - startTime };
  },

  // [FIX] Alias for backward compatibility
  uploadMasterDataOptimized: async (file, onProgress) => {
    return posService.uploadFileOptimized(file, 'MASTER', onProgress);
  },

  // --- LEGACY ---
  createOrder: async (orderData) => { const { addDoc, collection, serverTimestamp } = await import('firebase/firestore'); const docRef = await addDoc(collection(db, 'invoices'), { ...orderData, createdAt: serverTimestamp(), status: 'paid' }); return docRef.id; }
};
