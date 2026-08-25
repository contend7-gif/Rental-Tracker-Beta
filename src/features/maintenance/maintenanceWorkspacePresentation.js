const CLOSED_STATUSES = new Set(["Completed", "Closed"]);
const ACTIVE_STATUSES = new Set(["Open", "In Progress", "Waiting on Parts"]);

export function buildMaintenanceWorkspaceModes({
  activeCount = 0,
  cleanupCount = 0,
  historyCount = 0,
  vendorCount = 0,
} = {}) {
  return [
    {
      key: "active",
      label: "Active work",
      badge: `${activeCount} active`,
      description: "Triage open, in-progress, waiting, and overdue repairs.",
    },
    {
      key: "history",
      label: "History & costs",
      badge: `${historyCount} closed`,
      description: "Review completed or canceled work and resolved costs.",
    },
    {
      key: "cleanup",
      label: "Cleanup & accounting",
      badge: cleanupCount > 0 ? `${cleanupCount} open` : "Clear",
      description: "Resolve missing expenses, documents, and asset handoffs.",
    },
    {
      key: "vendors",
      label: "Vendors",
      badge: `${vendorCount} vendor${vendorCount === 1 ? "" : "s"}`,
      description: "Maintain assignment contacts and default categories.",
    },
  ];
}

export function maintenanceQuickFiltersForMode(mode) {
  if (mode === "history") {
    return [
      { key: "history", label: "All history" },
      { key: "completed", label: "Completed" },
      { key: "closed", label: "Closed" },
      { key: "canceled", label: "Canceled" },
    ];
  }
  if (mode === "cleanup") return [{ key: "needs_review", label: "Needs cleanup" }];
  return [
    { key: "active", label: "All active" },
    { key: "open", label: "Open" },
    { key: "in_progress", label: "In progress" },
    { key: "waiting", label: "Waiting on parts" },
    { key: "overdue", label: "Overdue" },
  ];
}

export function defaultMaintenanceQuickFilter(mode) {
  if (mode === "history") return "history";
  if (mode === "cleanup") return "needs_review";
  return "active";
}

export function formatMaintenanceDate(value, fallback = "Not set") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function workOrderPrimaryActionKey({ workOrder, linkedTxn, linkedAsset, hasActualCost }) {
  if (!workOrder) return "manage_work_order";

  const isClosed = CLOSED_STATUSES.has(workOrder.status);
  const isActive = ACTIVE_STATUSES.has(workOrder.status);
  const isCapitalWithoutAsset = workOrder.accountingTreatment === "capital_improvement" && !linkedAsset;

  if (isClosed && linkedTxn) return "view_expense";
  if (isClosed && !linkedTxn) return "create_expense";
  if (hasActualCost && !linkedTxn) return "create_expense";
  if (isCapitalWithoutAsset) return "create_asset";
  if (isActive) return "manage_work_order";
  if (linkedTxn) return "view_expense";

  return "manage_work_order";
}
