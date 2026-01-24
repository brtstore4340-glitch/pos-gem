# File: tools/create-admin-excel-upload-module.ps1
# Purpose: Create Admin Excel Upload Module (Master/ItemMaster/ItemEvent) with fast chunk upload + progress UI + last upload timestamps
# Run: pwsh -ExecutionPolicy Bypass -File .\tools\create-admin-excel-upload-module.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

trap {
  try {
    $msg = $_ | Out-String
    Write-Host "[FATAL] $msg" -ForegroundColor Red
  } catch {}
  exit 1
}

function New-Dir([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Get-Utf8NoBom() {
  # UTF-8 no BOM
  return New-Object System.Text.UTF8Encoding($false)
}

function Write-FileUtf8NoBom([string]$Path, [string]$Content) {
  $enc = Get-Utf8NoBom
  $dir = Split-Path -Parent $Path
  if ($dir) { New-Dir $dir }
  [System.IO.File]::WriteAllText($Path, $Content, $enc)
}

function Now-Stamp() { return (Get-Date).ToString("yyyyMMdd_HHmmss") }

function Write-Log {
  param(
    [Parameter(Mandatory=$true)][string]$Message,
    [ValidateSet("INFO","WARN","PASS","FAIL")][string]$Level="INFO"
  )
  $c = @{
    "INFO" = "Cyan"
    "WARN" = "Yellow"
    "PASS" = "Green"
    "FAIL" = "Red"
  }
  $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
  $line = "[$ts][$Level] $Message"
  Write-Host $line -ForegroundColor $c[$Level]
  if ($script:LogFile) {
    Add-Content -LiteralPath $script:LogFile -Value $line -Encoding UTF8
  }
}

function Backup-Path {
  param([Parameter(Mandatory=$true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return $null }

  $stamp = Now-Stamp
  $backupRoot = Join-Path $PSScriptRoot "backup_$stamp"
  New-Dir $backupRoot

  $leaf = Split-Path -Leaf $Path
  $dest = Join-Path $backupRoot $leaf

  Copy-Item -LiteralPath $Path -Destination $dest -Recurse -Force
  return $backupRoot
}

function Save-LastBackupDir([string]$BackupDir) {
  $toolsDir = Join-Path $PSScriptRoot ".."
  $toolsDir = (Resolve-Path $toolsDir).Path
  $file = Join-Path $toolsDir "LAST_BACKUP_DIR.txt"
  Write-FileUtf8NoBom -Path $file -Content $BackupDir
}

function Find-RepoRoot([string]$StartDir) {
  $dir = Resolve-Path $StartDir
  $cur = $dir.Path
  while ($true) {
    $pkg = Join-Path $cur "package.json"
    if (Test-Path -LiteralPath $pkg) { return $cur }
    $parent = Split-Path -Parent $cur
    if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $cur) { break }
    $cur = $parent
  }
  throw "Cannot find repo root (package.json) from: $StartDir"
}

function Run-Npm {
  param(
    [Parameter(Mandatory=$true)][string]$WorkingDir,
    [Parameter(Mandatory=$true)][string[]]$Args
  )
  $npm = "npm"
  $argLine = ($Args | ForEach-Object { $_ }) -join " "
  Write-Log "RUN: (cd $WorkingDir) npm $argLine" "INFO"

  $p = Start-Process -FilePath $npm -ArgumentList $Args -WorkingDirectory $WorkingDir -NoNewWindow -PassThru -Wait
  $code = $p.ExitCode
  if ($code -ne 0) {
    throw "npm failed (exit=$code): npm $argLine"
  }
  Write-Log "OK: npm $argLine" "PASS"
}

function Patch-InsertOrAppend {
  param(
    [Parameter(Mandatory=$true)][string]$FilePath,
    [Parameter(Mandatory=$true)][string]$Needle,
    [Parameter(Mandatory=$true)][string]$InsertText
  )

  if (-not (Test-Path -LiteralPath $FilePath)) {
    Write-Log "SKIP patch: missing file $FilePath" "WARN"
    return
  }

  $raw = Get-Content -LiteralPath $FilePath -Raw -Encoding UTF8
  if ($raw -like "*$Needle*") {
    Write-Log "Patch already applied in: $FilePath" "PASS"
    return
  }

  $new = $raw.TrimEnd() + "`r`n" + $InsertText.TrimEnd() + "`r`n"
  $backupDir = Backup-Path $FilePath
  if ($backupDir) { Save-LastBackupDir $backupDir }

  Write-FileUtf8NoBom -Path $FilePath -Content $new
  Write-Log "Patched: $FilePath" "PASS"
}

# -------------------- MAIN --------------------
$repoRoot = Find-RepoRoot (Get-Location).Path
$toolsDir = Join-Path $repoRoot "tools"
$logsDir = Join-Path $toolsDir "logs"
New-Dir $toolsDir
New-Dir $logsDir

$script:LogFile = Join-Path $logsDir ("create_admin_excel_upload_module_{0}.log" -f (Now-Stamp))
Write-Log "RepoRoot: $repoRoot" "INFO"
Write-Log "LogFile:  $script:LogFile" "INFO"

# Detect web app root (prefer .\web if exists)
$webRoot = Join-Path $repoRoot "web"
if (-not (Test-Path -LiteralPath $webRoot)) {
  # fallback to repoRoot if no web folder
  $webRoot = $repoRoot
  Write-Log "No .\web folder, using repo root as app root: $webRoot" "WARN"
} else {
  Write-Log "Detected web root: $webRoot" "PASS"
}

# Candidate src folder
$srcRoot = Join-Path $webRoot "src"
if (-not (Test-Path -LiteralPath $srcRoot)) {
  throw "Cannot find src folder at: $srcRoot"
}

# Install xlsx if missing (best-effort)
try {
  $webPkg = Join-Path $webRoot "package.json"
  if (Test-Path -LiteralPath $webPkg) {
    $pkgJson = Get-Content -LiteralPath $webPkg -Raw -Encoding UTF8
    if ($pkgJson -notmatch '"xlsx"\s*:') {
      Write-Log "Installing dependency: xlsx" "INFO"
      Run-Npm -WorkingDir $webRoot -Args @("i","xlsx")
    } else {
      Write-Log "Dependency already present: xlsx" "PASS"
    }
  } else {
    Write-Log "No package.json at webRoot, skip npm install" "WARN"
  }
} catch {
  Write-Log "npm install xlsx failed (continue). Error: $($_.Exception.Message)" "WARN"
}

# Create module files
$featureDir = Join-Path $srcRoot "features\admin\dataUpload"
New-Dir $featureDir

# 1) types + utils
$utilPath = Join-Path $featureDir "excelUploadUtils.ts"
$utilContent = @'
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

export type UploadMeta = {
  kind: UploadKind;
  lastUploadedAt?: string; // ISO
  rowCount?: number;
};

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

/** Normalize header: trim, remove weird spaces, toLower, replace non-word with _ */
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

/** Safe string */
function s(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** Try to find primary key from common column names */
export function detectKeyField(sample: Record<string, any>): string | null {
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
  // fallback: first non-empty field
  return keys.length ? keys[0] : null;
}

/** Try to detect status column in master */
export function detectStatusField(sample: Record<string, any>): string | null {
  const keys = Object.keys(sample || {});
  const candidates = ["status", "st", "active_status"];
  for (const c of candidates) {
    const hit = keys.find((k) => k === c);
    if (hit) return hit;
  }
  return null;
}

export async function readExcelFile(file: File): Promise<Record<string, any>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  // use first sheet
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, any>[];

  // normalize keys
  return json.map((row) => {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      out[normalizeKey(k)] = v;
    }
    return out;
  });
}

export function buildKeySet(rows: Record<string, any>[], keyField: string): Set<string> {
  const set = new Set<string>();
  for (const r of rows) {
    const key = s(r[keyField]);
    if (key) set.add(key);
  }
  return set;
}

export function filterMasterStatus0(
  rows: Record<string, any>[],
  keyField: string,
  statusField: string | null
): { filtered: Record<string, any>[]; keySet: Set<string> } {
  const filtered: Record<string, any>[] = [];
  for (const r of rows) {
    const key = s(r[keyField]);
    if (!key) continue;

    if (!statusField) {
      // If no status column detected, keep all (safer than dropping everything)
      filtered.push(r);
      continue;
    }

    const stRaw = r[statusField];
    const st = s(stRaw);

    // allow "0", 0, "00"
    if (st === "0" || st === "00") filtered.push(r);
    else if (typeof stRaw === "number" && stRaw === 0) filtered.push(r);
  }

  return { filtered, keySet: buildKeySet(filtered, keyField) };
}

export function filterByKeySet(
  rows: Record<string, any>[],
  keyField: string,
  allowedKeys: Set<string>
): Record<string, any>[] {
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
  rows: Record<string, any>[];
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

      // Upsert row doc
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

  // Save upload meta
  const metaRef = doc(collection(db, "adminMeta"), "uploadStatus");
  const metaSnap = await getDoc(metaRef);
  const old = metaSnap.exists() ? (metaSnap.data() as any) : {};

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

export async function getUploadStatus(): Promise<Record<string, any> | null> {
  const db = getFirestore();
  const ref = doc(collection(db, "adminMeta"), "uploadStatus");
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as any;
}
'@
Write-FileUtf8NoBom -Path $utilPath -Content $utilContent
Write-Log "Wrote: $utilPath" "PASS"

# 2) UI Page
$pagePath = Join-Path $featureDir "AdminExcelUploadPage.tsx"
$pageContent = @'
import React, { useEffect, useMemo, useState } from "react";
import {
  readExcelFile,
  detectKeyField,
  detectStatusField,
  filterMasterStatus0,
  filterByKeySet,
  uploadRowsChunked,
  getUploadStatus,
  type ProgressState,
} from "./excelUploadUtils";

type StepId = "master" | "itemmaster" | "itemevent";

function fmtIso(iso?: string) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-3 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
      <div
        className="h-3 rounded-full bg-zinc-900 dark:bg-zinc-100 transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function StepCard(props: {
  title: string;
  subtitle: string;
  hint: string;
  lastUploadedAt?: string;
  rowCount?: number;
  file: File | null;
  setFile: (f: File | null) => void;
  disabled?: boolean;
}) {
  const { title, subtitle, hint, lastUploadedAt, rowCount, file, setFile, disabled } = props;

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Last upload</div>
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{fmtIso(lastUploadedAt)}</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">{rowCount ? `${rowCount} rows` : ""}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{hint}</div>

        <label className={`block w-full`}>
          <input
            type="file"
            accept=".xlsx,.xls"
            disabled={disabled}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
            }}
          />
          <div
            className={[
              "rounded-xl border border-dashed p-4 cursor-pointer",
              "border-zinc-300 dark:border-zinc-700",
              "hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition",
              disabled ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
          >
            <div className="text-sm text-zinc-800 dark:text-zinc-200">
              {file ? `Selected: ${file.name}` : "Click to choose Excel file (.xlsx)"}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{file ? `${(file.size/1024/1024).toFixed(2)} MB` : ""}</div>
          </div>
        </label>
      </div>
    </div>
  );
}

