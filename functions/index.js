/* functions/index.js */
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const crypto = require("crypto");
const ALLOWED_ORIGINS = (process.env.ALLOWED_CORS_ORIGINS || "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const cors = require("cors")({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"), false);
  }
});

admin.initializeApp();
const db = admin.firestore();
const { calculateCartSummary } = require("./src/services/cartService");

const REGION = "asia-southeast1";
const UPLOAD_DOC = db.collection("system_metadata").doc("upload_status");
const BOOTSTRAP_ADMIN_DOC = db.collection("system_metadata").doc("bootstrap_admin_state");
const ACCOUNTS = db.collection("accounts");
const ID_INDEX = db.collection("idIndex");
const AUDIT_LOGS = db.collection("auditLogs");

const PIN_ITERATIONS = 120000;
const PIN_KEYLEN = 32;
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MINUTES = 15;
const ROLES = ["admin", "SM-SGM", "user"];
const DEFAULT_ALLOWED_MENUS = Object.freeze({
  admin: ["dashboard", "pos", "search", "report", "inventory", "orders", "settings", "Upload", "management"],
  "SM-SGM": ["dashboard", "pos", "search", "report", "inventory", "orders", "settings", "Upload", "management"],
  user: ["pos", "search", "dashboard"]
});

function requireAuth(context) {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
}

function getAuthEmail(context) {
  requireAuth(context);
  const email = String(context.auth.token?.email || "").trim().toLowerCase();
  if (!email) throw new functions.https.HttpsError("failed-precondition", "Email required");
  return email;
}
function requireAppCheck(context) {
  if (!context.app) throw new functions.https.HttpsError("failed-precondition", "App Check required");
}

async function isAdmin(uid) {
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists && (snap.data().role === "admin");
}

function nowTs() { return admin.firestore.FieldValue.serverTimestamp(); }

function hashPin(pin, salt) {
  const cleanPin = String(pin || "").trim();
  if (!cleanPin) throw new functions.https.HttpsError("invalid-argument", "PIN required");
  const pinSalt = salt || crypto.randomBytes(16).toString("base64");
  const hash = crypto.pbkdf2Sync(cleanPin, pinSalt, PIN_ITERATIONS, PIN_KEYLEN, "sha256").toString("base64");
  return { pinHash: hash, pinSalt, pinAlgo: `pbkdf2-sha256-${PIN_ITERATIONS}` };
}

function verifyPin(pin, record) {
  if (!record?.pinHash || !record?.pinSalt) return false;
  const expected = String(record.pinHash || "");
  const pinSalt = String(record.pinSalt || "");
  const hash = crypto.pbkdf2Sync(String(pin || ""), pinSalt, PIN_ITERATIONS, PIN_KEYLEN, "sha256").toString("base64");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
}

function validateJsonBody(req, res) {
  const contentType = req.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    res.status(415).json({ error: "Unsupported Media Type. Use application/json." });
    return false;
  }
  if (!req.body || typeof req.body !== "object") {
    res.status(400).json({ error: "Invalid JSON body" });
    return false;
  }
  return true;
}

function sanitizePermissions(input, role) {
  const allowedMenus = Array.isArray(input?.allowedMenus) ? input.allowedMenus : (DEFAULT_ALLOWED_MENUS[role] || []);
  const clean = Array.from(new Set(allowedMenus.map((m) => String(m || "").trim()).filter(Boolean)));
  return { allowedMenus: clean };
}

async function getIdDocByCode(idCode) {
  const cleanId = String(idCode || "").trim();
  if (!cleanId) throw new functions.https.HttpsError("invalid-argument", "idCode required");
  const indexSnap = await ID_INDEX.doc(cleanId).get();
  if (!indexSnap.exists) throw new functions.https.HttpsError("not-found", "ID not found");
  const email = String(indexSnap.data()?.email || "").trim().toLowerCase();
  if (!email) throw new functions.https.HttpsError("failed-precondition", "ID email missing");
  const idRef = ACCOUNTS.doc(email).collection("ids").doc(cleanId);
  const idSnap = await idRef.get();
  if (!idSnap.exists) throw new functions.https.HttpsError("not-found", "ID not found");
  return { email, idRef, idSnap };
}

async function getActor(context, actorIdCode) {
  const email = getAuthEmail(context);
  const { email: targetEmail, idSnap } = await getIdDocByCode(actorIdCode);
  if (targetEmail !== email) throw new functions.https.HttpsError("permission-denied", "Actor email mismatch");
  const data = idSnap.data() || {};
  if (data.status !== "active") throw new functions.https.HttpsError("permission-denied", "Actor disabled");
  return {
    email,
    idCode: String(actorIdCode || "").trim(),
    role: String(data.role || ""),
    permissions: data.permissions || {}
  };
}

