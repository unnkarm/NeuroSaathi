import { useEffect, useState } from "react";
import { DarkCard, Btn } from "../components/RiskDashboard";
import { getUser } from "../services/api";
import { listPatientAppointments, resolvePersonId } from "../services/appointments";

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

export default function PatientAppointments({ setPage }) {
  const user = getUser();
  const patientId = resolvePersonId(user);
  const [items, setItems] = useState([]);

  function load() {
    setItems(listPatientAppointments(patientId));
  }

  useEffect(() => {
    load();
    const onStorage = () => load();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 900, fontSize: "clamp(26px,3vw,40px)", color: "#fff", letterSpacing: "-1px", marginBottom: 8 }}>
          My Appointments
        </h1>
        <p style={{ color: "#666", fontSize: 14, lineHeight: 1.7 }}>
          Track doctor responses to your consultation requests. Status colors: <span style={{ color: "#fbbf24" }}>Pending</span>, <span style={{ color: "#4ade80" }}>Approved</span>, <span style={{ color: "#f87171" }}>Rejected</span>.
        </p>
      </div>

      {items.length === 0 ? (
        <DarkCard style={{ padding: 40, textAlign: "center" }} hover={false}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>📅</div>
          <div style={{ fontSize: 20, color: "#fff", fontWeight: 800, marginBottom: 8 }}>No Appointment Requests Yet</div>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>Book your first consultation to continue from screening to specialist follow-up.</p>
          <Btn onClick={() => setPage("book-appointment")}>Book Appointment</Btn>
        </DarkCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((a) => {
            const s = STATUS_STYLE[a.status] || STATUS_STYLE.Pending;
            return (
              <DarkCard key={a.id} style={{ padding: 20, border: `1px solid ${s.border}` }} hover={false}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, color: "#fff", fontWeight: 700 }}>{a.doctorName}</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{a.doctorSpecialization}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>{fmt(a.date, a.time)}</div>
                    {a.notes ? (
                      <p style={{ marginTop: 10, marginBottom: 0, color: "#777", fontSize: 13, lineHeight: 1.6 }}>
                        <strong style={{ color: "#999" }}>Your notes:</strong> {a.notes}
                      </p>
                    ) : null}
                    {a.status === "Approved" && a.meetingLink ? (
                      <div style={{ marginTop: 10 }}>
                          <a href={a.meetingLink} target="_blank" rel="noreferrer" style={{ color: "#60a5fa", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                          Join meeting: {a.meetingLink}
                          </a>
                      </div>
                    ) : null}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 20, padding: "5px 12px", whiteSpace: "nowrap" }}>
                    {a.status}
                  </span>
                </div>
              </DarkCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
