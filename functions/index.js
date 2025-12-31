/* functions/index.js */
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const REGION = "asia-southeast1";
const UPLOAD_DOC = db.collection("system_metadata").doc("upload_status");

function requireAuth(context) {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
}
function requireAppCheck(context) {
  if (!context.app) throw new functions.https.HttpsError("failed-precondition", "App Check required");
}

async function isAdmin(uid) {
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists && (snap.data().role === "admin");
}

function nowTs() { return admin.firestore.FieldValue.serverTimestamp(); }

function normalizeType(type) {
  // ✅ NEW: pricing = ItemMasterPrintOnDeph (must be first)
  if (!["pricing", "master", "maintenance"].includes(type)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid upload type");
  }
  return type;
}

async function acquireLock(uid, type, fileMeta) {
  await db.runTransaction(async (tx) => {
    const s = await tx.get(UPLOAD_DOC);
    const data = s.exists ? s.data() : {};
    const lock = data.lock || {};

    if (lock.inProgress) {
      throw new functions.https.HttpsError("failed-precondition", `Upload in progress by ${lock.by || "unknown"}`);
    }

    // ✅ NEW prerequisite: pricing must be ready before master/maintenance
    const pricingReady = !!(data.pricing && data.pricing.isReady);
    if ((type === "master" || type === "maintenance") && !pricingReady) {
      throw new functions.https.HttpsError("failed-precondition", "ItemMasterPrintOnDeph (pricing) not uploaded yet");
    }

    tx.set(UPLOAD_DOC, {
      lock: { inProgress: true, by: uid, type, startedAt: nowTs() },
      lastError: admin.firestore.FieldValue.delete()
    }, { merge: true });

    tx.set(UPLOAD_DOC, {
      [type]: {
        ...(data[type] || {}),
        lastFileName: fileMeta?.fileName || null,
        lastChecksum: fileMeta?.checksum || null,
        lastRowCount: fileMeta?.rowCount || null
      }
    }, { merge: true });
  });
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Keep ops safe
const MAX_OPS_PER_BATCH = 400;

function safeStr(x) { return (x === undefined || x === null) ? "" : String(x).trim(); }
function safeNum(x) { const n = Number(x); return Number.isFinite(n) ? n : 0; }

// ✅ Step 1 = PRICING (ItemMasterPrintOnDeph) - create/upsert base products
function mapPricingRow(row) {
  const itemCode = safeStr(row.Itemcode || row.ItemCode || row.ProductCode);
  if (!itemCode) return null;

  const name = safeStr(row.Description || row["Description"]);
  const barcode = safeStr(row.Barcode || row.BARCODE); // if present in file; ok if empty

  const doc = {
    itemCode,
    name: name || null,
    barcodeMain: barcode || null,
    dept: safeStr(row.Dept || row["Dept"]),
    class: safeStr(row.Class || row["Class"]),
    merchandise: safeStr(row.Merchandise || row["Merchandise"]),
    regPrice: safeNum(row["Reg. Price"] ?? row.RegPrice ?? row["Reg Price"]),
    method: safeStr(row.Method || row["Method"]),
    unitPrice: safeNum(row["Unit Price"] ?? row.UnitPrice),
    dealPrice: safeNum(row["Deal Price"] ?? row.DealPrice),
    dealQty: safeNum(row["Deal QTY"] ?? row.DealQty),
    limitQty: safeNum(row["Limit"] ?? row["Limit QTY"] ?? row.LimitQty),
    mpg: safeStr(row.MPG || row["MPG"]),
    tax: safeStr(row.Tax || row["Tax"]),
    brand: safeStr(row.Brand || row["Brand"]),
    source: { pricingAt: admin.firestore.FieldValue.serverTimestamp() },
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  doc.keywordsText = `${itemCode} ${barcode} ${name}`.toLowerCase();
  return { itemCode, barcode, doc };
}

// ✅ Step 2 = MASTER (ProductAllDept) - enrich/merge only (no need to exist check now, but ok)
function mapMasterRow(row) {
  const itemCode = safeStr(row.ProductCode || row.Itemcode || row.ItemCode || row.ID);
  const name = safeStr(row.ProductDesc || row.Description || row.Name);
  const barcode = safeStr(row.Barcode || row.BARCODE);
  const status = safeStr(row.ProductStatus || row.Status);

  if (!status || !status.startsWith("0")) return null;
  if (!itemCode) return null;

  const upd = {
    itemCode,
    name: name || null,
    barcodeMain: barcode || null,
    dept: safeStr(row.Dept || row.Department),
    deptDesc: safeStr(row.DeptDesc || row.DepartmentDesc),
    price: safeNum(row.SellPrice || row.Price || row.UnitPrice),
    status,
    source: { masterAt: admin.firestore.FieldValue.serverTimestamp() },
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  return { itemCode, barcode, upd };
}

function mapMaintenanceRow(row) {
  const itemCode = safeStr(row.Itemcode || row.ItemCode || row.ProductCode);
  if (!itemCode) return null;

  const upd = {
    itemCode,
    description: safeStr(row.Description || row["Description"]),
    maintenanceType: safeStr(row.Type || row["Type"]),
    dept: safeStr(row.Dept || row["Dept"]),
    class: safeStr(row.Class || row["Class"]),
    regPrice: safeNum(row["Reg. Price"] ?? row.RegPrice ?? row["Reg Price"]),
    method: safeStr(row.Method || row["Method"]),
    unitPrice: safeNum(row["Unit Price"] ?? row.UnitPrice),
    dealPrice: safeNum(row["Deal Price"] ?? row.DealPrice),
    limitQty: safeNum(row["Limit QTY"] ?? row.LimitQty),
    mpGroup: safeStr(row["MP Group"] ?? row.MPGroup),
    source: { maintenanceAt: admin.firestore.FieldValue.serverTimestamp() },
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (!upd.description) delete upd.description;
  return { itemCode, upd };
}

exports.beginUpload = functions.region(REGION).https.onCall(async (data, context) => {
  requireAuth(context);
  requireAppCheck(context);

  const uid = context.auth.uid;
  if (!(await isAdmin(uid))) throw new functions.https.HttpsError("permission-denied", "Admin only");

  const type = normalizeType(data?.type);
  const fileMeta = data?.fileMeta || {};
  await acquireLock(uid, type, fileMeta);
  return { ok: true };
});

exports.uploadChunk = functions.region(REGION).https.onCall(async (data, context) => {
  requireAuth(context);
  requireAppCheck(context);

  const uid = context.auth.uid;
  if (!(await isAdmin(uid))) throw new functions.https.HttpsError("permission-denied", "Admin only");

  const type = normalizeType(data?.type);
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  if (rows.length === 0) return { ok: true, processed: 0, matched: 0, skipped: 0, invalid: 0 };

  const st = await UPLOAD_DOC.get();
  const lock = st.exists ? (st.data().lock || {}) : {};
  if (!lock.inProgress || lock.by !== uid || lock.type !== type) {
    throw new functions.https.HttpsError("failed-precondition", "No active lock for this upload");
  }

  let processed = 0, matched = 0, skipped = 0, invalid = 0;
  const ops = [];

  if (type === "pricing") {
    // Step 1: upsert products base from ItemMasterPrintOnDeph
    for (const r of rows) {
      const mapped = mapPricingRow(r);
      if (!mapped) { invalid++; continue; }
      const { itemCode, barcode, doc } = mapped;

      ops.push({ ref: db.collection("products").doc(itemCode), data: doc, merge: true });

      if (barcode) {
        ops.push({ ref: db.collection("barcode_index").doc(barcode), data: { itemCode, updatedAt: nowTs() }, merge: true });
      }
      processed++; matched++;
    }
  } else if (type === "master") {
    // Step 2: merge ProductAllDept (only for existing codes is optional, but we'll just merge)
    for (const r of rows) {
      const mapped = mapMasterRow(r);
      if (!mapped) { invalid++; continue; }
      const { itemCode, barcode, upd } = mapped;

      ops.push({ ref: db.collection("products").doc(itemCode), data: upd, merge: true });

      if (barcode) {
        ops.push({ ref: db.collection("barcode_index").doc(barcode), data: { itemCode, updatedAt: nowTs() }, merge: true });
      }
      processed++; matched++;
    }
  } else if (type === "maintenance") {
    // Step 3: update only if product exists
    const codes = [];
    const mappedRows = [];
    for (const r of rows) {
      const mapped = mapMaintenanceRow(r);
      if (!mapped) { invalid++; continue; }
      mappedRows.push(mapped);
      codes.push(mapped.itemCode);
    }

    const codeChunks = chunkArray(codes, 200);
    const existsSet = new Set();
    for (const c of codeChunks) {
      const refs = c.map(code => db.collection("products").doc(code));
      const snaps = await db.getAll(...refs);
      snaps.forEach((snap, idx) => { if (snap.exists) existsSet.add(c[idx]); });
    }

    for (const m of mappedRows) {
      if (!existsSet.has(m.itemCode)) { skipped++; continue; }
      ops.push({ ref: db.collection("products").doc(m.itemCode), data: m.upd, merge: true });
      processed++; matched++;
    }
  }

  const opChunks = chunkArray(ops, MAX_OPS_PER_BATCH);
  for (const part of opChunks) {
    const batch = db.batch();
    for (const op of part) batch.set(op.ref, op.data, { merge: !!op.merge });
    await batch.commit();
  }

  return { ok: true, processed, matched, skipped, invalid };
});

exports.finalizeUpload = functions.region(REGION).https.onCall(async (data, context) => {
  requireAuth(context);
  requireAppCheck(context);

  const uid = context.auth.uid;
  if (!(await isAdmin(uid))) throw new functions.https.HttpsError("permission-denied", "Admin only");

  const type = normalizeType(data?.type);
  const summary = data?.summary || {};

  await db.runTransaction(async (tx) => {
    const s = await tx.get(UPLOAD_DOC);
    const d = s.exists ? s.data() : {};
    const currentVersion = Number(d?.pricing?.version || 0);

    const patch = {};
    if (type === "pricing") {
      patch.pricing = {
        ...(d.pricing || {}),
        isReady: true,
        lastUploadAt: nowTs(),
        rowCount: summary.rowCount ?? d.pricing?.rowCount ?? null,
        checksum: summary.checksum ?? d.pricing?.checksum ?? null,
        version: currentVersion + 1
      };
      patch.productsVersion = currentVersion + 1;
    } else {
      patch[type] = {
        ...(d[type] || {}),
        isReady: true,
        lastUploadAt: nowTs(),
        matched: summary.matched ?? null,
        skipped: summary.skipped ?? null,
        invalid: summary.invalid ?? null,
        processed: summary.processed ?? null
      };
      patch.productsVersion = currentVersion;
    }

    tx.set(UPLOAD_DOC, patch, { merge: true });
    tx.set(UPLOAD_DOC, { lock: { inProgress: false, by: null, type: null, startedAt: null } }, { merge: true });
  });

  return { ok: true };
});

exports.abortUpload = functions.region(REGION).https.onCall(async (data, context) => {
  requireAuth(context);
  requireAppCheck(context);

  const uid = context.auth.uid;
  if (!(await isAdmin(uid))) throw new functions.https.HttpsError("permission-denied", "Admin only");

  await UPLOAD_DOC.set({
    lock: { inProgress: false, by: null, type: null, startedAt: null },
    lastError: { at: new Date().toISOString(), step: "abort", message: "aborted by admin" }
  }, { merge: true });

  return { ok: true };
});
