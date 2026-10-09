export type MaintenanceReport = { title: string; location: string; urgency: "Routine" | "Soon" | "Urgent"; details: string };
const singleLine = (value: string, limit: number) => value.trim().replace(/\s+/g, " ").slice(0, limit);
export function formatMaintenanceReport(report: MaintenanceReport): string {
  return `Issue: ${singleLine(report.title, 80)}\nLocation: ${singleLine(report.location, 80)}\nUrgency: ${report.urgency}\nDetails: ${singleLine(report.details, 280)}`;
}
export function parseMaintenanceReport(note: string | null | undefined): MaintenanceReport | null {
  const match = /^Issue: ([^\n]{1,80})\nLocation: ([^\n]{0,80})\nUrgency: (Routine|Soon|Urgent)\nDetails: ([^\n]{1,280})$/.exec((note || "").replace(/\r\n?/g, "\n"));
  return match ? { title: match[1], location: match[2], urgency: match[3] as MaintenanceReport["urgency"], details: match[4] } : null;
}
export function cleanCaptureNote(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const report = parseMaintenanceReport(value.trim());
  return report ? formatMaintenanceReport(report) : singleLine(value, 500) || null;
}
