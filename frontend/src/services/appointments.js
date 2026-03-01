const APPOINTMENTS_KEY = "mindsaathi_appointments_v1";
const DOCTOR_DIR_KEY = "mindsaathi_doctor_directory_v1";

const DEFAULT_DOCTORS = [
  { id: "demo-dr-1", full_name: "Dr. Aditi Mehra", specialization: "Neurology", hospital: "MindCare Neuro Clinic" },
  { id: "demo-dr-2", full_name: "Dr. Rohan Iyer", specialization: "Neuropsychiatry", hospital: "Cognitive Wellness Center" },
  { id: "demo-dr-3", full_name: "Dr. Kavya Menon", specialization: "Geriatric Neurology", hospital: "NeuroLife Hospital" },
];

function parseJSON(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function resolvePersonId(user) {
  if (!user) return "anonymous";
  return String(user.id || user.email || user.full_name || "anonymous");
}

export function listAppointments() {
  return parseJSON(localStorage.getItem(APPOINTMENTS_KEY), []);
}

export function saveAppointments(items) {
  localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(items));
}

export function upsertDoctorDirectory(doctor) {
  if (!doctor?.id || !doctor?.full_name) return;
  const current = getDoctorDirectory();
  const exists = current.some((d) => String(d.id) === String(doctor.id));
  if (!exists) {
    current.push(doctor);
    localStorage.setItem(DOCTOR_DIR_KEY, JSON.stringify(current));
  }
}

export function getDoctorDirectory() {
  const fromStorage = parseJSON(localStorage.getItem(DOCTOR_DIR_KEY), []);
  const merged = [...DEFAULT_DOCTORS];
  fromStorage.forEach((d) => {
    if (!merged.some((m) => String(m.id) === String(d.id))) merged.push(d);
  });
  return merged;
}

export function createAppointment(payload) {
  const all = listAppointments();
  const item = {
    id: uid(),
    patientId: String(payload.patientId),
    patientName: payload.patientName || "Patient",
    patientEmail: payload.patientEmail || "",
    doctorId: String(payload.doctorId),
    doctorName: payload.doctorName || "Doctor",
    doctorSpecialization: payload.doctorSpecialization || "Neurology",
    date: payload.date,
    time: payload.time,
    notes: payload.notes || "",
    status: "Pending",
    meetingLink: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  all.push(item);
  saveAppointments(all);
  return item;
}

export function listPatientAppointments(patientId) {
  return listAppointments()
    .filter((a) => String(a.patientId) === String(patientId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function listDoctorAppointments(doctorId) {
  return listAppointments()
    .filter((a) => String(a.doctorId) === String(doctorId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function updateAppointmentStatus(appointmentId, status, providedMeetingLink = "") {
  const all = listAppointments();
  const next = all.map((a) => {
    if (a.id !== appointmentId) return a;
    const approved = status === "Approved";
    const safeProvidedLink = String(providedMeetingLink || "").trim();
    const meetingLink = approved
      ? (safeProvidedLink || `https://meet.mindsaathi.demo/session/${a.id}`)
      : null;
    return {
      ...a,
      status,
      meetingLink,
      updatedAt: new Date().toISOString(),
    };
  });
  saveAppointments(next);
  return next.find((a) => a.id === appointmentId) || null;
}
