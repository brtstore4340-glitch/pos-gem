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

export type UploadKind = "master" | "itemmaster" | "itemevent";

export type ProgressState = {
  phase:
    | "idle"
    | "reading"
    | "parsing"
    | "filtering"
    | "uploading"
    | "saving_meta"
    | "done"
    | "error";
  message?: string;
  percent: number; // 0-100
  uploaded?: number;
  total?: number;
};

const DEFAULT_CHUNK_SIZE = 400;

export function normalizeKey(k: string): string {
  return (k ?? "")
    .toString()
    .trim()
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function s(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export function detectKeyField(sample: Record<string, unknown>): string | null {
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

export function detectStatusField(
  sample: Record<string, unknown>,
): string | null {
  const keys = Object.keys(sample || {});
  const candidates = ["status", "st", "active_status"];
  for (const c of candidates) {
    const hit = keys.find((k) => k === c);
    if (hit) return hit;
  }
  return null;
}

export async function readExcelFile(
  file: File,
): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<
    string,
    unknown
  >[];

  return json.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[normalizeKey(k)] = v;
    }
    return out;
  });
}

export function buildKeySet(
  rows: Record<string, unknown>[],
  keyField: string,
): Set<string> {
  const set = new Set<string>();
  for (const r of rows) {
    const key = s(r[keyField]);
    if (key) set.add(key);
  }
  return set;
}

export function filterMasterStatus0(
  rows: Record<string, unknown>[],
  keyField: string,
  statusField: string | null,
): { filtered: Record<string, unknown>[]; keySet: Set<string> } {
  const filtered: Record<string, unknown>[] = [];
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

export function filterByKeySet(
  rows: Record<string, unknown>[],
  keyField: string,
  allowedKeys: Set<string>,
): Record<string, unknown>[] {
  return rows.filter((r) => {
    const key = s(r[keyField]);
    return key && allowedKeys.has(key);
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function uploadRowsChunked(params: {
  kind: UploadKind;
  rows: Record<string, unknown>[];
  keyField: string;
  collectionName: string;
  chunkSize?: number;
  onProgress?: (p: ProgressState) => void;
}) {
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
          { merge: true },
        );
      } else {
        b.set(ref, r, { merge: true });
      }
    }

    await b.commit();
    uploaded += c.length;

    const percent =
      total === 0 ? 100 : Math.min(99, Math.floor((uploaded / total) * 100));
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
  const old = metaSnap.exists()
    ? (metaSnap.data() as Record<string, unknown>)
    : {};

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

  onProgress?.({
    phase: "saving_meta",
    percent: 99,
    message: "Saving upload status...",
    uploaded,
    total,
  });
  await setDoc(metaRef, next, { merge: true });

  onProgress?.({
    phase: "done",
    percent: 100,
    message: "Done!",
    uploaded,
    total,
  });
}

export async function getUploadStatus(): Promise<Record<
  string,
  unknown
> | null> {
  const db = getFirestore();
  const ref = doc(collection(db, "adminMeta"), "uploadStatus");
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as Record<string, unknown>;
}
