import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../utils/cn';

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative inline-flex h-10 w-[4.5rem] items-center rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/50",
        isDark 
          ? "bg-slate-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] border border-slate-700" 
          : "bg-slate-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] border border-slate-300"
      )}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      <span className="sr-only">Toggle Theme</span>
      <span
        className={cn(
          "absolute transform rounded-full h-8 w-8 flex items-center justify-center transition-all duration-300 ease-spring shadow-md",
          "bg-white dark:bg-[#252830] border border-slate-200 dark:border-white/10",
          isDark ? "translate-x-[2.2rem]" : "translate-x-1"
        )}
      >
        {isDark ? (
          <Moon size={16} className="text-blue-400 fill-current" />
        ) : (
          <Sun size={16} className="text-orange-500 fill-current" />
        )}
      </span>
    </button>
  );
}
