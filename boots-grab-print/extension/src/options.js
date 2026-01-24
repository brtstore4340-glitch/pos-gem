import { getSettings, setSettings } from './storage.js';
const $ = (id) => document.getElementById(id);

(async function init(){
  const s = await getSettings();
  branchId.value = s.branchId;
  token.value = s.token;
  baseUrl.value = s.baseUrl;

  save.addEventListener('click', async () => {
    ok.textContent = '';
    err.textContent = '';
    try {
      const branchId = branchId.value.trim();
      const token = token.value;
      const baseUrl = baseUrl.value.trim().replace(/\/+$/,'');
      if (!branchId) throw new Error('missing_branchId');
      if (!token) throw new Error('missing_token');
      if (!baseUrl) throw new Error('missing_baseUrl');
      await setSettings({ branchId, token, baseUrl });
      ok.textContent = 'Saved.';
    } catch (e) {
      err.textContent = String(e?.message || e);
    }
  });
})();
