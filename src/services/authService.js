import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../firebase";

function normLower(v) {
  return String(v || "").trim().toLowerCase();
}

export async function resolveUsernameToEmail(username) {
  const u = normLower(username);
  if (!u) return null;
  const snap = await getDoc(doc(db, "usernames", u));
  if (!snap.exists()) return null;
  const data = snap.data();
  return data && data.email ? String(data.email) : null;
}

export async function loginWithUsernameOrEmail(usernameOrEmail, password) {
  const id = String(usernameOrEmail || "").trim();
  const pass = String(password || "");
  if (!id || !pass) {
    throw new Error("Please enter username/email and password");
  }

  let email = id;
  if (!id.includes("@")) {
    const resolved = await resolveUsernameToEmail(id);
    if (!resolved) {
      throw new Error("Username not found");
    }
    email = resolved;
  }

  return signInWithEmailAndPassword(auth, normLower(email), pass);
}

export async function logout() {
  return signOut(auth);
}

export async function getUserProfile(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return snap.data();
}

// Optional: self-registration (kept minimal). Role defaults to "user".
export async function registerSelf({ username, email, password }) {
  const u = normLower(username);
  const e = normLower(email);
  const p = String(password || "").trim();
  if (!u || u.length < 3) throw new Error("Username must be at least 3 characters");
  if (!e || !e.includes("@")) throw new Error("Invalid email");
  if (!p || p.length < 6) throw new Error("Password must be at least 6 characters");

  // Create auth user (will switch session to the new user)
  const cred = await createUserWithEmailAndPassword(auth, e, p);
  const uid = cred.user.uid;

  // Create minimal profile + username mapping (will be enforced by rules; may fail if reserved)
  await setDoc(doc(db, "users", uid), {
    uid,
    email: e,
    username: u,
    role: "user",
    allowedMenus: [],
    createdByUid: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, "usernames", u), {
    uid,
    email: e,
    createdAt: serverTimestamp(),
  });

  return cred;
}

export async function createManagedUser(payload) {
  const fn = httpsCallable(functions, "createManagedUser");
  const res = await fn(payload);
  return res && res.data ? res.data : null;
}

export async function updateManagedUser(payload) {
  const fn = httpsCallable(functions, "updateManagedUser");
  const res = await fn(payload);
  return res && res.data ? res.data : null;
}