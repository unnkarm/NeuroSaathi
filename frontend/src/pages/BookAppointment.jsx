import { useEffect, useMemo, useState } from "react";
import { DarkCard, Btn } from "../components/RiskDashboard";
import { getUser } from "../services/api";
import {
  createAppointment,
  getDoctorDirectory,
  resolvePersonId,
  upsertDoctorDirectory,
} from "../services/appointments";

const LIME = "#C8F135";
const BLU = "#60a5fa";

function formatDate(dateString) {
  if (!dateString) return "—";
  const d = new Date(`${dateString}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function BookAppointment({ setPage }) {
  const user = getUser();
  const patientId = resolvePersonId(user);

  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const list = getDoctorDirectory();
    setDoctors(list);
    if (list.length > 0) setDoctorId(String(list[0].id));
  }, []);

  const selectedDoctor = useMemo(
    () => doctors.find((d) => String(d.id) === String(doctorId)) || null,
    [doctorId, doctors]
  );

  function submit(e) {
    e.preventDefault();
    setMsg("");
    setErr("");

    if (!doctorId || !date || !time) {
      setErr("Please select doctor, date, and time.");
      return;
    }

    const today = new Date();
    const slot = new Date(`${date}T${time}`);
    if (slot < today) {
      setErr("Please choose a future date/time slot.");
      return;
    }

    const doctor = selectedDoctor;
    if (!doctor) {
      setErr("Selected doctor is unavailable.");
      return;
    }

    upsertDoctorDirectory(doctor);
    createAppointment({
      patientId,
      patientName: user?.full_name || "Patient",
      patientEmail: user?.email || "",
      doctorId: doctor.id,
      doctorName: doctor.full_name,
      doctorSpecialization: doctor.specialization || "Neurology",
      date,
      time,
      notes,
    });

    setMsg("Appointment request submitted. Status: Pending.");
    setNotes("");
    setDate("");
    setTime("");
  }

  return (
    <div>
      <div style={{ marginBottom: 30 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(96,165,250,0.10)", border: "1px solid rgba(96,165,250,0.35)", borderRadius: 99, padding: "5px 14px", marginBottom: 14, fontSize: 11, fontWeight: 700, color: BLU, letterSpacing: 1.5, textTransform: "uppercase" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: BLU, display: "inline-block" }} />
          Screening to Consultation
        </div>
        <h1 style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 900, fontSize: "clamp(28px,3vw,42px)", color: "#fff", letterSpacing: "-1px", marginBottom: 8 }}>
          Book Appointment
        </h1>
        <p style={{ color: "#666", fontSize: 14, maxWidth: 640, lineHeight: 1.7 }}>
          Continue your cognitive risk journey by requesting a specialist consultation. Your appointment starts as <strong style={{ color: "#fbbf24" }}>Pending</strong> until the doctor reviews it.
        </p>
      </div>

      <DarkCard style={{ padding: 26, marginBottom: 16 }} hover={false}>
        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: "#888", marginBottom: 6, display: "block" }}>Select Doctor</label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.03)", color: "#eee", padding: "0 12px", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}
              >
                {doctors.map((d) => (
                  <option key={d.id} value={d.id} style={{ background: "#111" }}>
                    {d.full_name} - {d.specialization || "Neurology"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#888", marginBottom: 6, display: "block" }}>Preferred Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.03)", color: "#eee", padding: "0 12px", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#888", marginBottom: 6, display: "block" }}>Preferred Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.03)", color: "#eee", padding: "0 12px", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#888", marginBottom: 6, display: "block" }}>Requested Slot</label>
              <div style={{ height: 42, borderRadius: 10, border: "1px solid rgba(200,241,53,0.20)", background: "rgba(200,241,53,0.07)", color: LIME, display: "flex", alignItems: "center", padding: "0 12px", fontSize: 13, fontWeight: 600 }}>
                {formatDate(date)} {time ? `• ${time}` : ""}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: "#888", marginBottom: 6, display: "block" }}>Notes for Doctor</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Share concerns: memory lapses, reaction changes, sleep pattern, etc."
              rows={4}
              style={{ width: "100%", borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.03)", color: "#eee", padding: "10px 12px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, resize: "vertical" }}
            />
          </div>

          {msg && (
            <div style={{ marginBottom: 12, borderRadius: 10, border: "1px solid rgba(74,222,128,0.35)", background: "rgba(74,222,128,0.10)", color: "#4ade80", fontSize: 13, padding: "10px 12px" }}>
              ✓ {msg}
            </div>
          )}
          {err && (
            <div style={{ marginBottom: 12, borderRadius: 10, border: "1px solid rgba(232,64,64,0.35)", background: "rgba(232,64,64,0.10)", color: "#ff7070", fontSize: 13, padding: "10px 12px" }}>
              ⚠️ {err}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn>Submit Request</Btn>
            <Btn variant="ghost" onClick={() => setPage("my-appointments")}>View My Appointments</Btn>
          </div>
        </form>
      </DarkCard>
    </div>
  );
}
