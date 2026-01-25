import React from "react";

export default function AccessDenied({ message }) {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="rounded-2xl bg-white shadow-md border border-slate-200 p-8 text-center max-w-md">
        <h2 className="text-2xl font-bold text-slate-800">Access Denied</h2>
        <p className="text-slate-500 mt-2">
          {message || "You do not have permission to access this area."}
        </p>
      </div>
    </div>
  );
}
