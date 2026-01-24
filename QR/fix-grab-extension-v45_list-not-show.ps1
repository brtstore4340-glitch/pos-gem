Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

trap {
  try {
    $msg = $_ | Out-String
    Write-Host "[FATAL] $msg" -ForegroundColor Red
  } catch {}
  exit 1
}

function New-Dir([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $dir = Split-Path -Parent $Path
  if ($dir) { New-Dir $dir }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Copy-Dir([string]$Src, [string]$Dst) {
  New-Dir $Dst
  robocopy $Src $Dst /MIR /R:1 /W:1 /NFL /NDL /NP | Out-Null
}

function Write-Log([string]$LogPath, [string]$Level, [string]$Message) {
  $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
  $line = "[$ts][$Level] $Message"
  Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
  if ($Level -eq "FAIL" -or $Level -eq "FATAL") {
    Write-Host $line -ForegroundColor Red
  } elseif ($Level -eq "WARN") {
    Write-Host $line -ForegroundColor Yellow
  } else {
    Write-Host $line -ForegroundColor Gray
  }
}

# ========= CONFIG =========
$ExtRoot = "C:\Users\4340s\OneDrive - Walgreen National Corporation-8489925-Boots Thailand\Desktop\GrabPrinterExtensionOne"
$ToolsDir = Join-Path $ExtRoot "tools"
$LogsDir  = Join-Path $ToolsDir "logs"
New-Dir $LogsDir

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$LogPath = Join-Path $LogsDir "grab_ext_fix_v45_$stamp.log"

Write-Log $LogPath "INFO" "Extension root: $ExtRoot"

if (-not (Test-Path -LiteralPath $ExtRoot)) {
  Write-Log $LogPath "FAIL" "Path not found: $ExtRoot"
  exit 2
}

# ========= BACKUP =========
$BackupDir = Join-Path $ToolsDir ("backup_" + $stamp)
New-Dir $ToolsDir

Write-Log $LogPath "INFO" "Creating backup => $BackupDir"
Copy-Dir $ExtRoot $BackupDir

$lastBackupTxt = Join-Path $ToolsDir "LAST_BACKUP_DIR.txt"
Write-Utf8NoBom $lastBackupTxt $BackupDir
Write-Log $LogPath "PASS" "Backup created + updated tools/LAST_BACKUP_DIR.txt"

# ========= PATCH FILES =========
$ManifestPath = Join-Path $ExtRoot "manifest.json"
$PopupHtmlPath = Join-Path $ExtRoot "popup.html"
$PopupJsPath = Join-Path $ExtRoot "popup.js"
$BgPath = Join-Path $ExtRoot "background.js"

# --- manifest.json (MV3) ---
$manifest = @'
{
  "manifest_version": 3,
  "name": "Grab Printer Extension (v45 Fixed)",
  "version": "45.0.2",
  "description": "Select orders on Grab Merchant Orders page then print labels.",
  "action": {
    "default_title": "Grab Printer",
    "default_popup": "popup.html"
  },
  "permissions": [
    "activeTab",
    "scripting",
    "tabs",
    "storage"
  ],
  "host_permissions": [
    "https://merchant.grab.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  }
}
'@

# --- popup.html ---
$popupHtml = @'
<!doctype html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Grab Printer</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 10px; width: 360px; }
    .row { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
    button { cursor:pointer; padding:8px 10px; border-radius:10px; border:1px solid #ddd; background:#fff; }
    button:hover { background:#f7f7f7; }
    input[type="text"] { flex:1; padding:8px 10px; border-radius:10px; border:1px solid #ddd; }
    table { width:100%; border-collapse: collapse; margin-top:8px; }
    th, td { border-bottom:1px solid #eee; padding:6px; font-size:12px; vertical-align: top; }
    th { text-align:left; font-weight:700; }
    .muted { opacity:.7; font-size:11px; }
    .status { margin-top:8px; font-size:12px; }
    .pill { display:inline-block; padding:2px 6px; border-radius:999px; border:1px solid #eee; background:#fafafa; font-size:11px; }
  </style>
</head>
<body>
  <div class="row">
    <input id="search" type="text" placeholder="ค้นหา GM / Order ID" />
    <button id="refresh">ดึงออเดอร์</button>
  </div>

  <div class="row">
    <button id="selectAll">เลือกทั้งหมด</button>
    <button id="clearSel">ล้างเลือก</button>
    <button id="printSel">พิมพ์ที่เลือก</button>
  </div>

  <div class="muted">
    ✅ เปิดหน้า Grab Merchant &gt; Orders ก่อน แล้วค่อยกด “ดึงออเดอร์”
    <div style="margin-top:4px"><span class="pill">วิธีดึง: จากลิงก์ /order/.../history</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:26px;"></th>
        <th>Order</th>
        <th style="width:70px;">Link</th>
      </tr>
    </thead>
    <tbody id="tbody"></tbody>
  </table>

  <div id="status" class="status"></div>

  <script src="popup.js"></script>
</body>
</html>
'@

# --- popup.js ---
# NOTE: แก้ให้ดึงจาก <a href="/order/.../history"> เป็นหลัก + fallback regex
$popupJs = @'
const els = {
  search: document.getElementById("search"),
  refresh: document.getElementById("refresh"),
  selectAll: document.getElementById("selectAll"),
  clearSel: document.getElementById("clearSel"),
  printSel: document.getElementById("printSel"),
  tbody: document.getElementById("tbody"),
  status: document.getElementById("status"),
};

let orders = [];
let filtered = [];
const selected = new Set();

function setStatus(msg) {
  els.status.textContent = msg || "";
}

function escapeHtml(s) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(s) {
  return (s || "").toLowerCase().replace(/\s+/g, "").trim();
}

function render() {
  els.tbody.innerHTML = "";
  const q = normalize(els.search.value);

  filtered = orders.filter(o => {
    if (!q) return true;
    return normalize(o.id).includes(q) || normalize(o.short || "").includes(q);
  });

  if (!filtered.length) {
    els.tbody.innerHTML = `<tr><td colspan="3" class="muted">-- ไม่พบออเดอร์ --</td></tr>`;
    setStatus(`0 รายการ`);
    return;
  }

  for (const o of filtered) {
    const checked = selected.has(o.id) ? "checked" : "";
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><input type="checkbox" data-id="${escapeHtml(o.id)}" ${checked}></td>
      <td>
        <div style="font-weight:700">${escapeHtml(o.short || o.id)}</div>
        <div class="muted">${escapeHtml(o.id)}</div>
      </td>
      <td>
        <a href="#" data-open="${escapeHtml(o.url)}">open</a>
      </td>
    `;
    els.tbody.appendChild(tr);
  }

  // checkbox handlers
  els.tbody.querySelectorAll('input[type="checkbox"][data-id]').forEach(cb => {
    cb.addEventListener("change", () => {
      const id = cb.getAttribute("data-id");
      if (cb.checked) selected.add(id);
      else selected.delete(id);
      setStatus(`${selected.size} เลือกอยู่ / ${filtered.length} รายการ`);
    });
  });

  // open link handlers
  els.tbody.querySelectorAll('a[data-open]').forEach(a => {
    a.addEventListener("click", async (e) => {
      e.preventDefault();
      const url = a.getAttribute("data-open");
      if (!url) return;
      await chrome.tabs.create({ url });
    });
  });

  setStatus(`${selected.size} เลือกอยู่ / ${filtered.length} รายการ`);
}

async function getActiveTab() {
  let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs.length ? tabs[0] : null;
}

// ========== Extract Orders from current Grab page (Orders list) ==========
// Strategy:
// 1) Prefer anchor href: /order/<id>/history (most stable)
// 2) Fallback: find any /order/<id> links and normalize to /history
// 3) Fallback regex on body innerText: 3-XXXXXXXXXXXXXXX patterns
function extractOrdersList() {
  const makeAbs = (href) => {
    try { return new URL(href, location.origin).href; } catch { return href; }
  };

  const uniq = new Map();

  // (1) /history links
  const anchors = Array.from(document.querySelectorAll('a[href*="/order/"]'));
  for (const a of anchors) {
    const href = a.getAttribute("href") || "";
    if (!href.includes("/order/")) continue;

    const abs = makeAbs(href);
    const m = abs.match(/\/order\/([^\/\?#]+)(\/history)?/i);
    if (!m) continue;

    const id = m[1];
    // normalize to history page
    const url = abs.includes("/history") ? abs : abs.replace(/\/order\/([^\/\?#]+)/i, "/order/$1/history");

    // best-effort short code (GM-xxxx) from surrounding card text
    let short = "";
    try {
      const cardText = (a.closest("section,article,div")?.innerText || "").trim();
      const gm = cardText.match(/GM[- ]?(\d{3,})/i);
      if (gm) short = "GM-" + gm[1];
    } catch {}

    if (!uniq.has(id)) {
      uniq.set(id, { id, url, short });
    }
  }

  // (2) fallback regex from innerText
  if (uniq.size === 0) {
    const t = document.body?.innerText || "";
    const ids = Array.from(new Set((t.match(/3-[A-Z0-9]{10,}/g) || [])));
    for (const id of ids) {
      const url = `${location.origin}/order/${id}/history`;
      uniq.set(id, { id, url, short: id });
    }
  }

  return Array.from(uniq.values()).slice(0, 200);
}

// ========== Print Injection (use existing extractor if needed) ==========
// Minimal: open each selected order URL then inject user-defined extractAndPrint if exists in page.
// Here we inject a simplified print script which opens print dialog after extracting.
function injectExtractAndPrint() {
  // NOTE: this function is executed INSIDE order history page context.
  // If user already has good extractAndPrint in clipboard, we can keep it in this injected block later.
  // For now, just confirm we are on order detail page.
  try {
    const title = document.title || "";
    const url = location.href;
    console.log("[GrabPrint] on page:", title, url);

    // placeholder: use innerText to find Booking code A-xxxxxx
    const bodyText = document.body?.innerText || "";
    const matchLong = bodyText.match(/A-[A-Z0-9]{10,}/);
    const bookingCode = matchLong ? matchLong[0] : "N/A";

    const win = window.open("", "_blank", "width=450,height=600");
    if (!win) { alert("Please allow popups!"); return; }

    const html = `
      <html><head><meta charset="UTF-8"><title>Grab Label</title></head>
      <body style="font-family:system-ui;padding:10px">
        <h3>Grab Label</h3>
        <div>Booking: <b>${bookingCode}</b></div>
        <div style="margin-top:10px;opacity:.7">* ถ้าต้องการแบบเต็ม (ชื่อ/รายการ/ราคา) จะ inject extractAndPrint เวอร์ชันเต็มต่อได้</div>
        <script>setTimeout(()=>window.print(),600)</script>
      </body></html>
    `;
    win.document.write(html);
    win.document.close();
  } catch (e) {
    alert("Print error: " + (e?.message || e));
  }
}

async function refreshOrders() {
  try {
    setStatus("กำลังดึงออเดอร์จากหน้า Grab...");
    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      setStatus("ไม่พบแท็บที่ active");
      return;
    }

    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractOrdersList
    });

    const list = res && res[0] && res[0].result ? res[0].result : [];
    orders = Array.isArray(list) ? list : [];
    setStatus(`ดึงได้ ${orders.length} รายการ`);
    render();
  } catch (e) {
    console.error(e);
    setStatus("ดึงไม่สำเร็จ: " + (e?.message || e));
  }
}

async function printSelected() {
  const ids = Array.from(selected.values());
  if (!ids.length) {
    setStatus("ยังไม่ได้เลือกออเดอร์");
    return;
  }

  setStatus(`กำลังพิมพ์ ${ids.length} ออเดอร์...`);

  for (const id of ids) {
    const o = orders.find(x => x.id === id);
    if (!o) continue;

    try {
      const tab = await chrome.tabs.create({ url: o.url, active: false });

      // wait for tab load (basic)
      await new Promise((r) => setTimeout(r, 2200));

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectExtractAndPrint
      });

      // small delay then close tab to reduce clutter
      await new Promise((r) => setTimeout(r, 1600));
      await chrome.tabs.remove(tab.id);

    } catch (e) {
      console.error(e);
      setStatus("พิมพ์บางรายการล้มเหลว: " + (e?.message || e));
    }
  }

  setStatus(`พิมพ์เสร็จแล้ว ${ids.length} ออเดอร์`);
}

els.refresh.addEventListener("click", refreshOrders);
els.search.addEventListener("input", render);

els.selectAll.addEventListener("click", () => {
  for (const o of filtered) selected.add(o.id);
  render();
});

els.clearSel.addEventListener("click", () => {
  selected.clear();
  render();
});

els.printSel.addEventListener("click", printSelected);

// initial
setStatus("เปิดหน้า Grab > Orders แล้วกด “ดึงออเดอร์”");
render();
'@

# --- background.js ---
$bgJs = @'
chrome.runtime.onInstalled.addListener(() => {
  console.log("[GrabPrinter] installed");
});
'@

Write-Log $LogPath "INFO" "Writing patched files..."

Write-Utf8NoBom $ManifestPath $manifest
Write-Utf8NoBom $PopupHtmlPath $popupHtml
Write-Utf8NoBom $PopupJsPath $popupJs
Write-Utf8NoBom $BgPath $bgJs

Write-Log $LogPath "PASS" "Patched: manifest.json, popup.html, popup.js, background.js"
Write-Log $LogPath "PASS" "DONE"

exit 0
