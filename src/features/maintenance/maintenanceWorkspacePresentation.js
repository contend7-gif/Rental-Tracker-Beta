const CLOSED_STATUSES = new Set(["Completed", "Closed"]);
const ACTIVE_STATUSES = new Set(["Open", "In Progress", "Waiting on Parts"]);

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
