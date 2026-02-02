/**
 * Grab Print - Content Script
 * Handles DOM observation for new order detection and order data extraction
 */

// Utility functions
function uniq(arr) {
  const s = new Set();
  const out = [];
  for (const x of arr) {
    if (!s.has(x)) {
      s.add(x);
      out.push(x);
    }
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Detect "New Order" elements in the DOM
function detectNewOrderElements() {
  // Look for common patterns indicating new orders
  const newOrderIndicators = [
    // Text-based indicators
    { selector: '*', text: /new order/i },
    { selector: '*', text: /คำสั่งซื้อใหม่/i },
    { selector: '*', text: /ใหม่/i },
    // Class-based indicators
    '[class*="new-order"]',
    '[class*="newOrder"]',
    '[class*="badge-new"]',
    '[class*="status-new"]',
    // Specific element types
    '.order-card.new',
    '.order-item.new',
    '[data-status="new"]',
    '[data-testid*="new"]'
  ];

  const elements = [];
  for (const indicator of newOrderIndicators) {
    if (typeof indicator === 'string') {
      const els = document.querySelectorAll(indicator);
      els.forEach((el) => elements.push(el));
    } else if (indicator.selector && indicator.text) {
      const els = document.querySelectorAll(indicator.selector);
      els.forEach((el) => {
        if (indicator.text.test(el.textContent || '')) {
          elements.push(el);
        }
      });
    }
  }
  return uniq(elements);
}

// Extract order IDs from the page
function extractOrderIds() {
  const orders = [];
  
  // Look for order links/elements
  const anchors = Array.from(document.querySelectorAll('a[href]'));
  const links = anchors
    .map((a) => a.getAttribute('href') || '')
    .filter((h) => /\/order\/[^/]+\/history/i.test(h));
  
  const abs = links
    .map((h) => {
      try {
        return new URL(h, location.origin).toString();
      } catch {
        return '';
      }
    })
    .filter(Boolean);
  
  uniq(abs)
    .slice(0, 100)
    .forEach((url) => {
      const m = url.match(/\/order\/([^/]+)\/history/);
      orders.push({
        id: m ? m[1] : url,
        url: url,
        timestamp: Date.now()
      });
    });

  return orders;
}

// Extract detailed order information from order detail page
function extractOrderDetails() {
  // This is a placeholder - actual extraction depends on Grab's DOM structure
  // Will need to be customized based on actual Grab merchant dashboard HTML
  
  const details = {
    id: '',
    bookingCode: '',
    shortGM: '',
    total: 0,
    totalQty: 0,
    driverName: '',
    driverPhone: '',
    orderDateStr: '',
    orderTimeStr: '',
    items: [],
    customerNote: '',
    sourceUrl: location.href,
    extractedAt: Date.now()
  };

  // Try to extract order ID from URL
  const urlMatch = location.href.match(/\/order\/([^/]+)/);
  if (urlMatch) {
    details.id = urlMatch[1];
  }

  // Look for booking code
  const bookingEl = document.querySelector('[class*="booking"], [class*="order-id"], [id*="booking"]');
  if (bookingEl) {
    details.bookingCode = bookingEl.textContent.trim();
  }

  // Look for total amount
  const totalEl = document.querySelector('[class*="total"], [class*="amount"], [class*="price"]');
  if (totalEl) {
    const text = totalEl.textContent.replace(/[^0-9.]/g, '');
    details.total = parseFloat(text) || 0;
  }

  // Look for driver info
  const driverEl = document.querySelector('[class*="driver"], [class*="rider"]');
  if (driverEl) {
    details.driverName = driverEl.textContent.trim();
  }

  // Look for phone number
  const phoneEl = document.querySelector('[class*="phone"], [class*="tel"]');
  if (phoneEl) {
    const phoneMatch = phoneEl.textContent.match(/0[0-9]{9,10}/);
    if (phoneMatch) {
      details.driverPhone = phoneMatch[0];
    }
  }

  // Look for order items
  const itemEls = document.querySelectorAll('[class*="item"], [class*="product"], [class*="menu"]');
  itemEls.forEach((el) => {
    const nameEl = el.querySelector('[class*="name"], [class*="title"]');
    const qtyEl = el.querySelector('[class*="qty"], [class*="quantity"]');
    const priceEl = el.querySelector('[class*="price"], [class*="cost"]');
    
    if (nameEl) {
      details.items.push({
        name: nameEl.textContent.trim(),
        qty: parseInt(qtyEl?.textContent || '1') || 1,
        price: parseFloat(priceEl?.textContent.replace(/[^0-9.]/g, '') || '0')
      });
    }
  });

  // Look for customer note
  const noteEl = document.querySelector('[class*="note"], [class*="remark"], [class*="comment"]');
  if (noteEl) {
    details.customerNote = noteEl.textContent.trim();
  }

  // Try to find date/time from page
  const dateEl = document.querySelector('[class*="date"], [class*="time"], [datetime]');
  if (dateEl) {
    const datetime = dateEl.getAttribute('datetime') || dateEl.textContent;
    const date = new Date(datetime);
    if (!isNaN(date.getTime())) {
      details.orderDateStr = date.toLocaleDateString('th-TH');
      details.orderTimeStr = date.toLocaleTimeString('th-TH');
    }
  }

  return details;
}

// Get list of orders from history page
function listOrderHistoryLinks() {
  return extractOrderIds();
}

// Check if page has new orders
function hasNewOrders() {
  const newElements = detectNewOrderElements();
  return newElements.length > 0;
}

// Get new order count
function getNewOrderCount() {
  const orders = listOrderHistoryLinks();
  return orders.length;
}

// DOM Observer for detecting new orders
let observer = null;
let lastKnownOrderCount = 0;

function startOrderObserver() {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver((mutations) => {
    const newOrders = hasNewOrders();
    const currentCount = getNewOrderCount();
    
    if (currentCount > lastKnownOrderCount) {
      // New orders detected
      lastKnownOrderCount = currentCount;
      notifyNewOrders(currentCount - lastKnownOrderCount);
    }
  });

  // Observe the entire document body
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  // Initial count
  lastKnownOrderCount = getNewOrderCount();
}

function stopOrderObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function notifyNewOrders(count) {
  chrome.runtime.sendMessage({
    type: 'NEW_ORDERS_DETECTED',
    count: count,
    timestamp: Date.now()
  });
}

// Message listener
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (!msg) {
        sendResponse({ ok: false, error: 'null_message' });
        return;
      }

      switch (msg.type) {
        case 'GRAB_LIST_ORDERS':
          sendResponse({ orders: listOrderHistoryLinks() });
          return;

        case 'GRAB_EXTRACT_DETAIL':
          sendResponse({
            ok: true,
            job: extractOrderDetails()
          });
          return;

        case 'GRAB_CHECK_NEW_ORDERS':
          const orders = listOrderHistoryLinks();
          sendResponse({
            ok: true,
            count: orders.length,
            hasNew: orders.length > lastKnownOrderCount
          });
          return;

        case 'GRAB_START_OBSERVER':
          startOrderObserver();
          sendResponse({ ok: true, message: 'observer_started' });
          return;

        case 'GRAB_STOP_OBSERVER':
          stopOrderObserver();
          sendResponse({ ok: true, message: 'observer_stopped' });
          return;

        case 'GRAB_GET_ORDER_COUNT':
          sendResponse({
            ok: true,
            count: getNewOrderCount()
          });
          return;

        default:
          sendResponse({ ok: false, error: 'unknown_message_type' });
          return;
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })().catch((e) => {
    try {
      sendResponse({ ok: false, error: String(e?.message || e) });
    } catch (ignoreError) {
      console.error('Failed to send error response:', ignoreError);
    }
  });
  return true;
});

// Auto-start observer when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(startOrderObserver, 2000);
  });
} else {
  setTimeout(startOrderObserver, 2000);
}
