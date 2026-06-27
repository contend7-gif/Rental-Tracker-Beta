export const DEFAULT_DESKTOP_UPDATE_STATE = {
  status: "unavailable",
  message: "Update checks are available in installed desktop builds.",
  currentVersion: "",
  availableVersion: "",
  downloadedVersion: "",
  progressPercent: 0,
  checkedAt: "",
  releaseDate: "",
  releaseName: "",
  releaseNotesUrl: "",
  releaseNotes: [],
  error: "",
  packaged: false,
};

export const DESKTOP_UPDATE_STATUS_LABELS = {
  idle: "Idle",
  unavailable: "Desktop only",
  checking: "Checking",
  available: "Available",
  downloading: "Downloading",
  downloaded: "Ready",
  "up-to-date": "Up to date",
  error: "Error",
};

export function formatDesktopUpdateDate(dateText) {
  if (!dateText) return "";
  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString();
}

export function normalizeReleaseNotesLines(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((line) => String(line || "").trim())
    .filter(Boolean);
}

export function desktopUpdateBadgeClass(status) {
  if (status === "downloaded") return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (status === "downloading" || status === "available" || status === "checking") return "border-blue-300 bg-blue-50 text-blue-700";
  if (status === "error") return "border-rose-300 bg-rose-50 text-rose-700";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

export function desktopDiagnosticPillClass(isHealthy) {
  return isHealthy
    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
    : "border-amber-300 bg-amber-50 text-amber-700";
}

export function desktopDiagnosticEventClass(level) {
  if (level === "error") return "border-rose-200 bg-rose-50 text-rose-800";
  if (level === "warn") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}
