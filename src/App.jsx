import React, { useEffect, useMemo, useState, Suspense, lazy } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Monitor,
  FileText,
  Settings as SettingsIcon,
  Package,
  ShoppingCart,
  UploadCloud,
  ShieldCheck,
  Search,
  LogOut,
  Lock
} from "lucide-react";

import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { CartProvider } from "./context/CartContext";
import { AuthProvider, useAuth } from './context/AuthContext';
import ThemeToggle from "./components/ThemeToggle";
import TabSkeleton from "./components/skeletons/TabSkeleton";
import { APP_VERSION, APP_UPDATED } from "./constants/appMeta";
import ClockWidget from "./components/ClockWidget";
import logoLight from "./image/logo.png";
import logoDark from "./image/logodark.png";
import AuthGate from './components/auth/AuthGate';
import AccessDenied from './components/auth/AccessDenied';

// Lazy load tab components
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const PosUI = lazy(() => import("./components/PosUI"));
const ReportPage = lazy(() => import("./pages/ReportPage"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const AdminSettings = lazy(() => import("./pages/AdminSettingsPage"));
const FileUploadPage = lazy(() => import("./pages/FileUploadPage"));
const ManagementConsole = lazy(() => import("./pages/ManagementConsole"));
const ProductSearchPage = lazy(() => import("./pages/ProductSearchPage"));

const DEFAULT_ALLOWED_MENUS = {
  admin: ["dashboard", "pos", "search", "report", "inventory", "orders", "settings", "Upload", "management"],
  "SM-SGM": ["dashboard", "pos", "search", "report", "inventory", "orders", "settings", "Upload", "management"],
  user: ["pos", "search", "dashboard"]
};

function AppShell() {
  const { isDark } = useTheme();
  const { session, signOut, lockTerminal } = useAuth();
  const [activeTab, setActiveTab] = useState("pos");
  const logoSrc = isDark ? logoDark : logoLight;
  const isManager = session?.role === "admin" || session?.role === "SM-SGM";

  const allowedMenus = useMemo(() => {
    if (!session) return [];
    const explicit = session.permissions?.allowedMenus;
    const base = Array.isArray(explicit) && explicit.length ? explicit : (DEFAULT_ALLOWED_MENUS[session.role] || []);
    const normalized = base.map((menu) => String(menu || "").trim()).filter(Boolean);
    if (session.role === "user" && !normalized.includes("search")) {
      normalized.push("search");
    }
    const unique = Array.from(new Set(normalized));
    return isManager ? unique : unique.filter((menu) => menu !== "management");
  }, [session, isManager]);

  const allowedSet = useMemo(() => new Set(allowedMenus), [allowedMenus]);

  const tabs = useMemo(() => ([
    { id: "dashboard", label: "Overview", Icon: LayoutDashboard },
    { id: "pos", label: "Terminal", Icon: Monitor },
    { id: "search", label: "Search", Icon: Search },
    { id: "report", label: "Reports", Icon: FileText },
    { id: "inventory", label: "Stock", Icon: Package },
    { id: "orders", label: "Orders", Icon: ShoppingCart },
    { id: "settings", label: "Settings", Icon: SettingsIcon },
    { id: "Upload", label: "Import", Icon: UploadCloud },
    { id: "management", label: "Admin", Icon: ShieldCheck }
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
      case "dashboard": return <DashboardPage />;
      case "pos": return <PosUI />;
      case "report": return <ReportPage />;
      case "search": return <ProductSearchPage />;
      case "inventory": return <InventoryPage />;
      case "orders": return <OrdersPage />;
      case "settings": return <AdminSettings onBack={() => setActiveTab("pos")} />;
      case "Upload": return <FileUploadPage />;
      case "management": return <ManagementConsole />;
      default: return null;
    }
  };

  return (
    <div className="min-h-dvh h-dvh bg-[#f8fafc] dark:bg-[#0f1014] text-slate-800 dark:text-slate-200 flex flex-col overflow-hidden font-sans transition-colors duration-300 relative">
      <ErrorBoundary>
        {/* Background Ambient Glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 dark:bg-blue-600/5 rounded-full blur-[120px]" />
           <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/5 dark:bg-cyan-600/5 rounded-full blur-[120px]" />
        </div>

        {/* Top Navigation Bar - Glassmorphism */}
        <nav className="relative z-50 px-4 py-3">
          <div className="glass-panel px-4 py-2 flex items-center justify-between shadow-lg ring-1 ring-black/5 dark:ring-white/5">
            
            {/* Left: Branding & Version */}
            <div className="flex items-center gap-4">
               <div className="relative group">
                  <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <img src={logoSrc} alt="Boots Logo" className="h-9 w-auto object-contain relative transition-transform hover:scale-105" />
               </div>
               <div className="hidden md:flex flex-col">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none tracking-tight">POS TERMINAL</span>
                  <div className="flex gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                    <span>v{APP_VERSION}</span>
                    <span>•</span>
                    <span>{APP_UPDATED}</span>
                  </div>
               </div>
            </div>

            {/* Center: Navigation Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[60vw] pb-1 md:pb-0 px-2">
              {visibleTabs.map((tab) => {
                const Icon = tab.Icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      group relative flex flex-col items-center justify-center w-[4.5rem] h-[3.75rem] rounded-xl transition-all duration-200 ease-out
                      ${isActive 
                        ? 'btn-inset-active bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 shadow-inner' 
                        : 'btn-inset hover:bg-white dark:hover:bg-white/5'
                      }
                    `}
                    title={tab.label}
                  >
                    <Icon 
                      size={20} 
                      className={`mb-1 transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`} 
                    />
                    <span className={`text-[10px] font-semibold leading-none ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>
                      {tab.label}
                    </span>
                    
                  </button>
                );
              })}
            </div>

            {/* Right: Tools & Profile */}
            <div className="flex items-center gap-3 pl-2 border-l border-slate-200 dark:border-white/10">
              <ClockWidget isDark={isDark} />
              
              <div className="hidden md:block">
                 <ThemeToggle />
              </div>
              
              <button
                onClick={lockTerminal}
                className="btn-inset w-10 h-10 rounded-full hover:bg-amber-50 dark:hover:bg-amber-900/10 hover:text-amber-500 border-transparent hover:border-amber-200 dark:hover:border-amber-900/30 group mr-1"
                title="Lock Terminal"
              >
                <Lock size={18} className="group-hover:scale-110 transition-transform" />
              </button>
              
              <button
                onClick={signOut}
                className="btn-inset w-10 h-10 rounded-full hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-500 border-transparent hover:border-red-200 dark:hover:border-red-900/30 group"
                title="Sign Out"
              >
                <LogOut size={18} className="group-hover:-translate-x-0.5 transition-transform" />
              </button>
            </div>

          </div>
        </nav>

        {/* Main Content Area */}
        <main className={`flex-1 relative z-0 transition-all ${activeTab === 'pos' ? 'overflow-hidden' : 'overflow-auto px-4 pb-4'}`}>
           <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.25, ease: "circOut" }}
              className="h-full w-full max-w-[1920px] mx-auto"
            >
              <Suspense fallback={<TabSkeleton />}>
                 {/* Content Wrapper with subtle glass effect backing for some pages if needed */}
                 <div className="h-full w-full">
                    {renderActiveTab()}
                 </div>
              </Suspense>
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
