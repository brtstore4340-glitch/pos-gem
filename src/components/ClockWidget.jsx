import React, { useEffect, useState } from 'react';
import { cn } from '../utils/cn';

export default function ClockWidget({ isDark }) {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatPart = (num) => num.toString().padStart(2, '0');

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-4 py-2 rounded-xl shadow-inner border transition-all select-none',
        isDark
          ? 'bg-slate-800 border-slate-700 shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6)]'
          : 'bg-slate-100 border-slate-200 shadow-[inset_2px_2px_6px_rgba(0,0,0,0.1)]'
      )}
    >
      <div className={cn('text-xs font-bold mr-2 uppercase tracking-wider', isDark ? 'text-slate-500' : 'text-slate-400')}>
        {time.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
      </div>

      <div className="flex items-center gap-0.5 font-mono text-xl font-black">
        <span
          className={cn(
            'relative top-[1px]',
            isDark ? 'text-white drop-shadow-[1px_1px_0_rgba(0,0,0,0.8)]' : 'text-slate-700 drop-shadow-[1px_1px_0_rgba(255,255,255,1)]'
          )}
        >
          {formatPart(time.getHours())}
        </span>
        <span className={cn('animate-pulse relative top-[0.5px]', isDark ? 'text-slate-600' : 'text-slate-400')}>:</span>
        <span
          className={cn(
            'relative top-[1px]',
            isDark ? 'text-white drop-shadow-[1px_1px_0_rgba(0,0,0,0.8)]' : 'text-slate-700 drop-shadow-[1px_1px_0_rgba(255,255,255,1)]'
          )}
        >
          {formatPart(time.getMinutes())}
        </span>
        <span className={cn('animate-pulse relative top-[0.5px]', isDark ? 'text-slate-600' : 'text-slate-400')}>:</span>
        <span
          className={cn(
            'relative top-[1px] text-lg',
            isDark ? 'text-boots-base drop-shadow-[1px_1px_0_rgba(0,0,0,0.8)]' : 'text-boots-base drop-shadow-[1px_1px_0_rgba(255,255,255,1)]'
          )}
        >
          {formatPart(time.getSeconds())}
        </span>
      </div>
    </div>
  );
}

