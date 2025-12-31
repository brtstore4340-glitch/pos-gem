export default function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-boots-text mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-boots-subtext mb-2">Today's Sales</h3>
          <p className="text-3xl font-bold text-boots-base">฿0.00</p>
        </div>
        <div className="glass-panel p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-boots-subtext mb-2">Transactions</h3>
          <p className="text-3xl font-bold text-boots-base">0</p>
        </div>
        <div className="glass-panel p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-boots-subtext mb-2">Items Sold</h3>
          <p className="text-3xl font-bold text-boots-base">0</p>
        </div>
      </div>
      <div className="mt-6 glass-panel p-6 rounded-xl">
        <h2 className="text-xl font-bold text-boots-text mb-4">Recent Activity</h2>
        <p className="text-boots-subtext">No recent transactions</p>
      </div>
    </div>
  );
}
