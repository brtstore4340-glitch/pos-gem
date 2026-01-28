export const settingsService = {
  async getStoreSettings(storeId) {
    return { storeId, timezone: "Asia/Bangkok" };
  },
  async updateStoreSettings(storeId, patch) {
    return { ok: true, storeId, patch };
  }
};
