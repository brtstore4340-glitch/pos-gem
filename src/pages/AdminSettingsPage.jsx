import { useState } from 'react';

export default function AdminSettingsPage() {
  const [activeSubTab, setActiveSubTab] = useState('features');
  const [features, setFeatures] = useState({
    multiStoreMode: true,
    advancedPromotions: false,
    couponScanning: true,
    voidManagerOnly: false,
    autoReport: true,
    lowStockAlerts: false,
    thaiLanguagePriority: true,
  });

  const [uploadMetadata, setUploadMetadata] = useState({
    ProductAllDept: { uploaded: false, itemCount: 0, uploadedAt: null },
    ItemMasterPrintOnDept: { uploaded: false, itemCount: 0, uploadedAt: null },
    ItemMaintananceEvent: { uploaded: false, itemCount: 0, uploadedAt: null },
  });

  const handleFeatureToggle = (featureName) => {
    setFeatures(prev => ({ ...prev, [featureName]: !prev[featureName] }));
  };

  const handleSaveFeatures = () => {
    // TODO: Save to Firestore
    alert('Settings saved successfully!');
  };

  const handleFileUpload = (uploadType) => {
    // TODO: Implement file upload logic
    alert(`Upload ${uploadType} - Coming soon`);
  };

  const canUploadSecondary = uploadMetadata.ProductAllDept.uploaded;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-boots-text mb-6">Admin Settings</h1>
      
      {/* Sub-tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveSubTab('features')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeSubTab === 'features'
              ? 'text-boots-base border-b-2 border-boots-base'
              : 'text-boots-subtext hover:text-boots-base'
          }`}
        >
          Feature Toggles
        </button>
        <button
          onClick={() => setActiveSubTab('uploads')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeSubTab === 'uploads'
              ? 'text-boots-base border-b-2 border-boots-base'
              : 'text-boots-subtext hover:text-boots-base'
          }`}
        >
          Data Uploads
        </button>
      </div>

      {/* Feature Toggles Sub-Tab */}
      {activeSubTab === 'features' && (
        <div className="glass-panel p-6 rounded-xl">
          <h2 className="text-xl font-bold text-boots-text mb-4">Feature Management</h2>
          <div className="space-y-4">
            {[
              { key: 'multiStoreMode', label: 'Enable Multi-Store Mode' },
              { key: 'advancedPromotions', label: 'Enable Advanced Promotions' },
              { key: 'couponScanning', label: 'Enable Coupon Scanning' },
              { key: 'voidManagerOnly', label: 'Enable Void by Manager Only' },
              { key: 'autoReport', label: 'Enable Daily Report Auto-send' },
              { key: 'lowStockAlerts', label: 'Enable Low Stock Alerts' },
              { key: 'thaiLanguagePriority', label: 'Enable Thai Language Priority' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={features[key]}
                  onChange={() => handleFeatureToggle(key)}
                  className="w-5 h-5 text-boots-base border-gray-300 rounded focus:ring-boots-base"
                />
                <span className="text-boots-text">{label}</span>
              </label>
            ))}
          </div>
          <div className="mt-6">
            <button onClick={handleSaveFeatures} className="btn-primary">
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Data Uploads Sub-Tab */}
      {activeSubTab === 'uploads' && (
        <div className="space-y-4">
          {/* ProductAllDept - Required First */}
          <div className="glass-panel p-6 rounded-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-boots-text">1. ProductAllDept (Master) - REQUIRED</h3>
                <p className="text-sm text-boots-subtext mt-1">Master product data - must be uploaded first</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm ${
                uploadMetadata.ProductAllDept.uploaded
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {uploadMetadata.ProductAllDept.uploaded ? '✓ Uploaded' : '⚠ Not uploaded'}
              </span>
            </div>
            {uploadMetadata.ProductAllDept.uploaded && (
              <div className="text-sm text-boots-subtext mb-4">
                <p>Items: {uploadMetadata.ProductAllDept.itemCount.toLocaleString()}</p>
                <p>Last Update: {uploadMetadata.ProductAllDept.uploadedAt || 'N/A'}</p>
              </div>
            )}
            <button
              onClick={() => handleFileUpload('ProductAllDept')}
              className="btn-primary"
            >
              📤 Upload New File
            </button>
          </div>

          {/* ItemMasterPrintOnDept */}
          <div className="glass-panel p-6 rounded-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-boots-text">2. ItemMasterPrintOnDept</h3>
                <p className="text-sm text-boots-subtext mt-1">Print label data (optional)</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm ${
                uploadMetadata.ItemMasterPrintOnDept.uploaded
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {uploadMetadata.ItemMasterPrintOnDept.uploaded ? '✓ Uploaded' : '⚠ Not uploaded'}
              </span>
            </div>
            <button
              onClick={() => handleFileUpload('ItemMasterPrintOnDept')}
              disabled={!canUploadSecondary}
              className={`btn-primary ${!canUploadSecondary ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              📤 Upload
            </button>
            {!canUploadSecondary && (
              <p className="text-sm text-red-600 mt-2">Upload ProductAllDept first</p>
            )}
          </div>

          {/* ItemMaintananceEvent */}
          <div className="glass-panel p-6 rounded-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-boots-text">3. ItemMaintananceEvent</h3>
                <p className="text-sm text-boots-subtext mt-1">Maintenance event data (optional)</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm ${
                uploadMetadata.ItemMaintananceEvent.uploaded
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {uploadMetadata.ItemMaintananceEvent.uploaded ? '✓ Uploaded' : '⚠ Not uploaded'}
              </span>
            </div>
            <button
              onClick={() => handleFileUpload('ItemMaintananceEvent')}
              disabled={!canUploadSecondary}
              className={`btn-primary ${!canUploadSecondary ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              📤 Upload
            </button>
            {!canUploadSecondary && (
              <p className="text-sm text-red-600 mt-2">Upload ProductAllDept first</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
