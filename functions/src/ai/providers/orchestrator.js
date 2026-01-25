const { OpenAIProvider } = require("./providers/openai");
const { VertexAIProvider } = require("./providers/vertex");
const { AnthropicProvider } = require("./providers/anthropic");
const admin = require("firebase-admin");
const crypto = require("crypto");

class AIOrchestrator {
  constructor(config) {
    this.openai = new OpenAIProvider(config.openaiKey);
    this.vertex = new VertexAIProvider(
      config.vertexProject,
      config.vertexLocation,
    );
    this.anthropic = new AnthropicProvider(config.anthropicKey);
    this.db = admin.firestore();
  }

  async orchestrate(spec, schemaContext) {
    const runId = this.generateRunId();
    const startTime = Date.now();

    try {
      console.log(`[Orchestrator ${runId}] Starting 3-AI generation...`);

      const [openaiResponse, vertexResponse, anthropicResponse] =
        await Promise.all([
          this.openai.generatePlan(spec, schemaContext),
          this.vertex.generatePlan(spec, schemaContext),
          this.anthropic.generatePlan(spec, schemaContext),
        ]);

      const providers = [openaiResponse, vertexResponse, anthropicResponse];
      const successfulProviders = providers.filter((p) => p.success && p.plan);

      console.log(
        `[Orchestrator ${runId}] Successful: ${successfulProviders.length}/3`,
      );

      if (successfulProviders.length < 2) {
        return this.createFailedResult(
          runId,
          providers,
          "Insufficient successful AI responses (need 2/3)",
        );
      }

      const normalizedPlans = successfulProviders.map((p) =>
        this.normalizePlan(p.plan),
      );
      const quorumResult = this.findQuorum(normalizedPlans);

      if (!quorumResult.found) {
        return this.createFailedResult(
          runId,
          providers,
          "No quorum reached: AI providers disagree",
        );
      }

      const agreedPlan = normalizedPlans[quorumResult.indices[0]];
      const perfValidation = this.validatePerformance(agreedPlan);

      if (!perfValidation.valid) {
        return this.createFailedResult(
          runId,
          providers,
          `Performance budget exceeded: ${perfValidation.issues.join(", ")}`,
        );
      }

      const totalLatencyMs = Date.now() - startTime;
      const result = {
        success: true,
        quorumMet: true,
        agreedPlan,
        providers,
        auditId: runId,
      };

      await this.saveAudit(runId, spec, result, {
        totalLatencyMs,
        perf: perfValidation.metrics,
      });

      console.log(`[Orchestrator ${runId}] Success!`);
      return result;
    } catch (error) {
      console.error(`[Orchestrator ${runId}] Error:`, error);
      return this.createFailedResult(runId, [], error.message);
    }
  }

  normalizePlan(plan) {
    return {
      ui: {
        patches: (plan.ui?.patches || []).sort((a, b) =>
          (a.targetPath || "").localeCompare(b.targetPath || ""),
        ),
      },
      db: {
        reads: (plan.db?.reads || []).sort((a, b) =>
          (a.collection || "").localeCompare(b.collection || ""),
        ),
        writes: (plan.db?.writes || []).sort((a, b) =>
          (a.collection || "").localeCompare(b.collection || ""),
        ),
      },
      ps: {
        steps: (plan.ps?.steps || []).sort((a, b) =>
          (a.targetPath || "").localeCompare(b.targetPath || ""),
        ),
      },
    };
  }

  findQuorum(plans) {
    for (let i = 0; i < plans.length; i++) {
      for (let j = i + 1; j < plans.length; j++) {
        if (this.plansMatch(plans[i], plans[j])) {
          return { found: true, indices: [i, j] };
        }
      }
    }
    return { found: false, indices: [] };
  }

  plansMatch(plan1, plan2) {
    const similarity = this.calculateSimilarity(plan1, plan2);
    return similarity >= 0.85;
  }

  calculateSimilarity(plan1, plan2) {
    let matches = 0;
    let total = 0;

    const uiPaths1 = new Set(
      (plan1.ui?.patches || []).map((p) => p.targetPath),
    );
    const uiPaths2 = new Set(
      (plan2.ui?.patches || []).map((p) => p.targetPath),
    );
    matches += this.setIntersectionSize(uiPaths1, uiPaths2);
    total += Math.max(uiPaths1.size, uiPaths2.size);

    return total > 0 ? matches / total : 0;
  }

  setIntersectionSize(set1, set2) {
    let count = 0;
    for (const item of set1) {
      if (set2.has(item)) count++;
    }
    return count;
  }

  validatePerformance(plan) {
    const issues = [];

    const totalCodeLength = (plan.ui?.patches || []).reduce(
      (sum, patch) => sum + (patch.content?.length || 0),
      0,
    );
    const estimatedBundleSizeKB = (totalCodeLength / 1024) * 0.3;

    const totalReads = (plan.db?.reads || []).reduce(
      (sum, op) => sum + (op.estimatedReads || 0),
      0,
    );

    if (estimatedBundleSizeKB > 5) {
      issues.push(
        `Bundle size ${estimatedBundleSizeKB.toFixed(2)}KB exceeds 5KB`,
      );
    }

    if (totalReads > 2) {
      issues.push(`Reads ${totalReads} exceeds 2`);
    }

    return {
      valid: issues.length === 0,
      issues,
      metrics: {
        estimatedBundleSizeKB,
        estimatedTTIImpactMs: estimatedBundleSizeKB * 2,
        estimatedReadsPerAction: totalReads,
      },
    };
  }

  createFailedResult(runId, providers, error) {
    return {
      success: false,
      quorumMet: false,
      providers,
      auditId: runId,
      error,
    };
  }

  async saveAudit(runId, prompt, result, metrics) {
    try {
      await this.db
        .collection("ai_audit")
        .doc(runId)
        .set({
          runId,
          prompt: this.sanitizePII(prompt),
          responses: result.providers,
          quorumResult: result.quorumMet,
          agreedPlan: result.agreedPlan || null,
          performanceMetrics: metrics || null,
          success: result.success,
          error: result.error || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
      console.error(`[Orchestrator ${runId}] Failed to save audit:`, error);
    }
  }

  sanitizePII(text) {
    return text
      .replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        "[EMAIL]",
      )
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE]");
  }

  generateRunId() {
    return `run_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  }
}

module.exports = { AIOrchestrator };
