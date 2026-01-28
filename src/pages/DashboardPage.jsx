import { TrendingUp, ShoppingBag, Package, Activity } from 'lucide-react';

export default function DashboardPage() {
  // Mock data for display - in real app would come from stats hook
  const stats = [
    { label: "Today's Sales", value: "฿42,590.00", icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Transactions", value: "142", icon: ShoppingBag, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Items Sold", value: "356", icon: Package, color: "text-orange-500", bg: "bg-orange-500/10" },
  ];

  return (
    <div className="p-6 md:p-8 w-full max-w-7xl mx-auto space-y-8 animate-fade-in-up">
      
      {/* Header */}
      <div className="flex items-center justify-between">
         <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400">Overview of store performance</p>
         </div>
         <div className="flex gap-2">
            <span className="glass-panel px-3 py-1 text-xs font-semibold flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Live
            </span>
         </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="glass-panel p-6 relative overflow-hidden group hover:scale-[1.01] transition-transform">
            <div className={`absolute top-0 right-0 p-4 opacity-50`}>
               <stat.icon size={64} className={`${stat.color} opacity-10 group-hover:scale-110 transition-transform`} />
            </div>
            <div className="relative z-10">
               <div className={`w-12 h-12 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center mb-4`}>
                 <stat.icon size={24} />
               </div>
               <h3 className="text-slate-500 dark:text-slate-400 font-medium mb-1">{stat.label}</h3>
               <p className="text-3xl font-bold text-slate-800 dark:text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="glass-panel p-6 rounded-2xl min-h-[300px]">
        <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
               <Activity size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Recent Activity</h2>
        </div>
        
        <div className="flex flex-col items-center justify-center h-48 text-slate-400 dark:text-slate-500">
           <Activity size={48} className="mb-4 opacity-20" />
           <p>No recent activity to display</p>
        </div>
      </div>
    
    </div>
  );
}

