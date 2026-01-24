
// ============================================================================
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { SchemaSnapshotSchema } = require("../ai/types");

function inferType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "object";
    default:
      return "unknown";
  }
}

async function buildSchemaSnapshot(db, sampleLimit = 10) {
  const rootCollections = await db.listCollections();
  const collections = [];

  for (const col of rootCollections) {
    const snap = await col.limit(sampleLimit).get();
    const fields = {};
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      for (const [k, v] of Object.entries(data)) {
        if (!fields[k]) fields[k] = inferType(v);
      }
    }
    collections.push({ name: col.id, sampleDocCount: snap.size, fields });
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    collections,
  };

  return SchemaSnapshotSchema.parse(snapshot);
}

const schemaSnapshot = onCall({ region: "asia-southeast1", cors: true }, async (req) => {
  const uid = req.auth?.uid;
  const roles = req.auth?.token?.roles;
  if (!uid) throw new HttpsError("unauthenticated", "Auth required.");
  if (!Array.isArray(roles) || !roles.includes("admin")) throw new HttpsError("permission-denied", "Admin only.");

  const db = getFirestore();
  return await buildSchemaSnapshot(db, 10);
});

module.exports = { schemaSnapshot, buildSchemaSnapshot };