function assertManageScope(actor, targetEmail, targetRole, desiredRole) {
  if (actor.role === "admin") return;
  if (actor.role !== "SM-SGM") throw new functions.https.HttpsError("permission-denied", "Not allowed");
  if (actor.email !== targetEmail) throw new functions.https.HttpsError("permission-denied", "Email scope violation");
  if (targetRole === "admin" || desiredRole === "admin") {
    throw new functions.https.HttpsError("permission-denied", "Cannot assign admin role");
  }
}

function assertMenuAccess(actor, menu) {
  const permissions = sanitizePermissions(actor.permissions, actor.role);
  if (!permissions.allowedMenus.includes(menu)) {
    throw new functions.https.HttpsError("permission-denied", "Menu access denied");
  }
}

async function writeAuditLog(payload) {
  await AUDIT_LOGS.add({
    ...payload,
    createdAt: nowTs()
  });
}

function normalizeType(type) {
  // ✅ NEW: pricing = ItemMasterPrintOnDeph (must be first)
  if (!["pricing", "master", "maintenance"].includes(type)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid upload type");
  }
  return type;
}

async function acquireLock(lockOwner, type, fileMeta) {
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
      lock: { inProgress: true, by: lockOwner, type, startedAt: nowTs() },
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

exports.bootstrapAdmin = functions.region(REGION).https.onCall(async (data, context) => {
  const email = getAuthEmail(context);
  const idCode = safeStr(data?.idCode);
  const pin = safeStr(data?.pin);
  if (!idCode || !pin) throw new functions.https.HttpsError("invalid-argument", "idCode and pin required");

  // Prefer collection group lookup; if unsupported, fall back to marker doc.
  let adminExists = false;
  try {
    const existingAdmin = await db.collectionGroup("ids").where("role", "==", "admin").limit(1).get();
    adminExists = !existingAdmin.empty;
  } catch (err) {
    console.error("bootstrapAdmin admin lookup failed, falling back to marker doc:", err?.message || err);
    const markerSnap = await BOOTSTRAP_ADMIN_DOC.get();
    adminExists = !!(markerSnap.exists && markerSnap.data()?.exists);
  }
  if (adminExists) throw new functions.https.HttpsError("failed-precondition", "Admin already exists");

  await db.runTransaction(async (tx) => {
    const bootstrapMarker = await tx.get(BOOTSTRAP_ADMIN_DOC);
    if (bootstrapMarker.exists && bootstrapMarker.data()?.exists) {
      throw new functions.https.HttpsError("failed-precondition", "Admin already exists");
    }

    const indexRef = ID_INDEX.doc(idCode);
    if ((await tx.get(indexRef)).exists) throw new functions.https.HttpsError("already-exists", "ID already exists");

    const accountRef = ACCOUNTS.doc(email);
    const idRef = accountRef.collection("ids").doc(idCode);
    const { pinHash, pinSalt, pinAlgo } = hashPin(pin);
    const permissions = sanitizePermissions(data?.permissions, "admin");

    tx.set(accountRef, { email, createdAt: nowTs(), updatedAt: nowTs() }, { merge: true });
    tx.set(idRef, {
      idCode,
      email,
      role: "admin",
      permissions,
      status: "active",
      pinHash,
      pinSalt,
      pinAlgo,
      pinAttempts: 0,
      pinResetRequired: false,
        createdAt: nowTs(),
        updatedAt: nowTs(),
        createdBy: "bootstrap",
        createdByUid: context.auth.uid
      });
      tx.set(indexRef, { idCode, email, createdAt: nowTs() });
      tx.set(BOOTSTRAP_ADMIN_DOC, {
        exists: true,
        email,
        idCode,
        createdAt: nowTs(),
        createdByUid: context.auth?.uid || null
      }, { merge: true });
    });

  await writeAuditLog({
    action: "bootstrap_admin",
    actorUid: context.auth.uid,
    actorEmail: email,
    actorIdCode: idCode,
    targetEmail: email,
    targetIdCode: idCode
  });

  return { ok: true };
});

// HTTPS REST fallback with CORS + body validation (for clients not using httpsCallable)
exports.bootstrapAdminHttp = functions.region(REGION).https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method === "OPTIONS") return res.status(204).send("");
      if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
      if (!validateJsonBody(req, res)) return;

      const { idCode, pin } = req.body || {};
      if (!idCode || !pin) return res.status(400).json({ error: "idCode and pin required" });

      // Require Firebase Auth token (should be injected by proxy/emulator middleware)
      try { requireAuth({ auth: req.auth || req.user }); } catch (e) { return res.status(401).json({ error: e.message }); }

      // Reuse callable logic by invoking directly
      const callable = exports.bootstrapAdmin;
      const result = await callable.run({ data: { idCode, pin }, context: { auth: req.auth || req.user } });
      return res.status(200).json(result);
    } catch (e) {
      console.error("bootstrapAdminHttp error:", e);
      const code = e?.code === "failed-precondition" ? 412 : 500;
      return res.status(code).json({ error: e?.message || "Internal error" });
    }
  });
});

