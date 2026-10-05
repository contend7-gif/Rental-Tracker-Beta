import { useWorkspaceMemory } from "../../app/WorkspaceMemory.jsx";
import { RecordDetailPanel, RecordFilePreview } from "../shared/RecordDetailPanel.jsx";
import { DialogClose, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { workspaceFocusDomId } from "../../app/workspaceFocus.ts";

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
  clearWorkspaceFocus,
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
  workspaceFocus,
  editingVendorId,
}) {
  const [createPanelOpen, setCreatePanelOpen] = useState(Boolean(pendingDocumentWorkOrderSource?.documentId));
  const [vendorPanelOpen, setVendorPanelOpen] = useState(false);
  const [optionalCreateOpen, setOptionalCreateOpen] = useState(false);
  const [search, setSearch] = useWorkspaceMemory("maintenance:search", "");
  const [detailSection, setDetailSection] = useState("overview");
  const [selectedFileId, setSelectedFileId] = useState("");
  const [workspaceMode, setWorkspaceMode] = useWorkspaceMemory("maintenance:workspaceMode", "active");
  const [queueQuickFilter, setQueueQuickFilter] = useWorkspaceMemory("maintenance:queueQuickFilter", "active");
  const [focusedWorkOrderId, setFocusedWorkOrderId] = useState("");
  const [vendorActionsOpenId, setVendorActionsOpenId] = useState("");
  const [detailId, setDetailId] = useState("");
  const detailTrigger = useRef(null);
  const detail = maintenanceVisibleWorkOrders.find((record) => record.id === detailId);
  const detailFiles = detail ? documents.filter((file) => file.workOrderId === detail.id || detail.sourceDocumentIds?.includes(file.id) || (detail.transactionId && file.transactionId === detail.transactionId)) : [];
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

  const maintenanceFocusRequestId = workspaceFocus?.source === "maintenance" ? workspaceFocus.requestId : "";
  useEffect(() => {
    if (!maintenanceFocusRequestId) return;
    const target = maintenanceVisibleWorkOrders.find((workOrder) => workOrder.id === workspaceFocus.recordId);
    if (!target) {
      clearWorkspaceFocus?.();
      return;
    }
    setWorkspaceMode(CLOSED_STATUSES.has(target.status) ? "history" : "active");
    setQueueQuickFilter(CLOSED_STATUSES.has(target.status) ? "history" : "active");
    setMaintenanceStatusFilter("all");
    setSearch("");
    setFocusedWorkOrderId(target.id);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById(workspaceFocusDomId("work-order", target.id))?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
    clearWorkspaceFocus?.();
  }, [maintenanceFocusRequestId]);

  useEffect(() => {
    if (!focusedWorkOrderId) return undefined;
    const timer = window.setTimeout(() => setFocusedWorkOrderId(""), 4000);
    return () => window.clearTimeout(timer);
  }, [focusedWorkOrderId]);

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

  const openRecord = (event, workOrder, section = "overview") => {
    detailTrigger.current = event?.currentTarget || document.getElementById(workspaceFocusDomId("work-order", workOrder.id))?.querySelector("button");
    setDetailSection(section);
    setSelectedFileId("");
    setDetailId(workOrder.id);
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
  const visibleQueueWorkOrders = queueWorkOrders.filter((workOrder) => {
    const term = search.trim().toLowerCase();
    return !term || [workOrder.title, workOrder.description, workOrder.notes, propertyNameById[workOrder.propertyId], labelForUnit(workOrder.unit), vendorById[workOrder.vendorId]?.name].some((value) => String(value || "").toLowerCase().includes(term));
  });
  const renderWorkOrderEditor = (workOrder) => {
    const meta = workOrderMetaById[workOrder.id];
    const { linkedTxn, linkedAsset, linkedDocumentCount, issues: workOrderIssues } = meta;
    const isCapital = workOrder.accountingTreatment === "capital_improvement";
    return (
                    <div className="mt-2 space-y-2 border-t border-slate-200 pt-2">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => actions.setWorkOrderStatus(workOrder.id, "In Progress")} disabled={!canCreateEditRecords || workOrder.status === "In Progress"}>Start</Button>
                        <Button size="sm" variant="secondary" onClick={() => actions.setWorkOrderStatus(workOrder.id, "Waiting on Parts")} disabled={!canCreateEditRecords || workOrder.status === "Waiting on Parts"}>Mark waiting</Button>
                        <Button size="sm" variant="secondary" onClick={() => actions.setWorkOrderStatus(workOrder.id, "Completed")} disabled={!canCreateEditRecords || workOrder.status === "Completed"}>Mark completed</Button>
                        <Button size="sm" variant="secondary" onClick={() => actions.setWorkOrderStatus(workOrder.id, "Closed")} disabled={!canCreateEditRecords || workOrder.status === "Closed"}>Close work order</Button>
                      </div>
                      <div className={WORKSPACE_MUTED_PANEL_CLASS}>
                        <div className="mb-2 text-xs font-medium uppercase text-slate-500">Status, vendor, cost, and accounting</div>
                        <fieldset disabled={!canCreateEditRecords} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <Label>Status</Label>
                            <Select value={workOrder.status} onValueChange={(value) => actions.setWorkOrderStatus(workOrder.id, value)}>
                              <SelectTrigger aria-label="Work order status"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {WORK_ORDER_STATUS_ORDER.map((status) => <SelectItem key={`${workOrder.id}-status-${status}`} value={status}>{status}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Vendor</Label>
                            <Select value={workOrder.vendorId || "__none__"} onValueChange={(value) => actions.assignWorkOrderVendor(workOrder.id, value === "__none__" ? "" : value)}>
                              <SelectTrigger aria-label="Assigned vendor"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Unassigned</SelectItem>
                                {maintenanceVendors.map((vendor) => <SelectItem key={`${workOrder.id}-vendor-${vendor.id}`} value={vendor.id}>{vendor.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Estimated cost</Label>
                            <Input
                              aria-label="Work order estimated cost"
                              type="number"
                              value={workOrder.estimatedCost ?? ""}
                              onChange={(e) => actions.addOrUpdateWorkOrder({ ...workOrder, estimatedCost: Number(e.target.value || 0) })}
                            />
                            <div className="mt-1 text-[11px] text-slate-500">Planning or expected cost.</div>
                          </div>
                          <div>
                            <Label>Actual cost</Label>
                            <Input
                              aria-label="Work order actual cost"
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
                        </fieldset>
                        <p className="mt-2 text-xs text-slate-500">Changes save as you go.</p>
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
                            <Button size="sm" variant="secondary" disabled={!linkedTxn && !canCreateEditRecords} onClick={() => createWorkOrderExpense(workOrder)}>
                              {linkedTxn ? "View expense" : "Create expense"}
                            </Button>
                            <Button size="sm" variant="secondary" disabled={!canCreateEditRecords} onClick={() => openWorkOrderAttachmentPicker(workOrder)}>Attach file</Button>
                            {linkedDocumentCount > 0 && (
                              <Button size="sm" variant="secondary" onClick={() => openWorkOrderDocuments(workOrder)}>
                                Open docs ({linkedDocumentCount})
                              </Button>
                            )}
                            {isCapital && !linkedAsset && (
                              <Button size="sm" variant="secondary" disabled={!canCreateEditRecords} onClick={() => startCreateAssetFromWorkOrder(workOrder)}>
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
    );
  };
  const changeWorkspaceMode = (mode) => {
    setWorkspaceMode(mode);
    setQueueQuickFilter(defaultMaintenanceQuickFilter(mode));
    setMaintenanceStatusFilter("all");
    if (mode !== "vendors") setVendorActionsOpenId("");
  };

  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="space-y-3 !p-4">
        <div role="tablist" aria-label="Maintenance workspace modes" className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
          {workspaceModes.map((mode) => {
            const modeSelected = workspaceMode === mode.key;
            const ModeIcon = mode.key === "active" ? Wrench : mode.key === "history" ? BarChart3 : mode.key === "cleanup" ? ClipboardList : Users;
            return (
              <button
                key={`maintenance-mode-${mode.key}`}
                type="button"
                role="tab"
                aria-selected={modeSelected}
                className={`rounded-md border px-3 py-2 text-left transition ${modeSelected ? "border-teal-700 bg-teal-700 text-white" : "border-transparent bg-white hover:bg-slate-50"}`}
                onClick={() => changeWorkspaceMode(mode.key)}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold"><ModeIcon className={`h-4 w-4 ${modeSelected ? "text-white" : "text-slate-600"}`} aria-hidden="true" />{mode.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${modeSelected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"}`}>{mode.badge}</span>
                </div>

              </button>
            );
          })}
        </div>

        {summaryCards.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const SummaryIcon = card.icon;
            return (
              <div key={card.label} className={`${WORKSPACE_STAT_TILE_CLASS} px-3 py-2`}>
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
              <Badge variant="secondary">{visibleQueueWorkOrders.length} visible</Badge>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="min-w-48 flex-1 text-xs font-medium text-slate-500">Search work orders<Input aria-label="Search work orders" className="mt-1" placeholder="Title, vendor, property, or notes" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <label className="text-xs font-medium text-slate-500">Show<Select value={queueQuickFilter} onValueChange={setQueueQuickFilter}><SelectTrigger aria-label="Work order filter" className="mt-1 min-w-40"><SelectValue /></SelectTrigger><SelectContent>{quickFilters.map((filter) => <SelectItem key={filter.key} value={filter.key}>{filter.label}</SelectItem>)}</SelectContent></Select></label>
            {search ? <Button variant="ghost" size="sm" onClick={() => setSearch("")}>Clear search</Button> : null}
          </div>

          <div className="mt-2 space-y-2">
            <input ref={workOrderAttachmentInputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onWorkOrderAttachmentInputChange} />
            {visibleQueueWorkOrders.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm">
                <div className="font-medium text-slate-900">{search ? "No matching work orders." : queuePresentation.emptyTitle}</div>
                <div className="mt-1 text-xs text-slate-500">{queuePresentation.emptyDetail}</div>
              </div>
            )}
            {visibleQueueWorkOrders.map((workOrder) => {
              const meta = workOrderMetaById[workOrder.id];
              const actionKey = workOrderPrimaryActionKey({ workOrder, linkedTxn: meta.linkedTxn, linkedAsset: meta.linkedAsset, hasActualCost: Number(workOrder.actualCost || 0) > 0 });
              const actionLabel = { manage_work_order: "Manage work order", create_expense: "Create expense", view_expense: "View expense", create_asset: "Create asset" }[actionKey];
              const StatusIcon = meta.isOverdue ? AlertTriangle : statusIconForStatus(workOrder.status);
              return <div key={workOrder.id} id={workspaceFocusDomId("work-order", workOrder.id)} className={`rt-maintenance-row rounded-lg border bg-white p-3 ${focusedWorkOrderId === workOrder.id ? "border-teal-400 ring-2 ring-teal-100" : meta.isOverdue ? "border-red-200" : "border-slate-200"}`}>
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${meta.isOverdue ? "border-red-200 bg-red-50 text-red-700" : statusIconTone(workOrder.status)}`}><StatusIcon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <button type="button" className="rt-row-title break-words text-left hover:text-teal-700" onClick={(event) => openRecord(event, workOrder)}>{workOrder.title}</button>
                    <div className="mt-1 text-xs text-slate-500">{propertyNameById[workOrder.propertyId] || workOrder.propertyId} · {labelForUnit(workOrder.unit)}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5"><Badge variant="secondary" className={statusTone(workOrder.status)}>{workOrder.status}</Badge>{["High", "Urgent"].includes(workOrder.priority) ? <Badge className={priorityTone(workOrder.priority)}>{workOrder.priority}</Badge> : null}{meta.isOverdue ? <Badge className="!bg-red-100 !text-red-700">Overdue</Badge> : null}{meta.issues.length ? <span className="text-xs text-amber-700" title={meta.issues.map((issue) => issue.label).join(", ")}>{meta.issues[0].label}{meta.issues.length > 1 ? ` +${meta.issues.length - 1}` : ""}</span> : null}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                  <div><div className="text-slate-500">Vendor</div><div className="mt-1 font-medium">{vendorById[workOrder.vendorId]?.name || "Unassigned"}</div></div>
                  <div><div className="text-slate-500">Due</div><div className={`mt-1 font-medium ${meta.isOverdue ? "text-red-700" : ""}`}>{formatMaintenanceDate(workOrder.dueDate)}</div></div>
                  <div><div className="text-slate-500">{workOrder.actualCost != null || meta.linkedTxn ? "Actual / linked cost" : "Estimated cost"}</div><div className="mt-1 font-semibold tabular-nums">{workOrder.actualCost != null || meta.linkedTxn || workOrder.estimatedCost != null ? currency(resolveWorkOrderCost(workOrder, transactionById)) : "Not entered"}</div></div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button size="sm" variant="secondary" onClick={(event) => openRecord(event, workOrder)}>Open record</Button>
                  <Button size="sm" disabled={!canCreateEditRecords && actionKey !== "view_expense"} onClick={(event) => {
                    if (actionKey === "create_expense" || actionKey === "view_expense") createWorkOrderExpense(workOrder);
                    else if (actionKey === "create_asset") startCreateAssetFromWorkOrder(workOrder);
                    else openRecord(event, workOrder, "update");
                  }}>{actionLabel}</Button>
                </div>
              </div>;
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
        <RecordDetailPanel open={Boolean(detail)} onOpenChange={(open) => { if (!open) { setDetailId(""); requestAnimationFrame(() => detailTrigger.current?.isConnected && detailTrigger.current.focus()); } }}>
          {detail && <>
            <DialogHeader><DialogTitle>{detail.title || "Work order"}</DialogTitle></DialogHeader>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500"><span>{propertyNameById[detail.propertyId]} · {labelForUnit(detail.unit)}</span><Badge className={statusTone(detail.status)}>{detail.status}</Badge><AuditReadinessBadge status={workOrderMetaById[detail.id].readiness} /></div>
            <div className="mt-4 flex flex-wrap gap-1 border-b pb-2" aria-label="Work order sections">
              {[ ["overview", "Overview"], ["update", "Update & accounting"], ["files", `Files (${detailFiles.length})`] ].map(([key, label]) => <Button key={key} size="sm" variant={detailSection === key ? "default" : "ghost"} aria-pressed={detailSection === key} onClick={() => setDetailSection(key)}>{label}</Button>)}
              <DialogClose variant="secondary" className="ml-auto">Close</DialogClose>
            </div>
            {detailSection === "overview" ? <div className="mt-4 space-y-4">
              <dl className="grid gap-3 rounded-lg border bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-xs text-slate-500">Vendor</dt><dd className="mt-1 font-medium">{vendorById[detail.vendorId]?.name || "Unassigned"}</dd></div>
                <div><dt className="text-xs text-slate-500">Priority</dt><dd className="mt-1 font-medium">{detail.priority || "Normal"}</dd></div>
                <div><dt className="text-xs text-slate-500">Due</dt><dd className="mt-1 font-medium">{formatMaintenanceDate(detail.dueDate)}</dd></div>
                <div><dt className="text-xs text-slate-500">Reported</dt><dd className="mt-1 font-medium">{formatMaintenanceDate(detail.reportedOn)}</dd></div>
              </dl>
              <section><h3 className="text-sm font-semibold">Request</h3><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{detail.description || "No description entered."}</p>{detail.notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-500">{detail.notes}</p> : null}</section>
              <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border p-3 text-sm"><h3 className="font-semibold">Costs and treatment</h3><div className="mt-2">Estimate: {detail.estimatedCost != null ? currency(detail.estimatedCost) : "Not entered"}</div><div className="mt-1">Actual: {detail.actualCost != null ? currency(detail.actualCost) : "Not entered"}</div><div className="mt-1 text-slate-500">{maintenanceAccountingTreatmentLabel(detail.accountingTreatment)}</div></div><div className="rounded-lg border p-3 text-sm"><h3 className="font-semibold">Record support</h3><div className="mt-2">{workOrderMetaById[detail.id].linkedTxn ? "Expense linked" : "No linked expense"} · {workOrderMetaById[detail.id].linkedDocumentCount} documents</div><div className="mt-2 space-y-1 text-xs text-amber-700">{workOrderMetaById[detail.id].issues.map((issue) => <p key={issue.key}>{issue.label}</p>)}</div></div></div>
              <Button disabled={!canCreateEditRecords} onClick={() => setDetailSection("update")}>Edit details</Button>
            </div> : detailSection === "update" ? renderWorkOrderEditor(detail) : <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2"><Button size="sm" disabled={!canCreateEditRecords} onClick={() => openWorkOrderAttachmentPicker(detail)}>Attach file</Button><Button size="sm" variant="secondary" onClick={() => { setDetailId(""); openWorkOrderDocuments(detail); }}>Open documents</Button></div>
              {detailFiles.length ? <label className="block text-xs text-slate-500">File<Select value={selectedFileId || detailFiles[0].id} onValueChange={setSelectedFileId}><SelectTrigger aria-label="Work order file" className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{detailFiles.map((file) => <SelectItem key={file.id} value={file.id}>{file.name}</SelectItem>)}</SelectContent></Select></label> : null}
              <RecordFilePreview document={detailFiles.find((file) => file.id === selectedFileId) || detailFiles[0]} />
            </div>}

          </>}
        </RecordDetailPanel>
      </CardContent>
    </Card>
  );
}
