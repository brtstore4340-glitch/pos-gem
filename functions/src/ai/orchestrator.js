const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { GoogleAuth } = require("google-auth-library");

const {
  OrchestratorRequestSchema,
  ProviderResultSchema,
  stableStringify,
  sha256Hex,
  redactPII,
  parsePlanOrThrow,
} = require("./types");

const { callOpenAI } = require("./providers/openai");
const { callAnthropic } = require("./providers/anthropic");
const { callVertexGemini } = require("./providers/vertex");
const { buildSchemaSnapshot } = require("../schema/snapshot");

const SPEC_CONTEXT = `
Boots POS Admin AI Module (v1.5.0)
Hard constraints:
- Perf budget: <= 5KB gzip added, <= 10ms TTI impact, <= 2 Firestore reads per action
- WCAG AA required
- Least privilege; no client-side secrets
- Firestore I/O: pagination (limit + startAfter), batch/transaction writes, compact payloads
- RBAC per menu: defaultRoles, allowedRoles, allowedUsers; enforce server-side + filter client
- Quorum: require 2/3 normalized plan match (hash equality)
Output MUST match Plan schema exactly as JSON.
`.trim();

async function getVertexAccessToken() {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token)
    throw new Error("Failed to obtain Google access token for Vertex.");
  return token;
}

function computeQuorum(results) {
  const okOnes = results.filter((r) => r.ok && r.hash);
  const counts = new Map();
  for (const r of okOnes) counts.set(r.hash, (counts.get(r.hash) || 0) + 1);

  let winningHash = null;
  for (const [h, c] of counts.entries()) if (c >= 2) winningHash = h;

  if (!winningHash)
    return { ok: false, winner: null, hashes: okOnes.map((r) => r.hash) };
  return {
    ok: true,
    winner: okOnes.find((r) => r.hash === winningHash) || null,
    hashes: okOnes.map((r) => r.hash),
  };
}

async function runProvider(provider, cfg) {
  try {
    let text = "";
    if (provider === "openai") {
      const r = await callOpenAI({
        apiKey: cfg.openaiKey,
        model: cfg.openaiModel,
        prompt: cfg.prompt,
      });
      text = r.text;
    } else if (provider === "vertex") {
      const token = await getVertexAccessToken();
      const r = await callVertexGemini({
        projectId: cfg.vertexProject,
        location: cfg.vertexLocation,
        model: cfg.vertexModel,
        prompt: cfg.prompt,
        accessToken: token,
      });
      text = r.text;
    } else {
      const r = await callAnthropic({
        apiKey: cfg.anthropicKey,
        model: cfg.anthropicModel,
        prompt: cfg.prompt,
        maxTokens: cfg.anthropicMaxTokens,
      });
      text = r.text;
    }

    const plan = parsePlanOrThrow(text);
    const canonical = stableStringify(plan);
    const hash = sha256Hex(canonical);

    return ProviderResultSchema.parse({
      provider,
      ok: true,
      rawText: redactPII(text).slice(0, 50000),
      plan,
      hash,
    });
  } catch (e) {
    return ProviderResultSchema.parse({
      provider,
      ok: false,
      rawText: "",
      error: String(e?.message || e).slice(0, 2000),
    });
  }
}

const aiOrchestrator = onCall(
  {
    region: "asia-southeast1",
    cors: true,
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (req) => {
    const uid = req.auth?.uid;
    const roles = req.auth?.token?.roles;

    if (!uid) throw new HttpsError("unauthenticated", "Auth required.");
    if (!Array.isArray(roles) || !roles.includes("admin"))
      throw new HttpsError("permission-denied", "Admin only.");

    const input = OrchestratorRequestSchema.parse(req.data || {});
    const db = getFirestore();

    const schema = await buildSchemaSnapshot(db, 10);

    const prompt = `
${SPEC_CONTEXT}

Intent:
${input.intent}

Schema Snapshot:
${stableStringify(schema)}

Admin Override (optional):
${stableStringify(input.schemaOverride || {})}

Return ONLY JSON matching Plan schema.
`.trim();

    const cfg = {
      prompt,
      openaiKey: process.env.OPENAI_API_KEY || "",
      openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      vertexProject: process.env.VERTEX_PROJECT || "",
      vertexLocation: process.env.VERTEX_LOCATION || "asia-southeast1",
      vertexModel: process.env.VERTEX_MODEL || "gemini-1.5-pro",
      anthropicKey: process.env.ANTHROPIC_API_KEY || "",
      anthropicModel:
        process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20240620",
      anthropicMaxTokens: process.env.ANTHROPIC_MAX_TOKENS || "4096",
    };

    if (!cfg.openaiKey || !cfg.anthropicKey || !cfg.vertexProject) {
      throw new HttpsError(
        "failed-precondition",
        "Missing server env: OPENAI_API_KEY, ANTHROPIC_API_KEY, VERTEX_PROJECT (and VERTEX_LOCATION).",
      );
    }

    const runId = db.collection("ai_audit").doc().id;
    const startedAt = Date.now();

    const results = await Promise.all([
      runProvider("openai", cfg),
      runProvider("vertex", cfg),
      runProvider("anthropic", cfg),
    ]);

    const q = computeQuorum(results);

    await db
      .collection("ai_audit")
      .doc(runId)
      .set(
        {
          runId,
          moduleId: input.moduleId,
          createdBy: uid,
          createdAt: FieldValue.serverTimestamp(),
          intent: redactPII(input.intent).slice(0, 5000),
          providers: results.map((r) => ({
            provider: r.provider,
            ok: r.ok,
            hash: r.hash || null,
            error: r.error || null,
          })),
          quorumOk: q.ok,
          winningHash: q.winner?.hash || null,
          latencyMs: Date.now() - startedAt,
          raw: results.map((r) => ({
            provider: r.provider,
            rawText: r.rawText,
          })),
          immutable: true,
        },
        { merge: false },
      );

    if (!q.ok || !q.winner?.plan) {
      throw new HttpsError("aborted", `Quorum failed (see ai_audit/${runId}).`);
    }

    const winningPlan = q.winner.plan;
    const readsCount = winningPlan.db.reads.length;
    const maxReads = winningPlan.constraints?.perf?.readsPerActionMax ?? 2;
    if (readsCount > maxReads) {
      throw new HttpsError(
        "failed-precondition",
        `Plan violates reads/action max: ${readsCount} > ${maxReads}.`,
      );
    }

    await db.collection("modules").doc(input.moduleId).set(
      {
        moduleId: input.moduleId,
        version: "1.5.0",
        status: "READY",
        updatedAt: FieldValue.serverTimestamp(),
        lastRunId: runId,
        plan: winningPlan,
      },
      { merge: true },
    );

    return { runId, moduleId: input.moduleId, plan: winningPlan };
  },
);

module.exports = { aiOrchestrator };
