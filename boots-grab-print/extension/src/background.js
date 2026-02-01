/* global chrome */
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function waitTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpd);
      reject(new Error('timeout'));
    }, timeoutMs);

    function onUpd(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(t);
        chrome.tabs.onUpdated.removeListener(onUpd);
        resolve(true);
      }
    }
    chrome.tabs.onUpdated.addListener(onUpd);
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type !== 'OPEN_BG_AND_EXTRACT') {
      return sendResponse({ ok: false, error: 'unknown_message_type' });
    }
    
    const url = (msg.url || '').toString();
    if (!url) throw new Error('missing_url');

    const tab = await chrome.tabs.create({ url, active: false });
    if (!tab?.id) throw new Error('tab_create_failed');

    try {
      await waitTabComplete(tab.id, 15000);
      await sleep(600);
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GRAB_EXTRACT_DETAIL' });
      if (!resp?.job) throw new Error(resp?.error || 'extract_failed');
      sendResponse(resp.job);
    } finally {
      try { await chrome.tabs.remove(tab.id); } catch { console.warn("Ignored error in background script"); }
    }
  })().catch(e => {
    try {
      sendResponse({ ok: false, error: String(e?.message || e) });
    } catch (ignoreError) {
      console.error('Failed to send error response:', ignoreError);
    }
  });
  return true;
});

