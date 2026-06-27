export const AUDIT_BADGE_STYLES = {
  ready: "!border-emerald-200 !bg-emerald-50 !text-emerald-700",
  complete: "!border-emerald-200 !bg-emerald-50 !text-emerald-700",
  reviewed: "!border-emerald-200 !bg-emerald-50 !text-emerald-700",
  needs_review: "!border-amber-200 !bg-amber-50 !text-amber-800",
  needs_setup: "!border-amber-200 !bg-amber-50 !text-amber-800",
  warning: "!border-amber-200 !bg-amber-50 !text-amber-800",
  invalid: "!border-rose-200 !bg-rose-50 !text-rose-800",
  not_applicable: "!border-slate-200 !bg-slate-50 !text-slate-600",
  not_tax_relevant: "!border-slate-200 !bg-slate-50 !text-slate-600",
  optional: "!border-slate-200 !bg-slate-50 !text-slate-600",
  unknown: "!border-slate-200 !bg-white !text-slate-700",
};

export const READINESS_TONES = {
  ready: "ready",
  complete: "ready",
  reviewed: "ready",
  needs_review: "warning",
  needs_setup: "warning",
  warning: "warning",
  invalid: "blocking",
  blocking: "blocking",
  not_applicable: "neutral",
  not_tax_relevant: "neutral",
  optional: "neutral",
  unknown: "neutral",
};

export function normalizeAuditStatus(input = {}) {
  if (typeof input === "string") {
    return { key: input, label: labelForAuditKey(input), issueCount: 0 };
  }
  const key = input.key || input.status || (Number(input.issueCount || input.issues?.length || 0) > 0 ? "needs_review" : "ready");
  return {
    key,
    label: input.label || labelForAuditKey(key),
    issueCount: Number(input.issueCount ?? input.issues?.length ?? 0),
  };
}

export function normalizeReadiness(input = {}, options = {}) {
  const normalized = normalizeAuditStatus(input);
  const issues = Array.isArray(input?.issues) ? input.issues : [];
  const issueCount = Number(normalized.issueCount || issues.length || 0);
  const blockingCount = issues.filter((issue) => issue?.blocking !== false).length;
  const key = normalized.key || (issueCount > 0 ? "needs_review" : "ready");
  const tone = READINESS_TONES[key] || READINESS_TONES.unknown;
  const isReady = tone === "ready" || key === "not_applicable" || key === "not_tax_relevant" || key === "optional";

  return {
    key,
    label: normalized.label || options.readyLabel || labelForAuditKey(key),
    issueCount,
    blockingCount,
    tone,
    isReady,
    isActionable: issueCount > 0 || tone === "warning" || tone === "blocking",
  };
}

export function labelForAuditKey(key) {
  if (key === "ready" || key === "complete" || key === "reviewed") return "Ready";
  if (key === "blocking") return "Blocking";
  if (key === "needs_setup") return "Needs setup";
  if (key === "needs_review" || key === "warning") return "Needs review";
  if (key === "invalid") return "Invalid";
  if (key === "not_applicable") return "Not applicable";
  if (key === "not_tax_relevant") return "Not tax relevant";
  if (key === "optional") return "Optional";
  return "Review status";
}

export function auditBadgeClass(status) {
  const normalized = normalizeAuditStatus(status);
  return AUDIT_BADGE_STYLES[normalized.key] || AUDIT_BADGE_STYLES.unknown;
}

export function readinessBadgeClass(status) {
  const normalized = normalizeReadiness(status);
  return AUDIT_BADGE_STYLES[normalized.key] || AUDIT_BADGE_STYLES.unknown;
}

export function auditStatusFromIssues(issues = [], readyLabel = "Ready") {
  const count = Array.isArray(issues) ? issues.length : 0;
  if (count > 0) return { key: "needs_review", label: `${count} review item${count === 1 ? "" : "s"}`, issueCount: count };
  return { key: "ready", label: readyLabel, issueCount: 0 };
}

export function readinessSummaryFromRecords(records = [], options = {}) {
  const statuses = (Array.isArray(records) ? records : []).map((record) => normalizeReadiness(record?.readiness || record, options));
  const readyCount = statuses.filter((status) => status.isReady).length;
  const needsReviewCount = statuses.filter((status) => status.tone === "warning").length;
  const blockingCount = statuses.reduce((sum, status) => sum + (status.tone === "blocking" ? Math.max(1, status.blockingCount || 0) : status.blockingCount || 0), 0);
  const openCount = statuses.length - readyCount;

  return {
    totalCount: statuses.length,
    readyCount,
    openCount,
    needsReviewCount,
    blockingCount,
    label: openCount > 0 ? `${openCount} open` : options.readyLabel || "Ready",
    key: blockingCount > 0 ? "blocking" : openCount > 0 ? "needs_review" : "ready",
  };
}

export function hasBlockingAuditIssues(issues = []) {
  return Array.isArray(issues) && issues.some((issue) => issue?.blocking !== false);
}

export function canRunSafeBulkReview(records = []) {
  return Array.isArray(records) && records.length > 0 && records.every((record) => !hasBlockingAuditIssues(record.issues || record.readiness?.issues || []));
}
