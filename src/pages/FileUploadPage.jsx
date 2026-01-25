import React, { useState } from "react";
import {
  UploadCloud,
  File,
  X,
  HardDrive,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { posService } from "../services/posService";
import { parseCsv, parseXls } from "../services/uploadService";

export default function FileUploadPage() {
  // BEGIN: FUNCTION ZONE
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setProgress(0);
    setStatus(null);

    try {
      // let totalProcessed = 0;

      for (const file of files) {
        // 1. Parse File
        let rows = [];
        if (file.name.toLowerCase().endsWith(".csv")) {
          const parsed = await parseCsv(file);
          rows = parsed.rows;
        } else if (
          file.name.toLowerCase().endsWith(".xlsx") ||
          file.name.toLowerCase().endsWith(".xls")
        ) {
          const parsed = await parseXls(file);
          rows = parsed.rows;
        } else {
          throw new Error(`Unsupported file format: ${file.name}`);
        }

        // 2. Upload using posService
        // Note: Assuming "product alldept" is the intended target for these files based on user request
        await posService.uploadProductAllDept(rows, (current, total) => {
          // Simple progress calculation (per file, or could be aggregated)
          const p = Math.round((current / total) * 100);
          setProgress(p);
        });

        // totalProcessed += rows.length;
      }

      setStatus({
        type: "success",
        message: `Successfully processed ${files.length} file(s).`,
      });
      setFiles([]);
      setProgress(100);
    } catch (error) {
      console.error("Upload failed:", error);
      setStatus({
        type: "error",
        message: error.message || "Upload failed. Please check console.",
      });
    } finally {
      setUploading(false);
    }
  };
  // END:   FUNCTION ZONE

  return (
    <div className="h-full p-6 md:p-8 animate-fade-in-up flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20 flex items-center justify-center">
          <UploadCloud size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">
            File Upload
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Import external data files into the system
          </p>
        </div>
      </div>

      <div
        className="glass-panel p-8 rounded-3xl min-h-[400px] flex flex-col items-center justify-center border-dashed border-2 border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 relative transition-colors"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!uploading) setFiles(Array.from(e.dataTransfer.files));
        }}
      >
        {!uploading && (
          <input
            type="file"
            multiple
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
        )}

        <div className="flex flex-col items-center text-center gap-4 pointer-events-none">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center mb-2 transition-all ${uploading ? "bg-blue-100 text-blue-600 animate-pulse" : "bg-blue-50 dark:bg-blue-900/20 text-blue-500 animate-bounce-slow"}`}
          >
            {uploading ? (
              <Loader2 size={48} className="animate-spin" />
            ) : (
              <UploadCloud size={48} />
            )}
          </div>

          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">
              {uploading ? "Processing Files..." : "Click or Drop Files Here"}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {uploading
                ? `Please wait while we update the database. ${progress}%`
                : "Support for CSV, XLSX, and JSON files. Maximum file size 50MB."}
            </p>
          </div>

          {uploading && (
            <div className="w-64 h-2 bg-slate-200 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}
        </div>

        {!uploading && files.length > 0 && (
          <div className="mt-8 w-full max-w-lg z-20 relative">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 pl-1">
              Selected Files ({files.length})
            </div>
            <div className="space-y-2">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 bg-white dark:bg-black/40 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm animate-in slide-in-from-bottom-2 fade-in"
                >
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500">
                    <File size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-800 dark:text-white truncate">
                      {f.name}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      {(f.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button
                    className="text-slate-400 hover:text-red-500"
                    onClick={(e) => {
                      e.preventDefault(); // Prevent opening file dialog again
                      setFiles((prev) => prev.filter((_, idx) => idx !== i));
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn-primary w-full mt-6 shadow-xl shadow-blue-500/20"
              onClick={(e) => {
                e.stopPropagation();
                handleUpload();
              }}
            >
              <HardDrive size={18} /> Start Upload Process
            </button>
          </div>
        )}

        {status && !uploading && (
          <div
            className={`absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg ${status.type === "success" ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-700 border border-red-200"}`}
          >
            {status.type === "success" ? (
              <CheckCircle size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
            <span className="font-medium text-sm">{status.message}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setStatus(null);
              }}
              className="p-1 hover:bg-black/5 rounded-full"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
