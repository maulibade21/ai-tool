import reactLogo from './assets/react.svg'
import { useState, useRef, useCallback, useEffect } from "react";

/* ─── FONT INJECTION ───────────────────────────────────────────────────────── */
const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500&display=swap";

/* ─── DESIGN TOKENS ────────────────────────────────────────────────────────── */
const T = {
  bg:     "#07090F",
  s0:     "#0C0E17",
  s1:     "#10131E",
  s2:     "#161A27",
  s3:     "#1D2235",
  b0:     "#1D2235",
  b1:     "#262C42",
  b2:     "#313857",
  text:   "#D8E0F0",
  muted:  "#5E6A88",
  dim:    "#3A4260",
  ig:     "#E1306C",
  yt:     "#FF4444",
  fb:     "#3A8EF6",
  accent: "#8B78FF",
  green:  "#2FD89A",
  amber:  "#F8B84E",
  font:   "'Space Grotesk', system-ui, sans-serif",
  mono:   "'IBM Plex Mono', monospace",
};

/* ─── HELPERS ──────────────────────────────────────────────────────────────── */
function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function fmtSize(bytes) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
function fmtDate(iso) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/* ─── ✅ FIXED: API CALL NOW GOES THROUGH YOUR VERCEL FUNCTION ─────────────── */
// OLD (broken): fetch("https://api.anthropic.com/v1/messages", ...)
//   → Browser calls Anthropic directly → CORS blocked → "Failed to fetch"
//
// NEW (fixed): fetch("/api/generate", ...)
//   → Browser calls YOUR Vercel function → Vercel calls Anthropic with secret key
//   → No CORS, no exposed API key, works in production forever
async function generateContent(title, desc, duration, niche, onStage) {
  const stages = [
    "Analyzing video context...",
    "Crafting Instagram hook...",
    "Optimizing YouTube SEO...",
    "Writing Facebook copy...",
  ];
  let si = 0;
  const stageTimer = setInterval(() => {
    si = (si + 1) % stages.length;
    onStage(stages[si]);
  }, 900);

  try {
    // ── Timeout controller: fail clearly after 30s instead of hanging ────────
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let res;
    try {
      res = await fetch("/api/generate", {          // ← YOUR serverless function
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, desc, duration, niche }),
        signal: controller.signal,
      });
    } catch (networkErr) {
      // This catch block only fires on network-level failures
      if (networkErr.name === "AbortError") {
        throw new Error("Request timed out after 30s. Your server may be slow or sleeping — try again.");
      }
      throw new Error(
        `Cannot reach the server. Check your Vercel deployment is live.\nDetail: ${networkErr.message}`
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // ── Handle non-200 HTTP responses from your serverless function ──────────
    if (!res.ok) {
      let errMsg = `Server error (${res.status})`;
      try {
        const errBody = await res.json();
        errMsg = errBody.error || errMsg;
        if (errBody.detail) errMsg += `: ${errBody.detail}`;
      } catch {
        // response wasn't JSON
        const text = await res.text().catch(() => "");
        if (text) errMsg += `: ${text.slice(0, 150)}`;
      }

      // Friendly messages for common status codes
      if (res.status === 401) throw new Error("Invalid Anthropic API key. Check ANTHROPIC_API_KEY in Vercel settings.");
      if (res.status === 429) throw new Error("Rate limited by Anthropic. Wait 30 seconds and try again.");
      if (res.status === 500) throw new Error(`AI generation failed: ${errMsg}`);
      throw new Error(errMsg);
    }

    // ── Parse the JSON response ───────────────────────────────────────────────
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("Server returned invalid response. Please try again.");
    }

    // ── Validate shape before rendering ──────────────────────────────────────
    if (!data.instagram || !data.youtube || !data.facebook) {
      throw new Error("Incomplete content generated. Please try again.");
    }

    return data;

  } finally {
    clearInterval(stageTimer);
  }
}

/* ─── CANVAS / THUMBNAIL ───────────────────────────────────────────────────── */
function seekVideo(el, t) {
  return new Promise((res, rej) => {
    const tid = setTimeout(() => rej(new Error("Seek timeout")), 6000);
    const h = () => { clearTimeout(tid); el.removeEventListener("seeked", h); res(); };
    el.addEventListener("seeked", h);
    el.currentTime = t;
  });
}