exports.listMyIds = functions.region(REGION).https.onCall(async (data, context) => {
  const email = getAuthEmail(context);
  const snap = await ACCOUNTS.doc(email).collection("ids").get();
  const ids = snap.docs.map((doc) => {
    const { pinHash, pinSalt, pinAlgo, ...rest } = doc.data() || {};
    return rest;
  });
  return { ids };
});

exports.verifyIdPin = functions.region(REGION).https.onCall(async (data, context) => {
  const email = getAuthEmail(context);
  const idCode = safeStr(data?.idCode);
  const pin = safeStr(data?.pin);
  if (!idCode || !pin) throw new functions.https.HttpsError("invalid-argument", "idCode and pin required");

  const { email: targetEmail, idRef, idSnap } = await getIdDocByCode(idCode);
  if (targetEmail !== email) throw new functions.https.HttpsError("permission-denied", "Email mismatch");
  const idData = idSnap.data() || {};
  if (idData.status !== "active") throw new functions.https.HttpsError("failed-precondition", "ID disabled");

  const lockedUntil = idData.pinLockedUntil?.toMillis ? idData.pinLockedUntil.toMillis() : 0;
  if (lockedUntil && lockedUntil > Date.now()) {
    throw new functions.https.HttpsError("failed-precondition", "PIN locked");
  }

  const ok = verifyPin(pin, idData);
  if (!ok) {
    const attempts = Number(idData.pinAttempts || 0) + 1;
    const updates = { pinAttempts: attempts, updatedAt: nowTs() };
    if (attempts >= PIN_MAX_ATTEMPTS) {
      const lockUntil = admin.firestore.Timestamp.fromMillis(Date.now() + PIN_LOCK_MINUTES * 60 * 1000);
      updates.pinLockedUntil = lockUntil;
    }
    await idRef.update(updates);
    throw new functions.https.HttpsError("permission-denied", "Invalid PIN");
  }

  await idRef.update({
    pinAttempts: 0,
    pinLockedUntil: admin.firestore.FieldValue.delete(),
    lastLoginAt: nowTs(),
    updatedAt: nowTs()
  });

  const permissions = idData.permissions || sanitizePermissions(null, idData.role);

  return {
    session: {
      email,
      idCode,
      role: idData.role,
      permissions,
      status: idData.status,
      pinResetRequired: !!idData.pinResetRequired
    }
  };
});

exports.createId = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = await getActor(context, data?.actorIdCode);
  if (!["admin", "SM-SGM"].includes(actor.role)) throw new functions.https.HttpsError("permission-denied", "Not allowed");

  const targetEmail = safeStr(data?.email || actor.email).toLowerCase();
  const idCode = safeStr(data?.idCode);
  const role = safeStr(data?.role);
  const pin = safeStr(data?.pin);
  if (!idCode || !pin) throw new functions.https.HttpsError("invalid-argument", "idCode and pin required");
  if (!ROLES.includes(role)) throw new functions.https.HttpsError("invalid-argument", "Invalid role");
  assertManageScope(actor, targetEmail, null, role);

  await db.runTransaction(async (tx) => {
    const indexRef = ID_INDEX.doc(idCode);
    if ((await tx.get(indexRef)).exists) throw new functions.https.HttpsError("already-exists", "ID already exists");

    const accountRef = ACCOUNTS.doc(targetEmail);
    const idRef = accountRef.collection("ids").doc(idCode);
    const { pinHash, pinSalt, pinAlgo } = hashPin(pin);
    const permissions = sanitizePermissions(data?.permissions, role);

    tx.set(accountRef, { email: targetEmail, createdAt: nowTs(), updatedAt: nowTs() }, { merge: true });
    tx.set(idRef, {
      idCode,
      email: targetEmail,
      role,
      permissions,
      status: "active",
      pinHash,
      pinSalt,
      pinAlgo,
      pinAttempts: 0,
      pinResetRequired: false,
      createdAt: nowTs(),
      updatedAt: nowTs(),
      createdBy: actor.idCode,
      createdByUid: context.auth.uid
    });
    tx.set(indexRef, { idCode, email: targetEmail, createdAt: nowTs() });
  });

  await writeAuditLog({
    action: "create_id",
    actorUid: context.auth.uid,
    actorEmail: actor.email,
    actorIdCode: actor.idCode,
    targetEmail: targetEmail,
    targetIdCode: idCode,
    role
  });

  return { ok: true };
});

