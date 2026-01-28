/**
 * Options page script (Chrome Extension)
 * - Lint-safe: no undefined globals, no empty blocks, no unused vars.
 * - Robust: works even if some DOM nodes are missing.
 */

const qs = (sel) => document.querySelector(sel);

const branchIdEl = qs("#branchId");
const tokenEl = qs("#token");
const baseUrlEl = qs("#baseUrl");

const saveBtn = qs("#btnSave");
const statusOkEl = qs("#statusOk");
const statusErrEl = qs("#statusErr");

function setText(el, text) {
  if (!el) return;
  el.textContent = text || "";
}

function showOk(msg) {
  setText(statusOkEl, msg);
  setText(statusErrEl, "");
}

function showErr(msg) {
  setText(statusErrEl, msg);
  setText(statusOkEl, "");
}

function readForm() {
  return {
    branchId: branchIdEl ? String(branchIdEl.value || "").trim() : "",
    token: tokenEl ? String(tokenEl.value || "").trim() : "",
    baseUrl: baseUrlEl ? String(baseUrlEl.value || "").trim() : "",
  };
}

function validate(values) {
  if (!values.branchId) return "Branch ID is required.";
  if (!values.token) return "Token is required.";
  if (!values.baseUrl) return "Base URL is required.";
  try {
    // Ensure valid absolute URL
     
    new URL(values.baseUrl);
  } catch {
    return "Base URL must be a valid URL (e.g. https://example.com).";
  }
  return null;
}

async function loadOptions() {
  try {
    const data = await chrome.storage.sync.get(["branchId", "token", "baseUrl"]);
    const branchId = data.branchId || "";
    const token = data.token || "";
    const baseUrl = data.baseUrl || "";

    if (branchIdEl) branchIdEl.value = branchId;
    if (tokenEl) tokenEl.value = token;
    if (baseUrlEl) baseUrlEl.value = baseUrl;

    showOk("Loaded.");
  } catch (e) {
    showErr(e?.message || String(e));
  }
}

async function saveOptions() {
  try {
    const values = readForm();
    const errMsg = validate(values);
    if (errMsg) {
      showErr(errMsg);
      return;
    }

    await chrome.storage.sync.set(values);
    showOk("Saved.");
  } catch (e) {
    showErr(e?.message || String(e));
  }
}

function wireEvents() {
  if (saveBtn) {
    saveBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      void saveOptions();
    });
  }

  // Optional: Ctrl/Cmd+S to save
  document.addEventListener("keydown", (ev) => {
    const isSaveCombo = (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s";
    if (!isSaveCombo) return;
    ev.preventDefault();
    void saveOptions();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireEvents();
  void loadOptions();
});

