const { redactPII } = require("../types");

async function callAnthropic({ apiKey, model, prompt, maxTokens }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: Number(maxTokens || 4096),
      temperature: 0.2,
      system:
        "Return ONLY valid JSON matching the Plan schema described in the prompt. No markdown.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${redactPII(t).slice(0, 2000)}`);
  }

  const data = await res.json();
  const text =
    data?.content
      ?.map((c) => c?.text)
      .filter(Boolean)
      .join("\n") ?? "";
  return { text: String(text || "") };
}

module.exports = { callAnthropic };
