import type { MaintenanceAccountingTreatment, Transaction, WorkOrder, WorkOrderStatus } from "../models.ts";

export const WORK_ORDER_STATUS_ORDER: WorkOrderStatus[] = [
  "Open",
  "In Progress",
  "Waiting on Parts",
  "Completed",
  "Closed",
  "Canceled",
];

export const MAINTENANCE_ACCOUNTING_TREATMENT_OPTIONS: { value: MaintenanceAccountingTreatment; label: string }[] = [
  { value: "needs_review", label: "Needs review" },
  { value: "repair_maintenance", label: "Repair / maintenance" },
  { value: "cleaning_turnover", label: "Cleaning / turnover" },
  { value: "supplies", label: "Supplies" },
  { value: "capital_improvement", label: "Capital improvement" },
  { value: "tenant_damage", label: "Tenant damage" },
  { value: "owner_only", label: "Owner-only / non-rental" },
  { value: "non_deductible", label: "Non-deductible" },
  { value: "warranty_repair", label: "Warranty repair" },
  { value: "reimbursed", label: "Reimbursed" },
];

const ACCOUNTING_TREATMENT_LABELS = Object.fromEntries(
  MAINTENANCE_ACCOUNTING_TREATMENT_OPTIONS.map((option) => [option.value, option.label]),
) as Record<MaintenanceAccountingTreatment, string>;

export function normalizeMaintenanceAccountingTreatment(value: unknown): MaintenanceAccountingTreatment {
  const normalized = String(value || "").trim();
  return MAINTENANCE_ACCOUNTING_TREATMENT_OPTIONS.some((option) => option.value === normalized)
    ? (normalized as MaintenanceAccountingTreatment)
    : "needs_review";
}

export function maintenanceAccountingTreatmentLabel(value: unknown) {
  return ACCOUNTING_TREATMENT_LABELS[normalizeMaintenanceAccountingTreatment(value)];
}

export function categoryForMaintenanceAccountingTreatment(value: unknown, fallback = "Repairs") {
  switch (normalizeMaintenanceAccountingTreatment(value)) {
    case "cleaning_turnover":
      return "Cleaning";
    case "supplies":
      return "Supplies";
    case "owner_only":
    case "non_deductible":
      return "Other expenses";
    case "tenant_damage":
      return "Repairs";
    case "capital_improvement":
      return "Repairs";
    case "warranty_repair":
    case "reimbursed":
    case "repair_maintenance":
      return "Repairs";
    default:
      return fallback || "Repairs";
  }
}

export type WorkOrderStatusSummaryRow = {
  status: WorkOrderStatus;
  count: number;
};

export type MaintenanceRollupRow = {
  propertyId: string;
  unit: string;
  workOrderCount: number;
  completedCount: number;
  openCount: number;
  totalCost: number;
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveWorkOrderCost(
  workOrder: WorkOrder,
  transactionsById: Record<string, Pick<Transaction, "amount"> | undefined> = {},
) {
  const actualCost = toNumber(workOrder.actualCost, -1);
  if (actualCost >= 0) return actualCost;

  if (workOrder.transactionId) {
    const linkedAmount = toNumber(transactionsById[workOrder.transactionId]?.amount, -1);
    if (linkedAmount >= 0) return linkedAmount;
  }

  return Math.max(0, toNumber(workOrder.estimatedCost, 0));
}

export function buildWorkOrderStatusSummary(workOrders: WorkOrder[]): WorkOrderStatusSummaryRow[] {
  const counts = Object.fromEntries(WORK_ORDER_STATUS_ORDER.map((status) => [status, 0])) as Record<WorkOrderStatus, number>;

  workOrders.forEach((workOrder) => {
    if (counts[workOrder.status] == null) return;
    counts[workOrder.status] += 1;
  });

  return WORK_ORDER_STATUS_ORDER.map((status) => ({ status, count: counts[status] }));
}

export function summarizeMaintenanceCostByPropertyUnit(
  workOrders: WorkOrder[],
  transactions: Transaction[],
): MaintenanceRollupRow[] {
  const transactionsById = Object.fromEntries(transactions.map((txn) => [txn.id, txn])) as Record<string, Transaction>;
  const grouped: Record<string, MaintenanceRollupRow> = {};

  workOrders.forEach((workOrder) => {
    const unit = String(workOrder.unit || "Shared");
    const key = `${workOrder.propertyId}::${unit}`;
    if (!grouped[key]) {
      grouped[key] = {
        propertyId: workOrder.propertyId,
        unit,
        workOrderCount: 0,
        completedCount: 0,
        openCount: 0,
        totalCost: 0,
      };
    }

    const row = grouped[key];
    row.workOrderCount += 1;

    if (workOrder.status === "Completed") {
      row.completedCount += 1;
    }
    if (workOrder.status !== "Completed" && workOrder.status !== "Canceled") {
      row.openCount += 1;
    }

    if (workOrder.status !== "Canceled") {
      row.totalCost += resolveWorkOrderCost(workOrder, transactionsById);
    }
  });

  return Object.values(grouped).sort((a, b) => {
    if (a.propertyId !== b.propertyId) return a.propertyId.localeCompare(b.propertyId);
    return a.unit.localeCompare(b.unit);
  });
}
