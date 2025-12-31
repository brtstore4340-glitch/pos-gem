import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../utils/cn';

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleTheme}
        className={cn(
          "relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-boots-base focus:ring-offset-2 dark:focus:ring-offset-slate-900",
          isDark ? "bg-boots-base" : "bg-slate-200"
        )}
        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        <span
          className={cn(
            "inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-200 ease-in-out shadow-sm flex items-center justify-center",
            isDark ? "translate-x-7" : "translate-x-1"
          )}
        >
          {isDark ? (
            <Moon size={14} className="text-boots-base" />
          ) : (
            <Sun size={14} className="text-orange-500" />
          )}
        </span>
      </button>
    </div>
  );
}
