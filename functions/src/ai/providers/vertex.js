const { redactPII } = require("../types");

async function callVertexGemini({ projectId, location, model, prompt, accessToken }) {
  const url =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}` +
    `/locations/${location}/publishers/google/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Return ONLY valid JSON matching the Plan schema described below. No markdown.\n\n" + prompt,
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Vertex ${res.status}: ${redactPII(t).slice(0, 2000)}`);
  }

  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p?.text).filter(Boolean).join("\n") ?? "";
  return { text: String(text || "") };
}

module.exports = { callVertexGemini };