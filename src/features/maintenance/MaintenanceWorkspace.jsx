import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  FilePlus2,
  MoreHorizontal,
  PackageOpen,
  Plus,
  Receipt,
  Users,
  Wrench,
} from "lucide-react";
import {
  MAINTENANCE_ACCOUNTING_TREATMENT_OPTIONS,
  WORK_ORDER_STATUS_ORDER,
  maintenanceAccountingTreatmentLabel,
  resolveWorkOrderCost,
} from "../../domain/maintenance.ts";
import { formatUnitLabel } from "../../domain/unitLabels.js";
import { getWorkOrderReadiness, getWorkOrderReviewIssues } from "./maintenanceReview.js";
import {
  buildMaintenanceWorkspaceModes,
  defaultMaintenanceQuickFilter,
  formatMaintenanceDate,
  maintenanceQuickFiltersForMode,
  workOrderPrimaryActionKey,
} from "./maintenanceWorkspacePresentation.js";
import { AuditReadinessBadge } from "../shared/AuditReadinessBadge.jsx";
import { ResponsiveTableFrame, field } from "../shared/uiHelpers.jsx";
import { selectableProperties } from "../../domain/propertyLifecycle.js";

const CLOSED_STATUSES = new Set(["Completed", "Closed", "Canceled"]);
const ACTIVE_STATUSES = new Set(["Open", "In Progress", "Waiting on Parts"]);

function countByStatus(summary, status) {
  return summary.find((row) => row.status === status)?.count || 0;
}

function isWorkOrderOverdue(workOrder, todayIso) {
  return Boolean(workOrder?.dueDate && workOrder.dueDate < todayIso && !CLOSED_STATUSES.has(workOrder.status));
}

function labelForUnit(unit) {
  return unit === "Shared" ? "Shared" : formatUnitLabel(unit);
}

function assetLinkedToWorkOrder(workOrder, assetById = {}) {
  if (!workOrder) return null;
  if (workOrder.assetId && assetById[workOrder.assetId]) return assetById[workOrder.assetId];
  return Object.values(assetById || {}).find((asset) => asset.sourceWorkOrderId === workOrder.id) || null;
}

function statusTone(status) {
  if (status === "Completed" || status === "Closed") return "!bg-emerald-100 !text-emerald-700";
  if (status === "Waiting on Parts") return "!bg-amber-100 !text-amber-800";
  if (status === "Canceled") return "!bg-slate-100 !text-slate-500";
  if (status === "In Progress") return "!bg-blue-100 !text-blue-700";
  return "";
}

function statusIconTone(status) {
  if (status === "Completed" || status === "Closed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Waiting on Parts") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "Canceled") return "border-slate-200 bg-slate-50 text-slate-500";
  if (status === "In Progress") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-orange-200 bg-orange-50 text-orange-700";
}

function statusIconForStatus(status) {
  if (status === "Completed" || status === "Closed") return CheckCircle2;
  if (status === "Waiting on Parts") return PackageOpen;
  if (status === "In Progress") return Clock3;
  return Wrench;
}

function priorityTone(priority) {
  if (priority === "Urgent") return "!bg-red-100 !text-red-700";
  if (priority === "High") return "!bg-amber-100 !text-amber-800";
  return "";
}

function issueCount(records, key) {
  return (records || []).filter((record) => record.issues?.some((issue) => issue.key === key)).length;
}

function amountsMatch(left, right) {
  return Math.abs(Number(left || 0) - Number(right || 0)) < 0.005;
}

