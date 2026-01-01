import React, { useState } from "react";

export default function FileUploadPage() {
  const [files, setFiles] = useState([]);

  return (
    <div className="p-6">
      <div className="bg-white dark:bg-dark-panel border border-slate-200 dark:border-dark-border rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Upload</h2>
        <p className="text-sm text-slate-500 dark:text-dark-subtext mt-1">
          อัปโหลดไฟล์เพื่อใช้ในระบบ (หน้าตัวอย่าง — ต่อฟังก์ชันจริงได้ทีหลัง)
        </p>

        <div className="mt-5 space-y-4">
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="block w-full text-sm text-slate-700 dark:text-dark-subtext
              file:mr-4 file:py-2 file:px-4 file:rounded-lg
              file:border-0 file:text-sm file:font-semibold
              file:bg-boots-light file:text-boots-base hover:file:bg-slate-200
              dark:file:bg-dark-border dark:hover:file:bg-dark-border/70"
          />

          <div className="rounded-xl border border-slate-200 dark:border-dark-border p-4">
            <div className="text-sm font-bold text-slate-700 dark:text-dark-subtext">Selected files</div>
            <ul className="mt-2 text-sm text-slate-600 dark:text-dark-subtext list-disc pl-5">
              {files.length === 0 ? (
                <li>No files selected</li>
              ) : (
                files.map((f, i) => <li key={i}>{f.name}</li>)
              )}
            </ul>
          </div>

          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-boots-base text-white font-bold hover:opacity-95"
            onClick={() => alert("TODO: wire upload logic")}
          >
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}
