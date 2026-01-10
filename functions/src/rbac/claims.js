const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const syncClaims = onDocumentWritten(
  { region: "asia-southeast1", document: "user_roles/{uid}" },
  async (event) => {
    const uid = event.params.uid;
    const after = event.data?.after;

    if (!after?.exists) {
      await getAuth().setCustomUserClaims(uid, { roles: [] });
      return;
    }

    const data = after.data() || {};
    const roles = Array.isArray(data.roles) ? data.roles.filter((r) => typeof r === "string") : [];

    // optional: ensure roles exist
    const db = getFirestore();
    const checks = await Promise.all(
      roles.map(async (r) => {
        const doc = await db.doc(`roles/${r}`).get();
        return doc.exists ? r : null;
      })
    );
    const safeRoles = checks.filter(Boolean);

    await getAuth().setCustomUserClaims(uid, { roles: safeRoles });
  }
);

module.exports = { syncClaims };