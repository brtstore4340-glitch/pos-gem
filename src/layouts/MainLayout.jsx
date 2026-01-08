import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  FileText, 
  Settings, 
  Menu, 
  X,
  PowerOff,
  User,
  Moon,
  Sun,
  LogOut
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

function MainLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // จัดการ Dark Mode
  useEffect(() => {
    // ตรวจสอบค่าเริ่มต้นจาก local storage หรือ system preference
    const isDark = localStorage.getItem('theme') === 'dark' || 
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  const menuItems = [
    { label: 'แดชบอรด', icon: LayoutDashboard, path: '/' },
    { label: 'จดขาย (POS)', icon: ShoppingCart, path: '/pos' },
    { label: 'คลงสนคา', icon: Package, path: '/inventory' },
    { label: 'รายงาน', icon: FileText, path: '/reports' },
    { label: 'ตงคา', icon: Settings, path: '/settings' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#1a1b1e] transition-colors duration-300 font-sans overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-72 transform transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-20'}
          bg-white dark:bg-[#25262b] border-r border-slate-200 dark:border-[#2c2e33]
          flex flex-col shadow-2xl lg:shadow-none
        `}
      >
        {/* Logo Header */}
        <div className="h-20 flex items-center justify-center border-b border-slate-100 dark:border-[#2c2e33]">
            <div className="flex items-center gap-3 px-4 w-full justify-center overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-boots-base text-white flex items-center justify-center shadow-lg shadow-blue-900/20 shrink-0">
                    <span className="font-bold text-xl">B</span>
                </div>
                <div className={`flex flex-col transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden lg:hidden'}`}>
                    <h1 className="font-bold text-xl text-boots-base dark:text-white leading-none tracking-tight">
                        Boots<span className="text-slate-400">POS</span>
                    </h1>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Store Manager</span>
                </div>
            </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          {menuItems.map((item, index) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <button
                key={index}
                onClick={() => navigate(item.path)}
                className={`
                  w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 group relative overflow-hidden
                  ${isActive 
                    ? 'bg-boots-base text-white shadow-md shadow-blue-900/25' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2c2e33] hover:text-boots-base dark:hover:text-white'
                  }
                `}
              >
                {/* Active Indicator Strip */}
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20"></div>}

                {/* Icon Wrapper */}
                <div className={`p-0.5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-boots-base dark:group-hover:text-white'}`}>
                   <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                
                {/* Text Label */}
                <span className={`font-medium text-sm whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden lg:hidden'}`}>
                  {item.label}
                </span>

                {/* Tooltip for collapsed state */}
                {!isSidebarOpen && (
                   <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap lg:block hidden">
                      {item.label}
                   </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* User & Logout Section */}
        <div className="p-4 border-t border-slate-100 dark:border-[#2c2e33] space-y-2">
            
            {/* User Profile */}
            <div className={`flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#1a1b1e]/50 border border-slate-100 dark:border-[#2c2e33] ${!isSidebarOpen && 'justify-center p-2'}`}>
                <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 shrink-0 border-2 border-white dark:border-[#25262b]">
                    <User size={18} />
                </div>
                <div className={`overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'w-auto opacity-100' : 'w-0 opacity-0 hidden'}`}>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">Admin</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Manager</p>
                </div>
            </div>

            {/* Logout Button */}
            <button 
                className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl 
                    text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/10 dark:text-red-400 
                    transition-all duration-200 group border border-transparent hover:border-red-100 dark:hover:border-red-900/20
                    ${!isSidebarOpen && 'justify-center px-0'}
                `}
                title="ออกจากระบบ"
            >
                <PowerOff size={20} className="group-hover:scale-110 transition-transform" />
                <span className={`font-medium text-sm whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                    ออกจากระบบ
                </span>
            </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-slate-50 dark:bg-[#1a1b1e]">
        
        {/* Top Header */}
        <header className="h-20 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-10 bg-slate-50/90 dark:bg-[#1a1b1e]/90 backdrop-blur-md">
            {/* Left: Toggle */}
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 -ml-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-colors"
                >
                    {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
                <div>
                   <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                       ภาพรวมระบบ
                   </h2>
                   <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">ยนดตอนรบกลบ, จดการรานคาของคณไดทน</p>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
                <button 
                    onClick={toggleTheme}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-[#25262b] border border-slate-200 dark:border-[#2c2e33] text-slate-600 dark:text-yellow-400 shadow-sm hover:shadow transition-all active:scale-95"
                    title={isDarkMode ? 'เปลยนเปนโหมดสวาง' : 'เปลยนเปนโหมดมด'}
                >
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 sm:p-8">
            <div className="max-w-7xl mx-auto animate-fade-in-up">
                {children}
            </div>
        </main>
      </div>
    </div>
  );
}

export default MainLayout;