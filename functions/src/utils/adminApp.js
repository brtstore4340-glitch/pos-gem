const { getApps, initializeApp } = require("firebase-admin/app");

function ensureAdminApp() {
  if (!getApps().length) {
    initializeApp();
  }
}

module.exports = { ensureAdminApp };
