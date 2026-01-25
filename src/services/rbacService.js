import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

function __requireIdCodePin__(payload) {
  const idCode = payload?.idCode ?? payload?.id ?? payload?.code;
  const pin = payload?.pin ?? payload?.PIN;
  if (!idCode || !pin) {
    throw new Error("idCode and pin required");
  }
  return { idCode, pin };
}

// Reuse a single functions instance so callables don't re-init each call.
const bootstrapAdminFn = httpsCallable(functions, 'bootstrapAdmin');
const listMyIdsFn = httpsCallable(functions, 'listMyIds');
const verifyIdPinFn = httpsCallable(functions, 'verifyIdPin');
const createIdFn = httpsCallable(functions, 'createId');
const updateIdFn = httpsCallable(functions, 'updateId');
const resetPinFn = httpsCallable(functions, 'resetPin');
const setPinFn = httpsCallable(functions, 'setPin');
const searchIdsFn = httpsCallable(functions, 'searchIds');
const getAuditLogsFn = httpsCallable(functions, 'getAuditLogs');

export async function bootstrapAdmin(payload) {
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
  const res = await listMyIdsFn();
  return res.data?.ids || [];
}

export async function verifyIdPin(payload) {
  const res = await verifyIdPinFn(payload);
  return res.data?.session;
}

export async function createId(payload) {
  const res = await createIdFn(payload);
  return res.data;
}

export async function updateId(payload) {
  const res = await updateIdFn(payload);
  return res.data;
}

export async function resetPin(payload) {
  const res = await resetPinFn(payload);
  return res.data;
}

export async function setPin(payload) {
  const res = await setPinFn(payload);
  return res.data;
}

export async function searchIds(payload) {
  const res = await searchIdsFn(payload);
  return res.data?.ids || [];
}

export async function getAuditLogs(payload) {
  const res = await getAuditLogsFn(payload);
  return res.data?.logs || [];
}
