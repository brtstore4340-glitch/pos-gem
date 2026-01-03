import React, { useEffect, useMemo, useState, Suspense, lazy } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Monitor,
  FileText,
  Settings as SettingsIcon,
  Package,
  ShoppingCart,
  Database,
  UploadCloud,
  ShieldCheck
} from "lucide-react";

import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./context/ThemeContext";
import { CartProvider } from "./context/CartContext";
import { useTheme } from "./context/ThemeContext";
import { AuthProvider, useAuth } from './context/AuthContext';
import ThemeToggle from "./components/ThemeToggle";
import TabSkeleton from "./components/skeletons/TabSkeleton";
import { APP_VERSION, APP_UPDATED } from "./constants/appMeta";
import ClockWidget from "./components/ClockWidget";
import logoLight from "./image/logo.png";
import logoDark from "./image/logodark.png";
import AuthGate from './components/auth/AuthGate';
import AccessDenied from './components/auth/AccessDenied';

// Lazy load tab components for code splitting
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const PosUI = lazy(() => import("./components/PosUI"));
const ReportPage = lazy(() => import("./pages/ReportPage"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const AdminSettings = lazy(() => import("./components/AdminSettings"));
const FileUploadPage = lazy(() => import("./pages/FileUploadPage"));
const ManagementConsole = lazy(() => import("./pages/ManagementConsole"));

const DEFAULT_ALLOWED_MENUS = {
  admin: ["dashboard", "pos", "report", "inventory", "orders", "settings", "Upload", "management"],
  "SM-SGM": ["dashboard", "pos", "report", "inventory", "orders", "settings", "Upload", "management"],
  user: ["pos", "dashboard"]
};

function AppShell() {
  const { isDark } = useTheme();
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState("pos");
  const logoSrc = isDark ? logoDark : logoLight;
  const iconColor = isDark ? "#ffffff" : "#000000";
  const isManager = session?.role === "admin" || session?.role === "SM-SGM";
  const allowedMenus = useMemo(() => {
    if (!session) return [];
    const explicit = session.permissions?.allowedMenus;
    const base = Array.isArray(explicit) && explicit.length ? explicit : (DEFAULT_ALLOWED_MENUS[session.role] || []);
    const normalized = base.map((menu) => String(menu || "").trim()).filter(Boolean);
    const unique = Array.from(new Set(normalized));
    return isManager ? unique : unique.filter((menu) => menu !== "management");
  }, [session, isManager]);
  const allowedSet = useMemo(() => new Set(allowedMenus), [allowedMenus]);
  const tabs = useMemo(() => ([
    { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { id: "pos", label: "POS", Icon: Monitor },
    { id: "report", label: "Report", Icon: FileText },
    { id: "inventory", label: "Inventory", Icon: Package },
    { id: "orders", label: "Order", Icon: ShoppingCart },
    { id: "settings", label: "Setting", Icon: SettingsIcon },
    { id: "Upload", label: "Upload", Icon: UploadCloud },
    { id: "management", label: "Management", Icon: ShieldCheck }
  ]), []);
  const visibleTabs = useMemo(() => tabs.filter((tab) => allowedSet.has(tab.id)), [tabs, allowedSet]);
  const defaultTab = useMemo(() => {
    if (isManager && allowedSet.has("management")) return "management";
    if (allowedSet.has("pos")) return "pos";
    return allowedMenus[0] || "pos";
  }, [isManager, allowedSet, allowedMenus]);

  useEffect(() => {
    if (!session) return;
    setActiveTab(defaultTab);
  }, [session?.idCode, defaultTab, session]);

  useEffect(() => {
    if (!allowedSet.has(activeTab)) {
      setActiveTab(defaultTab);
    }
  }, [activeTab, allowedSet, defaultTab]);

  const renderActiveTab = () => {
    if (!allowedSet.has(activeTab)) {
      return <AccessDenied message="You do not have access to this menu." />;
    }
    switch (activeTab) {
      case "dashboard":
        return <DashboardPage />;
      case "pos":
        return <PosUI />;
      case "report":
        return <ReportPage />;
      case "inventory":
        return <InventoryPage />;
      case "orders":
        return <OrdersPage />;
      case "settings":
        return <AdminSettings onBack={() => setActiveTab("pos")} />;
      case "Upload":
        return <FileUploadPage />;
      case "management":
        return <ManagementConsole />;
      }
  };

  return (
    <div className="min-h-dvh h-dvh bg-slate-50 dark:bg-dark-bg flex flex-col overflow-hidden">
      <ErrorBoundary>
        {/* Tab Navigation Bar */}
        <nav className="bg-white dark:bg-dark-panel border-b border-gray-200 dark:border-dark-border shadow-md">
          <div className="flex items-center justify-between px-4 py-3 drop-shadow-sm">
            <div className="flex items-center gap-4">
              {/* Logo & Version - Top Left */}
              <div className="flex items-center gap-3">
                <img src={logoSrc} alt="Boots Logo" className="h-8 w-auto object-contain" />
                <div className="flex flex-col text-[10px] text-slate-400 font-mono">
                  <span>v{APP_VERSION}</span>
                  <span>{APP_UPDATED}</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1">
                {visibleTabs.map((tab) => {
                  const Icon = tab.Icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
  key={tab.id}
  onClick={() => setActiveTab(tab.id)}
  className={`w-[86px] h-[74px] flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 font-semibold ${
    isActive
      ? "bg-boots-base text-white shadow-lg"
      : "text-boots-subtext dark:text-dark-subtext hover:bg-boots-light dark:hover:bg-dark-border shadow-sm"
  }`}
>
  <span
    className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border transition-colors ${
      isActive
        ? "bg-white/10 border-white/20"
        : "bg-white border-slate-200 dark:bg-dark-panel dark:border-dark-border"
    }`}
  >
    <Icon size={20} color={isActive ? "#ffffff" : iconColor} />
  </span>
  <span className="text-[11px] leading-none">{tab.label}</span>
</button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ClockWidget isDark={isDark} />
              <ThemeToggle />
            </div>

          </div>
        </nav>

        {/* Tab Content with Animation */}
        <main className={`flex-1 min-h-0 ${activeTab === "pos" ? "overflow-hidden" : "max-w-7xl mx-auto w-full overflow-auto"}`}>
          <AnimatePresence mode="wait">
            <motion.div className="h-full"
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ willChange: "transform, opacity" }}
            >
              <Suspense fallback={<TabSkeleton />}>{renderActiveTab()}</Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </ErrorBoundary>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate>
          <CartProvider>
            <AppShell />
          </CartProvider>
        </AuthGate>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;







