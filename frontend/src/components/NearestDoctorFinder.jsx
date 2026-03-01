/**
 * NearestDoctorFinder.jsx
 * Gemini-powered nearest neurology doctor finder
 * with proper map links, contact cards, and robust JSON parsing
 */

import { useState } from "react";

const LIME = "#C8F135";
const BLU  = "#60a5fa";
const AMB  = "#f59e0b";
const RED  = "#e84040";
const GRN  = "#34d399";

// ── Robust JSON extractor ───────────────────────────────────────────────────
function sanitizeJSONString(input) {
  if (!input) return "";
  let text = input
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\u00A0/g, " ");

  // Convert raw newlines/tabs inside quoted strings to escaped sequences.
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "\"" && !escaped) {
      inString = !inString;
      out += ch;
      escaped = false;
      continue;
    }
    if (inString && (ch === "\n" || ch === "\r")) {
      out += "\\n";
      escaped = false;
      continue;
    }
    if (inString && ch === "\t") {
      out += "\\t";
      escaped = false;
      continue;
    }
    out += ch;
    escaped = ch === "\\" && !escaped;
    if (ch !== "\\") escaped = false;
  }

  // Common JSON-ish repairs.
  out = out
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]")
    .replace(/([{,]\s*)'([^']+?)'\s*:/g, '$1"$2":')
    .replace(/:\s*'([^']*?)'(\s*[,}\]])/g, (_m, v, tail) => `:"${v.replace(/"/g, '\\"')}"${tail}`);

  return out.trim();
}

function extractJSON(text) {
  if (!text) return null;

  // Step 1: clean all markdown fences
  let cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  // Step 2: try direct parse
  try { return JSON.parse(cleaned); } catch (_) {}

  // Step 3: extract largest { } block
  const f1 = cleaned.indexOf("{");
  const l1 = cleaned.lastIndexOf("}");
  if (f1 !== -1 && l1 > f1) {
    try { return JSON.parse(cleaned.slice(f1, l1 + 1)); } catch (_) {}
  }

  // Step 4: fix trailing commas then parse
  try {
    const fixed = sanitizeJSONString(cleaned);
    const f2 = fixed.indexOf("{");
    const l2 = fixed.lastIndexOf("}");
    if (f2 !== -1 && l2 > f2) return JSON.parse(fixed.slice(f2, l2 + 1));
  } catch (_) {}

  // Step 5: try original text directly
  const f3 = text.indexOf("{");
  const l3 = text.lastIndexOf("}");
  if (f3 !== -1 && l3 > f3) {
    try { return JSON.parse(text.slice(f3, l3 + 1)); } catch (_) {}
  }

  // Step 6: aggressive sanitation + JS object fallback
  try {
    const candidate = sanitizeJSONString(cleaned);
    const f4 = candidate.indexOf("{");
    const l4 = candidate.lastIndexOf("}");
    if (f4 !== -1 && l4 > f4) {
      const objLike = candidate.slice(f4, l4 + 1);
      try { return JSON.parse(objLike); } catch (_) {}
      try {
        // Last-resort parser for JSON-like output (single quotes, minor syntax drift)
        const parsed = Function(`"use strict"; return (${objLike});`)();
        if (parsed && typeof parsed === "object") return parsed;
      } catch (_) {}
    }
  } catch (_) {}

  return null;
}

function tryParseObjectFragment(fragment) {
  if (!fragment) return null;
  const cleaned = sanitizeJSONString(fragment);
  try { return JSON.parse(cleaned); } catch (_) {}
  try {
    const parsed = Function(`"use strict"; return (${cleaned});`)();
    if (parsed && typeof parsed === "object") return parsed;
  } catch (_) {}
  return null;
}

function extractFallbackPayload(rawText) {
  if (!rawText) return null;
  const text = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();

  const urgencyMatch = text.match(/"urgency_note"\s*:\s*"([\s\S]*?)"\s*,\s*"summary"/i);
  const summaryMatch = text.match(/"summary"\s*:\s*"([\s\S]*?)"\s*,\s*"doctors"/i);
  const urgency_note = urgencyMatch ? urgencyMatch[1].replace(/\\"/g, "\"").trim() : "";
  const summary = summaryMatch ? summaryMatch[1].replace(/\\"/g, "\"").trim() : "";

  const doctors = [];
  const doctorsStart = text.search(/"doctors"\s*:\s*\[/i);
  if (doctorsStart !== -1) {
    const startBracket = text.indexOf("[", doctorsStart);
    if (startBracket !== -1) {
      let depth = 0;
      let objStart = -1;
      for (let i = startBracket; i < text.length; i += 1) {
        const ch = text[i];
        if (ch === "{") {
          if (depth === 0) objStart = i;
          depth += 1;
        } else if (ch === "}") {
          depth -= 1;
          if (depth === 0 && objStart !== -1) {
            const frag = text.slice(objStart, i + 1);
            const doc = tryParseObjectFragment(frag);
            if (doc && (doc.name || doc.address || doc.hospital)) doctors.push(doc);
            objStart = -1;
          }
        } else if (ch === "]" && depth <= 0) {
          break;
        }
      }
    }
  }

  if (!urgency_note && !summary && doctors.length === 0) return null;
  return { urgency_note, summary, doctors };
}

// ── Build health summary ────────────────────────────────────────────────────
function buildHealthSummary(lastResult) {
  if (!lastResult) return "No assessment data available yet.";
  const riskLevels = lastResult.risk_levels || {};
  const risks = Object.entries(riskLevels)
    .filter(([, v]) => v !== "Low")
    .map(([k, v]) => `${k} risk: ${v}`).join(", ");
  const scores = [
    `Speech: ${Math.round(lastResult.speech_score || 0)}`,
    `Memory: ${Math.round(lastResult.memory_score || 0)}`,
    `Reaction: ${Math.round(lastResult.reaction_score || 0)}`,
    `Executive: ${Math.round(lastResult.executive_score || 0)}`,
    `Motor: ${Math.round(lastResult.motor_score || 0)}`,
  ].join(", ");
  const overall = Math.round(
    [lastResult.speech_score, lastResult.memory_score, lastResult.reaction_score,
     lastResult.executive_score, lastResult.motor_score].reduce((a, b) => a + b, 0) / 5
  );
  return `Overall Cognitive Score: ${overall}/100. Domain scores — ${scores}. ${risks ? `Elevated risks: ${risks}.` : "All risks within normal range."}`;
}

// ── Gemini API call ─────────────────────────────────────────────────────────
async function callGemini(prompt, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 2000,
          responseMimeType: "application/json",
        },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini error ${res.status}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ── Urgency styling ─────────────────────────────────────────────────────────
function urgencyStyle(urgency = "") {
  const u = urgency.toLowerCase();
  if (u.includes("high") || u.includes("urgent"))      return { color: RED, bg: `${RED}14`, border: `${RED}30` };
  if (u.includes("moderate") || u.includes("medium"))  return { color: AMB, bg: `${AMB}14`, border: `${AMB}30` };
  return { color: GRN, bg: `${GRN}14`, border: `${GRN}30` };
}

// ── Doctor Card ─────────────────────────────────────────────────────────────
function DoctorCard({ doc, index }) {
  const [open, setOpen] = useState(false);
  const us = urgencyStyle(doc.urgency);

  const mapsUrl = doc.mapsUrl ||
    (doc.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(doc.address)}`
      : null);

  return (
    <div style={{
      borderRadius: 16,
      border: `1px solid rgba(255,255,255,0.07)`,
      background: "#111",
      overflow: "hidden",
      marginBottom: 10,
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
          background: `${BLU}18`, border: `1.5px solid ${BLU}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 900, fontSize: 15, color: BLU, fontFamily: "'DM Sans',sans-serif",
        }}>
          {index + 1}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>{doc.name || "Neurologist"}</div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {[doc.specialty, doc.hospital, doc.distance].filter(Boolean).join(" · ")}
          </div>
        </div>

        {doc.urgency && (
          <span style={{
            background: us.bg, color: us.color, border: `1px solid ${us.border}`,
            borderRadius: 20, padding: "3px 10px",
            fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
          }}>
            {doc.urgency}
          </span>
        )}

        <span style={{
          color: "#444", fontSize: 18, flexShrink: 0,
          transition: "transform 0.25s", transform: open ? "rotate(90deg)" : "none",
        }}>›</span>
      </div>

      {/* Expanded */}
      {open && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

          {doc.why && (
            <div>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 5 }}>Why recommended</div>
              <p style={{ fontSize: 13, color: "#888", lineHeight: 1.65, margin: 0 }}>{doc.why}</p>
            </div>
          )}

          {doc.address && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px",
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>📍</span>
              <span style={{ fontSize: 13, color: "#888", lineHeight: 1.5 }}>{doc.address}</span>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {doc.phone && (
              <a href={`tel:${doc.phone}`} style={{
                display: "flex", alignItems: "center", gap: 6,
                background: `${GRN}14`, color: GRN, border: `1px solid ${GRN}30`,
                borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 700, textDecoration: "none",
              }}>
                📞 {doc.phone}
              </a>
            )}
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{
                display: "flex", alignItems: "center", gap: 6,
                background: `${BLU}14`, color: BLU, border: `1px solid ${BLU}30`,
                borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 700, textDecoration: "none",
              }}>
                🗺️ Open in Maps
              </a>
            )}
            {mapsUrl && (
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(doc.address || "")}`}
                target="_blank" rel="noopener noreferrer" style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "rgba(255,255,255,0.04)", color: "#777",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 600, textDecoration: "none",
              }}>
                🧭 Directions
              </a>
            )}
          </div>

          {doc.tips && (
            <div style={{
              background: `${LIME}07`, border: `1px solid ${LIME}18`,
              borderRadius: 10, padding: "10px 12px",
            }}>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Appointment tips</div>
              <p style={{ fontSize: 12, color: "#777", lineHeight: 1.6, margin: 0 }}>{doc.tips}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Loading dots ────────────────────────────────────────────────────────────
function LoadingDots() {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 14 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: BLU,
          animation: `ndfpulse 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`@keyframes ndfpulse{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function NearestDoctorFinder({ lastResult, geminiApiKey }) {
  const [phase,       setPhase]       = useState("idle");
  const [doctors,     setDoctors]     = useState([]);
  const [summary,     setSummary]     = useState("");
  const [urgencyNote, setUrgencyNote] = useState("");
  const [errorMsg,    setErrorMsg]    = useState("");
  const [coords,      setCoords]      = useState(null);

  async function handleFind() {
    setPhase("locating");
    setErrorMsg(""); setDoctors([]); setSummary(""); setUrgencyNote("");

    let lat = null, lng = null;
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      setCoords({ lat, lng });
    } catch (_) {}

    setPhase("searching");

    const healthSummary = buildHealthSummary(lastResult);
    const locationCtx   = lat !== null
      ? `Patient GPS coordinates: latitude ${lat.toFixed(5)}, longitude ${lng.toFixed(5)}.`
      : "Patient location unavailable — provide general recommendations for India.";

    // Key instruction: return ONLY raw JSON, no markdown fences
    const prompt = `You are a medical assistant for NeuroSaathi, a neurological health app in India.

Patient health data: ${healthSummary}
${locationCtx}

Return ONLY one valid JSON object (no markdown, no explanation, no code fences) with exactly these fields:
{
  "urgency_note": "one sentence about how urgently this patient needs a neurologist",
  "summary": "1-2 short sentences on what the patient should discuss with the neurologist",
  "doctors": [
    {
      "name": "Doctor or clinic name",
      "specialty": "neurological sub-specialty",
      "hospital": "Hospital or clinic name",
      "distance": "approximate distance like 1.2 km",
      "address": "full street address",
      "phone": "phone number as string or null",
      "mapsUrl": "https://www.google.com/maps/search/?api=1&query=ENCODED_ADDRESS",
      "urgency": "Routine or Moderate or High Priority",
      "why": "why this specialist suits this patient specifically",
      "tips": "short preparation tip"
    }
  ]
}

Find exactly 3 real neurology specialists near the patient. Use real clinic names and addresses.
Use plain ASCII characters only.`;

    try {
      const raw    = await callGemini(prompt, geminiApiKey);
      const parsed = extractJSON(raw) || extractFallbackPayload(raw);

      console.log("Gemini raw response:", raw); // debug
      if (parsed?.doctors?.length > 0) {
        setDoctors(parsed.doctors);
        setSummary(parsed.summary || "");
        setUrgencyNote(parsed.urgency_note || "");
        setPhase("done");
      } else if (parsed?.summary || parsed?.urgency_note) {
        setDoctors([]);
        setSummary(parsed.summary || "");
        setUrgencyNote(parsed.urgency_note || "");
        setPhase("done");
      } else {
        // Could not parse at all
        throw new Error(`Could not parse AI response. First 200 chars: ${raw.slice(0, 200)}`);
      }
    } catch (e) {
      setErrorMsg(e.message);
      setPhase("error");
    }
  }

  const noKey = !geminiApiKey;

  return (
    <div style={{
      marginTop: 20, borderRadius: 18,
      border: `1px solid ${BLU}22`, background: "#0c0c0c", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 18px", background: `${BLU}09`,
        borderBottom: `1px solid ${BLU}18`,
      }}>
        <span style={{ fontSize: 22 }}>🧭</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, color: "#fff", fontSize: 14 }}>Find Nearest Neurologist</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 1 }}>AI-powered · Personalised to your health profile</div>
        </div>
        {(phase === "idle" || phase === "error") && (
          <button onClick={noKey ? undefined : handleFind} style={{
            background: noKey ? "rgba(255,255,255,0.04)" : `linear-gradient(135deg,${BLU},#3b82f6)`,
            color: noKey ? "#444" : "#fff",
            border: "none", borderRadius: 10, padding: "8px 16px",
            fontSize: 12, fontWeight: 700, cursor: noKey ? "not-allowed" : "pointer",
            fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap",
          }}>
            {noKey ? "API Key Required" : "🔍 Find Doctors"}
          </button>
        )}
        {phase === "done" && (
          <button onClick={handleFind} style={{
            background: "rgba(255,255,255,0.05)", color: "#666",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
            padding: "7px 13px", fontSize: 11, fontWeight: 600,
            cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
          }}>
            🔄 Refresh
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "16px 18px" }}>

        {phase === "idle" && (
          <p style={{ fontSize: 12, color: "#444", lineHeight: 1.7, margin: 0 }}>
            {noKey
              ? <span style={{ color: RED }}>⚠️ Add <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4 }}>VITE_GEMINI_API_KEY</code> to your <code>.env</code> to enable this feature.</span>
              : <>Click <strong style={{ color: BLU }}>Find Doctors</strong> to get AI-powered neurology recommendations near you based on your health data.</>
            }
          </p>
        )}

        {phase === "locating" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>📍</div>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>Getting your location…</div>
            <div style={{ color: "#555", fontSize: 12, marginTop: 4 }}>Allow location access in your browser</div>
            <LoadingDots />
          </div>
        )}

        {phase === "searching" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>🤖</div>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>Analysing your health profile…</div>
            <div style={{ color: "#555", fontSize: 12, marginTop: 4 }}>Finding the best neurologists for your condition</div>
            <LoadingDots />
          </div>
        )}

        {phase === "error" && (
          <div style={{
            background: "rgba(232,64,64,0.08)", border: "1px solid rgba(232,64,64,0.2)",
            borderRadius: 12, padding: "12px 14px", color: "#ff7070", fontSize: 13, lineHeight: 1.5,
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {phase === "done" && (
          <div>
            {urgencyNote && (
              <div style={{
                background: `${AMB}0c`, border: `1px solid ${AMB}25`,
                borderRadius: 12, padding: "10px 14px",
                marginBottom: 14, fontSize: 13, color: AMB, lineHeight: 1.55,
              }}>
                ⏱️ {urgencyNote}
              </div>
            )}

            {summary && (
              <div style={{
                background: `${BLU}09`, border: `1px solid ${BLU}20`,
                borderRadius: 12, padding: "12px 14px",
                marginBottom: 16, fontSize: 13, color: "#8eb4fa", lineHeight: 1.65,
              }}>
                🧠 {summary}
              </div>
            )}

            <div style={{ fontSize: 10, color: "#444", letterSpacing: 1.8, textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>
              Recommended specialists ({doctors.length})
            </div>

            {doctors.map((doc, i) => <DoctorCard key={i} doc={doc} index={i} />)}

            {coords && (
              <div style={{ marginTop: 8, fontSize: 11, color: "#2a2a2a" }}>
                📍 Based on your location ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
              </div>
            )}

            <p style={{
              marginTop: 14, fontSize: 11, color: "#2e2e2e", lineHeight: 1.6,
              borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10, margin: "14px 0 0",
            }}>
              ℹ️ AI recommendations are for informational purposes only. Always verify with a qualified medical professional.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
