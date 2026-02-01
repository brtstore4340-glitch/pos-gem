/**
 * Lint-safe helpers & element bindings (added by fix script)
 */
const $ = (sel) => document.querySelector(sel);

function ok(msg) {
  const el = $("#statusOk");
  if (el) el.textContent = msg || "OK";
  const er = $("#statusErr");
  if (er) er.textContent = "";
}

function err(msg) {
  const el = $("#statusErr");
  if (el) el.textContent = msg || "Error";
  const okEl = $("#statusOk");
  if (okEl) okEl.textContent = "";
}

// Buttons commonly used in popup.html
const btnScan = $("#btnScan");
const btnIngestSel = $("#btnIngestSel");

function openOptions() {
  if (chrome?.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage();
    return;
  }
  // fallback
  const url = chrome?.runtime?.getURL ? chrome.runtime.getURL("options.html") : "options.html";
  window.open(url, "_blank");
}
/* global chrome */import { getSettings } from './storage.js';
const _$ = (id) => document.getElementById(id);

function renderList(orders) {
  const list = $('list');
  list.innerHTML = '';
  for (const o of orders) {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <input type="checkbox" data-id="${o.id}" />
      <div style="flex:1;">
        <div><b>${o.id}</b></div>
        <div class="meta">${o.url}</div>
      </div>
    `;
    list.appendChild(div);
  }
  if (!orders.length) {
    list.innerHTML = '<div class="meta">ไม่พบลิงก์ /order/{id}/history ในหน้า (ลองเปิดหน้า Orders ก่อน)</div>';
  }
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('no_active_tab');
  return tab;
}

async function scan() {
  err.textContent = '';
  ok.textContent = '';
  const tab = await activeTab();
  const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GRAB_LIST_ORDERS' });
  const orders = resp?.orders || [];
  renderList(orders);
  ok.textContent = `Found ${orders.length} orders.`;
}

async function ingestSelected() {
  err.textContent = '';
  ok.textContent = '';
  const s = await getSettings();
  if (!s.branchId || !s.token || !s.baseUrl) throw new Error('missing_settings_open_settings');

  const tab = await activeTab();
  const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GRAB_LIST_ORDERS' });
  const orders = resp?.orders || [];

  const checks = Array.from(document.querySelectorAll('input[type=checkbox][data-id]'));
  const selectedIds = new Set(checks.filter(c => c.checked).map(c => c.getAttribute('data-id')));
  const selected = orders.filter(o => selectedIds.has(o.id));
  if (!selected.length) throw new Error('no_selection');

  let okCount = 0, failCount = 0;

  for (const o of selected) {
    try {
      const jobResp = await chrome.runtime.sendMessage({ type: 'OPEN_BG_AND_EXTRACT', url: o.url });
      if (jobResp?.ok === false) throw new Error(jobResp?.error || 'extract_failed');

      const r = await fetch(`${s.baseUrl}/api/jobs/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: s.token, branchId: s.branchId, job: jobResp })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'http_error');
      okCount++;
    } catch {
      failCount++;
    }
  }

  ok.textContent = `Ingest done. ok=${okCount} fail=${failCount}`;
}
if (btnScan) btnScan.addEventListener('click', () => scan().catch(e => err.textContent = String(e?.message || e)));
if (btnIngestSel) btnIngestSel.addEventListener('click', () => ingestSelected().catch(e => err.textContent = String(e?.message || e)));
openOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());

