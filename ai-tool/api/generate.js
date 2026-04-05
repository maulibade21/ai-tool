export default async function handler(req, res) {
  try {
    const { title, desc, duration, niche } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY",
      });
    }

    const prompt = `
Create viral social media content.

Title: ${title}
Description: ${desc}
Duration: ${duration}
Niche: ${niche}

Give:
- Hooks
- Captions
- Hashtags
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
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No content generated";

    // 🔥 NO JSON PARSING — DIRECT OUTPUT
    return res.status(200).json({
      result: raw,
    });

  } catch (err) {
    return res.status(500).json({
      error: "Something went wrong",
      detail: err.message,
    });
  }
}