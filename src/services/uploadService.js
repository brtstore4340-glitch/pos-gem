import Papa from "papaparse";
import * as XLSX from "xlsx";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase";

const firebaseRegion =
  import.meta.env.VITE_FIREBASE_REGION || "asia-southeast1";
const functions = getFunctions(app, firebaseRegion);
const beginUpload = httpsCallable(functions, "beginUpload");
const uploadChunk = httpsCallable(functions, "uploadChunk");
const finalizeUpload = httpsCallable(functions, "finalizeUpload");
const abortUpload = httpsCallable(functions, "abortUpload");

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function parseCsv(file) {
  const text = await file.text();
  const checksum = await sha256(text.slice(0, 200000));
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve({ rows: res.data || [], checksum }),
      error: reject,
    });
  });
}

export async function parseXls(file) {
  const ab = await file.arrayBuffer();
  const checksum = await sha256(String(file.size) + ":" + file.name);
  const wb = XLSX.read(ab, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  return { rows, checksum };
}

export async function runUploadFlow({ actorIdCode, type, file, onProgress }) {
  if (!actorIdCode) {
    throw new Error("actorIdCode is required");
  }
  if (!type) {
    throw new Error("type is required");
  }
  if (!file) {
    throw new Error("file is required");
  }

  onProgress?.({ phase: "parsing", percent: 5 });
  onProgress?.({ phase: "parsing", percent: 5 });

  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const parsed = isCsv ? await parseCsv(file) : await parseXls(file);
  const rows = parsed.rows || [];
  const checksum = parsed.checksum;

  onProgress?.({
    phase: "parsing",
    percent: 15,
    meta: { rowCount: rows.length },
  });

  await beginUpload({
    actorIdCode,
    type,
    fileMeta: { fileName: file.name, checksum, rowCount: rows.length },
  });
  onProgress?.({ phase: "uploading", percent: 20 });

  const CHUNK_ROWS = type === "master" ? 200 : 400;
  const chunks = chunkArray(rows, CHUNK_ROWS);

  let agg = { processed: 0, matched: 0, skipped: 0, invalid: 0 };
  for (let i = 0; i < chunks.length; i++) {
    const resp = await uploadChunk({ actorIdCode, type, rows: chunks[i] });
    const r = resp?.data || {};
    agg.processed += r.processed || 0;
    agg.matched += r.matched || 0;
    agg.skipped += r.skipped || 0;
    agg.invalid += r.invalid || 0;

    const base = 20,
      span = 75;
    const p = base + Math.round(((i + 1) / chunks.length) * span);
    onProgress?.({
      phase: "uploading",
      percent: p,
      meta: { ...agg, chunk: i + 1, totalChunks: chunks.length },
    });
  }

  onProgress?.({ phase: "finalizing", percent: 97, meta: agg });
  await finalizeUpload({
    actorIdCode,
    type,
    summary: { ...agg, rowCount: rows.length, checksum },
  });

  onProgress?.({ phase: "done", percent: 100, meta: agg });
  return agg;
}

export async function abortUploadFlow(actorIdCode) {
  if (
    !actorIdCode ||
    typeof actorIdCode !== "string" ||
    actorIdCode.trim() === ""
  ) {
    throw new Error("actorIdCode is required");
  }
  await abortUpload({ actorIdCode });
}
