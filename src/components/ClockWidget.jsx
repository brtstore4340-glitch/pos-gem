import React, { useEffect, useState } from 'react';

export default function ClockWidget({ isDark }) {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatPart = (num) => num.toString().padStart(2, '0');

  // Unity Theme: Glass capsule style
  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/50 dark:bg-black/20 border border-slate-200/60 dark:border-white/10 backdrop-blur-md shadow-sm select-none">
      <div className="flex flex-col items-end leading-none">
        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
          {time.toLocaleDateString('en-GB', { weekday: 'short' })}
        </span>
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {time.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
        </span>
      </div>

      <div className="h-8 w-[1px] bg-slate-200 dark:bg-white/10"></div>

      <div className="flex items-baseline gap-0.5 font-mono text-xl font-bold text-slate-700 dark:text-white">
        <span>{formatPart(time.getHours())}</span>
        <span className="animate-pulse text-blue-500">:</span>
        <span>{formatPart(time.getMinutes())}</span>
        <span className="text-sm text-slate-400 dark:text-slate-500 ml-1 font-medium">
          {formatPart(time.getSeconds())}
        </span>
      </div>
    </div>
  );
}
