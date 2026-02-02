import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  orderBy,
  updateDoc,
  increment
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * accounts/{uid}:
 *  { email, sessionVersion, disabled, welcomeMessage, createdAt, updatedAt }
 *
 * accounts/{uid}/profiles/{profileId}:
 *  { role: 'admin'|'supervisor'|'staff', displayName, pinSaltB64, pinHashB64, pinIterations, mustChangePin, disabled, createdAt, updatedAt }
 */

export function accountRef(uid) {
  return doc(db, "accounts", uid);
}

export function profileRef(uid, profileId) {
  return doc(db, "accounts", uid, "profiles", profileId);
}

export async function ensureAccountDoc(uid, email) {
  const ref = accountRef(uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      email: email ?? null,
      sessionVersion: 1,
      disabled: false,
      welcomeMessage: "ยินดีต้อนรับ",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, { updatedAt: serverTimestamp() });
  }
}

export async function listProfiles(uid) {
  const col = collection(db, "accounts", uid, "profiles");
  const q = query(col, orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function ensureStarterAdmin(uid) {
  const profiles = await listProfiles(uid);
  if (profiles.length > 0) return;

  await setDoc(profileRef(uid, "admin"), {
    role: "admin",
    displayName: "Starter Admin",
    disabled: false,
    mustChangePin: true,
    // PIN hash will be seeded to 1234 on first PIN screen use if missing
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function bumpSessionVersion(uid) {
  await updateDoc(accountRef(uid), { sessionVersion: increment(1), updatedAt: serverTimestamp() });
}

export async function setWelcomeMessage(uid, text) {
  await updateDoc(accountRef(uid), { welcomeMessage: String(text ?? ""), updatedAt: serverTimestamp() });
}

export async function pingDatabase() {
  // ping: if read succeeds, treat as connected
  await getDoc(doc(db, "system", "status"));
  return true;
}