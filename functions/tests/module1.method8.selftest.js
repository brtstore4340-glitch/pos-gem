// BEGIN: THAM:TEST_METHOD8_SELFTEST_V1
const assert = require('assert');

function loadCartService() {
try {
return require('../src/services/cartService');
} catch (e1) {
try {
return require('../src/services/cartservice');
} catch (e2) {
throw new Error('Cannot require cartService (cartService.js / cartservice.js).');
}
}
}

function run() {
const cart = loadCartService();
if (!cart.THAM || typeof cart.THAM.calcMethod8_A !== 'function' || typeof cart.THAM.calcMethod8_B !== 'function') {
throw new Error('Missing THAM helpers. Ensure patch P004 applied.');
}

// Interpretation A (default)
assert.deepStrictEqual(cart.THAM.calcMethod8_A(1, 2), { freeItems: 0, payableQty: 1 });
assert.deepStrictEqual(cart.THAM.calcMethod8_A(2, 2), { freeItems: 1, payableQty: 1 });
assert.deepStrictEqual(cart.THAM.calcMethod8_A(5, 2), { freeItems: 2, payableQty: 3 });
assert.deepStrictEqual(cart.THAM.calcMethod8_A(0, 2), { freeItems: 0, payableQty: 0 });

// Alternative Interpretation B (documented only)
assert.deepStrictEqual(cart.THAM.calcMethod8_B(3, 2), { freeItems: 1, payableQty: 2 });
assert.deepStrictEqual(cart.THAM.calcMethod8_B(6, 2), { freeItems: 2, payableQty: 4 });
assert.deepStrictEqual(cart.THAM.calcMethod8_B(0, 2), { freeItems: 0, payableQty: 0 });

console.log('[PASS] Module1 Method8 selftest OK');
}

try {
run();
} catch (err) {
console.error('[FAIL] Module1 Method8 selftest failed:', err && err.message ? err.message : err);
process.exit(1);
}
// END:   THAM:TEST_METHOD8_SELFTEST_V1