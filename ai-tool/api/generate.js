export default async function handler(req, res) {
  try {
    const { title, desc, duration, niche } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY",
      });
    }

    const prompt = `
You are a social media expert.

Create viral content for this video.

Title: ${title}
Description: ${desc}
Duration: ${duration}
Niche: ${niche}

Return STRICT JSON format like this:

{
  "hooks": ["hook1", "hook2", "hook3"],
  "captions": ["caption1", "caption2"],
  "hashtags": ["#tag1", "#tag2", "#tag3"]
}

Only return JSON. No extra text.
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

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return res.status(500).json({
        error: "Invalid JSON from AI",
        raw,
      });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({
      error: "Something went wrong",
      detail: err.message,
    });
  }
}