export default function AdminExcelUploadPage() {
  const [statusMeta, setStatusMeta] = useState<Record<string, any> | null>(null);

  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [itemMasterFile, setItemMasterFile] = useState<File | null>(null);
  const [itemEventFile, setItemEventFile] = useState<File | null>(null);

  const [progress, setProgress] = useState<ProgressState>({ phase: "idle", percent: 0 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const meta = await getUploadStatus();
      setStatusMeta(meta);
    })();
  }, []);

  const canUpload = useMemo(() => !!masterFile, [masterFile]);

  async function handleUploadAll() {
    if (!masterFile) return;

    setBusy(true);
    setProgress({ phase: "reading", percent: 1, message: "Reading master file..." });

    try {
      // ---- 1) MASTER (Itemmasterprintondept) ----
      const masterRows = await readExcelFile(masterFile);
      setProgress({ phase: "parsing", percent: 5, message: "Parsing master file..." });

      const masterKeyField = detectKeyField(masterRows[0] || {});
      if (!masterKeyField) throw new Error("Cannot detect master key column (ItemCode/SKU/Barcode).");

      const statusField = detectStatusField(masterRows[0] || {});
      setProgress({ phase: "filtering", percent: 8, message: "Filtering status=0 in master..." });

      const { filtered: masterFiltered, keySet } = filterMasterStatus0(masterRows, masterKeyField, statusField);

      setProgress({ phase: "uploading", percent: 10, message: `Uploading master (${masterFiltered.length} rows)...` });

      await uploadRowsChunked({
        kind: "master",
        rows: masterFiltered,
        keyField: masterKeyField,
        collectionName: "masterPrintOnDept",
        onProgress: setProgress,
      });

      // ---- 2) ITEMMASTER (only keys in master) ----
      if (itemMasterFile) {
        setProgress({ phase: "reading", percent: 1, message: "Reading itemmaster file..." });

        const rows = await readExcelFile(itemMasterFile);
        const keyField = detectKeyField(rows[0] || {}) || masterKeyField;

        setProgress({ phase: "filtering", percent: 6, message: "Filtering itemmaster by master keys..." });
        const filtered = filterByKeySet(rows, keyField, keySet);

        setProgress({ phase: "uploading", percent: 10, message: `Uploading itemmaster (${filtered.length} rows)...` });

        await uploadRowsChunked({
          kind: "itemmaster",
          rows: filtered,
          keyField,
          collectionName: "itemMaster",
          onProgress: setProgress,
        });
      }

      // ---- 3) ITEMEVENT (only keys in master + upsert + timestamp) ----
      if (itemEventFile) {
        setProgress({ phase: "reading", percent: 1, message: "Reading itemevent file..." });

        const rows = await readExcelFile(itemEventFile);
        const keyField = detectKeyField(rows[0] || {}) || masterKeyField;

        setProgress({ phase: "filtering", percent: 6, message: "Filtering itemevent by master keys..." });
        const filtered = filterByKeySet(rows, keyField, keySet);

        setProgress({ phase: "uploading", percent: 10, message: `Uploading itemevent (${filtered.length} rows)...` });

        await uploadRowsChunked({
          kind: "itemevent",
          rows: filtered,
          keyField,
          collectionName: "itemEvent",
          onProgress: setProgress,
        });
      }

      // refresh meta
      const meta = await getUploadStatus();
      setStatusMeta(meta);

      setProgress({ phase: "done", percent: 100, message: "Upload complete ✅" });
    } catch (e: any) {
      setProgress({ phase: "error", percent: 0, message: e?.message || "Upload failed" });
      throw e;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-80px)] p-4 md:p-8 bg-zinc-50 dark:bg-black">
      <div className="max-w-5xl mx-auto">
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                Upload Excel (Fast Patch Upload)
              </div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Master = Itemmasterprintondept (status=0 only) • Itemmaster/Itemevent will upload only items inside Master
              </div>
            </div>

            <button
              disabled={!canUpload || busy}
              onClick={() => {
                handleUploadAll().catch(() => {});
              }}
              className={[
                "px-5 py-3 rounded-2xl font-semibold shadow-sm",
                "bg-zinc-900 text-white hover:bg-zinc-800",
                "dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-200",
                (!canUpload || busy) ? "opacity-50 cursor-not-allowed" : "",
              ].join(" ")}
            >
              {busy ? "Uploading..." : "Upload Now"}
            </button>
          </div>

          <div className="mt-5">
            <ProgressBar value={progress.percent} />
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <div>{progress.message || "Ready"}</div>
              <div>{progress.phase}</div>
            </div>
          </div>

          {progress.phase === "error" ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 text-red-800 p-4 text-sm">
              {progress.message}
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <StepCard
              title="1) Master (Itemmasterprintondept)"
              subtitle="Upload only status = 0 (Primary file)"
              hint="เลือกไฟล์ Master ก่อนเสมอ (เป็นตัวกำหนด masterKeySet)"
              lastUploadedAt={statusMeta?.master?.lastUploadedAt}
              rowCount={statusMeta?.master?.rowCount}
              file={masterFile}
              setFile={setMasterFile}
              disabled={busy}
            />

            <StepCard
              title="2) Itemmaster"
              subtitle="Upload only items that exist in Master"
              hint="ถ้าไม่เลือกไฟล์นี้ ระบบจะข้ามขั้นนี้ให้"
              lastUploadedAt={statusMeta?.itemmaster?.lastUploadedAt}
              rowCount={statusMeta?.itemmaster?.rowCount}
              file={itemMasterFile}
              setFile={setItemMasterFile}
              disabled={busy}
            />

            <StepCard
              title="3) ItempEvent"
              subtitle="Upsert + updatedAt timestamp"
              hint="ถ้าไม่เลือกไฟล์นี้ ระบบจะข้ามขั้นนี้ให้"
              lastUploadedAt={statusMeta?.itemevent?.lastUploadedAt}
              rowCount={statusMeta?.itemevent?.rowCount}
              file={itemEventFile}
              setFile={setItemEventFile}
              disabled={busy}
            />
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 p-4">
            <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Upload Summary</div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-3">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Master</div>
                <div className="font-medium">{fmtIso(statusMeta?.master?.lastUploadedAt)}</div>
              </div>
              <div className="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-3">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Itemmaster</div>
                <div className="font-medium">{fmtIso(statusMeta?.itemmaster?.lastUploadedAt)}</div>
              </div>
              <div className="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-3">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Itemevent</div>
                <div className="font-medium">{fmtIso(statusMeta?.itemevent?.lastUploadedAt)}</div>
              </div>
            </div>

            <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Collections: masterPrintOnDept • itemMaster • itemEvent • Meta: adminMeta/uploadStatus
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
'@
Write-FileUtf8NoBom -Path $pagePath -Content $pageContent
Write-Log "Wrote: $pagePath" "PASS"

# 3) Index export
$indexPath = Join-Path $featureDir "index.ts"
$indexContent = @'
export { default as AdminExcelUploadPage } from "./AdminExcelUploadPage";
'@
Write-FileUtf8NoBom -Path $indexPath -Content $indexContent
Write-Log "Wrote: $indexPath" "PASS"

# ---- Patch router (best-effort, append only) ----
# Try common router file paths
$routerCandidates = @(
  (Join-Path $srcRoot "app\router.tsx"),
  (Join-Path $srcRoot "router.tsx"),
  (Join-Path $srcRoot "routes.tsx"),
  (Join-Path $srcRoot "App.tsx")
)

$routerFile = $null
foreach ($p in $routerCandidates) {
  if (Test-Path -LiteralPath $p) { $routerFile = $p; break }
}

if ($routerFile) {
  Write-Log "Router candidate: $routerFile" "INFO"

  $needle = "AdminExcelUploadPage"
  $insert = @'
/**
 * AUTO-APPENDED ROUTE (Admin Excel Upload)
 * NOTE: You may want to integrate this into your existing router properly.
 * Import:
 *   import { AdminExcelUploadPage } from "@/features/admin/dataUpload";
 * Route path suggestion:
 *   /admin/data-upload
 */
'@

  Patch-InsertOrAppend -FilePath $routerFile -Needle $needle -InsertText $insert
} else {
  Write-Log "No router file found (skip patch). Module created only." "WARN"
}

Write-Log "DONE. Module created at: $featureDir" "PASS"
Write-Log "NEXT: Add route to your router -> /admin/data-upload => <AdminExcelUploadPage />" "INFO"
Write-Log "EXIT CODE: 0" "PASS"
exit 0
