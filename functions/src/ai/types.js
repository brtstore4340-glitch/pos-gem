const { z } = require("zod");
const crypto = require("node:crypto");

const PlacementMode = z.enum(["append_end", "before_ref", "after_ref", "at_index"]);
const PlacementGroup = z.enum(["primary", "secondary", "admin"]);

const PlacementSchema = z.object({
  mode: PlacementMode,
  refId: z.string().nullable().default(null),
  index: z.number().int().min(0).nullable().default(null),
  group: PlacementGroup.default("primary"),
});

const AccessSchema = z.object({
  defaultRoles: z.array(z.string()).default(["admin"]),
  allowedRoles: z.array(z.string()).default(["admin"]),
  allowedUsers: z.array(z.string()).default([]),
});

const PatchOp = z.enum(["CREATE_OR_REPLACE", "INSERT_BEFORE", "INSERT_AFTER", "DELETE_RANGE"]);

const PatchStepSchema = z.object({
  op: PatchOp,
  path: z.string().min(1),
  anchor: z.string().optional(),
  content: z.string().optional(),
  rangeStartAnchor: z.string().optional(),
  rangeEndAnchor: z.string().optional(),
  note: z.string().optional(),
  sha256: z.string().optional(),
});

const FirestoreIOReadSchema = z.object({
  collection: z.string(),
  where: z.array(z.tuple([z.string(), z.string(), z.any()])).default([]),
  orderBy: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  startAfter: z.any().optional(),
});

const FirestoreIOWriteSchema = z.object({
  collection: z.string(),
  docId: z.string().optional(),
  op: z.enum(["set", "update", "delete", "batch", "transaction"]),
  payload: z.record(z.any()).optional(),
});

const PerfBudgetSchema = z.object({
  addedGzipBytesMax: z.number().int().min(0).default(5000),
  ttiImpactMsMax: z.number().int().min(0).default(10),
  readsPerActionMax: z.number().int().min(0).default(2),
});

const PlanSchema = z.object({
  version: z.string().default("1.5.0"),
  ui: z.object({ patches: z.array(PatchStepSchema).default([]) }),
  db: z.object({
    reads: z.array(FirestoreIOReadSchema).default([]),
    writes: z.array(FirestoreIOWriteSchema).default([]),
  }),
  ps: z.object({ steps: z.array(PatchStepSchema).default([]) }),
  constraints: z.object({
    wcagAA: z.boolean().default(true),
    leastPrivilege: z.boolean().default(true),
    perf: PerfBudgetSchema.default({}),
  }),
  meta: z.object({
    summary: z.string().default(""),
    risks: z.array(z.string()).default([]),
    verification: z.array(z.string()).default([]),
  }),
});

const ProviderResultSchema = z.object({
  provider: z.enum(["openai", "vertex", "anthropic"]),
  ok: z.boolean(),
  rawText: z.string().default(""),
  plan: PlanSchema.optional(),
  error: z.string().optional(),
  hash: z.string().optional(),
});

const OrchestratorRequestSchema = z.object({
  moduleId: z.string().min(1).default("admin-ai-module"),
  intent: z.string().min(1),
  schemaOverride: z
    .object({
      mandatory: z.array(z.string()).default([]),
      optional: z.array(z.string()).default([]),
      indexes: z.array(z.string()).default([]),
    })
    .optional(),
});

const SchemaSnapshotSchema = z.object({
  generatedAt: z.string(),
  collections: z.array(
    z.object({
      name: z.string(),
      sampleDocCount: z.number().int(),
      fields: z.record(z.string()),
    })
  ),
});

function stableStringify(value) {
  return JSON.stringify(value, (k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const out = {};
      for (const key of Object.keys(v).sort()) out[key] = v[key];
      return out;
    }
    return v;
  });
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function redactPII(text) {
  return String(text || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/\b\d{8,}\b/g, "[REDACTED_NUMBER]");
}

function parsePlanOrThrow(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }
  return PlanSchema.parse(obj);
}

module.exports = {
  PlacementSchema,
  AccessSchema,
  PatchStepSchema,
  PlanSchema,
  ProviderResultSchema,
  OrchestratorRequestSchema,
  SchemaSnapshotSchema,
  stableStringify,
  sha256Hex,
  redactPII,
  parsePlanOrThrow,
};