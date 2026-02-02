/**
 * Grab Print - Print Preview Script
 * Handles print preview window interactions
 */

import { getSettings, savePrintedOrder } from './storage.js';
import { applyToDOM } from './print-template.js';

// DOM Elements
const btnPrint = document.getElementById('btnPrint');
const btnClose = document.getElementById('btnClose');
const printStatus = document.getElementById('printStatus');

// Current order data
let currentOrder = null;

// Initialize the preview
async function init() {
  // Load settings
  const settings = await getSettings();
  
  // Get order data from URL parameters or storage
  await loadOrderData(settings);
  
  // Set up event listeners
  setupEventListeners();
  
  // Update printer width based on settings
  updatePrinterWidth(settings.printerWidth);
}

async function loadOrderData(settings) {
  // Try to get order data from URL
  const urlParams = new URLSearchParams(window.location.search);
  const orderData = urlParams.get('order');
  
  if (orderData) {
    try {
      // Decode base64 encoded order data
      currentOrder = JSON.parse(decodeURIComponent(atob(orderData)));
      applyToDOM(currentOrder, settings);
      return;
    } catch (e) {
      console.error('Failed to parse order data from URL:', e);
    }
  }
  
  // Try via message to get from storage
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_PENDING_ORDER' });
    if (response?.ok && response.order) {
      currentOrder = response.order;
      applyToDOM(currentOrder, settings);
      return;
    }
  } catch (e) {
    console.log('No pending order from background');
  }
  
  // Show empty state
  showStatus('ไม่พบข้อมูลคำสั่งซื้อ', 'error');
}

function setupEventListeners() {
  // Print button
  if (btnPrint) {
    btnPrint.addEventListener('click', handlePrint);
  }
  
  // Close button
  if (btnClose) {
    btnClose.addEventListener('click', () => window.close());
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'p') {
        e.preventDefault();
        handlePrint();
      } else if (e.key === 'w') {
        e.preventDefault();
        window.close();
      }
    }
  });
}

async function handlePrint() {
  if (!currentOrder) {
    showStatus('ไม่พบข้อมูลคำสั่งซื้อ', 'error');
    return;
  }
  
  try {
    // Mark as printed
    await savePrintedOrder(currentOrder.id || currentOrder.bookingCode, currentOrder);
    
    // Show success status
    showStatus('กำลังเปิดหน้าต่างพิมพ์...', 'success');
    
    // Trigger print
    window.print();
    
    // Update status after print dialog closes
    setTimeout(() => {
      showStatus('✅ พิมพ์สำเร็จ!', 'success');
      
      // Notify background script
      try {
        chrome.runtime.sendMessage({
          type: 'ORDER_PRINTED',
          orderId: currentOrder.id || currentOrder.bookingCode
        });
      } catch (e) {
        console.log('Could not notify background script');
      }
    }, 500);
    
  } catch (e) {
    showStatus('❌ เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
}

function showStatus(message, type = 'info') {
  if (!printStatus) return;
  
  printStatus.textContent = message;
  printStatus.className = `print-status ${type}`;
  printStatus.style.display = 'block';
  
  // Auto-hide after 3 seconds for success messages
  if (type === 'success') {
    setTimeout(() => {
      printStatus.style.display = 'none';
    }, 3000);
  }
}

function updatePrinterWidth(width) {
  const thermalPrint = document.getElementById('thermalPrint');
  if (!thermalPrint) return;
  
  // Remove existing width classes
  thermalPrint.classList.remove('printer-width-58', 'printer-width-80');
  
  // Add new width class
  const widthValue = width?.replace('mm', '') || '58';
  thermalPrint.classList.add(`printer-width-${widthValue}`);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
