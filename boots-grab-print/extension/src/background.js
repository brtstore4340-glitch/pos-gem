/**
 * Grab Print - Background Service Worker
 * Handles alarms, notifications, and message routing
 */

import { getSettings } from './storage.js';

// Constants
const POLL_ALARM_NAME = 'grab-print-poll';
const DEFAULT_POLL_INTERVAL = 15; // seconds

// Pending order storage
let pendingOrder = null;

// Helper functions
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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

// Show browser notification
async function showNotification(orderId, title, message) {
  const settings = await getSettings();
  
  if (!settings.enableNotifications) {
    console.log('Notifications disabled, skipping:', title);
    return;
  }

  try {
    await chrome.notifications.create(`grab-print-${orderId}-${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: title || 'GRAB PRINT',
      message: message || `Order: ${orderId}`,
      priority: 2,
      requireInteraction: true
    });
  } catch (e) {
    console.error('Failed to show notification:', e);
  }
}

// Schedule polling alarm
async function schedulePollAlarm() {
  const settings = await getSettings();
  const interval = (settings.pollingInterval || DEFAULT_POLL_INTERVAL) * 1000;
  
  await chrome.alarms.create(POLL_ALARM_NAME, {
    periodInMinutes: interval / 60000,
    delayInMinutes: interval / 60000
  });
  
  console.log(`Poll alarm scheduled for every ${interval / 1000} seconds`);
}

// Clear polling alarm
async function clearPollAlarm() {
  await chrome.alarms.clear(POLL_ALARM_NAME);
  console.log('Poll alarm cleared');
}

// Check for new orders
async function checkForNewOrders() {
  try {
    const tabs = await chrome.tabs.query({
      url: ['*://merchant.grab.com/*', '*://*.grab.com/*'],
      active: true
    });

    if (tabs.length === 0) {
      console.log('No Grab merchant tab active');
      return;
    }

    const tab = tabs[0];
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GRAB_GET_ORDER_COUNT' });
    
    if (response?.ok && response.count > 0) {
      // Notify about potential new orders
      await showNotification(
        'new',
        '📦 New Grab Orders',
        `You have ${response.count} order(s) on Grab Merchant Dashboard`
      );
    }
  } catch (e) {
    console.error('Failed to check for new orders:', e);
  }
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
        case 'OPEN_BG_AND_EXTRACT':
          const url = (msg.url || '').toString();
          if (!url) throw new Error('missing_url');

          const tab = await chrome.tabs.create({ url, active: false });
          if (!tab?.id) throw new Error('tab_create_failed');

          try {
            await waitTabComplete(tab.id, 15000);
            await sleep(600);
            const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GRAB_EXTRACT_DETAIL' });
            if (!resp?.job) throw new Error(resp?.error || 'extract_failed');
            sendResponse({ ok: true, job: resp.job });
          } finally {
            try {
              await chrome.tabs.remove(tab.id);
            } catch {
              console.warn('Ignored error removing tab');
            }
          }
          return;

        case 'START_POLLING':
          await schedulePollAlarm();
          // Also start content script observer
          const tabs = await chrome.tabs.query({
            url: ['*://merchant.grab.com/*', '*://*.grab.com/*']
          });
          for (const t of tabs) {
            try {
              await chrome.tabs.sendMessage(t.id, { type: 'GRAB_START_OBSERVER' });
            } catch (e) {
              console.warn('Failed to start observer on tab:', t.id);
            }
          }
          sendResponse({ ok: true, message: 'polling_started' });
          return;

        case 'STOP_POLLING':
          await clearPollAlarm();
          // Stop content script observers
          const allTabs = await chrome.tabs.query({
            url: ['*://merchant.grab.com/*', '*://*.grab.com/*']
          });
          for (const t of allTabs) {
            try {
              await chrome.tabs.sendMessage(t.id, { type: 'GRAB_STOP_OBSERVER' });
            } catch (e) {
              console.warn('Failed to stop observer on tab:', t.id);
            }
          }
          sendResponse({ ok: true, message: 'polling_stopped' });
          return;

        case 'SHOW_NOTIFICATION':
          await showNotification(msg.orderId, msg.title, msg.message);
          sendResponse({ ok: true, message: 'notification_shown' });
          return;

        case 'SET_PENDING_ORDER':
          pendingOrder = msg.order;
          sendResponse({ ok: true, message: 'pending_order_set' });
          return;

        case 'GET_PENDING_ORDER':
          const order = pendingOrder;
          pendingOrder = null; // Clear after retrieval
          sendResponse({ ok: true, order: order });
          return;

        case 'ORDER_PRINTED':
          // Notification that an order was printed
          console.log('Order printed:', msg.orderId);
          sendResponse({ ok: true, message: 'order_printed_recorded' });
          return;

        default:
          sendResponse({ ok: false, error: 'unknown_message_type' });
          return;
      }
    } catch (e) {
      try {
        sendResponse({ ok: false, error: String(e?.message || e) });
      } catch (ignoreError) {
        console.error('Failed to send error response:', ignoreError);
      }
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

// Alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM_NAME) {
    checkForNewOrders();
  }
});

// Installation listener
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('Extension installed, setting up defaults...');
    // Schedule default poll alarm
    await schedulePollAlarm();
  }
});

// Notification click listener
chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (notificationId.startsWith('grab-print-')) {
    // Open Grab merchant dashboard
    const tabs = await chrome.tabs.query({
      url: ['*://merchant.grab.com/*', '*://*.grab.com/*']
    });
    
    if (tabs.length > 0) {
      await chrome.tabs.update(tabs[0].id, { active: true });
    } else {
      await chrome.tabs.create({ url: 'https://merchant.grab.com' });
    }
    
    // Clear the notification
    await chrome.notifications.clear(notificationId);
  }
});
