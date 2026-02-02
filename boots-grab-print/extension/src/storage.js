/**
 * Grab Print - Storage Module
 * Handles settings and printed orders tracking
 */

// Default settings
const DEFAULT_SETTINGS = {
  branchId: '',
  token: '',
  baseUrl: '',
  pollingInterval: 15, // seconds
  enableNotifications: true,
  storeName: 'ร้านของฉัน',
  printerWidth: '58mm', // 58mm or 80mm
  autoPrint: false
};

// Get all settings
export async function getSettings() {
  const s = await chrome.storage.sync.get([
    'branchId',
    'token',
    'baseUrl',
    'pollingInterval',
    'enableNotifications',
    'storeName',
    'printerWidth',
    'autoPrint'
  ]);
  
  return {
    branchId: (s.branchId || DEFAULT_SETTINGS.branchId).toString(),
    token: (s.token || DEFAULT_SETTINGS.token).toString(),
    baseUrl: (s.baseUrl || DEFAULT_SETTINGS.baseUrl).toString().replace(/\/+$/, ''),
    pollingInterval: parseInt(s.pollingInterval) || DEFAULT_SETTINGS.pollingInterval,
    enableNotifications: s.enableNotifications !== false,
    storeName: (s.storeName || DEFAULT_SETTINGS.storeName).toString(),
    printerWidth: (s.printerWidth || DEFAULT_SETTINGS.printerWidth).toString(),
    autoPrint: s.autoPrint === true
  };
}

// Save all settings
export async function setSettings(v) {
  await chrome.storage.sync.set({
    branchId: (v.branchId || '').toString().trim(),
    token: (v.token || '').toString(),
    baseUrl: (v.baseUrl || '').toString().replace(/\/+$/, ''),
    pollingInterval: parseInt(v.pollingInterval) || DEFAULT_SETTINGS.pollingInterval,
    enableNotifications: v.enableNotifications !== false,
    storeName: (v.storeName || '').toString().trim(),
    printerWidth: (v.printerWidth || '58mm').toString(),
    autoPrint: v.autoPrint === true
  });
}

// Get printed orders
export async function getPrintedOrders() {
  const data = await chrome.storage.sync.get('printedOrders');
  return data.printedOrders || {};
}

// Get a specific printed order
export async function getPrintedOrder(orderId) {
  const orders = await getPrintedOrders();
  return orders[orderId] || null;
}

// Check if an order has been printed
export async function isOrderPrinted(orderId) {
  const order = await getPrintedOrder(orderId);
  return order !== null;
}

// Save a printed order
export async function savePrintedOrder(orderId, orderData) {
  const orders = await getPrintedOrders();
  orders[orderId] = {
    printedAt: Date.now(),
    orderData: orderData
  };
  await chrome.storage.sync.set({ printedOrders: orders });
  return orders[orderId];
}

// Remove a printed order (mark as unprinted)
export async function removePrintedOrder(orderId) {
  const orders = await getPrintedOrders();
  delete orders[orderId];
  await chrome.storage.sync.set({ printedOrders: orders });
}

// Clear all printed orders
export async function clearPrintedOrders() {
  await chrome.storage.sync.set({ printedOrders: {} });
}

// Get today's printed orders count
export async function getTodayPrintedCount() {
  const orders = await getPrintedOrders();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let count = 0;
  for (const orderId in orders) {
    if (orders[orderId].printedAt >= today.getTime()) {
      count++;
    }
  }
  return count;
}

// Get orders by date range
export async function getOrdersByDateRange(startDate, endDate) {
  const orders = await getPrintedOrders();
  const filtered = {};
  
  for (const orderId in orders) {
    const printedAt = orders[orderId].printedAt;
    if (printedAt >= startDate.getTime() && printedAt <= endDate.getTime()) {
      filtered[orderId] = orders[orderId];
    }
  }
  return filtered;
}

// Export printed orders for backup
export async function exportPrintedOrders() {
  return await getPrintedOrders();
}

// Import printed orders from backup
export async function importPrintedOrders(orders) {
  const currentOrders = await getPrintedOrders();
  const merged = { ...currentOrders, ...orders };
  await chrome.storage.sync.set({ printedOrders: merged });
  return merged;
}
