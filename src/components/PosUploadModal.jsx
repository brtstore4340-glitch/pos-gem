import React, { useMemo, useState } from "react";
import { UploadCloud, Loader2, CheckCircle, AlertCircle, X } from "lucide-react";
import { cn } from "../utils/cn";
import { runUploadFlow, abortUploadFlow } from "../services/uploadService";

function Card({ title, subtitle, disabled, children, isDarkMode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-sm",
        disabled
          ? (isDarkMode ? "bg-slate-900/50 border-slate-800 opacity-60" : "bg-slate-50 border-slate-200 opacity-60")
          : (isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")
      )}
    >
      <div className="mb-3">
        <div className={cn("text-lg font-bold", isDarkMode ? "text-white" : "text-slate-800")}>{title}</div>
        <div className={cn("text-xs", isDarkMode ? "text-slate-400" : "text-slate-500")}>{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

export default function PosUploadModal({ open, onClose, isDarkMode = false, masterReady = true, pricingReady }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ phase: "idle", percent: 0, meta: null });
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const canSecondary = masterReady && (typeof pricingReady === "boolean" ? pricingReady : true);

  const statusBadge = useMemo(() => {
    if (busy) return { icon: <Loader2 className="animate-spin" size={16} />, text: `${progress.phase} ${progress.percent}%` };
    if (err) return { icon: <AlertCircle size={16} />, text: err };
    if (result) return { icon: <CheckCircle size={16} />, text: "Upload completed" };
    return { icon: <UploadCloud size={16} />, text: "Ready" };
  }, [busy, progress, err, result]);

  if (!open) return null;

  const onPick = async (type, file) => {
    if (!file) return;
    setBusy(true); setErr(""); setResult(null);
    setProgress({ phase: "starting", percent: 1, meta: null });
    try {
      const summary = await runUploadFlow({ type, file, onProgress: setProgress });
      setResult({ type, summary });
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const abortNow = async () => {
    try { await abortUploadFlow(); } catch {}
    setBusy(false);
    setErr("Aborted");
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={cn(
        "w-full max-w-4xl rounded-3xl shadow-2xl border overflow-hidden",
        isDarkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
      )}>
        <div className={cn(
          "px-6 py-4 border-b flex items-center justify-between",
          isDarkMode ? "border-slate-800" : "border-slate-200"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-xl border",
              isDarkMode ? "bg-white border-white text-slate-900" : "bg-slate-50 border-slate-200 text-slate-700"
            )}>
              {statusBadge.icon}
            </div>
            <div>
              <div className="text-xl font-bold">Product Data Upload</div>
              <div className={cn("text-xs", isDarkMode ? "text-slate-400" : "text-slate-500")}>{statusBadge.text}</div>
            </div>
          </div>

          <button onClick={onClose} disabled={busy} className={cn(
            "p-2 rounded-xl border transition",
            isDarkMode ? "border-slate-800 hover:bg-slate-900" : "border-slate-200 hover:bg-slate-50",
            busy && "opacity-50 cursor-not-allowed"
          )}>
            <X size={18} />
          </button>
        </div>

        <div className={cn("px-6 py-4", isDarkMode ? "bg-slate-950" : "bg-white")}>
          <div className={cn("h-2 rounded-full overflow-hidden", isDarkMode ? "bg-slate-800" : "bg-slate-200")}>
            <div className="h-full bg-blue-600" style={{ width: `${progress.percent || 0}%` }} />
          </div>

          {progress.meta && (
            <div className={cn("mt-2 text-xs", isDarkMode ? "text-slate-400" : "text-slate-600")}>
              {JSON.stringify(progress.meta)}
            </div>
          )}

          {result && (
            <div className={cn("mt-3 p-3 rounded-xl border text-sm",
              isDarkMode ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"
            )}>
              <div className="font-bold mb-1">Summary ({result.type})</div>
              <div className="text-xs">
                processed: {result.summary.processed} | matched: {result.summary.matched} | skipped: {result.summary.skipped} | invalid: {result.summary.invalid}
              </div>
            </div>
          )}

          {err && (
            <div className="mt-3 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm">
              {err}
            </div>
          )}
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            title="1) Master (ProductAllDept .csv)"
            subtitle="ต้องทำก่อนเสมอ (สร้าง products + barcode_index)"
            disabled={busy}
            isDarkMode={isDarkMode}
          >
            <input type="file" accept=".csv" disabled={busy} onChange={(e) => onPick("master", e.target.files?.[0])} className="w-full text-xs" />
          </Card>

          <Card
            title="2) Pricing (ItemMasterPrintOnDeph .xls/.xlsx)"
            subtitle={canSecondary ? "merge เฉพาะ fields ที่กำหนด" : "ต้องอัปโหลด Master ก่อน"}
            disabled={busy || !canSecondary}
            isDarkMode={isDarkMode}
          >
            <input type="file" accept=".xls,.xlsx" disabled={busy || !canSecondary} onChange={(e) => onPick("pricing", e.target.files?.[0])} className="w-full text-xs" />
          </Card>

          <Card
            title="3) Maintenance (ItemMaintananceEvent .xls/.xlsx)"
            subtitle={canSecondary ? "merge เฉพาะ fields ที่กำหนด" : "ต้องอัปโหลด Master ก่อน"}
            disabled={busy || !canSecondary}
            isDarkMode={isDarkMode}
          >
            <input type="file" accept=".xls,.xlsx" disabled={busy || !canSecondary} onChange={(e) => onPick("maintenance", e.target.files?.[0])} className="w-full text-xs" />
          </Card>
        </div>

        <div className="px-6 pb-6 flex justify-end gap-3">
          {busy && (
            <button onClick={abortNow} className="px-4 py-2 rounded-xl border border-red-500/40 bg-red-500/10 text-red-200 font-bold">
              Abort
            </button>
          )}
          <button onClick={onClose} disabled={busy} className={cn(
            "px-4 py-2 rounded-xl font-bold border",
            isDarkMode ? "bg-slate-900 border-slate-800 hover:bg-slate-800" : "bg-white border-slate-200 hover:bg-slate-50",
            busy && "opacity-50 cursor-not-allowed"
          )}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
