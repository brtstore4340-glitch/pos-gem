/**
 * Grab Print - Label Print Script
 * Handles dual stub label printing with QR code
 */

import { getSettings, savePrintedOrder } from './storage.js';

// DOM Elements
const btnPrint = document.getElementById('btnPrint');
const btnClose = document.getElementById('btnClose');
const printStatus = document.getElementById('printStatus');

// Current order data
let currentOrder = null;

// Initialize
async function init() {
  // Get order data from URL parameters
  await loadOrderData();
  
  // Set up event listeners
  setupEventListeners();
}

async function loadOrderData() {
  const urlParams = new URLSearchParams(window.location.search);
  const orderData = urlParams.get('order');
  
  if (orderData) {
    try {
      currentOrder = JSON.parse(decodeURIComponent(atob(orderData)));
      applyToDOM();
      return;
    } catch (e) {
      console.error('Failed to parse order data:', e);
    }
  }
  
  showStatus('ไม่พบข้อมูลคำสั่งซื้อ', 'error');
}

function applyToDOM() {
  if (!currentOrder) return;
  
  const bookingCode = currentOrder.shortGM || currentOrder.bookingCode || currentOrder.id || '-';
  const driverName = currentOrder.driverName || '-';
  const driverPhone = currentOrder.driverPhone || '-';
  
  // Generate QR code data URL (using a simple placeholder for now)
  // In production, use a QR code library like qrcode.js
  const qrDataUrl = generateQRDataUrl(bookingCode);
  
  // Update upper stub
  document.getElementById('bookingCode').textContent = `Booking: ${bookingCode}`;
  document.getElementById('qrCode').src = qrDataUrl;
  document.getElementById('driverInfo').innerHTML = `
    Driver: ${escapeHtml(driverName)}<br>
    Phone: ${escapeHtml(driverPhone)}
  `;
  
  // Update lower stub (flipped)
  document.getElementById('bookingCode2').textContent = `Booking: ${bookingCode}`;
  document.getElementById('qrCode2').src = qrDataUrl;
  document.getElementById('driverInfo2').innerHTML = `
    Driver: ${escapeHtml(driverName)}<br>
    Phone: ${escapeHtml(driverPhone)}
  `;
}

// Generate a simple QR code placeholder
// In production, use a proper QR code library
function generateQRDataUrl(data) {
  // Create a simple SVG with the booking code
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <rect fill="white" width="100%" height="100%"/>
      <rect x="10" y="10" width="25" height="25" fill="black"/>
      <rect x="65" y="10" width="25" height="25" fill="black"/>
      <rect x="10" y="65" width="25" height="25" fill="black"/>
      <rect x="40" y="40" width="20" height="20" fill="black"/>
      <rect x="10" y="40" width="5" height="5" fill="black"/>
      <rect x="20" y="40" width="5" height="5" fill="black"/>
      <rect x="10" y="50" width="5" height="5" fill="black"/>
      <rect x="20" y="50" width="5" height="5" fill="black"/>
      <rect x="65" y="40" width="5" height="5" fill="black"/>
      <rect x="75" y="40" width="5" height="5" fill="black"/>
      <rect x="65" y="50" width="5" height="5" fill="black"/>
      <rect x="75" y="50" width="5" height="5" fill="black"/>
      <rect x="40" y="65" width="5" height="5" fill="black"/>
      <rect x="50" y="65" width="5" height="5" fill="black"/>
      <rect x="40" y="75" width="5" height="5" fill="black"/>
      <rect x="50" y="75" width="5" height="5" fill="black"/>
      <text x="50%" y="95" text-anchor="middle" font-size="8" fill="black">${escapeHtml(data.substring(0, 10))}</text>
    </svg>
  `;
  
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function setupEventListeners() {
  if (btnPrint) {
    btnPrint.addEventListener('click', handlePrint);
  }
  
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
    
    showStatus('กำลังเปิดหน้าต่างพิมพ์...', 'success');
    
    // Trigger print
    window.print();
    
    // Notify background
    setTimeout(() => {
      showStatus('✅ พิมพ์สำเร็จ!', 'success');
      try {
        chrome.runtime.sendMessage({
          type: 'ORDER_PRINTED',
          orderId: currentOrder.id || currentOrder.bookingCode
        });
      } catch (e) {
        console.log('Could not notify background');
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
  
  if (type === 'success') {
    setTimeout(() => {
      printStatus.style.display = 'none';
    }, 3000);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
