export async function getSettings() {
  const s = await chrome.storage.sync.get(['branchId', 'token', 'baseUrl']);
  return {
    branchId: (s.branchId || '').toString(),
    token: (s.token || '').toString(),
    baseUrl: (s.baseUrl || '').toString()
  };
}

export async function setSettings(v) {
  await chrome.storage.sync.set({
    branchId: (v.branchId || '').toString().trim(),
    token: (v.token || '').toString(),
    baseUrl: (v.baseUrl || '').toString().replace(/\/+$/,'')
  });
}
