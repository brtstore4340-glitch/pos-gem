/**
 * Grab Print - Print Template Module
 * Renders thermal printer template for order printing
 */

// Format price in Thai Baht
export function formatPrice(price) {
  if (typeof price !== 'number') return '฿0.00';
  return `฿${price.toFixed(2)}`;
}

// Format date for Thai locale
export function formatDate(date) {
  if (!(date instanceof Date)) date = new Date(date);
  return date.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// Format time for Thai locale
export function formatTime(date) {
  if (!(date instanceof Date)) date = new Date(date);
  return date.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Render a single item row
export function renderItem(item) {
  const modifiers = item.modifiers || [];
  let html = `
    <div class="item">
      <span class="qty-col">${item.qty || 1}</span>
      <span class="item-col">${escapeHtml(item.name || 'สินค้า')}</span>
      <span class="price-col">${formatPrice(item.price || 0)}</span>
    </div>
  `;
  
  if (modifiers.length > 0) {
    html += `
      <div class="item-modifiers">
        ${modifiers.map(m => `• ${escapeHtml(m)}`).join('<br>')}
      </div>
    `;
  }
  
  return html;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Render all items
export function renderItems(items) {
  if (!items || items.length === 0) {
    return '<div class="empty-items">ไม่พบรายการสินค้า</div>';
  }
  
  return items.map(item => renderItem(item)).join('');
}

// Render complete order template
export function renderOrder(order, settings = {}) {
  const now = new Date();
  const storeName = settings.storeName || 'ร้านของฉัน';
  
  // Calculate totals
  const subtotal = (order.items || []).reduce((sum, item) => sum + (item.price * (item.qty || 1)), 0);
  const deliveryFee = order.deliveryFee || 0;
  const serviceFee = order.serviceFee || 0;
  const total = order.total || subtotal + deliveryFee + serviceFee;
  
  return {
    storeName: escapeHtml(storeName),
    orderNumber: order.id || order.bookingCode || '-',
    orderDate: order.orderDateStr || formatDate(now),
    orderTime: order.orderTimeStr || formatTime(now),
    driverName: escapeHtml(order.driverName || '-'),
    driverPhone: order.driverPhone || '-',
    itemsHtml: renderItems(order.items),
    subtotal: formatPrice(subtotal),
    deliveryFee: formatPrice(deliveryFee),
    serviceFee: formatPrice(serviceFee),
    totalAmount: formatPrice(total),
    customerNote: escapeHtml(order.customerNote || ''),
    printTime: formatDate(now) + ' ' + formatTime(now)
  };
}

// Apply rendered order to DOM
export function applyToDOM(order, settings = {}) {
  const rendered = renderOrder(order, settings);
  
  // Set values
  document.getElementById('storeName').textContent = rendered.storeName;
  document.getElementById('orderNumber').textContent = rendered.orderNumber;
  document.getElementById('orderDate').textContent = rendered.orderDate;
  document.getElementById('orderTime').textContent = rendered.orderTime;
  document.getElementById('driverName').textContent = rendered.driverName;
  document.getElementById('driverPhone').textContent = rendered.driverPhone;
  document.getElementById('itemsList').innerHTML = rendered.itemsHtml;
  document.getElementById('subtotal').textContent = rendered.subtotal;
  document.getElementById('deliveryFee').textContent = rendered.deliveryFee;
  document.getElementById('serviceFee').textContent = rendered.serviceFee;
  document.getElementById('totalAmount').textContent = rendered.totalAmount;
  document.getElementById('printTime').textContent = rendered.printTime;
  
  // Handle customer note
  const noteSection = document.getElementById('customerNoteSection');
  const noteText = document.getElementById('customerNote');
  if (order.customerNote) {
    noteSection.style.display = 'block';
    noteText.textContent = order.customerNote;
  } else {
    noteSection.style.display = 'none';
  }
  
  // Update printer width class
  const thermalPrint = document.getElementById('thermalPrint');
  thermalPrint.className = `thermal-print printer-width-${(settings.printerWidth || '58mm').replace('mm', '')}`;
}
