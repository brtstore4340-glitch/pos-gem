const KEY = "boots_pos_orders_v1";

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export const posOrderService = {
  async createOrder(order) {
    const all = readAll();
    const now = new Date();
    const id = "ord_" + now.getTime();
    const record = { id, ...order, createdAt: now.toISOString() };
    all.unshift(record);
    writeAll(all);
    return record;
  },

  async listOrders({ limit = 20 } = {}) {
    const all = readAll();
    return all.slice(0, limit);
  }
};
