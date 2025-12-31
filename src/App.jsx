import React, { useState, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Monitor, FileText, Settings as SettingsIcon, Package, ShoppingCart, Database } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import { CartProvider } from './context/CartContext';
import { useTheme } from './context/ThemeContext';
import ThemeToggle from './components/ThemeToggle';
import TabSkeleton from './components/skeletons/TabSkeleton';
import { APP_VERSION, APP_UPDATED } from './constants/appMeta';
import ClockWidget from './components/ClockWidget';

// Lazy load tab components for code splitting
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PosUI = lazy(() => import('./components/PosUI'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const AdminSettings = lazy(() => import('./components/AdminSettings'));

function AppShell() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('pos');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { id: 'pos', label: 'POS', Icon: Monitor },
    { id: 'report', label: 'Report', Icon: FileText },
    { id: 'inventory', label: 'Inventory', Icon: Package },
    { id: 'settings', label: 'Setting', Icon: SettingsIcon },
    { id: 'orders', label: 'Order', Icon: ShoppingCart },
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'pos':
        return <PosUI />;
      case 'report':
        return <ReportPage />;
      case 'inventory':
        return <InventoryPage />;
      case 'orders':
        return <OrdersPage />;
      case 'settings':
        return <AdminSettings onBack={() => setActiveTab('pos')} />;
      default:
        return <PosUI />;
    }
  };

  return (
    <div className="min-h-dvh h-dvh bg-slate-50 dark:bg-dark-bg flex flex-col">
      <ErrorBoundary>
        {/* Tab Navigation Bar */}
        <nav className="bg-white dark:bg-dark-panel border-b border-gray-200 dark:border-dark-border shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              {/* Logo & Version - Top Left */}
              <div className="flex items-center gap-3">
                <img
                  src="https://store.boots.co.th/images/boots-logo.png"
                  alt="Boots Logo"
                  className="h-8 w-auto object-contain"
                />
                <div className="flex flex-col text-[10px] text-slate-400 font-mono">
                  <span>v{APP_VERSION}</span>
                  <span>{APP_UPDATED}</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1">
                {tabs.map((tab) => {
                  const Icon = tab.Icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 font-medium ${
                        isActive
                          ? 'bg-boots-base text-white shadow-md'
                          : 'text-boots-subtext dark:text-dark-subtext hover:bg-boots-light dark:hover:bg-dark-border'
                      }`}
                    >
                      <span
                        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
                          isActive
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-white dark:border-white dark:text-slate-900'
                        }`}
                      >
                        <Icon size={18} />
                      </span>
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab('settings')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all border bg-white text-slate-700 hover:bg-slate-50 dark:bg-dark-panel dark:text-dark-subtext dark:border-dark-border dark:hover:bg-dark-border"
                title="Upload Data"
              >
                <Database size={16} />
                Upload Data
              </button>
              <ClockWidget isDark={isDark} />
              <ThemeToggle />
            </div>
          </div>
        </nav>

        {/* Tab Content with Animation */}
        <main className={`flex-1 ${activeTab === 'pos' ? 'overflow-hidden' : 'max-w-7xl mx-auto w-full overflow-auto'}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ willChange: 'transform, opacity' }}
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
      <CartProvider>
        <AppShell />
      </CartProvider>
    </ThemeProvider>
  );
}

export default App;
