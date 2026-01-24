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
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ""}
            </div>
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

      // ---- 2) ITEMMASTER ----
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

      // ---- 3) ITEMEVENT ----
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
                Master = Itemmasterprintondept (status=0 only) • Itemmaster/Itemevent upload only items inside Master
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
            <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Last Upload Dates</div>
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