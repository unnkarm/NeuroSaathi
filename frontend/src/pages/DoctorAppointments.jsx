import { useEffect, useState } from "react";
import { DarkCard } from "../components/RiskDashboard";
import { getUser } from "../services/api";
import {
  listDoctorAppointments,
  resolvePersonId,
  updateAppointmentStatus,
  upsertDoctorDirectory,
} from "../services/appointments";

const STATUS_STYLE = {
  Pending: { color: "#fbbf24", bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.35)" },
  Approved: { color: "#4ade80", bg: "rgba(74,222,128,0.10)", border: "rgba(74,222,128,0.35)" },
  Rejected: { color: "#f87171", bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.35)" },
};

function fmt(dt, tm) {
  const d = new Date(`${dt}T00:00:00`);
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${day} • ${tm}`;
}

export default function DoctorAppointments() {
  const doctor = getUser();
  const doctorId = resolvePersonId(doctor);
  const [items, setItems] = useState([]);
  const [meetingLinks, setMeetingLinks] = useState({});
  const [errorMsg, setErrorMsg] = useState("");

  function load() {
    setItems(listDoctorAppointments(doctorId));
  }

  useEffect(() => {
    upsertDoctorDirectory({
      id: doctorId,
      full_name: doctor?.full_name || "Doctor",
      specialization: doctor?.specialization || "Neurology",
      hospital: doctor?.hospital || "MindSaathi Clinical Network",
    });
    load();
    const onStorage = () => load();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function update(id, status) {
    setErrorMsg("");
    const rawLink = (meetingLinks[id] || "").trim();
    if (status === "Approved") {
      if (!rawLink) {
        setErrorMsg("Please add a meeting URL (Google Meet/Zoom) before approving.");
        return;
      }
      const valid = /^https?:\/\/\S+/i.test(rawLink);
      if (!valid) {
        setErrorMsg("Meeting link must start with http:// or https://");
        return;
      }
    }

    updateAppointmentStatus(id, status, rawLink);
    load();
  }

  const pending = items.filter((a) => a.status === "Pending").length;

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(200,241,53,0.10)", border: "1px solid rgba(200,241,53,0.35)", borderRadius: 99, padding: "5px 14px", marginBottom: 14, fontSize: 11, fontWeight: 700, color: "#C8F135", letterSpacing: 1.5, textTransform: "uppercase" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#C8F135", display: "inline-block" }} />
          Consultation Queue
        </div>
        <h1 style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 900, fontSize: "clamp(26px,3vw,40px)", color: "#fff", letterSpacing: "-1px", marginBottom: 8 }}>
          Appointment Requests
        </h1>
        <p style={{ color: "#666", fontSize: 14, lineHeight: 1.7 }}>
          Review consultation requests generated after cognitive assessments. Pending requests: <strong style={{ color: "#fbbf24" }}>{pending}</strong>.
        </p>
      </div>

      {errorMsg ? (
        <div style={{ marginBottom: 12, borderRadius: 10, border: "1px solid rgba(248,113,113,0.35)", background: "rgba(248,113,113,0.10)", color: "#f87171", fontSize: 13, padding: "10px 12px" }}>
          ⚠️ {errorMsg}
        </div>
      ) : null}

      {items.length === 0 ? (
        <DarkCard style={{ padding: 42, textAlign: "center" }} hover={false}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>🩺</div>
          <div style={{ fontSize: 20, color: "#fff", fontWeight: 800, marginBottom: 8 }}>No Requests Yet</div>
          <p style={{ fontSize: 13, color: "#666" }}>New patient appointment requests will appear here.</p>
        </DarkCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((a) => {
            const s = STATUS_STYLE[a.status] || STATUS_STYLE.Pending;
            const isPending = a.status === "Pending";
            return (
              <DarkCard key={a.id} style={{ padding: 20, border: `1px solid ${s.border}` }} hover={false}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, color: "#fff", fontWeight: 700 }}>{a.patientName}</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{a.patientEmail || "No email provided"}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>{fmt(a.date, a.time)}</div>
                    {a.notes ? (
                      <p style={{ marginTop: 10, marginBottom: 0, color: "#777", fontSize: 13, lineHeight: 1.6 }}>
                        <strong style={{ color: "#999" }}>Patient notes:</strong> {a.notes}
                      </p>
                    ) : null}
                    {a.status === "Approved" && a.meetingLink ? (
                      <div style={{ marginTop: 10, fontSize: 13 }}>
                        <span style={{ color: "#4ade80", fontWeight: 700 }}>Meeting link:</span>{" "}
                        <a href={a.meetingLink} target="_blank" rel="noreferrer" style={{ color: "#60a5fa", textDecoration: "none" }}>
                          {a.meetingLink}
                        </a>
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 20, padding: "5px 12px", whiteSpace: "nowrap" }}>
                      {a.status}
                    </span>
                    {isPending ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 320 }}>
                        <input
                          type="url"
                          placeholder="Paste Google Meet / Zoom link"
                          value={meetingLinks[a.id] || ""}
                          onChange={(e) => setMeetingLinks((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          style={{ width: "100%", border: "1px solid rgba(96,165,250,0.30)", background: "rgba(96,165,250,0.08)", color: "#cfe3ff", borderRadius: 9, height: 34, padding: "0 10px", fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}
                        />
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => update(a.id, "Approved")}
                          style={{ border: "1px solid rgba(74,222,128,0.35)", background: "rgba(74,222,128,0.10)", color: "#4ade80", borderRadius: 9, height: 32, padding: "0 10px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700 }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => update(a.id, "Rejected")}
                          style={{ border: "1px solid rgba(248,113,113,0.35)", background: "rgba(248,113,113,0.10)", color: "#f87171", borderRadius: 9, height: 32, padding: "0 10px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700 }}
                        >
                          Reject
                        </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </DarkCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
