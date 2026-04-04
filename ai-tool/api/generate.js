// api/generate.js  — Vercel Serverless Function
// Place this file at:  your-project/api/generate.js
// Vercel auto-deploys every file inside /api as a serverless endpoint.
// This keeps your ANTHROPIC_API_KEY secret and bypasses CORS.

export default async function handler(req, res) {
  // ── 1. Only allow POST ─────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── 2. Check API key exists ────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set in environment variables");
    return res.status(500).json({
      error: "Server misconfiguration: API key missing. Add ANTHROPIC_API_KEY to Vercel environment variables.",
    });
  }

  // ── 3. Parse request body ──────────────────────────────────────────────────
  const { title, desc, duration, niche } = req.body;

  if (!title || typeof title !== "string") {
    return res.status(400).json({ error: "Missing required field: title" });
  }

  // ── 4. Build the prompt ────────────────────────────────────────────────────
  const prompt = `You are an elite social media strategist and copywriter. Generate viral, platform-optimized content.

VIDEO CONTEXT:
- Title: "${title}"
- Description: "${desc || "Not provided"}"
- Duration: ${duration ? Math.round(duration) + "s" : "Unknown"}
- Niche: "${niche || "General"}"

RULES:
- Instagram: conversational, emoji-heavy, strong hook, save/share CTA
- YouTube: SEO-first, keyword in title, timestamps, descriptive metadata
- Facebook: community-focused, question to drive comments, list benefits

Return ONLY valid JSON (no markdown, no backticks, no explanation):
{
  "instagram": {
    "title": "Punchy title under 60 chars — start with emoji",
    "caption": "🔥 [BOLD HOOK — statement or question that stops the scroll]\\n\\n[2-3 value-packed sentences with 1-2 relevant emojis each]\\n\\n💡 [Key insight or tip]\\n\\n👇 [Strong CTA: save, comment, tag someone]",
    "hashtags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12","tag13","tag14","tag15","tag16","tag17","tag18","tag19","tag20"]
  },
  "youtube": {
    "title": "[Primary Keyword] — [Compelling Benefit] (max 70 chars)",
    "description": "[3-line hook that teases the value]\\n\\n📌 What you'll learn:\\n• [Specific point 1]\\n• [Specific point 2]\\n• [Specific point 3]\\n\\n⏱ Timestamps:\\n0:00 — Intro\\n1:30 — [Key section]\\n\\n🔔 Subscribe for weekly uploads!\\n\\n#keyword1 #keyword2 #keyword3",
    "tags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12","tag13","tag14","tag15"]
  },
  "facebook": {
    "caption": "[PROVOCATIVE QUESTION or BOLD STATEMENT]\\n\\n[1-2 sentences of context]\\n\\n✅ What you'll get:\\n→ [Concrete benefit 1]\\n→ [Concrete benefit 2]\\n→ [Concrete benefit 3]\\n\\nReact ❤️ if this resonates!\\nTag someone who needs this 👇"
  }
}`;

  // ── 5. Call Anthropic from the SERVER (not the browser) ───────────────────
  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,                        // ← secret, only on server
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    // ── 6. Handle Anthropic errors ───────────────────────────────────────────
    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, errText);

      // Send a clear message back to the frontend
      return res.status(anthropicRes.status).json({
        error: `Anthropic API error ${anthropicRes.status}`,
        detail: errText.slice(0, 300),
      });
    }

    const data = await anthropicRes.json();
    const raw = data.content.map((b) => b.text || "").join("");

    // ── 7. Parse and validate JSON from Claude ───────────────────────────────
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch (parseErr) {
      console.error("Failed to parse Claude response as JSON:", raw.slice(0, 500));
      return res.status(500).json({
        error: "Claude returned invalid JSON. Try again.",
        raw: raw.slice(0, 200),
      });
    }

    // ── 8. Validate the shape of the response ───────────────────────────────
    if (!parsed.instagram || !parsed.youtube || !parsed.facebook) {
      return res.status(500).json({
        error: "Claude response missing required platforms.",
        received: Object.keys(parsed),
      });
    }

    // ── 9. Return success ────────────────────────────────────────────────────
    return res.status(200).json(parsed);

  } catch (err) {
    // Network error reaching Anthropic (rare but possible)
    console.error("Network error calling Anthropic:", err);
    return res.status(500).json({
      error: "Failed to reach Anthropic API. Check server connectivity.",
      detail: err.message,
    });
  }
}
