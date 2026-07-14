import { normalizeMaintenanceAccountingTreatment } from "../domain/maintenance.ts";
import { toLocalIsoDate } from "../lib/localDate.ts";
import type { DocumentItem, Vendor, WorkOrder, WorkOrderStatus } from "../models.ts";
import type { AppendActivityLog } from "./activityStore.ts";
import { formatUsPhone } from "./propertyStore.ts";
import { normalizeStringArray } from "./storeUtils.ts";

type StateSetter<T> = (updater: T[] | ((previous: T[]) => T[])) => void;

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

export function createMaintenanceActions({
  getVendors,
  getWorkOrders,
  setVendors,
  setWorkOrders,
  setDocuments,
  appendActivityLog,
}: {
  getVendors: () => Vendor[];
  getWorkOrders: () => WorkOrder[];
  setVendors: StateSetter<Vendor>;
  setWorkOrders: StateSetter<WorkOrder>;
  setDocuments: StateSetter<DocumentItem>;
  appendActivityLog: AppendActivityLog;
}) {
  return {
    addOrUpdateVendor(vendor: Vendor) {
      const normalized: Vendor = {
        ...vendor,
        name: String(vendor.name || "").trim(),
        aliases: Array.isArray(vendor.aliases)
          ? Array.from(new Set(vendor.aliases.map((alias) => String(alias || "").trim()).filter(Boolean)))
          : [],
        phone: formatUsPhone(vendor.phone),
        email: String(vendor.email || "").trim(),
        defaultCategory: String(vendor.defaultCategory || "").trim(),
        notes: String(vendor.notes || "").trim(),
        active: vendor.active !== false,
      };
      const existsBefore = getVendors().some((item) => item.id === normalized.id);
      setVendors((previous) => {
        const exists = previous.some((item) => item.id === normalized.id);
        if (exists) return previous.map((item) => (item.id === normalized.id ? normalized : item));
        return [normalized, ...previous];
      });
      appendActivityLog({
        action: existsBefore ? "update" : "create",
        entityType: "vendor",
        entityId: normalized.id,
        summary: existsBefore ? "Vendor updated." : "Vendor created.",
        details: normalized.name,
      });
    },
    deleteVendor(id: string) {
      const existingVendor = getVendors().find((vendor) => vendor.id === id);
      setVendors((previous) => previous.filter((vendor) => vendor.id !== id));
      setWorkOrders((previous) => previous.map((workOrder) => (workOrder.vendorId === id ? { ...workOrder, vendorId: "" } : workOrder)));
      appendActivityLog({
        action: "delete",
        entityType: "vendor",
        entityId: id,
        summary: "Vendor deleted.",
        details: existingVendor?.name,
      });
    },
    addOrUpdateWorkOrder(workOrder: WorkOrder) {
      const normalized = normalizeWorkOrder(workOrder);
      const existsBefore = getWorkOrders().some((item) => item.id === normalized.id);
      setWorkOrders((previous) => {
        const exists = previous.some((item) => item.id === normalized.id);
        if (exists) return previous.map((item) => (item.id === normalized.id ? normalized : item));
        return [normalized, ...previous];
      });
      appendActivityLog({
        action: existsBefore ? "update" : "create",
        entityType: "work-order",
        entityId: normalized.id,
        propertyId: normalized.propertyId,
        unit: normalized.unit,
        summary: existsBefore ? "Work order updated." : "Work order created.",
        details: normalized.title,
      });
    },
    deleteWorkOrder(id: string) {
      const existingWorkOrder = getWorkOrders().find((workOrder) => workOrder.id === id);
      setWorkOrders((previous) => previous.filter((workOrder) => workOrder.id !== id));
      setDocuments((previous) => previous.filter((document) => document.workOrderId !== id));
      appendActivityLog({
        action: "delete",
        entityType: "work-order",
        entityId: id,
        propertyId: existingWorkOrder?.propertyId,
        unit: existingWorkOrder?.unit,
        summary: "Work order deleted.",
        details: existingWorkOrder?.title,
      });
    },
    setWorkOrderStatus(id: string, status: WorkOrderStatus) {
      const normalizedStatus = normalizeWorkOrderStatus(status);
      const existingWorkOrder = getWorkOrders().find((workOrder) => workOrder.id === id);
      const completedToday = toLocalIsoDate();
      setWorkOrders((previous) => previous.map((workOrder) => {
        if (workOrder.id !== id) return workOrder;
        return {
          ...workOrder,
          status: normalizedStatus,
          completedAt: normalizedStatus === "Completed"
            ? workOrder.completedAt || completedToday
            : normalizedStatus === "Canceled"
              ? ""
              : workOrder.completedAt,
        };
      }));
      if (existingWorkOrder && existingWorkOrder.status !== normalizedStatus) {
        appendActivityLog({
          action: "status",
          entityType: "work-order",
          entityId: id,
          propertyId: existingWorkOrder.propertyId,
          unit: existingWorkOrder.unit,
          summary: `Work order status changed to ${normalizedStatus}.`,
          details: existingWorkOrder.title,
        });
      }
    },
    assignWorkOrderVendor(id: string, vendorId: string) {
      const existingWorkOrder = getWorkOrders().find((workOrder) => workOrder.id === id);
      setWorkOrders((previous) => previous.map((workOrder) => (workOrder.id === id ? { ...workOrder, vendorId } : workOrder)));
      if (existingWorkOrder && String(existingWorkOrder.vendorId || "") !== String(vendorId || "")) {
        const vendorLabel = getVendors().find((vendor) => vendor.id === vendorId)?.name || "Unassigned";
        appendActivityLog({
          action: "assign",
          entityType: "work-order",
          entityId: id,
          propertyId: existingWorkOrder.propertyId,
          unit: existingWorkOrder.unit,
          summary: "Work order vendor assigned.",
          details: vendorLabel,
        });
      }
    },
    updateWorkOrderAccounting(id: string, patch: Partial<Pick<WorkOrder, "accountingTreatment" | "accountingReviewed" | "accountingReviewNotes" | "tenantLedgerEntryId" | "reimbursementTransactionId">>) {
      const existingWorkOrder = getWorkOrders().find((workOrder) => workOrder.id === id);
      setWorkOrders((previous) => previous.map((workOrder) => (
        workOrder.id === id ? normalizeWorkOrder({ ...workOrder, ...patch }) : workOrder
      )));
      if (existingWorkOrder) {
        appendActivityLog({
          action: "review",
          entityType: "work-order",
          entityId: id,
          propertyId: existingWorkOrder.propertyId,
          unit: existingWorkOrder.unit,
          summary: "Work order accounting review updated.",
          details: existingWorkOrder.title,
        });
      }
    },
    linkWorkOrderTransaction(id: string, transactionId: string) {
      const existingWorkOrder = getWorkOrders().find((workOrder) => workOrder.id === id);
      setWorkOrders((previous) => previous.map((workOrder) => (
        workOrder.id === id ? normalizeWorkOrder({ ...workOrder, transactionId }) : workOrder
      )));
      if (existingWorkOrder && String(existingWorkOrder.transactionId || "") !== String(transactionId || "")) {
        appendActivityLog({
          action: "link",
          entityType: "work-order",
          entityId: id,
          propertyId: existingWorkOrder.propertyId,
          unit: existingWorkOrder.unit,
          summary: transactionId ? "Work order linked to transaction." : "Work order transaction link removed.",
          details: transactionId || existingWorkOrder.title,
        });
      }
    },
    linkWorkOrderAsset(id: string, assetId: string) {
      const existingWorkOrder = getWorkOrders().find((workOrder) => workOrder.id === id);
      setWorkOrders((previous) => previous.map((workOrder) => (
        workOrder.id === id ? normalizeWorkOrder({ ...workOrder, assetId }) : workOrder
      )));
      if (existingWorkOrder && String(existingWorkOrder.assetId || "") !== String(assetId || "")) {
        appendActivityLog({
          action: "link",
          entityType: "work-order",
          entityId: id,
          propertyId: existingWorkOrder.propertyId,
          unit: existingWorkOrder.unit,
          summary: assetId ? "Work order linked to asset." : "Work order asset link removed.",
          details: assetId || existingWorkOrder.title,
        });
      }
    },
  };
}
