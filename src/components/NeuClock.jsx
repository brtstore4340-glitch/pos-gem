import React, { useEffect, useState } from "react";

export default function NeuClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");

  return (
    <div className="px-3 py-1.5 rounded-full border text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
      {hh}:{mm}
    </div>
  );
}