exports.updateId = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = await getActor(context, data?.actorIdCode);
  if (!["admin", "SM-SGM"].includes(actor.role)) throw new functions.https.HttpsError("permission-denied", "Not allowed");

  const idCode = safeStr(data?.idCode);
  if (!idCode) throw new functions.https.HttpsError("invalid-argument", "idCode required");

  const { email: targetEmail, idRef, idSnap } = await getIdDocByCode(idCode);
  const targetData = idSnap.data() || {};
  const desiredRole = data?.role ? safeStr(data?.role) : null;
  if (desiredRole && !ROLES.includes(desiredRole)) throw new functions.https.HttpsError("invalid-argument", "Invalid role");
  assertManageScope(actor, targetEmail, targetData.role, desiredRole);

  const updates = { updatedAt: nowTs(), updatedBy: actor.idCode, updatedByUid: context.auth.uid };
  if (desiredRole) updates.role = desiredRole;
  if (data?.permissions) updates.permissions = sanitizePermissions(data?.permissions, desiredRole || targetData.role);
  if (data?.status) updates.status = safeStr(data?.status);

  await idRef.update(updates);

  await writeAuditLog({
    action: "update_id",
    actorUid: context.auth.uid,
    actorEmail: actor.email,
    actorIdCode: actor.idCode,
    targetEmail,
    targetIdCode: idCode,
    role: desiredRole || targetData.role,
    status: updates.status
  });

  return { ok: true };
});

exports.resetPin = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = await getActor(context, data?.actorIdCode);
  if (!["admin", "SM-SGM"].includes(actor.role)) throw new functions.https.HttpsError("permission-denied", "Not allowed");

  const idCode = safeStr(data?.idCode);
  if (!idCode) throw new functions.https.HttpsError("invalid-argument", "idCode required");

  const { email: targetEmail, idRef, idSnap } = await getIdDocByCode(idCode);
  const targetData = idSnap.data() || {};
  assertManageScope(actor, targetEmail, targetData.role, null);

  const tempPin = String(Math.floor(100000 + Math.random() * 900000));
  const { pinHash, pinSalt, pinAlgo } = hashPin(tempPin);

  await idRef.update({
    pinHash,
    pinSalt,
    pinAlgo,
    pinAttempts: 0,
    pinLockedUntil: admin.firestore.FieldValue.delete(),
    pinResetRequired: true,
    updatedAt: nowTs(),
    updatedBy: actor.idCode,
    updatedByUid: context.auth.uid
  });

  await writeAuditLog({
    action: "reset_pin",
    actorUid: context.auth.uid,
    actorEmail: actor.email,
    actorIdCode: actor.idCode,
    targetEmail,
    targetIdCode: idCode
  });

  return { ok: true, tempPin };
});

exports.setPin = functions.region(REGION).https.onCall(async (data, context) => {
  const email = getAuthEmail(context);
  const idCode = safeStr(data?.idCode);
  const currentPin = safeStr(data?.currentPin);
  const newPin = safeStr(data?.newPin);
  if (!idCode || !currentPin || !newPin) throw new functions.https.HttpsError("invalid-argument", "Missing pin fields");

  const { email: targetEmail, idRef, idSnap } = await getIdDocByCode(idCode);
  if (targetEmail !== email) throw new functions.https.HttpsError("permission-denied", "Email mismatch");
  const idData = idSnap.data() || {};

  if (!verifyPin(currentPin, idData)) {
    throw new functions.https.HttpsError("permission-denied", "Invalid PIN");
  }

  const { pinHash, pinSalt, pinAlgo } = hashPin(newPin);
  await idRef.update({
    pinHash,
    pinSalt,
    pinAlgo,
    pinAttempts: 0,
    pinLockedUntil: admin.firestore.FieldValue.delete(),
    pinResetRequired: false,
    updatedAt: nowTs(),
    updatedBy: idCode,
    updatedByUid: context.auth.uid
  });

  await writeAuditLog({
    action: "set_pin",
    actorUid: context.auth.uid,
    actorEmail: email,
    actorIdCode: idCode,
    targetEmail,
    targetIdCode: idCode
  });

  return { ok: true };
});

