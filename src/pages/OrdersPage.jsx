export default function OrdersPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-boots-text mb-6">Orders & Invoices</h1>
      <div className="glass-panel p-6 rounded-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-boots-text">Recent Orders</h2>
          <div className="flex gap-2">
            <input
              type="date"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-boots-base focus:border-transparent"
            />
            <button className="btn-ghost">Filter</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-boots-subtext">Invoice #</th>
                <th className="text-left py-3 px-4 text-boots-subtext">Date & Time</th>
                <th className="text-left py-3 px-4 text-boots-subtext">Items</th>
                <th className="text-left py-3 px-4 text-boots-subtext">Total</th>
                <th className="text-left py-3 px-4 text-boots-subtext">Status</th>
                <th className="text-left py-3 px-4 text-boots-subtext">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan="6" className="text-center py-8 text-boots-subtext">
                  No orders found for the selected period.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
