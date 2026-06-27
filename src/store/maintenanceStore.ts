import { normalizeMaintenanceAccountingTreatment } from "../domain/maintenance.ts";
import type { WorkOrder, WorkOrderStatus } from "../models.ts";
import { normalizeStringArray } from "./storeUtils.ts";

export const WORK_ORDER_STATUSES: WorkOrderStatus[] = ["Open", "In Progress", "Waiting on Parts", "Completed", "Closed", "Canceled"];

export function normalizeWorkOrderStatus(status: unknown): WorkOrderStatus {
  const value = String(status || "").trim();
  return WORK_ORDER_STATUSES.includes(value as WorkOrderStatus) ? (value as WorkOrderStatus) : "Open";
}

export function normalizeWorkOrder(workOrder: WorkOrder): WorkOrder {
  return {
    ...workOrder,
    title: String(workOrder.title || "").trim(),
    description: String(workOrder.description || "").trim(),
    priority: workOrder.priority || "Medium",
    status: normalizeWorkOrderStatus(workOrder.status),
    reportedOn: String(workOrder.reportedOn || "").trim(),
    dueDate: String(workOrder.dueDate || "").trim(),
    vendorId: String(workOrder.vendorId || "").trim(),
    estimatedCost: Number.isFinite(Number(workOrder.estimatedCost)) ? Number(workOrder.estimatedCost) : 0,
    actualCost: Number.isFinite(Number(workOrder.actualCost)) ? Number(workOrder.actualCost) : undefined,
    transactionId: String(workOrder.transactionId || "").trim(),
    accountingTreatment: normalizeMaintenanceAccountingTreatment(workOrder.accountingTreatment),
    accountingReviewed: Boolean(workOrder.accountingReviewed),
    accountingReviewNotes: String(workOrder.accountingReviewNotes || "").trim(),
    sourceDocumentIds: normalizeStringArray(workOrder.sourceDocumentIds),
    assetId: String(workOrder.assetId || "").trim() || undefined,
    tenantLedgerEntryId: String(workOrder.tenantLedgerEntryId || "").trim() || undefined,
    reimbursementTransactionId: String(workOrder.reimbursementTransactionId || "").trim() || undefined,
    createdAt: String(workOrder.createdAt || new Date().toISOString()),
    completedAt: String(workOrder.completedAt || "").trim(),
    notes: String(workOrder.notes || "").trim(),
  };
}
