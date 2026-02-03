/**
 * create-admin-account.cjs
 * Script สำหรับสร้าง admin account เริ่มต้น (chicken-egg solution)
 * 
 * วิธีใช้:
 * 1. ไปที่ Firebase Console > Project Settings > Service Accounts
 * 2. Generate new private key และ save เป็น service-account.json ใน root folder
 * 3. รัน: node scripts/create-admin-account.cjs
 */

const admin = require("firebase-admin");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Configuration
const SERVICE_ACCOUNT_PATH = process.env.SERVICE_ACCOUNT_PATH || path.join(__dirname, "..", "service-account.json");
const ID_CODE = process.env.ID_CODE || "ADMIN001";
const EMAIL = process.env.ADMIN_EMAIL || "admin@boots-pos.com";
const PIN = process.env.ADMIN_PIN || "1234";

const PIN_ITERATIONS = 120000;
const PIN_KEYLEN = 32;

// Load service account
let serviceAccount;
try {
  serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
} catch (err) {
  console.error(`❌ ไม่พบ service-account.json: ${SERVICE_ACCOUNT_PATH}`);
  console.error("   กรุณา download service account key จาก Firebase Console");
  console.error("   หรือระบุ path ผ่าน env: SERVICE_ACCOUNT_PATH=/path/to/service-account.json");
  process.exit(1);
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
  });
}

const db = admin.firestore();

function hashPin(pin, salt) {
  const pinSalt = salt || crypto.randomBytes(16).toString("base64");
  const hash = crypto.pbkdf2Sync(pin, pinSalt, PIN_ITERATIONS, PIN_KEYLEN, "sha256").toString("base64");
  return { pinHash: hash, pinSalt, pinAlgo: `pbkdf2-sha256-${PIN_ITERATIONS}` };
}

async function createAdminAccount() {
  console.log("🚀 กำลังสร้าง admin account...");
  console.log(`   ID Code: ${ID_CODE}`);
  console.log(`   Email: ${EMAIL}`);

  const { pinHash, pinSalt, pinAlgo } = hashPin(PIN);

  const batch = db.batch();

  // Document references
  const accountRef = db.collection("accounts").doc(EMAIL);
  const idRef = accountRef.collection("ids").doc(ID_CODE);
  const indexRef = db.collection("idIndex").doc(ID_CODE);
  const bootstrapMarkerRef = db.collection("system_metadata").doc("bootstrap_admin_state");

  // Create account document
  batch.set(accountRef, {
    email: EMAIL,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Create ID document with admin role
  batch.set(idRef, {
    idCode: ID_CODE,
    email: EMAIL,
    role: "admin",
    permissions: {
      allowedMenus: ["dashboard", "pos", "search", "report", "inventory", "orders", "settings", "Upload", "management"]
    },
    status: "active",
    pinHash,
    pinSalt,
    pinAlgo,
    pinAttempts: 0,
    pinResetRequired: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: "bootstrap-script",
    createdByUid: "system"
  });

  // Create index document
  batch.set(indexRef, {
    idCode: ID_CODE,
    email: EMAIL,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Mark that bootstrap admin exists
  batch.set(bootstrapMarkerRef, {
    exists: true,
    email: EMAIL,
    idCode: ID_CODE,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdByUid: "system"
  });

  try {
    await batch.commit();
    console.log("✅ สร้าง admin account สำเร็จ!");
    console.log("");
    console.log("ข้อมูลสำหรับ login:");
    console.log(`   Email: ${EMAIL}`);
    console.log(`   ID Code: ${ID_CODE}`);
    console.log(`   PIN: ${PIN}`);
    console.log("");
    console.log("⚠️  กรุณาเปลี่ยน PIN หลังจาก login ครั้งแรก");
  } catch (err) {
    console.error("❌ Error:", err.message);
    if (err.code === 6) { // ALREADY_EXISTS
      console.error("   Admin account มีอยู่แล้ว");
    }
    process.exit(1);
  }
}

createAdminAccount();