exports.searchIds = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = await getActor(context, data?.actorIdCode);
  if (!["admin", "SM-SGM"].includes(actor.role)) throw new functions.https.HttpsError("permission-denied", "Not allowed");

  const idCode = safeStr(data?.idCode);
  const email = safeStr(data?.email).toLowerCase();

  if (idCode) {
    const { email: targetEmail, idSnap } = await getIdDocByCode(idCode);
    assertManageScope(actor, targetEmail, idSnap.data()?.role, null);
    const { pinHash, pinSalt, pinAlgo, ...rest } = idSnap.data() || {};
    return { ids: [rest] };
  }

  if (!email) throw new functions.https.HttpsError("invalid-argument", "email or idCode required");
  assertManageScope(actor, email, null, null);

  const snap = await ACCOUNTS.doc(email).collection("ids").get();
  const ids = snap.docs.map((doc) => {
    const { pinHash, pinSalt, pinAlgo, ...rest } = doc.data() || {};
    return rest;
  });
  return { ids };
});

exports.getAuditLogs = functions.region(REGION).https.onCall(async (data, context) => {
  const actor = await getActor(context, data?.actorIdCode);
  if (!["admin", "SM-SGM"].includes(actor.role)) throw new functions.https.HttpsError("permission-denied", "Not allowed");

  const targetEmail = safeStr(data?.email || "").toLowerCase();
  const limit = Math.min(Math.max(parseInt(data?.limit || 50, 10), 1), 200);

  if (actor.role === "SM-SGM" && targetEmail && targetEmail !== actor.email) {
    throw new functions.https.HttpsError("permission-denied", "Email scope violation");
  }

  let query = AUDIT_LOGS.orderBy("createdAt", "desc").limit(limit);
  if (targetEmail) query = query.where("targetEmail", "==", targetEmail);
  if (actor.role === "SM-SGM" && !targetEmail) query = query.where("targetEmail", "==", actor.email);

  const snap = await query.get();
  const logs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return { logs };
});

exports.calculateOrder = functions.region(REGION).https.onCall(async (data, context) => {
  requireAuth(context);
  const actorIdCode = safeStr(data?.actorIdCode);
  if (!actorIdCode) throw new functions.https.HttpsError("invalid-argument", "actorIdCode required");
  const actor = await getActor(context, actorIdCode);
  assertMenuAccess(actor, "pos");
  const { items, billDiscountPercent, coupons, allowance, topup } = data || {};
  return calculateCartSummary(items, billDiscountPercent, coupons, allowance, topup);
});

exports.beginUpload = functions.region(REGION).https.onCall(async (data, context) => {
  requireAuth(context);
  requireAppCheck(context);

  const actor = await getActor(context, data?.actorIdCode);
  if (actor.role !== "admin") throw new functions.https.HttpsError("permission-denied", "Admin only");

  const type = normalizeType(data?.type);
  const fileMeta = data?.fileMeta || {};
  await acquireLock(actor.idCode, type, fileMeta);
  return { ok: true };
});

exports.uploadChunk = functions.region(REGION).https.onCall(async (data, context) => {
  requireAuth(context);
  requireAppCheck(context);

  const actor = await getActor(context, data?.actorIdCode);
  if (actor.role !== "admin") throw new functions.https.HttpsError("permission-denied", "Admin only");

  const type = normalizeType(data?.type);
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  if (rows.length === 0) return { ok: true, processed: 0, matched: 0, skipped: 0, invalid: 0 };

  const st = await UPLOAD_DOC.get();
  const lock = st.exists ? (st.data().lock || {}) : {};
  if (!lock.inProgress || lock.by !== actor.idCode || lock.type !== type) {
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

  const actor = await getActor(context, data?.actorIdCode);
  if (actor.role !== "admin") throw new functions.https.HttpsError("permission-denied", "Admin only");

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

  const actor = await getActor(context, data?.actorIdCode);
  if (actor.role !== "admin") throw new functions.https.HttpsError("permission-denied", "Admin only");

  await UPLOAD_DOC.set({
    lock: { inProgress: false, by: null, type: null, startedAt: null },
    lastError: { at: new Date().toISOString(), step: "abort", message: "aborted by admin" }
  }, { merge: true });

  return { ok: true };
});
