import { useEffect, useMemo, useState } from "react";
import {
  buildWorkOrderStatusSummary,
  summarizeMaintenanceCostByPropertyUnit,
  WORK_ORDER_STATUS_ORDER,
} from "../domain/maintenance.ts";
import {
  createBlankVendorDraft,
  createBlankWorkOrderDraft,
} from "./draftFactories.js";
import {
  namesLikelyReferToSamePerson,
  normalizeCatalogName,
  scoreVendorForMaintenance,
} from "./formatHelpers.js";

const WORK_ORDER_PRIORITY_OPTIONS = ["Low", "Medium", "High", "Urgent"];

export function useMaintenanceWorkspaceController({
  actions,
  leases,
  properties,
  propertyFilter,
  requirePermission,
  setDocumentStatusFilter,
  setExpenseQueueShowDismissed,
  setNotice,
  todayIso,
  transactions,
  unitFilter,
  units,
  vendors,
  workOrders,
  openConfirmDialog,
  formatUsPhone,
}) {
  const [maintenanceStatusFilter, setMaintenanceStatusFilter] = useState("all");
  const [pendingDocumentWorkOrderSource, setPendingDocumentWorkOrderSource] = useState(null);
  const [vendorDraft, setVendorDraft] = useState(() => createBlankVendorDraft());
  const [editingVendorId, setEditingVendorId] = useState("");
  const [workOrderDraft, setWorkOrderDraft] = useState(() => createBlankWorkOrderDraft());

  const linkedWorkOrderCountByVendorId = useMemo(() => {
    const counts = {};
    workOrders.forEach((workOrder) => {
      if (!workOrder.vendorId) return;
      counts[workOrder.vendorId] = (counts[workOrder.vendorId] || 0) + 1;
    });
    return counts;
  }, [workOrders]);
  const tenantNames = useMemo(
    () => Array.from(new Set(leases.map((lease) => String(lease.tenantName || "").trim()).filter(Boolean))),
    [leases],
  );
  const maintenanceVendors = useMemo(() => {
    const deduped = new Map();

    vendors.forEach((vendor) => {
      if (vendor.active === false) return;
      const name = String(vendor.name || "").trim();
      if (!name) return;

      const linkedWorkOrderCount = linkedWorkOrderCountByVendorId[vendor.id] || 0;
      const looksLikeTenant = tenantNames.some((tenantName) => namesLikelyReferToSamePerson(name, tenantName));
      if (looksLikeTenant && linkedWorkOrderCount === 0) return;

      const dedupeKey = normalizeCatalogName(name);
      const existing = deduped.get(dedupeKey);
      if (
        !existing ||
        scoreVendorForMaintenance(vendor, linkedWorkOrderCount) >
          scoreVendorForMaintenance(existing, linkedWorkOrderCountByVendorId[existing.id] || 0)
      ) {
        deduped.set(dedupeKey, vendor);
      }
    });

    return Array.from(deduped.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [linkedWorkOrderCountByVendorId, tenantNames, vendors]);
  const hiddenMaintenanceVendorCount = useMemo(() => {
    const visibleIds = new Set(maintenanceVendors.map((vendor) => vendor.id));
    return vendors.filter((vendor) => vendor.active !== false && !visibleIds.has(vendor.id)).length;
  }, [maintenanceVendors, vendors]);

  const maintenanceScopedWorkOrders = useMemo(
    () =>
      workOrders.filter((workOrder) => {
        if (propertyFilter !== "all" && workOrder.propertyId !== propertyFilter) return false;
        if (unitFilter !== "all" && workOrder.unit !== unitFilter) return false;
        return true;
      }),
    [propertyFilter, unitFilter, workOrders],
  );
  const maintenanceVisibleWorkOrders = useMemo(() => {
    const filtered =
      maintenanceStatusFilter === "all"
        ? maintenanceScopedWorkOrders
        : maintenanceScopedWorkOrders.filter((workOrder) => workOrder.status === maintenanceStatusFilter);

    return [...filtered].sort((a, b) => {
      const aDue = a.dueDate || a.reportedOn || "";
      const bDue = b.dueDate || b.reportedOn || "";
      return aDue.localeCompare(bDue);
    });
  }, [maintenanceScopedWorkOrders, maintenanceStatusFilter]);
  const maintenanceStatusSummary = useMemo(
    () => buildWorkOrderStatusSummary(maintenanceScopedWorkOrders),
    [maintenanceScopedWorkOrders],
  );
  const maintenanceRollup = useMemo(
    () => summarizeMaintenanceCostByPropertyUnit(maintenanceScopedWorkOrders, transactions),
    [maintenanceScopedWorkOrders, transactions],
  );
  const maintenanceTotalCost = useMemo(
    () => maintenanceRollup.reduce((sum, row) => sum + Number(row.totalCost || 0), 0),
    [maintenanceRollup],
  );
  const workOrderUnitOptions = useMemo(() => {
    if (!workOrderDraft.propertyId) return ["Shared"];
    const names = ["Shared", ...units.filter((unit) => unit.propertyId === workOrderDraft.propertyId).map((unit) => unit.name)];
    return Array.from(new Set(names));
  }, [workOrderDraft.propertyId, units]);

  useEffect(() => {
    const firstPropertyId = properties[0]?.id || "";

    setWorkOrderDraft((prev) => {
      const propertyExists = prev.propertyId && properties.some((property) => property.id === prev.propertyId);
      const nextPropertyId = propertyExists ? prev.propertyId : firstPropertyId;
      const validUnits = new Set(["Shared", ...units.filter((unit) => unit.propertyId === nextPropertyId).map((unit) => unit.name)]);
      const nextUnit = validUnits.has(prev.unit) ? prev.unit : "Shared";

      if (prev.propertyId === nextPropertyId && prev.unit === nextUnit) {
        return prev;
      }
      return { ...prev, propertyId: nextPropertyId, unit: nextUnit };
    });
  }, [properties, units]);

  const resetVendorEditor = () => {
    setEditingVendorId("");
    setVendorDraft(createBlankVendorDraft());
  };

  const startEditingVendor = (vendor) => {
    if (!requirePermission("create_edit_records", "This access profile cannot edit vendors.")) return;
    setEditingVendorId(vendor.id);
    setVendorDraft({
      name: vendor.name || "",
      aliases: Array.isArray(vendor.aliases) ? vendor.aliases.join(", ") : "",
      phone: vendor.phone || "",
      email: vendor.email || "",
      defaultCategory: vendor.defaultCategory || "Repairs",
      notes: vendor.notes || "",
    });
    setNotice(`Editing vendor: ${vendor.name}.`);
  };

  const saveVendor = () => {
    if (!requirePermission("create_edit_records", `This access profile cannot ${editingVendorId ? "edit" : "add"} vendors.`)) return;
    const name = String(vendorDraft.name || "").trim();
    if (!name) {
      setNotice("Vendor name is required.");
      return;
    }

    const vendorId = editingVendorId || `vendor-${Date.now()}`;
    actions.addOrUpdateVendor({
      id: vendorId,
      name,
      aliases: String(vendorDraft.aliases || "").split(/[;,\n]/).map((alias) => alias.trim()).filter(Boolean),
      phone: formatUsPhone(vendorDraft.phone),
      email: String(vendorDraft.email || "").trim(),
      defaultCategory: String(vendorDraft.defaultCategory || "Repairs").trim() || "Repairs",
      notes: String(vendorDraft.notes || "").trim(),
      active: true,
    });

    resetVendorEditor();
    setNotice(editingVendorId ? `Vendor updated: ${name}.` : `Vendor added: ${name}.`);
  };

  const createWorkOrder = () => {
    if (!requirePermission("create_edit_records", "This access profile cannot create work orders.")) return;
    const propertyId = workOrderDraft.propertyId;
    const title = String(workOrderDraft.title || "").trim();
    if (!propertyId) {
      setNotice("Select a property for the work order.");
      return;
    }
    if (!title) {
      setNotice("Work order title is required.");
      return;
    }

    const nowIso = new Date().toISOString();
    const status = WORK_ORDER_STATUS_ORDER.includes(workOrderDraft.status) ? workOrderDraft.status : "Open";
    const workOrderId = `wo-${Date.now()}`;
    const linkedDocumentId = pendingDocumentWorkOrderSource?.documentId || "";
    const nextQueueName = String(pendingDocumentWorkOrderSource?.nextDocumentName || "").trim();

    actions.addOrUpdateWorkOrder({
      id: workOrderId,
      propertyId,
      unit: workOrderDraft.unit || "Shared",
      title,
      description: String(workOrderDraft.description || "").trim(),
      priority: WORK_ORDER_PRIORITY_OPTIONS.includes(workOrderDraft.priority) ? workOrderDraft.priority : "Medium",
      status,
      reportedOn: workOrderDraft.reportedOn || todayIso,
      dueDate: workOrderDraft.dueDate || "",
      vendorId: workOrderDraft.vendorId || "",
      estimatedCost: Number(workOrderDraft.estimatedCost || 0),
      actualCost: workOrderDraft.actualCost ? Number(workOrderDraft.actualCost) : undefined,
      transactionId: "",
      accountingTreatment: workOrderDraft.accountingTreatment || "needs_review",
      accountingReviewed: Boolean(workOrderDraft.accountingReviewed),
      accountingReviewNotes: String(workOrderDraft.accountingReviewNotes || "").trim(),
      sourceDocumentIds: linkedDocumentId ? [linkedDocumentId] : [],
      assetId: "",
      tenantLedgerEntryId: "",
      reimbursementTransactionId: "",
      createdAt: nowIso,
      completedAt: status === "Completed" ? (workOrderDraft.reportedOn || todayIso) : "",
      notes: String(workOrderDraft.notes || "").trim(),
    });

    if (linkedDocumentId) {
      actions.updateDocument(linkedDocumentId, {
        workOrderId,
        workOrderReviewDismissedAt: undefined,
      });
    }

    const unitForReset = workOrderDraft.unit || "Shared";
    setWorkOrderDraft(createBlankWorkOrderDraft(propertyId, unitForReset));
    if (pendingDocumentWorkOrderSource?.nextDocumentId) {
      setDocumentStatusFilter("work_order_queue");
      setExpenseQueueShowDismissed(false);
    }
    setPendingDocumentWorkOrderSource(null);
    setNotice(`Work order created: ${title}.` + (nextQueueName ? ` Next OCR work order: ${nextQueueName}.` : ""));
  };

  const confirmAndDeleteVendor = (vendor) => {
    if (!requirePermission("delete_records", "Admin access is required to delete vendors.")) return;
    const linkedWorkOrderCount = workOrders.filter((workOrder) => workOrder.vendorId === vendor.id).length;
    const runDelete = () => {
      actions.deleteVendor(vendor.id);
      if (linkedWorkOrderCount > 0) {
        setNotice(`Vendor removed. ${linkedWorkOrderCount} work order${linkedWorkOrderCount === 1 ? "" : "s"} unassigned.`);
      } else {
        setNotice(`Vendor removed: ${vendor.name}.`);
      }
    };

    openConfirmDialog({
      title: "Delete vendor?",
      message:
        linkedWorkOrderCount > 0
          ? `Delete vendor "${vendor.name}"? ${linkedWorkOrderCount} work order${linkedWorkOrderCount === 1 ? " is" : "s are"} currently assigned and will be set to Unassigned.`
          : `Delete vendor "${vendor.name}"? This cannot be undone.`,
      confirmLabel: "Delete vendor",
      onConfirm: runDelete,
    });
  };

  const resetMaintenanceWorkspaceState = () => {
    setMaintenanceStatusFilter("all");
    setEditingVendorId("");
    setVendorDraft(createBlankVendorDraft());
    setWorkOrderDraft(createBlankWorkOrderDraft());
    setPendingDocumentWorkOrderSource(null);
  };

  return {
    WORK_ORDER_PRIORITY_OPTIONS,
    confirmAndDeleteVendor,
    createWorkOrder,
    editingVendorId,
    hiddenMaintenanceVendorCount,
    maintenanceRollup,
    maintenanceStatusFilter,
    maintenanceStatusSummary,
    maintenanceTotalCost,
    maintenanceVendors,
    maintenanceVisibleWorkOrders,
    pendingDocumentWorkOrderSource,
    resetMaintenanceWorkspaceState,
    resetVendorEditor,
    saveVendor,
    setMaintenanceStatusFilter,
    setPendingDocumentWorkOrderSource,
    setVendorDraft,
    setWorkOrderDraft,
    startEditingVendor,
    vendorDraft,
    workOrderDraft,
    workOrderUnitOptions,
  };
}
