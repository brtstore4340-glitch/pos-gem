// BEGIN: THAM:FIELD_MAPPER_V1
function normalizeKey(key) {
  return String(key)
    .trim()
    .toUpperCase()
    .replace(/[_\s]+/g, " ")
    .replace(/[()]/g, "");
}

const FIELD_MAP = Object.freeze({
  // Print fields
  "DESCRIPTION PRINT": "name",
  "REG PRICE": "unitPrice",
  "DEAL PRICE": "dealPrice",
  "DEAL QTY": "dealQty",
  METHOD: "method",
  // Maintenance event fields
  "DESCRIPTION MAINT": "name",
  "REGPRICE MAINT": "unitPrice",
  "UNITPRICE MAINT": "unitPrice",
  "DEALPRICE MAINT": "dealPrice",
  "DEALQTY MAINT": "dealQty",
  "METHOD MAINT": "method",
});

function safeNumber(val) {
  const n = parseFloat(String(val ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

function safeInt(val) {
  const n = parseInt(String(val ?? "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function mapFields(input) {
  const out = {};
  if (!input || typeof input !== "object") return out;

  for (const [k, v] of Object.entries(input)) {
    const nk = normalizeKey(k);
    const dest = FIELD_MAP[nk];
    if (!dest) continue;

    if (dest === "unitPrice" || dest === "dealPrice") out[dest] = safeNumber(v);
    else if (dest === "dealQty" || dest === "method") out[dest] = safeInt(v);
    else out[dest] = String(v ?? "");
  }
  return out;
}

module.exports = {
  normalizeKey,
  FIELD_MAP,
  safeNumber,
  safeInt,
  mapFields,
};
// END:   THAM:FIELD_MAPPER_V1
