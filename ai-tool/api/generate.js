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
- 3 Hooks
- 2 Captions
- 5 Hashtags
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

    // 🔥 SIMPLE PARSING (NO STRICT JSON)
    const hooks = raw.match(/(?:\d+\.|-)\s*(.*hook.*)/gi) || [
      title || "Must watch this!",
      "Don't miss this!",
      "Viral content alert!"
    ];

    const captions = raw.match(/(?:caption[:\-]?)(.*)/gi) || [
      desc || "Check this out!",
      "This is amazing!"
    ];

    const hashtags = raw.match(/#\w+/g) || [
      "#viral",
      "#trending",
      "#fyp"
    ];

    return res.status(200).json({
      hooks,
      captions,
      hashtags,
    });

  } catch (err) {
    return res.status(500).json({
      error: "Something went wrong",
      detail: err.message,
    });
  }
}