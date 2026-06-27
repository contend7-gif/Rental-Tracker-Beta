const SECTION_TARGETS = {
  assets: "assets",
  documents: "documents",
  leases: "leaseHistory",
  loans: "loans",
  maintenance: "maintenance",
  occupancy: "leaseHistory",
  tax: "tax",
  tenantLedger: "leaseHistory",
  transactions: "ledger",
};

export function normalizeReviewRoute(target = "review") {
  if (typeof target === "string") return { view: target };
  if (!target || typeof target !== "object") return { view: "review" };
  return {
    view: target.view || SECTION_TARGETS[target.sectionKey] || "review",
    sectionKey: target.sectionKey || "",
    entityType: target.entityType || "",
    entityId: target.entityId || "",
    issueKey: target.issueKey || "",
    propertyFilter: target.propertyFilter,
    unitFilter: target.unitFilter,
    yearFilter: target.yearFilter,
    record: target.record,
  };
}

export function routeForReviewSection(sectionKey, fallbackView = "review") {
  return normalizeReviewRoute({
    view: SECTION_TARGETS[sectionKey] || fallbackView,
    sectionKey,
  });
}

export function routeForTransactionReview(transaction, issueKey = "", sourceView = "review") {
  return normalizeReviewRoute({
    view: "ledger",
    sectionKey: "transactions",
    entityType: "transaction",
    entityId: transaction?.id || "",
    issueKey,
    record: transaction,
    sourceView,
  });
}

export function runReviewRoute(route, handlers = {}) {
  const normalized = normalizeReviewRoute(route);
  if (normalized.entityType === "transaction" && normalized.record && handlers.openTransaction) {
    handlers.openTransaction(normalized.record, "review", false, normalized.issueKey || "");
    return normalized;
  }
  handlers.navigate?.(normalized);
  return normalized;
}
