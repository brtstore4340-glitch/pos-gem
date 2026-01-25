import React, { useState, useRef } from "react";
import {
  Upload,
  X,
  CheckCircle,
  AlertTriangle,
  FileText,
  Loader2,
  Database,
} from "lucide-react";
import { posService } from "../services/posService";
import { cn } from "../utils/cn";

export default function AdminSettings({ onClose }) {
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [progress, setProgress] = useState({
    phase: "",
    percent: 0,
    total: 0,
    success: 0,
    failed: 0,
    errors: [],
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadStatus("idle");
      setProgress({
        phase: "Ready",
        percent: 0,
        total: 0,
        success: 0,
        failed: 0,
        errors: [],
      });
    }
  };

  const startUpload = async () => {
    if (!selectedFile) return;
    setUploadStatus("uploading");

    try {
      await posService.uploadMasterDataOptimized(selectedFile, (stats) => {
        setProgress(stats);
      });
      setUploadStatus("done");
    } catch (err) {
      console.error(err);
      setUploadStatus("error");
      setProgress((prev) => ({
        ...prev,
        phase: "Failed",
        errors: [err.message, ...prev.errors],
      }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Database size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Database Management
              </h2>
              <p className="text-xs text-slate-500">
                Update product master data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 flex flex-col gap-6 overflow-y-auto">
          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center transition-all",
              uploadStatus === "uploading"
                ? "border-blue-200 bg-blue-50/50 pointer-events-none opacity-50"
                : "border-slate-300 hover:border-blue-400 hover:bg-slate-50 cursor-pointer",
            )}
            onClick={() =>
              uploadStatus !== "uploading" && fileInputRef.current?.click()
            }
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />

            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shadow-sm">
                {uploadStatus === "uploading" ? (
                  <Loader2 size={32} className="animate-spin" />
                ) : (
                  <Upload size={32} />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-700">
                  {selectedFile ? selectedFile.name : "Click to select file"}
                </h3>
                <p className="text-sm text-slate-400">
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                    : "Supports Excel (.xlsx, .xls) or CSV"}
                </p>
              </div>
            </div>
          </div>

          {(selectedFile || uploadStatus !== "idle") && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-4 animate-in slide-in-from-bottom-2">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                  <span>{progress.phase || "Ready"}</span>
                  <span>{progress.percent}%</span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300 ease-out"
                    style={{ width: `${progress.percent}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm text-center">
                  <div className="text-xs text-slate-400 mb-1">Total</div>
                  <div className="text-xl font-bold text-slate-800">
                    {progress.total.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-green-100 shadow-sm text-center">
                  <div className="text-xs text-green-500 mb-1">Success</div>
                  <div className="text-xl font-bold text-green-600">
                    {progress.success.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-red-100 shadow-sm text-center">
                  <div className="text-xs text-red-500 mb-1">Failed</div>
                  <div className="text-xl font-bold text-red-600">
                    {progress.failed.toLocaleString()}
                  </div>
                </div>
              </div>

              {progress.errors.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100 text-xs">
                  <div className="font-bold text-red-700 mb-2 flex items-center gap-2">
                    <AlertTriangle size={14} /> Errors ({progress.errors.length}
                    )
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-red-600 max-h-32 overflow-y-auto">
                    {progress.errors.slice(0, 20).map((err, i) => (
                      <li key={i} className="truncate">
                        {err}
                      </li>
                    ))}
                    {progress.errors.length > 20 && (
                      <li>...and {progress.errors.length - 20} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={uploadStatus === "uploading"}
            className="px-6 py-2 rounded-lg text-slate-600 hover:bg-slate-200 font-bold transition-colors disabled:opacity-50"
          >
            Close
          </button>

          {uploadStatus === "idle" && selectedFile && (
            <button
              onClick={startUpload}
              className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Upload size={18} /> Start Upload
            </button>
          )}

          {uploadStatus === "done" && (
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold shadow-md flex items-center gap-2"
            >
              <CheckCircle size={18} /> Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
