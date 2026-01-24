const { initializeApp } = require("firebase-admin/app");
initializeApp();

const { aiOrchestrator } = require("./ai/orchestrator");
const { schemaSnapshot } = require("./schema/snapshot");
const { syncClaims } = require("./rbac/claims");
const { onRequest } = require("firebase-functions/v2/https");

exports.aiOrchestrator = aiOrchestrator;
exports.schemaSnapshot = schemaSnapshot;
exports.rbacSyncClaims = syncClaims;

exports.healthCheck = onRequest({ region: "asia-southeast1" }, (req, res) => {
  res.json({ status: "healthy", version: "1.5.0" });
});