async function extractFrames(videoEl, count = 3) {
  const dur = videoEl.duration;
  if (!dur || !isFinite(dur)) return [];
  const frames = [];
  for (let i = 0; i < count; i++) {
    try {
      const t = (dur * (i + 1)) / (count + 1);
      await seekVideo(videoEl, t);
      const c = document.createElement("canvas");
      c.width = videoEl.videoWidth || 1280;
      c.height = videoEl.videoHeight || 720;
      c.getContext("2d").drawImage(videoEl, 0, 0, c.width, c.height);
      frames.push({ raw: c.toDataURL("image/jpeg", 0.85), time: t });
    } catch (e) { console.warn("Frame skip:", e); }
  }
  return frames;
}

async function applyTextToFrame(dataURL, text, color = "#FFFFFF") {
  if (!text?.trim()) return dataURL;
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const grd = ctx.createLinearGradient(0, c.height * 0.5, 0, c.height);
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(0.45, "rgba(0,0,0,0.68)");
      grd.addColorStop(1, "rgba(0,0,0,0.94)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, c.height * 0.5, c.width, c.height * 0.5);
      const fsize = Math.round(c.height * 0.088);
      ctx.font = `900 ${fsize}px "Arial Black", Arial, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
      ctx.fillStyle = color;
      const words = text.toUpperCase().split(" ");
      const lines = []; let line = "";
      const maxW = c.width * 0.86;
      for (const w of words) {
        const t2 = line + w + " ";
        if (ctx.measureText(t2).width > maxW && line) { lines.push(line.trim()); line = w + " "; }
        else line = t2;
      }
      lines.push(line.trim());
      const lh = fsize * 1.32;
      const startY = c.height - (lines.length * lh) / 2 - fsize * 0.4;
      lines.forEach((l, i) => {
        ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = fsize * 0.09;
        ctx.strokeText(l, c.width / 2, startY + i * lh, maxW);
        ctx.fillText(l, c.width / 2, startY + i * lh, maxW);
      });
      res(c.toDataURL("image/jpeg", 0.92));
    };
    img.src = dataURL;
  });
}

/* ─── ICONS ────────────────────────────────────────────────────────────────── */
const Icon = {
  upload: () => (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  copy: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  trash: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  ),
  download: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  spark: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
    </svg>
  ),
};

/* ─── CONSTANTS ─────────────────────────────────────────────────────────────── */
const STEPS = ["upload", "configure", "results", "thumbnails", "schedule"];
const STEP_LABELS = { upload: "Upload", configure: "Configure", results: "Content", thumbnails: "Thumbnails", schedule: "Schedule" };
const PLT = {
  instagram: { label: "Instagram", color: T.ig, short: "IG" },
  youtube:   { label: "YouTube",   color: T.yt, short: "YT" },
  facebook:  { label: "Facebook",  color: T.fb, short: "FB" },
};
const NICHES = ["Fitness", "Tech", "Business", "Food", "Travel", "Fashion", "Education", "Gaming", "Health", "Finance", "Art", "Music"];

/* ─── APP ───────────────────────────────────────────────────────────────────── */
export default function App() {
  useEffect(() => {
    if (!document.querySelector("#smtool-fonts")) {
      const l = document.createElement("link");
      l.id = "smtool-fonts"; l.rel = "stylesheet"; l.href = FONT_URL;
      document.head.appendChild(l);
    }
  }, []);

  /* ── state ── */
  const [step, setStep]               = useState("upload");
  const [drag, setDrag]               = useState(false);
  const [videoFile, setVideoFile]     = useState(null);
  const [videoURL, setVideoURL]       = useState("");
  const [videoDuration, setVideoDuration] = useState(0);
  const [uploadPct, setUploadPct]     = useState(0);
  const [uploading, setUploading]     = useState(false);
  const [title, setTitle]             = useState("");
  const [desc, setDesc]               = useState("");
  const [niche, setNiche]             = useState("");
  const [generating, setGenerating]   = useState(false);
  const [genStage, setGenStage]       = useState("");
  const [content, setContent]         = useState(null);
  const [platform, setPlatform]       = useState("instagram");
  const [extracting, setExtracting]   = useState(false);
  const [frames, setFrames]           = useState([]);
  const [selFrame, setSelFrame]       = useState(0);
  const [thumbText, setThumbText]     = useState("");
  const [thumbColor, setThumbColor]   = useState("#FFFFFF");
  const [processedThumb, setProcessedThumb] = useState("");
  const [schedDate, setSchedDate]     = useState("");
  const [schedTime, setSchedTime]     = useState("10:00");
  const [schedPlatform, setSchedPlatform] = useState("instagram");
  const [scheduled, setScheduled]     = useState([]);
  const [addedAnim, setAddedAnim]     = useState(false);
  const [copied, setCopied]           = useState("");
  const [error, setError]             = useState("");

  const videoRef = useRef(null);
  const fileRef  = useRef(null);

  /* ── upload ── */
  const processFile = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["mp4", "mov", "avi", "webm", "mkv"].includes(ext)) {
      setError("Unsupported format. Use MP4, MOV, AVI, WebM, or MKV."); return;
    }
    if (file.size > 500 * 1024 * 1024) { setError("File exceeds 500 MB."); return; }
    setError("");
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoURL(url);
    const nameBase = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
    setTitle(nameBase.replace(/\b\w/g, (c) => c.toUpperCase()));
    setUploading(true); setUploadPct(0);
    let pct = 0;
    const iv = setInterval(() => {
      pct += Math.random() * 14 + 3;
      if (pct >= 100) {
        pct = 100; clearInterval(iv);
        setTimeout(() => { setUploading(false); setStep("configure"); }, 350);
      }
      setUploadPct(Math.min(pct, 100));
    }, 80);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    processFile(e.dataTransfer.files[0]);
  }, [processFile]);

  /* ── generate ── */
  const handleGenerate = async () => {
    if (!title.trim()) { setError("Please enter a video title."); return; }
    setGenerating(true); setError(""); setGenStage("Analyzing video context...");
    try {
      const result = await generateContent(title, desc, videoDuration, niche, setGenStage);
      setContent(result);
      setStep("results");
      setThumbText(result.youtube?.title?.slice(0, 40) || title.slice(0, 40));
    } catch (e) {
      setError(e.message || "Generation failed. Please try again.");
    } finally {
      setGenerating(false); setGenStage("");
    }
  };

  /* ── frame extraction ── */
  const handleExtract = async () => {
    const vid = videoRef.current;
    if (!vid || !videoURL) return;
    setExtracting(true); setError("");
    try {
      if (vid.readyState < 2) {
        await new Promise((r) => vid.addEventListener("canplay", r, { once: true }));
      }
      const extracted = await extractFrames(vid, 3);
      setFrames(extracted);
      setSelFrame(0);
      if (extracted[0]) setProcessedThumb(extracted[0].raw);
    } catch (e) {
      setError("Frame extraction failed: " + e.message);
    } finally {
      setExtracting(false);
    }
  };

  useEffect(() => {
    if (step === "thumbnails" && frames.length === 0 && videoURL) handleExtract();
  }, [step]);

  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      if (!frames[selFrame]) return;
      const out = await applyTextToFrame(frames[selFrame].raw, thumbText, thumbColor);
      if (!cancelled) setProcessedThumb(out);
    };
    update();
    return () => { cancelled = true; };
  }, [thumbText, thumbColor, selFrame, frames]);

  /* ── copy ── */
  const copy = async (text, id) => {
    try { await navigator.clipboard.writeText(text); } catch {}
    setCopied(id); setTimeout(() => setCopied(""), 2200);
  };

  /* ── download ── */
  const downloadThumb = () => {
    if (!processedThumb) return;
    const a = document.createElement("a");
    a.href = processedThumb;
    a.download = `thumbnail-frame${selFrame + 1}.jpg`;
    a.click();
  };

  /* ── schedule ── */
  const addSchedule = () => {
    if (!schedDate || !schedTime) { setError("Select both date and time."); return; }
    const dt = new Date(`${schedDate}T${schedTime}`);
    if (dt < new Date()) { setError("Schedule time must be in the future."); return; }
    setScheduled((p) => [...p, {
      id: Date.now(), platform: schedPlatform,
      title: content?.[schedPlatform]?.title || title,
      scheduledAt: dt.toISOString(),
      thumbnail: processedThumb || null,
      status: "scheduled",
    }]);
    setAddedAnim(true); setError("");
    setTimeout(() => setAddedAnim(false), 1800);
  };

  const deletePost = (id) => setScheduled((p) => p.filter((x) => x.id !== id));

  /* ── shared styles ── */
  const S = {
    card: { background: T.s1, border: `1px solid ${T.b0}`, borderRadius: 12, padding: "20px 24px" },
    input: {
      width: "100%", background: T.s2, border: `1px solid ${T.b1}`,
      borderRadius: 8, padding: "11px 14px", color: T.text,
      fontFamily: T.font, fontSize: 14, outline: "none", transition: "border-color 0.15s",
      boxSizing: "border-box",
    },
    textarea: {
      width: "100%", background: T.s2, border: `1px solid ${T.b1}`,
      borderRadius: 8, padding: "11px 14px", color: T.text,
      fontFamily: T.font, fontSize: 14, outline: "none", resize: "vertical",
      minHeight: 80, lineHeight: 1.6, boxSizing: "border-box",
    },
    btn: (col, disabled = false) => ({
      background: disabled ? T.dim : col, color: "#fff", border: "none",
      borderRadius: 8, padding: "11px 20px", fontFamily: T.font, fontWeight: 600,
      fontSize: 14, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.55 : 1, letterSpacing: "0.01em",
      transition: "all 0.15s", display: "inline-flex", alignItems: "center", gap: 7,
    }),
    ghost: (active = false) => ({
      background: active ? T.s3 : "transparent",
      color: active ? T.text : T.muted,
      border: `1px solid ${active ? T.b1 : "transparent"}`,
      borderRadius: 7, padding: "8px 14px", fontFamily: T.font,
      fontWeight: 500, fontSize: 13, cursor: "pointer", transition: "all 0.15s",
    }),
    label: {
      fontSize: 12, fontWeight: 600, color: T.muted,
      letterSpacing: "0.06em", textTransform: "uppercase",
      marginBottom: 6, display: "block",
    },
    contentBox: {
      background: T.s2, border: `1px solid ${T.b0}`, borderRadius: 10,
      padding: "14px 16px", fontFamily: T.mono, fontSize: 13,
      color: T.text, lineHeight: 1.65, whiteSpace: "pre-wrap",
      wordBreak: "break-word", maxHeight: 220, overflowY: "auto",
    },
    copyBtn: (id) => ({
      background: copied === id ? T.green + "22" : T.s3,
      color: copied === id ? T.green : T.muted,
      border: `1px solid ${copied === id ? T.green + "44" : T.b1}`,
      borderRadius: 6, padding: "5px 10px", fontSize: 12,
      fontFamily: T.font, cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 5, transition: "all 0.2s",
    }),
    error: {
      padding: "12px 16px", background: T.yt + "18",
      border: `1px solid ${T.yt + "44"}`, borderRadius: 8,
      fontSize: 13, color: T.yt, lineHeight: 1.5,
    },
  };

  /* ── step bar ── */
  const stepIdx = STEPS.indexOf(step);
  const renderStepBar = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32, overflowX: "auto" }}>
      {STEPS.map((s, i) => {
        const done = i < stepIdx, active = i === stepIdx;
        const canGo = done || (i === stepIdx + 1 && (
          (s === "configure" && videoFile) ||
          (s === "results" && content) ||
          (s === "thumbnails" && content) ||
          (s === "schedule" && content)
        ));
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "auto" }}>
            <button onClick={() => (canGo || done) ? setStep(s) : null} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
              background: active ? T.accent + "22" : "transparent",
              border: `1px solid ${active ? T.accent + "66" : done ? T.b1 : "transparent"}`,
              borderRadius: 8, cursor: (canGo || done) ? "pointer" : "default",
              fontFamily: T.font, fontSize: 13, fontWeight: active ? 600 : 400,
              color: active ? T.accent : done ? T.text : T.dim,
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
                background: done ? T.green + "33" : active ? T.accent + "33" : T.b0,
                color: done ? T.green : active ? T.accent : T.muted,
                border: `1px solid ${done ? T.green + "55" : active ? T.accent + "55" : T.b1}`,
                flexShrink: 0,
              }}>{done ? "✓" : i + 1}</span>
              {STEP_LABELS[s]}
            </button>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 1, background: done ? T.green + "44" : T.b0, margin: "0 4px", minWidth: 12 }} />
            )}
          </div>
        );
      })}
    </div>
  );

  /* ── UPLOAD ── */
  const renderUpload = () => (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <h2 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "0 0 8px" }}>Upload Your Video</h2>
      <p style={{ color: T.muted, fontSize: 15, margin: "0 0 28px" }}>Supports MP4, MOV, AVI, WebM · Max 500 MB</p>

      {!videoFile ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${drag ? T.accent : T.b2}`,
            borderRadius: 16, padding: "56px 32px", textAlign: "center",
            background: drag ? T.accent + "0A" : T.s1,
            cursor: "pointer", transition: "all 0.2s",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
          }}
        >
          <div style={{ color: drag ? T.accent : T.dim }}><Icon.upload /></div>
          <div>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: drag ? T.accent : T.text }}>
              {drag ? "Release to upload" : "Drop video here"}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: T.muted }}>or click to browse files</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {["MP4", "MOV", "AVI", "WebM"].map((f) => (
              <span key={f} style={{ padding: "3px 10px", background: T.s3, border: `1px solid ${T.b1}`, borderRadius: 6, fontSize: 11, color: T.muted, fontWeight: 600 }}>{f}</span>
            ))}
          </div>
        </div>
      ) : (
        <div style={S.card}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 52, height: 52, borderRadius: 10, background: T.accent + "22", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${T.accent + "44"}`, color: T.accent, flexShrink: 0, fontSize: 20 }}>▶</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{videoFile.name}</p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: T.muted }}>{fmtSize(videoFile.size)}{videoDuration > 0 ? ` · ${fmtTime(videoDuration)}` : ""}</p>
            </div>
            <button onClick={() => { setVideoFile(null); setVideoURL(""); setUploadPct(0); }} style={{ ...S.ghost(), padding: "5px 10px", fontSize: 12 }}>✕ Remove</button>
          </div>
          {uploading && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: T.muted }}>Uploading...</span>
                <span style={{ fontSize: 12, color: T.accent, fontFamily: T.mono }}>{Math.round(uploadPct)}%</span>
              </div>
              <div style={{ height: 6, background: T.s3, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${uploadPct}%`, background: `linear-gradient(90deg, ${T.accent}, ${T.green})`, borderRadius: 3, transition: "width 0.1s" }} />
              </div>
            </div>
          )}
        </div>
      )}

      <input ref={fileRef} type="file" accept="video/*" onChange={(e) => processFile(e.target.files[0])} style={{ display: "none" }} />
      {error && <div style={{ ...S.error, marginTop: 16 }}>{error}</div>}
    </div>
  );

  /* ── CONFIGURE ── */
  const renderConfigure = () => (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <h2 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "0 0 8px" }}>Configure & Generate</h2>
      <p style={{ color: T.muted, fontSize: 15, margin: "0 0 28px" }}>Provide context so AI can craft platform-perfect content</p>

      {videoURL && (
        <div style={{ ...S.card, marginBottom: 20, overflow: "hidden", padding: 0 }}>
          <video src={videoURL} controls muted onLoadedMetadata={(e) => setVideoDuration(e.target.duration)}
            style={{ width: "100%", maxHeight: 260, display: "block", background: "#000", borderRadius: 12 }} />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <label style={S.label}>Video Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My Amazing Video" style={S.input} />
        </div>
        <div>
          <label style={S.label}>Description / Context (optional)</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What is this video about? Key points, topics, audience?" style={S.textarea} />
        </div>
        <div>
          <label style={S.label}>Niche / Industry</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {NICHES.map((n) => (
              <button key={n} onClick={() => setNiche(n)} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, fontFamily: T.font, fontWeight: 500,
                cursor: "pointer", border: `1px solid ${niche === n ? T.accent + "88" : T.b1}`,
                background: niche === n ? T.accent + "22" : T.s2,
                color: niche === n ? T.accent : T.muted, transition: "all 0.12s",
              }}>{n}</button>
            ))}
          </div>
          <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Or type your niche..." style={S.input} />
        </div>

        {error && <div style={S.error}>{error}</div>}

        <button onClick={handleGenerate} disabled={generating || !title.trim()} style={{ ...S.btn(T.accent, generating || !title.trim()), justifyContent: "center", padding: "14px 20px", fontSize: 15 }}>
          {generating ? (
            <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>◌</span>{genStage || "Generating..."}</>
          ) : (
            <><Icon.spark />Generate AI Content</>
          )}
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  /* ── RESULTS ── */
  const renderResults = () => {
    if (!content) return null;
    const cur = content[platform];
    const pInfo = PLT[platform];
    const CopyField = ({ label, value, id }) => (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={S.label}>{label}</span>
          <button onClick={() => copy(value, id)} style={S.copyBtn(id)}>
            {copied === id ? <><Icon.check /> Copied!</> : <><Icon.copy /> Copy</>}
          </button>
        </div>
        <div style={S.contentBox}>{value}</div>
      </div>
    );
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "0 0 4px" }}>Generated Content</h2>
            <p style={{ color: T.muted, fontSize: 14, margin: 0 }}>"{title}"</p>
          </div>
          <button onClick={() => { setStep("configure"); setContent(null); }} style={{ ...S.ghost(), fontSize: 13 }}>↺ Regenerate</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 24, background: T.s1, padding: 6, borderRadius: 10, border: `1px solid ${T.b0}` }}>
          {Object.entries(PLT).map(([key, info]) => (
            <button key={key} onClick={() => setPlatform(key)} style={{
              flex: 1, padding: "9px 12px", borderRadius: 7,
              border: `1px solid ${platform === key ? info.color + "55" : "transparent"}`,
              background: platform === key ? info.color + "22" : "transparent",
              color: platform === key ? info.color : T.muted,
              fontFamily: T.font, fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all 0.15s",
            }}>{info.label}</button>
          ))}
        </div>

        <div style={{ borderLeft: `3px solid ${pInfo.color}`, paddingLeft: 18, marginBottom: 24 }}>
          {platform === "instagram" && (
            <>
              <CopyField label="Title" value={cur.title} id="ig-title" />
              <CopyField label="Caption" value={cur.caption} id="ig-caption" />
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={S.label}>Hashtags ({cur.hashtags?.length || 0})</span>
                  <button onClick={() => copy(cur.hashtags?.map(h => `#${h.replace(/^#/, "")}`).join(" "), "ig-tags")} style={S.copyBtn("ig-tags")}>
                    {copied === "ig-tags" ? <><Icon.check /> Copied!</> : <><Icon.copy /> Copy All</>}
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {cur.hashtags?.map((tag, i) => {
                    const t = tag.startsWith("#") ? tag : "#" + tag;
                    return <span key={i} onClick={() => copy(t, "tag-" + i)} style={{ padding: "4px 10px", background: T.ig + "18", border: `1px solid ${T.ig + "33"}`, borderRadius: 20, fontSize: 12, color: T.ig, cursor: "pointer", fontFamily: T.mono }}>{t}</span>;
                  })}
                </div>
              </div>
            </>
          )}
          {platform === "youtube" && (
            <>
              <CopyField label="SEO Title" value={cur.title} id="yt-title" />
              <CopyField label="Description" value={cur.description} id="yt-desc" />
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={S.label}>Tags ({cur.tags?.length || 0})</span>
                  <button onClick={() => copy(cur.tags?.join(", "), "yt-tags")} style={S.copyBtn("yt-tags")}>
                    {copied === "yt-tags" ? <><Icon.check /> Copied!</> : <><Icon.copy /> Copy All</>}
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {cur.tags?.map((tag, i) => (
                    <span key={i} style={{ padding: "4px 10px", background: T.yt + "18", border: `1px solid ${T.yt + "33"}`, borderRadius: 20, fontSize: 12, color: T.yt, fontFamily: T.mono }}>{tag}</span>
                  ))}
                </div>
              </div>
            </>
          )}
          {platform === "facebook" && <CopyField label="Post Caption" value={cur.caption} id="fb-caption" />}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={() => setStep("thumbnails")} style={S.btn(T.accent)}>Next: Thumbnails →</button>
        </div>
      </div>
    );
  };

  /* ── THUMBNAILS ── */
  const renderThumbnails = () => (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "0 0 8px" }}>Thumbnail Generator</h2>
      <p style={{ color: T.muted, fontSize: 15, margin: "0 0 28px" }}>Extract frames and add bold text overlays</p>

      {extracting && (
        <div style={{ ...S.card, textAlign: "center", padding: "36px 24px" }}>
          <div style={{ fontSize: 28, marginBottom: 12, animation: "spin 1.2s linear infinite", display: "inline-block" }}>◌</div>
          <p style={{ color: T.muted, margin: 0, fontSize: 14 }}>Extracting video frames...</p>
        </div>
      )}

      {!extracting && frames.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: "36px 24px" }}>
          <p style={{ color: T.muted, marginBottom: 16, fontSize: 14 }}>No frames extracted yet.</p>
          <button onClick={handleExtract} style={S.btn(T.accent)}>Extract Frames</button>
        </div>
      )}

      {frames.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={S.card}>
              <label style={S.label}>Select Frame</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {frames.map((f, i) => (
                  <div key={i} onClick={() => setSelFrame(i)} style={{ border: `2px solid ${selFrame === i ? T.accent : T.b0}`, borderRadius: 8, overflow: "hidden", cursor: "pointer", position: "relative" }}>
                    <img src={f.raw} alt={`Frame ${i + 1}`} style={{ width: "100%", display: "block", maxHeight: 90, objectFit: "cover" }} />
                    <div style={{ position: "absolute", bottom: 6, right: 8, background: "rgba(0,0,0,0.7)", borderRadius: 4, padding: "2px 7px", fontSize: 11, color: "#fff", fontFamily: T.mono }}>{fmtTime(f.time)}</div>
                    {selFrame === i && <div style={{ position: "absolute", top: 6, left: 8, background: T.accent, borderRadius: 4, padding: "2px 7px", fontSize: 11, color: "#fff", fontWeight: 600 }}>Selected</div>}
                  </div>
                ))}
              </div>
            </div>
            <div style={S.card}>
              <label style={S.label}>Text Overlay</label>
              <input value={thumbText} onChange={(e) => setThumbText(e.target.value)} placeholder="YOUR TITLE HERE..." style={{ ...S.input, marginBottom: 12, fontWeight: 700 }} />
              <label style={S.label}>Text Color</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {["#FFFFFF", "#FFE234", "#FF4444", "#4ADE80", "#60A5FA"].map((c) => (
                  <div key={c} onClick={() => setThumbColor(c)} style={{ width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer", border: `2px solid ${thumbColor === c ? "#fff" : "transparent"}`, boxShadow: thumbColor === c ? `0 0 0 3px ${T.accent}` : "none" }} />
                ))}
                <input type="color" value={thumbColor} onChange={(e) => setThumbColor(e.target.value)} style={{ width: 28, height: 28, border: "none", background: "none", cursor: "pointer", padding: 0, borderRadius: "50%" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={downloadThumb} disabled={!processedThumb} style={{ ...S.btn(T.green, !processedThumb), flex: 1, justifyContent: "center" }}><Icon.download /> Download</button>
              <button onClick={handleExtract} style={{ ...S.ghost(), padding: "11px 14px", fontSize: 13 }}>↺ Re-extract</button>
            </div>
          </div>
          <div>
            <label style={S.label}>Live Preview</label>
            <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${T.b1}`, background: "#000" }}>
              {processedThumb && <img src={processedThumb} alt="Preview" style={{ width: "100%", display: "block" }} />}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
        <button onClick={() => setStep("schedule")} style={S.btn(T.accent)}>Next: Schedule →</button>
      </div>
    </div>
  );

  /* ── SCHEDULE ── */
  const renderSchedule = () => {
    const minDate = new Date().toISOString().split("T")[0];
    return (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: "0 0 8px" }}>Schedule Posts</h2>
        <p style={{ color: T.muted, fontSize: 15, margin: "0 0 28px" }}>Queue your content for each platform</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
          <div style={S.card}>
            <label style={{ ...S.label, marginBottom: 14 }}>New Scheduled Post</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={S.label}>Platform</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {Object.entries(PLT).map(([key, info]) => (
                    <button key={key} onClick={() => setSchedPlatform(key)} style={{
                      flex: 1, padding: "9px 8px", borderRadius: 7,
                      border: `1px solid ${schedPlatform === key ? info.color + "55" : T.b1}`,
                      background: schedPlatform === key ? info.color + "22" : T.s2,
                      color: schedPlatform === key ? info.color : T.muted,
                      fontFamily: T.font, fontWeight: 600, fontSize: 12, cursor: "pointer",
                    }}>{info.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={S.label}>Date</label>
                <input type="date" min={minDate} value={schedDate} onChange={(e) => setSchedDate(e.target.value)} style={{ ...S.input, colorScheme: "dark" }} />
              </div>
              <div>
                <label style={S.label}>Time</label>
                <input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} style={{ ...S.input, colorScheme: "dark" }} />
              </div>
              {content?.[schedPlatform] && (
                <div style={{ background: T.s2, border: `1px solid ${T.b0}`, borderRadius: 8, padding: "12px 14px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 12, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Content preview</p>
                  <p style={{ margin: 0, fontSize: 13, color: T.text, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {content[schedPlatform].title || content[schedPlatform].caption?.slice(0, 80) + "..."}
                  </p>
                </div>
              )}
              {error && <div style={S.error}>{error}</div>}
              <button onClick={addSchedule} style={{ ...S.btn(addedAnim ? T.green : PLT[schedPlatform].color), justifyContent: "center", padding: "13px 20px" }}>
                {addedAnim ? <><Icon.check /> Post Scheduled!</> : `+ Schedule ${PLT[schedPlatform].label} Post`}
              </button>
            </div>
          </div>

          <div>
            <label style={S.label}>Scheduled ({scheduled.length})</label>
            {scheduled.length === 0 ? (
              <div style={{ ...S.card, textAlign: "center", padding: "36px 24px", marginTop: 8 }}>
                <p style={{ color: T.dim, fontSize: 13, margin: 0 }}>No posts scheduled yet.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                {[...scheduled].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)).map((post) => {
                  const pInfo = PLT[post.platform];
                  return (
                    <div key={post.id} style={{ ...S.card, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
                      {post.thumbnail && <img src={post.thumbnail} alt="" style={{ width: 60, height: 38, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: pInfo.color, background: pInfo.color + "22", padding: "2px 7px", borderRadius: 10 }}>{pInfo.label}</span>
                          <span style={{ fontSize: 11, color: T.green, background: T.green + "22", padding: "2px 7px", borderRadius: 10 }}>● Scheduled</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.title}</p>
                        <p style={{ margin: "3px 0 0", fontSize: 12, color: T.muted, fontFamily: T.mono }}>{fmtDate(post.scheduledAt)}</p>
                      </div>
                      <button onClick={() => deletePost(post.id)} style={{ ...S.ghost(), padding: "6px 8px", color: T.yt + "aa" }}><Icon.trash /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ── MAIN RENDER ── */
  return (
    <div style={{ fontFamily: T.font, background: T.bg, minHeight: "100vh", color: T.text }}>
      {videoURL && (
        <video ref={videoRef} src={videoURL} crossOrigin="anonymous" preload="auto"
          onLoadedMetadata={(e) => setVideoDuration(e.target.duration)} style={{ display: "none" }} />
      )}

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${T.b0}`, background: T.s0, padding: "0 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✦</div>
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>ContentForge</span>
            <span style={{ fontSize: 11, background: T.accent + "33", color: T.accent, border: `1px solid ${T.accent + "55"}`, padding: "2px 8px", borderRadius: 10, fontWeight: 600, letterSpacing: "0.04em" }}>BETA</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["IG", "YT", "FB"].map((p, i) => (
              <span key={p} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: [T.ig, T.yt, T.fb][i] + "22", color: [T.ig, T.yt, T.fb][i], border: `1px solid ${[T.ig, T.yt, T.fb][i] + "44"}`, fontWeight: 700 }}>{p}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 24px 80px" }}>
        {renderStepBar()}
        {step === "upload"     && renderUpload()}
        {step === "configure"  && renderConfigure()}
        {step === "results"    && renderResults()}
        {step === "thumbnails" && renderThumbnails()}
        {step === "schedule"   && renderSchedule()}
      </div>

      <div style={{ position: "fixed", bottom: 20, right: 20, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
        <span style={{ fontSize: 11, padding: "4px 10px", background: T.green + "22", color: T.green, border: `1px solid ${T.green + "55"}`, borderRadius: 10, fontWeight: 700 }}>✓ Phase 1: Live</span>
        <span style={{ fontSize: 11, padding: "4px 10px", background: T.accent + "22", color: T.accent, border: `1px solid ${T.accent + "55"}`, borderRadius: 10, fontWeight: 700 }}>✓ Phase 2: Live</span>
      </div>
    </div>
  );
}
