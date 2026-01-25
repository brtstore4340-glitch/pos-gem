"use strict";

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function normLower(v) {
  return String(v || "")
    .trim()
    .toLowerCase();
}

async function getCallerProfile(uid) {
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) return null;
  return snap.data();
}

function assertRoleAllowed(callerRole, targetRole) {
  const okRoles = new Set(["admin", "SM-SGM", "user"]);
  if (!okRoles.has(targetRole)) {
    const err = new Error("Invalid role");
    err.code = "invalid-argument";
    throw err;
  }
  if (callerRole === "SM-SGM" && targetRole === "admin") {
    const err = new Error("SM-SGM cannot assign admin role");
    err.code = "permission-denied";
    throw err;
  }
}

exports.createManagedUser = async (data, context) => {
  if (!context || !context.auth || !context.auth.uid) {
    const err = new Error("Unauthenticated");
    err.code = "unauthenticated";
    throw err;
  }

  const callerUid = context.auth.uid;
  const caller = await getCallerProfile(callerUid);
  const callerRole = caller && caller.role ? caller.role : null;
  if (callerRole !== "admin" && callerRole !== "SM-SGM") {
    const err = new Error("Permission denied");
    err.code = "permission-denied";
    throw err;
  }

  const username = normLower(data && data.username);
  const email = normLower(data && data.email);
  const password = String((data && data.password) || "").trim();
  const role = String((data && data.role) || "user").trim();
  const allowedMenus = Array.isArray(data && data.allowedMenus)
    ? data.allowedMenus.map(String)
    : [];

  if (!username || username.length < 3) {
    const err = new Error("Username must be at least 3 characters");
    err.code = "invalid-argument";
    throw err;
  }
  if (!email || !email.includes("@")) {
    const err = new Error("Invalid email");
    err.code = "invalid-argument";
    throw err;
  }
  if (!password || password.length < 6) {
    const err = new Error("Password must be at least 6 characters");
    err.code = "invalid-argument";
    throw err;
  }

  assertRoleAllowed(callerRole, role);

  const unameRef = db.doc(`usernames/${username}`);
  const unameSnap = await unameRef.get();
  if (unameSnap.exists) {
    const err = new Error("Username already exists");
    err.code = "already-exists";
    throw err;
  }

  let userRecord;
  try {
    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: username,
    });
  } catch (e) {
    const msg = e && e.message ? e.message : "Failed to create auth user";
    const err = new Error(msg);
    err.code = "internal";
    throw err;
  }

  const uid = userRecord.uid;
  const now = admin.firestore.FieldValue.serverTimestamp();

  const userRef = db.doc(`users/${uid}`);
  const createdByUid = callerRole === "admin" ? null : callerUid;

  const batch = db.batch();
  batch.set(userRef, {
    uid,
    email,
    username,
    role,
    allowedMenus,
    createdByUid,
    createdAt: now,
    updatedAt: now,
  });
  batch.create(unameRef, {
    uid,
    email,
    createdAt: now,
  });

  try {
    await batch.commit();
  } catch (e) {
    // Best-effort rollback auth user if Firestore write fails
    try {
      await admin.auth().deleteUser(uid);
    } catch (_) {}
    const msg = e && e.message ? e.message : "Failed to create user profile";
    const err = new Error(msg);
    err.code = "internal";
    throw err;
  }

  return { uid };
};

exports.updateManagedUser = async (data, context) => {
  if (!context || !context.auth || !context.auth.uid) {
    const err = new Error("Unauthenticated");
    err.code = "unauthenticated";
    throw err;
  }

  const callerUid = context.auth.uid;
  const caller = await getCallerProfile(callerUid);
  const callerRole = caller && caller.role ? caller.role : null;
  if (callerRole !== "admin" && callerRole !== "SM-SGM") {
    const err = new Error("Permission denied");
    err.code = "permission-denied";
    throw err;
  }

  const targetUid = String((data && data.uid) || "").trim();
  if (!targetUid) {
    const err = new Error("Missing uid");
    err.code = "invalid-argument";
    throw err;
  }

  const targetRef = db.doc(`users/${targetUid}`);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    const err = new Error("User not found");
    err.code = "not-found";
    throw err;
  }
  const target = targetSnap.data();

  if (callerRole === "SM-SGM") {
    if (!target || target.createdByUid !== callerUid) {
      const err = new Error("SM-SGM can only update users they created");
      err.code = "permission-denied";
      throw err;
    }
  }

  const patch = {};
  if (data && typeof data.role === "string" && data.role.trim()) {
    const role = data.role.trim();
    assertRoleAllowed(callerRole, role);
    patch.role = role;
  }
  if (data && Array.isArray(data.allowedMenus)) {
    patch.allowedMenus = data.allowedMenus.map(String);
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true };
  }

  patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  await targetRef.update(patch);

  return { ok: true };
};
