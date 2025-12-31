export default function InventoryPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-boots-text mb-6">Inventory Management</h1>
      <div className="glass-panel p-6 rounded-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-boots-text">Product List</h2>
          <button className="btn-primary">Add Product</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-boots-subtext">SKU</th>
                <th className="text-left py-3 px-4 text-boots-subtext">Product Name</th>
                <th className="text-left py-3 px-4 text-boots-subtext">Price</th>
                <th className="text-left py-3 px-4 text-boots-subtext">Status</th>
                <th className="text-left py-3 px-4 text-boots-subtext">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan="5" className="text-center py-8 text-boots-subtext">
                  No products found. Upload product data in Admin Settings.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
