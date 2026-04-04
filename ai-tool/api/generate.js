export default async function handler(req, res) {
  try {
    const { title, desc, duration, niche } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY",
      });
    }

    const prompt = `
You are an AI that ONLY returns valid JSON.

Create viral social media content.

Title: ${title}
Description: ${desc}
Duration: ${duration}
Niche: ${niche}

Return ONLY JSON in this format:

{
  "hooks": ["hook1", "hook2", "hook3"],
  "captions": ["caption1", "caption2"],
  "hashtags": ["#tag1", "#tag2"]
}

Do NOT add any explanation.
Do NOT add text outside JSON.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    const raw =
  data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

// extract only JSON
const start = raw.indexOf("{");
const end = raw.lastIndexOf("}");

if (start === -1 || end === -1) {
  return res.status(500).json({
    error: "No JSON found",
    raw,
  });
}

const jsonString = raw.substring(start, end + 1);

let parsed;

try {
  parsed = JSON.parse(jsonString);
} catch (e) {
  return res.status(500).json({
    error: "Still invalid JSON",
    raw,
  });
}

return res.status(200).json({
  hooks: [raw],
  captions: [],
  hashtags: []
});
    return res.status(200).json({
  hooks: [raw],
  captions: [],
  hashtags: []
});
  } catch (err) {
    return res.status(500).json({
      error: "Something went wrong",
      detail: err.message,
    });
  }
}