function IssueGroup({ title, items }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-semibold uppercase text-slate-500">{title}</div>
      <div className="mt-2 space-y-1 text-xs text-slate-700">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3">
            <span>{item.label}</span>
            <span className="font-semibold text-slate-900">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MaintenanceWorkspace({
  WORKSPACE_FILTER_PANEL_CLASS,
  WORKSPACE_MUTED_PANEL_CLASS,
  WORKSPACE_PANEL_CLASS,
  WORKSPACE_STAT_TILE_CLASS,
  actions,
  assetById,
  canCreateEditRecords,
  canDeleteRecords,
  confirmAndDeleteVendor,
  createBlankWorkOrderDraft,
  createWorkOrder,
  createWorkOrderExpense,
  currency,
  documents,
  formatUsPhone,
  hiddenMaintenanceVendorCount,
  maintenanceRollup,
  maintenanceStatusFilter,
  maintenanceStatusSummary,
  maintenanceTotalCost,
  maintenanceVendors,
  maintenanceReviewInbox,
  maintenanceVisibleWorkOrders,
  newWorkOrderRequestKey,
  onWorkOrderAttachmentInputChange,
  openWorkOrderAttachmentPicker,
  openWorkOrderDocuments,
  openReviewCenter,
  pendingDocumentWorkOrderSource,
  properties,
  propertyNameById,
  resetVendorEditor,
  saveVendor,
  setMaintenanceStatusFilter,
  setVendorDraft,
  setWorkOrderDraft,
  startCreateAssetFromWorkOrder,
  startEditingVendor,
  todayIso,
  transactionById,
  vendorById,
  vendorDraft,
  workOrderPriorityOptions,
  workOrderAttachmentInputRef,
  workOrderDocumentCountById,
  workOrderDraft,
  workOrderSuggestionConfidenceLabel,
  workOrderUnitOptions,
  editingVendorId,
}) {
  const [createPanelOpen, setCreatePanelOpen] = useState(Boolean(pendingDocumentWorkOrderSource?.documentId));
  const [vendorPanelOpen, setVendorPanelOpen] = useState(false);
  const [optionalCreateOpen, setOptionalCreateOpen] = useState(false);
  const [expandedOverrides, setExpandedOverrides] = useState({});
  const [workspaceMode, setWorkspaceMode] = useState("active");
  const [queueQuickFilter, setQueueQuickFilter] = useState("active");
  const [vendorActionsOpenId, setVendorActionsOpenId] = useState("");
  const propertyOptions = selectableProperties(properties, workOrderDraft.propertyId);
  const reviewContext = {
    transactions: Object.values(transactionById || {}),
    documents: documents || [],
    assets: Object.values(assetById || {}),
    vendors: maintenanceVendors,
    todayIso,
  };

  useEffect(() => {
    if (pendingDocumentWorkOrderSource?.documentId) {
      setWorkspaceMode("active");
      setQueueQuickFilter("active");
      setCreatePanelOpen(true);
    }
  }, [pendingDocumentWorkOrderSource?.documentId]);

  useEffect(() => {
    if (newWorkOrderRequestKey) {
      setWorkspaceMode("active");
      setQueueQuickFilter("active");
      setCreatePanelOpen(true);
    }
  }, [newWorkOrderRequestKey]);

  useEffect(() => {
    if (editingVendorId) {
      setWorkspaceMode("vendors");
      setVendorPanelOpen(true);
    }
  }, [editingVendorId]);

  const reviewRecords = maintenanceReviewInbox?.records || [];
  const cleanupCounts = {
    total: maintenanceReviewInbox?.counts?.total || 0,
    completedWithoutExpense: maintenanceReviewInbox?.counts?.completedWithoutExpense || 0,
    actualCostWithoutDocument: maintenanceReviewInbox?.counts?.actualCostWithoutDocument || 0,
    actualCostWithoutTransaction: issueCount(reviewRecords, "actual_cost_without_transaction"),
    capitalImprovementWithoutAsset: maintenanceReviewInbox?.counts?.capitalImprovementWithoutAsset || 0,
    staleOpen: maintenanceReviewInbox?.counts?.staleOpen || 0,
  };
  const overdueCount = useMemo(
    () => maintenanceVisibleWorkOrders.filter((workOrder) => isWorkOrderOverdue(workOrder, todayIso)).length,
    [maintenanceVisibleWorkOrders, todayIso],
  );
  const activeWorkOrderCount = maintenanceVisibleWorkOrders.filter((workOrder) => ACTIVE_STATUSES.has(workOrder.status)).length;
  const historyWorkOrderCount = maintenanceVisibleWorkOrders.filter((workOrder) => CLOSED_STATUSES.has(workOrder.status)).length;
  const workspaceModes = buildMaintenanceWorkspaceModes({
    activeCount: activeWorkOrderCount,
    cleanupCount: cleanupCounts.total,
    historyCount: historyWorkOrderCount,
    vendorCount: maintenanceVendors.length,
  });
  const defaultExpandedIds = useMemo(() => {
    const priorityRows = maintenanceVisibleWorkOrders
      .filter((workOrder) => {
        const issues = getWorkOrderReviewIssues(workOrder, reviewContext);
        return isWorkOrderOverdue(workOrder, todayIso) || issues.length > 0;
      })
      .slice(0, 3)
      .map((workOrder) => workOrder.id);
    return new Set(priorityRows);
  }, [maintenanceVisibleWorkOrders, reviewContext, todayIso]);
  const summaryCards = {
    active: [
      { label: "Open", value: countByStatus(maintenanceStatusSummary, "Open"), icon: Wrench, iconTone: "border-orange-200 bg-orange-50 text-orange-700" },
      { label: "In progress", value: countByStatus(maintenanceStatusSummary, "In Progress"), icon: Clock3, iconTone: "border-blue-200 bg-blue-50 text-blue-700" },
      { label: "Waiting on parts", value: countByStatus(maintenanceStatusSummary, "Waiting on Parts"), icon: PackageOpen, iconTone: "border-amber-200 bg-amber-50 text-amber-700" },
      { label: "Overdue", value: overdueCount, tone: overdueCount > 0 ? "text-red-700" : "", icon: AlertTriangle, iconTone: overdueCount > 0 ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-500" },
    ],
    history: [
      { label: "Completed", value: countByStatus(maintenanceStatusSummary, "Completed"), icon: CheckCircle2, iconTone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
      { label: "Closed", value: countByStatus(maintenanceStatusSummary, "Closed"), icon: CheckCircle2, iconTone: "border-slate-200 bg-slate-50 text-slate-600" },
      { label: "Canceled", value: countByStatus(maintenanceStatusSummary, "Canceled"), icon: PackageOpen, iconTone: "border-slate-200 bg-slate-50 text-slate-500" },
      { label: "Resolved cost", value: currency(maintenanceTotalCost), icon: CircleDollarSign, iconTone: "border-teal-200 bg-teal-50 text-teal-700" },
    ],
    cleanup: [
      { label: "Cleanup items", value: cleanupCounts.total, tone: cleanupCounts.total > 0 ? "text-amber-700" : "", icon: ClipboardList, iconTone: cleanupCounts.total > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700" },
      { label: "Missing expense", value: cleanupCounts.completedWithoutExpense + cleanupCounts.actualCostWithoutTransaction, icon: Receipt, iconTone: "border-amber-200 bg-amber-50 text-amber-700" },
      { label: "Missing document", value: cleanupCounts.actualCostWithoutDocument, icon: FilePlus2, iconTone: "border-blue-200 bg-blue-50 text-blue-700" },
      { label: "Asset handoff", value: cleanupCounts.capitalImprovementWithoutAsset, icon: BarChart3, iconTone: "border-violet-200 bg-violet-50 text-violet-700" },
    ],
  }[workspaceMode] || [];

  const toggleExpanded = (id) => {
    setExpandedOverrides((prev) => {
      const currentlyExpanded = Object.prototype.hasOwnProperty.call(prev, id) ? prev[id] : defaultExpandedIds.has(id);
      return { ...prev, [id]: !currentlyExpanded };
    });
  };
  const resetDraft = () => {
    setWorkOrderDraft(createBlankWorkOrderDraft(workOrderDraft.propertyId || (properties[0]?.id || ""), workOrderDraft.unit || "Shared"));
  };
  const workOrderMetaById = useMemo(() => {
    return Object.fromEntries(maintenanceVisibleWorkOrders.map((workOrder) => {
      const linkedTxn = workOrder.transactionId ? transactionById[workOrder.transactionId] : null;
      const linkedAsset = assetLinkedToWorkOrder(workOrder, assetById);
      const issues = getWorkOrderReviewIssues(workOrder, reviewContext);
      return [workOrder.id, {
        linkedTxn,
        linkedAsset,
        issues,
        readiness: getWorkOrderReadiness(workOrder, reviewContext),
        isOverdue: isWorkOrderOverdue(workOrder, todayIso),
        linkedDocumentCount: Math.max(workOrderDocumentCountById[workOrder.id] || 0, workOrder.sourceDocumentIds?.length || 0),
      }];
    }));
  }, [assetById, maintenanceVisibleWorkOrders, reviewContext, todayIso, transactionById, workOrderDocumentCountById]);
  const queueWorkOrders = useMemo(() => {
    if (queueQuickFilter === "active") return maintenanceVisibleWorkOrders.filter((workOrder) => ACTIVE_STATUSES.has(workOrder.status));
    if (queueQuickFilter === "open") return maintenanceVisibleWorkOrders.filter((workOrder) => workOrder.status === "Open");
    if (queueQuickFilter === "in_progress") return maintenanceVisibleWorkOrders.filter((workOrder) => workOrder.status === "In Progress");
    if (queueQuickFilter === "waiting") return maintenanceVisibleWorkOrders.filter((workOrder) => workOrder.status === "Waiting on Parts");
    if (queueQuickFilter === "history") return maintenanceVisibleWorkOrders.filter((workOrder) => CLOSED_STATUSES.has(workOrder.status));
    if (queueQuickFilter === "completed") return maintenanceVisibleWorkOrders.filter((workOrder) => workOrder.status === "Completed");
    if (queueQuickFilter === "closed") return maintenanceVisibleWorkOrders.filter((workOrder) => workOrder.status === "Closed");
    if (queueQuickFilter === "canceled") return maintenanceVisibleWorkOrders.filter((workOrder) => workOrder.status === "Canceled");
    if (queueQuickFilter === "needs_review") return maintenanceVisibleWorkOrders.filter((workOrder) => (workOrderMetaById[workOrder.id]?.issues || []).length > 0);
    if (queueQuickFilter === "overdue") return maintenanceVisibleWorkOrders.filter((workOrder) => workOrderMetaById[workOrder.id]?.isOverdue);
    return maintenanceVisibleWorkOrders;
  }, [maintenanceVisibleWorkOrders, queueQuickFilter, workOrderMetaById]);
  const quickFilters = maintenanceQuickFiltersForMode(workspaceMode);
  const queuePresentation = {
    active: {
      title: "Active work orders",
      helper: "Triage current repairs, assignments, due dates, and next actions.",
      emptyTitle: "No active work orders.",
      emptyDetail: "Create a work order when a repair or property task needs tracking.",
    },
    history: {
      title: "Maintenance history",
      helper: "Review completed, closed, or canceled work without mixing it into the active queue.",
      emptyTitle: "No maintenance history yet.",
      emptyDetail: "Completed and canceled work orders will stay available here.",
    },
    cleanup: {
      title: "Work orders needing cleanup",
      helper: "Inspect records missing an expense, document, review, or capital-asset handoff.",
      emptyTitle: "No work orders need cleanup.",
      emptyDetail: "Accounting and support records are clear for the current scope.",
    },
  }[workspaceMode];
  const changeWorkspaceMode = (mode) => {
    setWorkspaceMode(mode);
    setQueueQuickFilter(defaultMaintenanceQuickFilter(mode));
    setMaintenanceStatusFilter("all");
    if (mode !== "vendors") setVendorActionsOpenId("");
  };

  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="space-y-3 !p-4">
        <div role="tablist" aria-label="Maintenance workspace modes" className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {workspaceModes.map((mode) => {
            const modeSelected = workspaceMode === mode.key;
            const ModeIcon = mode.key === "active" ? Wrench : mode.key === "history" ? BarChart3 : mode.key === "cleanup" ? ClipboardList : Users;
            return (
              <button
                key={`maintenance-mode-${mode.key}`}
                type="button"
                role="tab"
                aria-selected={modeSelected}
                className={`rounded-xl border p-3 text-left transition ${modeSelected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/60"}`}
                onClick={() => changeWorkspaceMode(mode.key)}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold"><ModeIcon className={`h-4 w-4 ${modeSelected ? "text-white" : "text-slate-600"}`} aria-hidden="true" />{mode.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${modeSelected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"}`}>{mode.badge}</span>
                </div>
                <div className={`mt-2 text-xs leading-4 ${modeSelected ? "text-slate-200" : "text-slate-500"}`}>{mode.description}</div>
              </button>
            );
          })}
        </div>

        {summaryCards.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const SummaryIcon = card.icon;
            return (
              <div key={card.label} className={`${WORKSPACE_STAT_TILE_CLASS} p-3`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs uppercase text-slate-500">{card.label}</div>
                    <div className={`mt-1 text-lg font-semibold leading-tight text-slate-900 ${card.tone || ""}`}>{card.value}</div>
                  </div>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${card.iconTone}`}>
                    <SummaryIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
              </div>
            );
          })}
        </div> : null}

        {workspaceMode === "active" && createPanelOpen && (
          <div className={`${WORKSPACE_PANEL_CLASS} p-3`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 text-orange-700">
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">New Work Order</div>
                  <div className="mt-1 text-xs text-slate-500">Capture the request first; add cost and accounting detail when it matters.</div>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setCreatePanelOpen(false)}>Close</Button>
            </div>
            {pendingDocumentWorkOrderSource?.documentId && (
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-sm text-blue-900">
                <div>
                  OCR draft source: <span className="font-medium">{pendingDocumentWorkOrderSource.documentName || "Document"}</span>.
                  Creating this work order will link the document automatically.
                </div>
                {pendingDocumentWorkOrderSource.confidence && (
                  <div className="mt-1 text-xs text-blue-800">
                    {workOrderSuggestionConfidenceLabel(pendingDocumentWorkOrderSource.confidence)}
                    {pendingDocumentWorkOrderSource.reasonSummary ? ` | ${pendingDocumentWorkOrderSource.reasonSummary}` : ""}
                  </div>
                )}
                {pendingDocumentWorkOrderSource.nextDocumentName && (
                  <div className="mt-1 text-xs text-blue-800">Next in queue: {pendingDocumentWorkOrderSource.nextDocumentName}</div>
                )}
              </div>
            )}
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {field("Title", <Input id="maintenance-workorder-title" value={workOrderDraft.title} onChange={(e) => setWorkOrderDraft((prev) => ({ ...prev, title: e.target.value }))} />)}
              {field(
                "Property",
                <Select value={workOrderDraft.propertyId} onValueChange={(value) => setWorkOrderDraft((prev) => ({ ...prev, propertyId: value, unit: "Shared" }))}>
                  <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>
                    {propertyOptions.map((property) => <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>)}
                  </SelectContent>
                </Select>,
              )}
              {field(
                "Unit",
                <Select value={workOrderDraft.unit} onValueChange={(value) => setWorkOrderDraft((prev) => ({ ...prev, unit: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {workOrderUnitOptions.map((unitName) => <SelectItem key={`wo-unit-${unitName}`} value={unitName}>{labelForUnit(unitName)}</SelectItem>)}
                  </SelectContent>
                </Select>,
              )}
              {field("Reported on", <Input type="date" value={workOrderDraft.reportedOn} onChange={(e) => setWorkOrderDraft((prev) => ({ ...prev, reportedOn: e.target.value }))} />)}
              {field(
                "Priority",
                <Select value={workOrderDraft.priority} onValueChange={(value) => setWorkOrderDraft((prev) => ({ ...prev, priority: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {workOrderPriorityOptions.map((priority) => <SelectItem key={`wo-priority-${priority}`} value={priority}>{priority}</SelectItem>)}
                  </SelectContent>
                </Select>,
              )}
              {field(
                "Status",
                <Select value={workOrderDraft.status} onValueChange={(value) => setWorkOrderDraft((prev) => ({ ...prev, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WORK_ORDER_STATUS_ORDER.map((status) => <SelectItem key={`wo-status-${status}`} value={status}>{status}</SelectItem>)}
                  </SelectContent>
                </Select>,
              )}
              {field(
                "Vendor",
                <Select value={workOrderDraft.vendorId || "__none__"} onValueChange={(value) => setWorkOrderDraft((prev) => ({ ...prev, vendorId: value === "__none__" ? "" : value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {maintenanceVendors.map((vendor) => <SelectItem key={`wo-vendor-${vendor.id}`} value={vendor.id}>{vendor.name}</SelectItem>)}
                  </SelectContent>
                </Select>,
              )}
              <div className="md:col-span-2 xl:col-span-4">
                {field("Description", <Input value={workOrderDraft.description} onChange={(e) => setWorkOrderDraft((prev) => ({ ...prev, description: e.target.value }))} />)}
              </div>
            </div>
            <button type="button" className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900" onClick={() => setOptionalCreateOpen((value) => !value)}>
              {optionalCreateOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Optional fields
            </button>
            {optionalCreateOpen && (
              <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {field("Due date", <Input type="date" value={workOrderDraft.dueDate} onChange={(e) => setWorkOrderDraft((prev) => ({ ...prev, dueDate: e.target.value }))} />)}
                {field("Estimated cost", <Input type="number" value={workOrderDraft.estimatedCost} onChange={(e) => setWorkOrderDraft((prev) => ({ ...prev, estimatedCost: e.target.value }))} />)}
                {field("Actual cost", <Input type="number" value={workOrderDraft.actualCost} onChange={(e) => setWorkOrderDraft((prev) => ({ ...prev, actualCost: e.target.value }))} />)}
                {field(
                  "Expense / asset treatment",
                  <Select value={workOrderDraft.accountingTreatment || "needs_review"} onValueChange={(value) => setWorkOrderDraft((prev) => ({ ...prev, accountingTreatment: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MAINTENANCE_ACCOUNTING_TREATMENT_OPTIONS.map((option) => <SelectItem key={`wo-treatment-${option.value}`} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>,
                )}
                {field("Reviewed", (
                  <label className="flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(workOrderDraft.accountingReviewed)}
                      onChange={(e) => setWorkOrderDraft((prev) => ({ ...prev, accountingReviewed: e.target.checked }))}
                    />
                    <span>Reviewed</span>
                  </label>
                ))}
                <div className="md:col-span-2 xl:col-span-3">
                  {field("Accounting notes", <Input value={workOrderDraft.accountingReviewNotes || ""} onChange={(e) => setWorkOrderDraft((prev) => ({ ...prev, accountingReviewNotes: e.target.value }))} />)}
                </div>
                <div className="md:col-span-2 xl:col-span-4">
                  {field("Notes", <Input value={workOrderDraft.notes} onChange={(e) => setWorkOrderDraft((prev) => ({ ...prev, notes: e.target.value }))} />)}
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" className="w-full sm:w-auto" onClick={createWorkOrder}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create work order
              </Button>
              <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={resetDraft}>Reset</Button>
            </div>
          </div>
        )}

        {workspaceMode !== "vendors" && queuePresentation ? <div className={`${WORKSPACE_PANEL_CLASS} p-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
              <div className="min-w-0">
                <div className="font-medium text-slate-900">{queuePresentation.title}</div>
                <div className="text-xs text-slate-500">{queuePresentation.helper}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {workspaceMode === "active" ? <Button size="sm" onClick={() => setCreatePanelOpen((value) => !value)} disabled={!canCreateEditRecords}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New Work Order
              </Button> : null}
              <Badge variant="secondary">{queueWorkOrders.length} visible</Badge>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {quickFilters.map((filter) => (
              <Button
                key={`maintenance-queue-filter-${filter.key}`}
                size="sm"
                variant={queueQuickFilter === filter.key ? "default" : "secondary"}
                className="h-7 px-3 text-xs"
                onClick={() => setQueueQuickFilter(filter.key)}
              >
                {filter.label}
              </Button>
            ))}
          </div>

          <div className="mt-2 space-y-2">
            <input ref={workOrderAttachmentInputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onWorkOrderAttachmentInputChange} />
            {queueWorkOrders.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm">
                <div className="font-medium text-slate-900">{queuePresentation.emptyTitle}</div>
                <div className="mt-1 text-xs text-slate-500">{queuePresentation.emptyDetail}</div>
              </div>
            )}
            {queueWorkOrders.map((workOrder) => {
              const rowMeta = workOrderMetaById[workOrder.id] || {};
              const linkedTxn = rowMeta.linkedTxn || null;
              const linkedAsset = rowMeta.linkedAsset || null;
              const vendorLabel = workOrder.vendorId ? (vendorById[workOrder.vendorId]?.name || "Unknown vendor") : "Unassigned";
              const resolvedCost = resolveWorkOrderCost(workOrder, transactionById);
              const linkedDocumentCount = rowMeta.linkedDocumentCount || 0;
              const workOrderIssues = rowMeta.issues || [];
              const workOrderReadiness = rowMeta.readiness || getWorkOrderReadiness(workOrder, reviewContext);
              const isOverdue = Boolean(rowMeta.isOverdue);
              const isExpanded = Object.prototype.hasOwnProperty.call(expandedOverrides, workOrder.id)
                ? expandedOverrides[workOrder.id]
                : defaultExpandedIds.has(workOrder.id);
              const hasActualCost = Number(workOrder.actualCost || 0) > 0;
              const estimatedCost = Number(workOrder.estimatedCost || 0);
              const hasEstimatedCost = estimatedCost > 0;
              const hasResolvedCostRecord = hasActualCost || Boolean(linkedTxn);
              const shouldShowEstimatedCost = hasEstimatedCost && (!hasResolvedCostRecord || !amountsMatch(estimatedCost, resolvedCost));
              const shouldShowResolvedCost = hasResolvedCostRecord && resolvedCost > 0;
              const hasAnyCost = shouldShowEstimatedCost || shouldShowResolvedCost;
              const isCapital = workOrder.accountingTreatment === "capital_improvement";
              const primaryActionKey = workOrderPrimaryActionKey({ workOrder, linkedTxn, linkedAsset, hasActualCost });
              const primaryAction = {
                create_expense: { label: "Create expense", onClick: () => createWorkOrderExpense(workOrder), icon: Receipt },
                view_expense: { label: "View expense", onClick: () => createWorkOrderExpense(workOrder), icon: Receipt },
                create_asset: { label: "Create asset", onClick: () => startCreateAssetFromWorkOrder(workOrder), icon: FilePlus2 },
                manage_work_order: { label: "Manage work order", onClick: () => toggleExpanded(workOrder.id), icon: ClipboardList },
              }[primaryActionKey];
              const PrimaryIcon = primaryAction.icon;
              const StatusIcon = isOverdue ? AlertTriangle : statusIconForStatus(workOrder.status);

              return (
                <div key={workOrder.id} className={`rounded-lg border bg-white p-2.5 ${isOverdue ? "border-red-200" : "border-slate-200"}`}>
                  <div className="grid gap-3 xl:grid-cols-[minmax(240px,1fr)_minmax(360px,1.35fr)_minmax(300px,auto)]">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-start gap-1.5">
                        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${isOverdue ? "border-red-200 bg-red-50 text-red-700" : statusIconTone(workOrder.status)}`}>
                          <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <button
                          type="button"
                          className="mt-0.5 flex min-w-0 items-center gap-1 text-left font-semibold text-slate-900 hover:text-teal-800"
                          onClick={() => toggleExpanded(workOrder.id)}
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                          <span className="truncate">{workOrder.title}</span>
                        </button>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">{propertyNameById[workOrder.propertyId] || workOrder.propertyId} &middot; {labelForUnit(workOrder.unit)}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <Badge variant="secondary" className={statusTone(workOrder.status)}>{workOrder.status}</Badge>
                        <Badge variant="outline" className={priorityTone(workOrder.priority)}>{workOrder.priority}</Badge>
                        {isOverdue && <Badge variant="secondary" className="!bg-red-100 !text-red-700">Overdue</Badge>}
                      </div>
                    </div>
                    <div className="grid min-w-0 gap-x-4 gap-y-1.5 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="min-w-0 lg:col-span-1 xl:col-span-1">
                        <div className="text-[10px] font-semibold uppercase text-slate-500">Vendor</div>
                        <div className={`truncate ${workOrder.vendorId ? "font-medium text-slate-900" : "font-medium text-amber-700"}`} title={vendorLabel}>{vendorLabel}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase text-slate-500">Reported</div>
                        <div>{formatMaintenanceDate(workOrder.reportedOn)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase text-slate-500">Due</div>
                        <div className={isOverdue ? "font-medium text-red-700" : ""}>{formatMaintenanceDate(workOrder.dueDate)}</div>
                      </div>
                      {(workOrder.completedAt || workOrder.status === "Completed") && (
                        <div>
                          <div className="text-[10px] font-semibold uppercase text-slate-500">Completed</div>
                          <div className="font-medium text-emerald-700">{formatMaintenanceDate(workOrder.completedAt)}</div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-start justify-between gap-2 xl:justify-end">
                      <div className="min-w-40 rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-xs">
                        {hasAnyCost ? (
                          <div className="space-y-1">
                            {shouldShowEstimatedCost && (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-slate-500">Estimated</span>
                                <span className="font-medium text-slate-900">{currency(estimatedCost)}</span>
                              </div>
                            )}
                            {shouldShowResolvedCost && (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-slate-500">Actual/resolved</span>
                                <span className="font-semibold text-slate-900">{currency(resolvedCost)}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-slate-500">No cost recorded.</div>
                        )}
                      </div>
                      <div className="flex w-full flex-wrap gap-2 sm:w-auto xl:flex-col">
                        <Button size="sm" className="w-full sm:w-auto xl:w-40" onClick={primaryAction.onClick}>
                          <PrimaryIcon className="h-4 w-4" aria-hidden="true" />
                          {primaryAction.label}
                        </Button>
                        {!isExpanded && (
                          <Button size="sm" variant="secondary" className="w-full sm:w-auto xl:w-40" onClick={() => toggleExpanded(workOrder.id)}>
                            View details
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 grid gap-2 border-t border-slate-100 pt-2 text-[10px] font-semibold uppercase text-slate-500 md:grid-cols-3">
                    <div>
                      <div>Record support</div>
                      <div className="mt-1 flex flex-wrap gap-1 normal-case">
                        <Badge variant="secondary" className={linkedTxn ? "!bg-emerald-100 !text-emerald-700" : "!bg-amber-100 !text-amber-800"}>
                          {linkedTxn ? "Expense linked" : "No linked expense"}
                        </Badge>
                        <Badge variant="secondary">{linkedDocumentCount} doc{linkedDocumentCount === 1 ? "" : "s"}</Badge>
                      </div>
                    </div>
                    <div>
                      <div>Accounting</div>
                      <div className="mt-1 flex flex-wrap gap-1 normal-case">
                        <Badge variant="secondary" className={workOrder.accountingReviewed ? "!bg-emerald-100 !text-emerald-700" : "!bg-amber-100 !text-amber-800"}>
                          {workOrder.accountingReviewed ? "Reviewed" : "Needs review"}
                        </Badge>
                        <AuditReadinessBadge status={workOrderReadiness} />
                      </div>
                    </div>
                    <div>
                      <div>Category</div>
                      <div className="mt-1 flex flex-wrap gap-1 normal-case">
                        <Badge variant="secondary" className={isCapital && !linkedAsset ? "!bg-amber-100 !text-amber-800" : ""}>
                          {isCapital ? (linkedAsset ? "Capital asset linked" : "Capital asset needed") : maintenanceAccountingTreatmentLabel(workOrder.accountingTreatment)}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 space-y-2 border-t border-slate-200 pt-2">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => actions.setWorkOrderStatus(workOrder.id, "In Progress")} disabled={workOrder.status === "In Progress"}>Start</Button>
                        <Button size="sm" variant="secondary" onClick={() => actions.setWorkOrderStatus(workOrder.id, "Waiting on Parts")} disabled={workOrder.status === "Waiting on Parts"}>Mark waiting</Button>
                        <Button size="sm" variant="secondary" onClick={() => actions.setWorkOrderStatus(workOrder.id, "Completed")} disabled={workOrder.status === "Completed"}>Mark completed</Button>
                        <Button size="sm" variant="secondary" onClick={() => actions.setWorkOrderStatus(workOrder.id, "Closed")} disabled={workOrder.status === "Closed"}>Close</Button>
                      </div>
                      <div className={WORKSPACE_MUTED_PANEL_CLASS}>
                        <div className="mb-2 text-xs font-medium uppercase text-slate-500">Status, vendor, cost, and accounting</div>
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <Label>Status</Label>
                            <Select value={workOrder.status} onValueChange={(value) => actions.setWorkOrderStatus(workOrder.id, value)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {WORK_ORDER_STATUS_ORDER.map((status) => <SelectItem key={`${workOrder.id}-status-${status}`} value={status}>{status}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Vendor</Label>
                            <Select value={workOrder.vendorId || "__none__"} onValueChange={(value) => actions.assignWorkOrderVendor(workOrder.id, value === "__none__" ? "" : value)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Unassigned</SelectItem>
                                {maintenanceVendors.map((vendor) => <SelectItem key={`${workOrder.id}-vendor-${vendor.id}`} value={vendor.id}>{vendor.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Estimated cost</Label>
                            <Input
                              type="number"
                              value={workOrder.estimatedCost ?? ""}
                              onChange={(e) => actions.addOrUpdateWorkOrder({ ...workOrder, estimatedCost: Number(e.target.value || 0) })}
                            />
                            <div className="mt-1 text-[11px] text-slate-500">Planning or expected cost.</div>
                          </div>
                          <div>
                            <Label>Actual cost</Label>
                            <Input
                              type="number"
                              value={workOrder.actualCost ?? ""}
                              onChange={(e) => actions.addOrUpdateWorkOrder({ ...workOrder, actualCost: e.target.value ? Number(e.target.value) : undefined })}
                            />
                            <div className="mt-1 text-[11px] text-slate-500">Work-order cost before ledger cleanup.</div>
                          </div>
                          <div>
                            <Label>Expense / asset treatment</Label>
                            <Select value={workOrder.accountingTreatment || "needs_review"} onValueChange={(value) => actions.updateWorkOrderAccounting(workOrder.id, { accountingTreatment: value, accountingReviewed: false })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {MAINTENANCE_ACCOUNTING_TREATMENT_OPTIONS.map((option) => <SelectItem key={`${workOrder.id}-treatment-${option.value}`} value={option.value}>{option.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <div className="mt-1 text-[11px] text-slate-500">Use this to decide whether the work order becomes an expense, asset, or review item.</div>
                          </div>
                          <div>
                            <Label>Reviewed</Label>
                            <label className="mt-1 flex h-10 items-center gap-2 rounded border border-slate-200 bg-white px-3 text-sm">
                              <input
                                type="checkbox"
                                checked={Boolean(workOrder.accountingReviewed)}
                                onChange={(event) => actions.updateWorkOrderAccounting(workOrder.id, { accountingReviewed: event.target.checked })}
                              />
                              <span>Reviewed</span>
                            </label>
                          </div>
                          <div className="md:col-span-2">
                            <Label>Accounting notes</Label>
                            <Input
                              value={workOrder.accountingReviewNotes || ""}
                              onChange={(e) => actions.updateWorkOrderAccounting(workOrder.id, { accountingReviewNotes: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
                          <div className="font-medium text-slate-900">Description and notes</div>
                          <div className="mt-2">{workOrder.description || "No description entered."}</div>
                          {workOrder.notes ? <div className="mt-2 text-slate-500">{workOrder.notes}</div> : null}
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
                          <div className="font-medium text-slate-900">Linked records</div>
                          <div className="mt-2 space-y-1">
                            <div>Linked expense: {linkedTxn ? `${formatMaintenanceDate(linkedTxn.date)} | ${currency(linkedTxn.amount)}` : "Not linked"}</div>
                            <div>Linked documents: {linkedDocumentCount}</div>
                            <div>Linked asset: {linkedAsset ? linkedAsset.description : isCapital ? "Needed for capital improvement" : "Not applicable"}</div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" onClick={() => createWorkOrderExpense(workOrder)}>
                              {linkedTxn ? "View expense" : "Create expense"}
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => openWorkOrderAttachmentPicker(workOrder)}>Attach file</Button>
                            {linkedDocumentCount > 0 && (
                              <Button size="sm" variant="secondary" onClick={() => openWorkOrderDocuments(workOrder)}>
                                Open docs ({linkedDocumentCount})
                              </Button>
                            )}
                            {isCapital && !linkedAsset && (
                              <Button size="sm" variant="secondary" onClick={() => startCreateAssetFromWorkOrder(workOrder)}>
                                Create asset
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-1">
                          {workOrderIssues.length === 0 ? (
                            <span className="text-xs text-emerald-700">No readiness issues.</span>
                          ) : (
                            workOrderIssues.map((issue) => (
                              <span key={`${workOrder.id}-issue-${issue.key}`} title={issue.help} className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700">
                                {issue.label}
                              </span>
                            ))
                          )}
                        </div>
                        <Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => actions.deleteWorkOrder(workOrder.id)} disabled={!canDeleteRecords}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div> : null}

        <div className="space-y-3">
          {workspaceMode === "cleanup" ? <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700">
                  <Wrench className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">Cleanup status</div>
                  <div className="mt-1 text-xs text-slate-600">Resolve details here or use Work Queue for guided cleanup.</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className={cleanupCounts.total > 0 ? "!bg-amber-100 !text-amber-800" : "!bg-emerald-100 !text-emerald-700"}>
                  {cleanupCounts.total} cleanup items
                </Badge>
                <Button size="sm" variant={cleanupCounts.total > 0 ? "default" : "secondary"} onClick={openReviewCenter}>
                  Open Work Queue
                </Button>
              </div>
            </div>
            {cleanupCounts.total === 0 ? (
              <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500">
                No cleanup items.
              </div>
            ) : (
              <div className="mt-2 grid gap-2 xl:grid-cols-3 2xl:grid-cols-1">
                <IssueGroup
                  title="Expense/document cleanup"
                  items={[
                    { label: "Completed without expense", count: cleanupCounts.completedWithoutExpense },
                    { label: "Actual cost without expense", count: cleanupCounts.actualCostWithoutTransaction },
                    { label: "Actual cost without document", count: cleanupCounts.actualCostWithoutDocument },
                  ]}
                />
                <IssueGroup
                  title="Capital improvement handoff"
                  items={[
                    { label: "Capital improvement without asset", count: cleanupCounts.capitalImprovementWithoutAsset },
                  ]}
                />
                <IssueGroup
                  title="Stale queue items"
                  items={[
                    { label: "Stale open", count: cleanupCounts.staleOpen },
                  ]}
                />
              </div>
            )}
          </div> : null}

          {workspaceMode === "vendors" ? <div className={`${WORKSPACE_PANEL_CLASS} p-3`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">Vendor Directory</div>
                  <div className="mt-1 text-xs text-slate-500">Contacts for faster assignment.</div>
                  {hiddenMaintenanceVendorCount > 0 && (
                    <div className="mt-1 text-xs text-slate-500">
                      Hidden {hiddenMaintenanceVendorCount} tenant/import-only contact{hiddenMaintenanceVendorCount === 1 ? "" : "s"}.
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{maintenanceVendors.length} vendor{maintenanceVendors.length === 1 ? "" : "s"}</Badge>
                <Button size="sm" variant="secondary" onClick={() => setVendorPanelOpen((value) => !value)} disabled={!canCreateEditRecords}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add Vendor
                </Button>
              </div>
            </div>
            <div className="mt-2 grid gap-2">
            {maintenanceVendors.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm">
                <div className="font-medium text-slate-900">No vendors saved yet.</div>
                <div className="mt-1 text-xs text-slate-500">Add vendors for faster work-order assignment.</div>
              </div>
            )}
            {maintenanceVendors.map((vendor) => {
              const linkedWorkOrderCount = maintenanceVisibleWorkOrders.filter((workOrder) => workOrder.vendorId === vendor.id).length;
              const vendorActionsOpen = vendorActionsOpenId === vendor.id;

              return (
                <div key={vendor.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                  <div className="min-w-0 text-xs text-slate-700">
                    <div className="font-medium text-slate-900">{vendor.name}</div>
                    <div>{vendor.phone || "No phone"}{vendor.email ? ` | ${vendor.email}` : ""}</div>
                    <div className="text-slate-500">{vendor.defaultCategory || "No default category"}</div>
                    {Array.isArray(vendor.aliases) && vendor.aliases.length > 0 ? (
                      <div className="mt-1 text-slate-500">Aliases: {vendor.aliases.join(", ")}</div>
                    ) : null}
                    {linkedWorkOrderCount > 0 && (
                      <div className="mt-1 text-amber-700">This vendor is linked to existing work orders.</div>
                    )}
                    {vendor.notes ? <div className="mt-1 text-slate-500">{vendor.notes}</div> : null}
                  </div>
                  <div className="relative flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                    <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={() => { startEditingVendor(vendor); setVendorPanelOpen(true); }} disabled={!canCreateEditRecords}>Edit</Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full px-2 sm:w-auto"
                      title="More vendor actions"
                      onClick={() => setVendorActionsOpenId(vendorActionsOpen ? "" : vendor.id)}
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    {vendorActionsOpen && (
                      <div className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-sm sm:absolute sm:right-0 sm:top-9 sm:z-10 sm:w-64">
                        {linkedWorkOrderCount > 0 && (
                          <div className="mb-2 rounded border border-amber-200 bg-amber-50 p-2 text-amber-800">
                            This vendor is linked to existing work orders.
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full justify-start text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setVendorActionsOpenId("");
                            confirmAndDeleteVendor(vendor);
                          }}
                          disabled={!canDeleteRecords}
                        >
                          Remove vendor
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
            {vendorPanelOpen && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium text-slate-900">{editingVendorId ? "Edit vendor" : "Add vendor"}</div>
                <Button size="sm" variant="ghost" onClick={() => { resetVendorEditor(); setVendorPanelOpen(false); }}>Close</Button>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {field("Name", <Input value={vendorDraft.name} onChange={(e) => setVendorDraft((prev) => ({ ...prev, name: e.target.value }))} />)}
                {field("Aliases", <Input value={vendorDraft.aliases} onChange={(e) => setVendorDraft((prev) => ({ ...prev, aliases: e.target.value }))} />)}
                {field("Phone", <Input value={vendorDraft.phone} onChange={(e) => setVendorDraft((prev) => ({ ...prev, phone: formatUsPhone(e.target.value) }))} />)}
                {field("Email", <Input value={vendorDraft.email} onChange={(e) => setVendorDraft((prev) => ({ ...prev, email: e.target.value }))} />)}
                {field("Default category", <Input value={vendorDraft.defaultCategory} onChange={(e) => setVendorDraft((prev) => ({ ...prev, defaultCategory: e.target.value }))} />)}
                <div className="md:col-span-2">
                  {field("Notes", <Input value={vendorDraft.notes} onChange={(e) => setVendorDraft((prev) => ({ ...prev, notes: e.target.value }))} />)}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={saveVendor} disabled={!canCreateEditRecords}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {editingVendorId ? "Save vendor" : "Add vendor"}
                </Button>
                <Button size="sm" variant="secondary" onClick={resetVendorEditor}>{editingVendorId ? "Cancel edit" : "Reset"}</Button>
              </div>
            </div>
            )}
          </div> : null}
        </div>

        {workspaceMode === "history" ? <div className={`${WORKSPACE_PANEL_CLASS} p-3`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
              <div className="min-w-0">
                <div className="font-medium text-slate-900">Maintenance cost roll-up</div>
                <div className="mt-1 text-xs text-slate-500">Actual/resolved cost uses actual cost first, then linked expense, then estimate for open work. Totals exclude canceled work orders.</div>
              </div>
            </div>
            <Badge variant="secondary">{maintenanceRollup.length} row{maintenanceRollup.length === 1 ? "" : "s"}</Badge>
          </div>
          <ResponsiveTableFrame
            className="mt-2"
            minWidthClass="min-w-[560px]"
            hint="Swipe to compare work-order volume and cost by property and unit."
            mobileCards={maintenanceRollup.map((row) => (
              <div key={`maintenance-rollup-card-${row.propertyId}-${row.unit}`} className={WORKSPACE_MUTED_PANEL_CLASS}>
                <div className="text-sm font-medium text-slate-900">{propertyNameById[row.propertyId] || row.propertyId} | {labelForUnit(row.unit)}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>Total work orders: <span className="font-medium text-slate-900">{row.workOrderCount}</span></div>
                  <div>Completed: <span className="font-medium text-slate-900">{row.completedCount}</span></div>
                  <div>Open: <span className="font-medium text-slate-900">{row.openCount}</span></div>
                  <div>Actual/resolved cost: <span className="font-semibold text-slate-900">{currency(row.totalCost)}</span></div>
                </div>
              </div>
            ))}
          >
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-1 text-left">Property</th>
                  <th className="px-2 py-1 text-left">Unit</th>
                  <th className="px-2 py-1 text-right">Total work orders</th>
                  <th className="px-2 py-1 text-right">Completed</th>
                  <th className="px-2 py-1 text-right">Open</th>
                  <th className="px-2 py-1 text-right">Actual/resolved cost</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceRollup.length === 0 && (
                  <tr>
                    <td className="px-2 py-2 text-slate-500" colSpan={6}>No maintenance costs in the current scope.</td>
                  </tr>
                )}
                {maintenanceRollup.map((row) => (
                  <tr key={`${row.propertyId}-${row.unit}`} className="border-t border-slate-100">
                    <td className="px-2 py-1">{propertyNameById[row.propertyId] || row.propertyId}</td>
                    <td className="px-2 py-1">{labelForUnit(row.unit)}</td>
                    <td className="px-2 py-1 text-right">{row.workOrderCount}</td>
                    <td className="px-2 py-1 text-right">{row.completedCount}</td>
                    <td className="px-2 py-1 text-right">{row.openCount}</td>
                    <td className="px-2 py-1 text-right font-medium">{currency(row.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTableFrame>
        </div> : null}
      </CardContent>
    </Card>
  );
}
