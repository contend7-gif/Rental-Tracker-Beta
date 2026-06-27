const GENERIC_DOCUMENT_TAGS = new Set([
  "document",
  "file",
  "property",
  "property-document",
  "scan",
  "scanned",
  "supporting-only",
  "uploaded",
]);

const normalizeTag = (value) => String(value || "").trim().toLowerCase();

export const VISIBLE_RENT_SCHEDULE_HELP = "Visible scheduled rent is calculated from lease rows through the selected as-of date and may be partial when lease history is incomplete.";
export const SENSITIVE_NOTE_REVEAL_MS = 60_000;
export const PROPERTY_PHOTO_CATEGORIES = ["Exterior", "Interior", "Unit", "Appliance", "System", "Condition", "Other"];

export function documentRenewalStatus(expiresOn, asOfDate, warningDays = 60) {
  const expiry = String(expiresOn || "").trim();
  const asOf = String(asOfDate || "").trim();
  if (!expiry || !asOf) return { key: "not-tracked", label: "Renewal not tracked", actionable: false };
  if (expiry < asOf) return { key: "expired", label: `Expired ${expiry}`, actionable: true };
  const warningDate = new Date(`${asOf}T12:00:00`);
  warningDate.setDate(warningDate.getDate() + warningDays);
  const warningIso = warningDate.toISOString().slice(0, 10);
  if (expiry <= warningIso) return { key: "due-soon", label: `Renews ${expiry}`, actionable: true };
  return { key: "current", label: `Renews ${expiry}`, actionable: false };
}

export function propertyActivityEntries(activityLog = [], propertyId, limit = 8) {
  return activityLog
    .filter((entry) => entry?.propertyId === propertyId)
    .sort((left, right) => String(right.at || "").localeCompare(String(left.at || "")))
    .slice(0, limit);
}

export function readinessRecordSection(section) {
  if (section === "operations") return "notes";
  return section || "valuation";
}

export function usefulPropertyDocumentTags(document, limit = 3) {
  const typeTag = normalizeTag(document?.type).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return Array.from(new Set((document?.tags || []).map(normalizeTag)))
    .filter((tag) => tag && tag.length > 1 && tag.length <= 32)
    .filter((tag) => !GENERIC_DOCUMENT_TAGS.has(tag) && tag !== typeTag)
    .slice(0, limit);
}

export function buildUnitOccupancyTimeline(unitName, occupancyPeriods = [], leases = []) {
  const occupancyRows = occupancyPeriods.map((period) => ({
    id: `occupancy-${period.id}`,
    kind: period.useType === "Vacant" ? "vacancy" : "occupancy",
    label: period.useType === "Owner-Occupied" ? "Owner occupied" : period.useType,
    startDate: period.startDate || "",
    endDate: period.endDate || "",
    detail: period.reviewed ? "Reviewed occupancy record" : "Occupancy record",
  }));
  const leaseRows = leases
    .filter((lease) => lease.unit === unitName)
    .map((lease) => ({
      id: `lease-${lease.id}`,
      kind: "lease",
      label: lease.tenantName ? `Lease - ${lease.tenantName}` : "Lease",
      startDate: lease.startDate || "",
      endDate: lease.actualEndDate || lease.endDate || "",
      detail: Number(lease.monthlyRent || 0) > 0 ? `${Number(lease.monthlyRent).toLocaleString("en-US", { style: "currency", currency: "USD" })} / mo` : "Rent not set",
    }));

  return [...occupancyRows, ...leaseRows].sort((left, right) => {
    const startCompare = String(right.startDate).localeCompare(String(left.startDate));
    if (startCompare !== 0) return startCompare;
    return String(right.endDate).localeCompare(String(left.endDate));
  });
}
