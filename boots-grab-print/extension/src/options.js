/* global chrome */
/**
 * Grab Print - Options Script
 * Handles settings page interactions
 */

import { getSettings, setSettings } from './storage.js';

// DOM Elements
const $ = (sel) => document.querySelector(sel);
const errEl = $('#err');
const okEl = $('#ok');
const btnSave = $('#save');

// Fields
const fBranchId = $('#branchId');
const fToken = $('#token');
const fBaseUrl = $('#baseUrl');
const fPollingInterval = $('#pollingInterval');
const fEnableNotifications = $('#enableNotifications');
const fStoreName = $('#storeName');
const fPrinterWidth = $('#printerWidth');
const fAutoPrint = $('#autoPrint');

// Initialize
async function init() {
  // Load settings
  await loadSettings();
  
  // Set up save button
  if (btnSave) {
    btnSave.addEventListener('click', saveSettings);
  }
  
  // Enter key to save
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'Enter') {
        saveSettings();
      }
    }
  });
}

async function loadSettings() {
  try {
    const settings = await getSettings();
    
    if (fBranchId) fBranchId.value = settings.branchId || '';
    if (fToken) fToken.value = settings.token || '';
    if (fBaseUrl) fBaseUrl.value = settings.baseUrl || '';
    if (fPollingInterval) fPollingInterval.value = settings.pollingInterval || 15;
    if (fEnableNotifications) fEnableNotifications.checked = settings.enableNotifications;
    if (fStoreName) fStoreName.value = settings.storeName || '';
    if (fPrinterWidth) fPrinterWidth.value = settings.printerWidth || '58mm';
    if (fAutoPrint) fAutoPrint.checked = settings.autoPrint;
    
  } catch (e) {
    showError('ไม่สามารถโหลดการตั้งค่า: ' + e.message);
  }
}

async function saveSettings() {
  try {
    showError('');
    showOk('');
    
    const pollingInterval = parseInt(fPollingInterval?.value) || 15;
    if (pollingInterval < 5 || pollingInterval > 60) {
      throw new Error('ช่วงเวลาต้องอยู่ระหว่าง 5-60 วินาที');
    }
    
    await setSettings({
      branchId: fBranchId?.value || '',
      token: fToken?.value || '',
      baseUrl: fBaseUrl?.value || '',
      pollingInterval: pollingInterval,
      enableNotifications: fEnableNotifications?.checked ?? true,
      storeName: fStoreName?.value || '',
      printerWidth: fPrinterWidth?.value || '58mm',
      autoPrint: fAutoPrint?.checked ?? false
    });
    
    showOk('✅ บันทึกสำเร็จ!');
    
    // Restart polling if enabled
    try {
      await chrome.runtime.sendMessage({ type: 'START_POLLING' });
    } catch (e) {
      // Extension context invalidated, ignore
    }
    
  } catch (e) {
    showError('เกิดข้อผิดพลาด: ' + (e?.message || e));
  }
}

function showError(msg) {
  if (errEl) errEl.textContent = msg || '';
}

function showOk(msg) {
  if (okEl) okEl.textContent = msg || '';
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
