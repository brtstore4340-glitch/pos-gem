import React, { useState } from "react";
import { UploadCloud, File, X, CheckSquare, HardDrive } from "lucide-react";
import { cn } from "../utils/cn";

export default function FileUploadPage() {
  // BEGIN: FUNCTION ZONE
  const [files, setFiles] = useState([]);
  // END:   FUNCTION ZONE

  return (
    <div className="h-full p-6 md:p-8 animate-fade-in-up flex flex-col gap-6 max-w-4xl mx-auto">
       
       <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20 flex items-center justify-center">
             <UploadCloud size={28} />
          </div>
          <div>
             <h1 className="text-3xl font-bold text-slate-800 dark:text-white">File Upload</h1>
             <p className="text-slate-500 dark:text-slate-400">Import external data files into the system</p>
          </div>
       </div>

       <div className="glass-panel p-8 rounded-3xl min-h-[400px] flex flex-col items-center justify-center border-dashed border-2 border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 relative">
          
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          
          <div className="flex flex-col items-center text-center gap-4 pointer-events-none">
             <div className="w-24 h-24 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center mb-2 animate-bounce-slow">
                <UploadCloud size={48} />
             </div>
             
             <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Click or Drop Files Here</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                   Support for CSV, XLSX, and JSON files. Maximum file size 50MB.
                </p>
             </div>
          </div>

          {files.length > 0 && (
             <div className="mt-8 w-full max-w-lg z-20 relative">
                 <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 pl-1">Selected Files ({files.length})</div>
                 <div className="space-y-2">
                    {files.map((f, i) => (
                       <div key={i} className="flex items-center gap-3 p-3 bg-white dark:bg-black/40 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm animate-in slide-in-from-bottom-2 fade-in">
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500">
                             <File size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="font-bold text-sm text-slate-800 dark:text-white truncate">{f.name}</div>
                             <div className="text-xs text-slate-400 font-mono">{(f.size / 1024).toFixed(1)} KB</div>
                          </div>
                          <button className="text-slate-400 hover:text-red-500" onClick={(e) => {
                             e.preventDefault(); // Prevent opening file dialog again
                             setFiles(prev => prev.filter((_, idx) => idx !== i));
                          }}>
                             <X size={16} />
                          </button>
                       </div>
                    ))}
                 </div>
                 
                 <button
                    type="button"
                    className="btn-primary w-full mt-6 shadow-xl shadow-blue-500/20"
                    onClick={(e) => {
                       e.stopPropagation(); // prevent file input click
                       console.warn("Upload not implemented yet.");
                       alert("Upload processing is not yet implemented.");
                    }}
                  >
                    <HardDrive size={18} /> Start Upload Process
                  </button>
             </div>
          )}
       </div>
    </div>
  );
}
