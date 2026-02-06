import { httpsCallable } from 'firebase/functions';
import { functions, firebaseConfigured } from '../firebase';

// Reuse a single functions instance so callables don't re-init each call.

function ensureFunctionsReady() {
  if (!firebaseConfigured || !functions) {
    throw new Error('Firebase is not configured for this deployment. Please verify VITE_FIREBASE_* build variables in hosting CI.');
  }
}

const bootstrapAdminFn = functions ? httpsCallable(functions, 'bootstrapAdmin') : null;
const listMyIdsFn = functions ? httpsCallable(functions, 'listMyIds') : null;
const verifyIdPinFn = functions ? httpsCallable(functions, 'verifyIdPin') : null;
const createIdFn = functions ? httpsCallable(functions, 'createId') : null;
const updateIdFn = functions ? httpsCallable(functions, 'updateId') : null;
const resetPinFn = functions ? httpsCallable(functions, 'resetPin') : null;
const setPinFn = functions ? httpsCallable(functions, 'setPin') : null;
const searchIdsFn = functions ? httpsCallable(functions, 'searchIds') : null;
const getAuditLogsFn = functions ? httpsCallable(functions, 'getAuditLogs') : null;

export async function bootstrapAdmin(payload) {
  ensureFunctionsReady();
  try {
    const res = await bootstrapAdminFn(payload);
    return res.data;
  } catch (err) {
    // Surface a friendlier message while keeping console detail for debugging.
    const msg = err?.message || 'Bootstrap admin failed';
    console.error('bootstrapAdmin error:', err);
    throw new Error(msg);
  }
}

export async function listMyIds() {
  ensureFunctionsReady();
  const res = await listMyIdsFn();
  return res.data?.ids || [];
}

export async function verifyIdPin(payload) {
  ensureFunctionsReady();
  const res = await verifyIdPinFn(payload);
  return res.data?.session;
}

export async function createId(payload) {
  ensureFunctionsReady();
  const res = await createIdFn(payload);
  return res.data;
}

export async function updateId(payload) {
  ensureFunctionsReady();
  const res = await updateIdFn(payload);
  return res.data;
}

export async function resetPin(payload) {
  ensureFunctionsReady();
  const res = await resetPinFn(payload);
  return res.data;
}

export async function setPin(payload) {
  ensureFunctionsReady();
  const res = await setPinFn(payload);
  return res.data;
}

export async function searchIds(payload) {
  ensureFunctionsReady();
  const res = await searchIdsFn(payload);
  return res.data?.ids || [];
}

export async function getAuditLogs(payload) {
  ensureFunctionsReady();
  const res = await getAuditLogsFn(payload);
  return res.data?.logs || [];
}


