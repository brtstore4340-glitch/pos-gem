import * as React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Container } from "@/components/ui/grid";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ServerStatus } from "@/components/ui/ServerStatus";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/pos", label: "POS Terminal" },
  { to: "/item-search", label: "Item Search" },
  { to: "/reports", label: "Daily" },
  { to: "/settings", label: "Setting" },
];

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "text-sm px-3 py-2 rounded-md border transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          isActive ? "bg-accent text-accent-foreground" : "bg-background"
        )
      }
    >
      {label}
    </NavLink>
  );
}

export function AppShell() {
  const location = useLocation();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-slate-50/70 dark:bg-black/40 backdrop-blur-md">
        <Container className="py-4 px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="https://store.boots.co.th/images/boots-logo.png" alt="Boots Logo" className="h-8 w-auto object-contain" />
            <span className="font-bold text-xl text-slate-800 dark:text-slate-200">รายการขาย</span>
          </div>
          <nav className="flex flex-wrap gap-2 items-center">
            {navItems.map((it) => (
              <NavItem key={it.to} to={it.to} label={it.label} />
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ServerStatus />
            <ThemeToggle />
          </div>
        </Container>
      </header>

      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={{ duration: 0.35, ease: "circOut" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
