/**
 * Grab Print - Popup Script
 * Handles today's orders view and print functionality
 */

import { getSettings, isOrderPrinted, getPrintedOrders, savePrintedOrder } from './storage.js';

// DOM Elements
const $ = (sel) => document.querySelector(sel);
const errEl = $('#err');
const okEl = $('#ok');
const listEl = $('#list');
const statsEl = $('#stats');

// Buttons
const btnScan = $('#btnScan');
const btnPrintAll = $('#btnPrintAll');
const btnRefresh = $('#refreshBtn');
const btnOpenOptions = $('#openOptions');

// State
let orders = [];
let printedOrderIds = new Set();

// Initialize
async function init() {
  // Load printed orders
  const printedOrders = await getPrintedOrders();
  printedOrderIds = new Set(Object.keys(printedOrders));
  
  // Set up event listeners
  setupEventListeners();
  
  // Auto-scan on open
  setTimeout(() => scan(), 500);
  
  // Start polling for updates
  startPolling();
}

function setupEventListeners() {
  if (btnScan) btnScan.addEventListener('click', () => scan().catch(e => showError(e?.message || e)));
  if (btnPrintAll) btnPrintAll.addEventListener('click', () => printAllUnprinted().catch(e => showError(e?.message || e)));
  if (btnRefresh) btnRefresh.addEventListener('click', () => scan().catch(e => showError(e?.message || e)));
  if (btnOpenOptions) btnOpenOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());
}

async function scan() {
  showError('');
  showOk('');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('no_active_tab');
    
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GRAB_LIST_ORDERS' });
    const allOrders = resp?.orders || [];
    
    // Filter to today's orders (simplified - all orders from scan)
    orders = allOrders;
    
    // Update stats
    updateStats();
    
    // Render list
    await renderList();
    
    showOk(`Found ${orders.length} orders`);
  } catch (e) {
    // If no grab tab, show empty state
    showError('เปิดหน้า Grab Merchant ก่อน หรือไม่พบคำสั่งซื้อวันนี้');
    orders = [];
    updateStats();
    renderEmptyState();
  }
}

function updateStats() {
  if (!statsEl) return;
  
  const total = orders.length;
  const printed = orders.filter(o => printedOrderIds.has(o.id)).length;
  const unprinted = total - printed;
  
  statsEl.innerHTML = `
    <span class="badge badge-new">วันนี้: ${total}</span>
    <span class="badge badge-printed">พิมพ์แล้ว: ${printed}</span>
    <span class="badge" style="background:#fef3c7;color:#92400e">รอพิมพ์: ${unprinted}</span>
  `;
}

async function renderList() {
  if (!listEl) return;
  
  listEl.innerHTML = '';
  
  if (orders.length === 0) {
    renderEmptyState();
    return;
  }
  
  // Sort: unprinted first, then by URL
  const sortedOrders = [...orders].sort((a, b) => {
    const aPrinted = printedOrderIds.has(a.id);
    const bPrinted = printedOrderIds.has(b.id);
    if (aPrinted !== bPrinted) return aPrinted ? 1 : -1;
    return a.url.localeCompare(b.url);
  });
  
  for (const o of sortedOrders) {
    const isPrinted = printedOrderIds.has(o.id);
    const div = document.createElement('div');
    div.className = `item ${isPrinted ? 'printed' : ''}`;
    div.innerHTML = `
      <div class="checkbox-col">
        <input type="checkbox" data-id="${o.id}" ${isPrinted ? 'disabled' : ''} />
      </div>
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <b>${escapeHtml(o.id)}</b>
          ${isPrinted 
            ? '<span class="badge badge-printed">✓ พิมพ์แล้ว</span>' 
            : '<span class="badge badge-new">รอพิมพ์</span>'}
        </div>
        <div class="meta">${escapeHtml(o.url)}</div>
        ${!isPrinted ? `
          <button class="btn-print" data-url="${escapeHtml(o.url)}" data-id="${escapeHtml(o.id)}" 
                  style="margin-top:6px;padding:4px 8px;font-size:11px;">
            🖨 พิมพ์
          </button>
        ` : ''}
      </div>
    `;
    listEl.appendChild(div);
  }
  
  // Add print button listeners
  listEl.querySelectorAll('.btn-print').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const url = e.target.dataset.url;
      const id = e.target.dataset.id;
      await printOrder(url, id);
    });
  });
}

function renderEmptyState() {
  if (!listEl) return;
  listEl.innerHTML = `
    <div class="empty-state">
      <div style="font-size:32px;margin-bottom:8px;">📋</div>
      <div>ไม่พบคำสั่งซื้อวันนี้</div>
      <div style="font-size:11px;margin-top:4px;">เปิดหน้า Grab Merchant Dashboard แล้วกด "Scan Orders"</div>
    </div>
  `;
}

async function printOrder(url, orderId) {
  try {
    showError('');
    showOk('กำลังเปิดหน้าต่างพิมพ์...');
    
    // Extract order details
    const jobResp = await chrome.runtime.sendMessage({ type: 'OPEN_BG_AND_EXTRACT', url });
    if (jobResp?.ok === false) throw new Error(jobResp?.error || 'extract_failed');
    
    // Set pending order for print preview
    await chrome.runtime.sendMessage({ type: 'SET_PENDING_ORDER', order: jobResp.job });
    
    // Mark as printed
    await savePrintedOrder(orderId, jobResp.job);
    printedOrderIds.add(orderId);
    
    // Open print preview
    const orderData = encodeURIComponent(btoa(JSON.stringify(jobResp.job)));
    const printUrl = `print-preview.html?order=${orderData}`;
    
    await chrome.tabs.create({ url: printUrl, active: true });
    
    // Refresh list
    updateStats();
    await renderList();
    
    showOk('พิมพ์สำเร็จ!');
  } catch (e) {
    showError('เกิดข้อผิดพลาด: ' + (e?.message || e));
  }
}

async function printAllUnprinted() {
  const checks = Array.from(listEl.querySelectorAll('input[type=checkbox]:not(:disabled):checked'));
  const selectedIds = new Set(checks.map(c => c.getAttribute('data-id')));
  const selected = orders.filter(o => selectedIds.has(o.id) && !printedOrderIds.has(o.id));
  
  if (selected.length === 0) {
    showError('เลือกคำสั่งซื้อที่ต้องการพิมพ์ก่อน');
    return;
  }
  
  let success = 0, fail = 0;
  
  for (const o of selected) {
    try {
      await printOrder(o.url, o.id);
      success++;
      await sleep(500); // Small delay between prints
    } catch (e) {
      fail++;
    }
  }
  
  showOk(`พิมพ์เสร็จ: ${success} รายการ${fail > 0 ? `, ล้มเหลว: ${fail}` : ''}`);
}

function startPolling() {
  // Listen for new orders from content script
  chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    if (msg?.type === 'NEW_ORDERS_DETECTED') {
      showOk(`📦 มีคำสั่งซื้อใหม่ ${msg.count} รายการ!`);
      scan(); // Refresh list
    }
    return false;
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function showError(msg) {
  if (errEl) errEl.textContent = msg || '';
}

function showOk(msg) {
  if (okEl) okEl.textContent = msg || '';
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
