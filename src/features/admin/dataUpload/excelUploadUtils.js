import * as XLSX from "xlsx";
import {
  getFirestore,
  doc,
  setDoc,
  writeBatch,
  serverTimestamp,
  collection,
  getDoc,
} from "firebase/firestore";

/**
 * Fast Excel -> JSON utilities
 * - normalize header keys
 * - detect primary key column (ItemCode/SKU/Barcode/etc.)
 * - chunk upload with progress callback
 */

/** @typedef {"master" | "itemmaster" | "itemevent"} UploadKind */

/**
 * @typedef {Object} ProgressState
 * @property {"idle" | "reading" | "parsing" | "filtering" | "uploading" | "saving_meta" | "done" | "error"} phase
 * @property {string=} message
 * @property {number} percent
 * @property {number=} uploaded
 * @property {number=} total
 */

const DEFAULT_CHUNK_SIZE = 400;

/** @param {string} k */
export function normalizeKey(k) {
  return (k ?? "")
    .toString()
    .trim()
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** @param {unknown} v */
function s(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** @param {Record<string, any>} sample */
export function detectKeyField(sample) {
  const keys = Object.keys(sample || {});
  const candidates = [
    "itemcode",
    "item_code",
    "sku",
    "barcode",
    "plu",
    "item",
    "code",
    "productcode",
    "product_code",
  ];
  for (const c of candidates) {
    const hit = keys.find((k) => k === c);
    if (hit) return hit;
  }
  return keys.length ? keys[0] : null;
}

/** @param {Record<string, any>} sample */
export function detectStatusField(sample) {
  const keys = Object.keys(sample || {});
  const candidates = ["status", "st", "active_status"];
  for (const c of candidates) {
    const hit = keys.find((k) => k === c);
    if (hit) return hit;
  }
  return null;
}

/**
 * @param {File} file
 * @returns {Promise<Record<string, any>[]>}
 */
export async function readExcelFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const json = /** @type {Record<string, any>[]} */ (XLSX.utils.sheet_to_json(ws, { defval: "" }));

  return json.map((row) => {
    /** @type {Record<string, any>} */
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      out[normalizeKey(k)] = v;
    }
    return out;
  });
}

/**
 * @param {Record<string, any>[]} rows
 * @param {string} keyField
 */
export function buildKeySet(rows, keyField) {
  const set = new Set();
  for (const r of rows) {
    const key = s(r[keyField]);
    if (key) set.add(key);
  }
  return set;
}

/**
 * @param {Record<string, any>[]} rows
 * @param {string} keyField
 * @param {string | null} statusField
 * @returns {{ filtered: Record<string, any>[]; keySet: Set<string> }}
 */
export function filterMasterStatus0(rows, keyField, statusField) {
  /** @type {Record<string, any>[]} */
  const filtered = [];
  for (const r of rows) {
    const key = s(r[keyField]);
    if (!key) continue;

    if (!statusField) {
      filtered.push(r);
      continue;
    }

    const stRaw = r[statusField];
    const st = s(stRaw);

    if (st === "0" || st === "00") filtered.push(r);
    else if (typeof stRaw === "number" && stRaw === 0) filtered.push(r);
  }

  return { filtered, keySet: buildKeySet(filtered, keyField) };
}

/**
 * @param {Record<string, any>[]} rows
 * @param {string} keyField
 * @param {Set<string>} allowedKeys
 */
export function filterByKeySet(rows, keyField, allowedKeys) {
  return rows.filter((r) => {
    const key = s(r[keyField]);
    return key && allowedKeys.has(key);
  });
}

/**
 * @template T
 * @param {T[]} arr
 * @param {number} size
 * @returns {T[][]}
 */
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * @param {{
 *   kind: UploadKind;
 *   rows: Record<string, any>[];
 *   keyField: string;
 *   collectionName: string;
 *   chunkSize?: number;
 *   onProgress?: (p: ProgressState) => void;
 * }} params
 */
export async function uploadRowsChunked(params) {
  const db = getFirestore();
  const {
    kind,
    rows,
    keyField,
    collectionName,
    chunkSize = DEFAULT_CHUNK_SIZE,
    onProgress,
  } = params;

  const total = rows.length;
  const chunks = chunk(rows, chunkSize);

  let uploaded = 0;

  for (let i = 0; i < chunks.length; i++) {
    const b = writeBatch(db);
    const c = chunks[i];

    for (const r of c) {
      const id = s(r[keyField]);
      if (!id) continue;

      const ref = doc(collection(db, collectionName), id);

      if (kind === "itemevent") {
        b.set(
          ref,
          {
            ...r,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        b.set(ref, r, { merge: true });
      }
    }

    await b.commit();
    uploaded += c.length;

    const percent = total === 0 ? 100 : Math.min(99, Math.floor((uploaded / total) * 100));
    onProgress?.({
      phase: "uploading",
      percent,
      uploaded,
      total,
      message: `Uploading ${uploaded}/${total}...`,
    });
  }

  onProgress?.({
    phase: "uploading",
    percent: 99,
    uploaded,
    total,
    message: "Finalizing...",
  });

  const metaRef = doc(collection(db, "adminMeta"), "uploadStatus");
  const metaSnap = await getDoc(metaRef);
  const old = metaSnap.exists() ? metaSnap.data() : {};

  const nowIso = new Date().toISOString();
  const next = {
    ...old,
    [kind]: {
      lastUploadedAt: nowIso,
      rowCount: total,
      collectionName,
    },
    updatedAt: serverTimestamp(),
  };

  onProgress?.({ phase: "saving_meta", percent: 99, message: "Saving upload status...", uploaded, total });
  await setDoc(metaRef, next, { merge: true });

  onProgress?.({ phase: "done", percent: 100, message: "Done!", uploaded, total });
}
