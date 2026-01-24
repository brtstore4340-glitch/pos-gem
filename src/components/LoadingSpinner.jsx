import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../utils/cn";

export default function LoadingSpinner({ label = "Loading...", size = 28, className }) {
  return (
    <div className={cn("flex items-center justify-center gap-3 text-slate-500", className)}>
      <Loader2 size={size} className="animate-spin text-blue-500" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
