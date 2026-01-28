function uniq(arr) {
var s = new Set(); const out = [];
  for (const x of arr) { if (!s.has(x)) { s.add(x); out.push(x); } }
  return out;
}

function listOrderHistoryLinks() {
var anchors = Array.from(document.querySelectorAll('a[href]'));
var links = anchors
    .map(a => a.getAttribute('href') || '')
    .filter(h => //order/.+/history/.test(h));
var abs = links.map(h => {
    try { return new URL(h, location.origin).toString(); } catch { return ''; }
  }).filter(Boolean);
var orders = uniq(abs).slice(0, 80).map(url => {
var m = url.match(//order/([^/]+)/history/);
    return { id: m ? m[1] : url, url };
  });

  return orders;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (!msg) {
        sendResponse({ ok: false, error: 'null_message' });
        return;
      }

      if (msg?.type === 'GRAB_LIST_ORDERS') {
        sendResponse({ orders: listOrderHistoryLinks() });
        return;
      }
      if (msg?.type === 'GRAB_EXTRACT_DETAIL') {
        // MVP: minimal payload to prove pipeline; refine DOM extraction later
        sendResponse({
          job: {
            source: 'grab',
            shortGM: '',
            bookingCode: '',
            total: '',
            totalQty: 0,
            driverName: '',
            driverPhone: '',
            orderDateStr: '',
            orderTimeStr: '',
            items: [],
            sourceUrl: location.href
          }
        });
        return;
      }
      sendResponse({ ok: false, error: 'unknown_message_type' });
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
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

