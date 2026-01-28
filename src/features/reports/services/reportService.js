export const reportService = {
  async getDailyReport({ storeId, date } = {}) {
    // TODO: aggregate orders; likely Cloud Function
    return { ok: true, storeId, date, totals: { sales: 0, orders: 0 } };
  }
};
