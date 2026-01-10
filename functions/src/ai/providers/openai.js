const { redactPII } = require("../types");

async function callOpenAI({ apiKey, model, prompt }) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: "Return ONLY valid JSON matching the Plan schema described in the prompt. No markdown.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI ${res.status}: ${redactPII(t).slice(0, 2000)}`);
  }

  const data = await res.json();
  const text =
    data?.output_text ??
    data?.output?.[0]?.content?.map((c) => c?.text).filter(Boolean).join("\n") ??
    "";
  return { text: String(text || "") };
}

module.exports = { callOpenAI };