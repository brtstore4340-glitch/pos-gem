/* eslint-disable react-refresh/only-export-components */
import * as React from "react";

const ThemeContext = React.createContext(null);

export function ThemeProvider({ children, defaultTheme = "system", storageKey = "theme" }) {
  const [theme, setTheme] = React.useState(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = React.useState("light");

  React.useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) setTheme(stored);
  }, [storageKey]);

  React.useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    let resolved = "light";
    if (theme === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      resolved = theme;
    }

    root.classList.add(resolved);
    setResolvedTheme(resolved);
  }, [theme]);

  const value = React.useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (newTheme) => {
        localStorage.setItem(storageKey, newTheme);
        setTheme(newTheme);
      }
    }),
    [theme, resolvedTheme, storageKey]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
