// BEGIN: THAM:TEST_CARTSUMMARY_SELFTEST_V1
const assert = require("assert");

function loadCartService() {
  try {
    return require("../src/services/cartService");
  } catch (e1) {
    try {
      return require("../src/services/cartservice");
    } catch (e2) {
      throw new Error(
        "Cannot require cartService (cartService.js / cartservice.js).",
      );
    }
  }
}

function run() {
  const cart = loadCartService();
  if (typeof cart.calculateCartSummary !== "function") {
    throw new Error("calculateCartSummary not found.");
  }

  // Method 8 via raw inconsistent keys (METHOD/DEAL QTY/REG PRICE)
  const raw = {
    qty: 2,
    METHOD: 8,
    "DEAL QTY": 2,
    "REG PRICE": 100,
    "DESCRIPTION PRINT": "TEST ITEM",
  };

  const res = cart.calculateCartSummary([raw], 0, [], 0, 0);
  assert.ok(
    res && res.items && res.items.length === 1,
    "Expected 1 processed item",
  );

  // Buy 2 get 1 free (Interpretation A) => pay 1
  assert.strictEqual(
    res.items[0].calculatedTotal,
    100,
    "Method 8 discount not applied as expected",
  );

  // Net Total shown must equal payable amount (grandTotal)
  assert.strictEqual(
    res.summary.netTotal,
    res.summary.grandTotal,
    "netTotal must equal grandTotal (payable)",
  );
  console.log("[PASS] CartSummary selftest OK");
}

try {
  run();
} catch (err) {
  console.error(
    "[FAIL] CartSummary selftest failed:",
    err && err.message ? err.message : err,
  );
  process.exit(1);
}
// END:   THAM:TEST_CARTSUMMARY_SELFTEST_V1
