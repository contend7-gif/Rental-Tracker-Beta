import { maintenanceAccountingTreatmentLabel } from "../../domain/maintenance.ts";
import { toLocalIsoDate } from "../../lib/localDate.ts";

const COMPLETED_STATUSES = new Set(["Completed", "Closed"]);
const OPEN_STATUSES = new Set(["Open", "In Progress", "Waiting on Parts"]);
const UNCLEAR_CATEGORIES = new Set(["Other expenses", "Other income", "Uncategorized", "Other", ""]);

const ISSUE_HELP = {
  completed_without_expense: "Completed paid work should usually have a linked expense transaction.",
  actual_cost_without_transaction: "Actual cost is entered, but no ledger expense is linked yet.",
  actual_cost_without_document: "Actual paid work should have a receipt, invoice, or linked support document.",
  capital_improvement_without_asset: "Capital-improvement work needs an asset record before depreciation review.",
  capital_treatment_without_asset: "This work order is classified as capital but is not linked to an asset.",
  linked_transaction_missing_document: "The linked expense is missing a receipt or supporting document.",
  linked_transaction_not_capitalized: "Capital-improvement work is linked to an expense that is not marked capital improvement.",
  tenant_damage_without_recovery: "Tenant damage should note the deposit, reimbursement, tenant ledger entry, or why recovery is not expected.",
  vendor_missing_category: "Vendor/category defaults are incomplete or too generic for accounting cleanup.",
  stale_open_work_order: "This work order is still open after its due date.",
  accounting_treatment_needed: "Choose how this work should be treated for accounting.",
  accounting_review_open: "Mark accounting reviewed once the treatment, support, and linked records are settled.",
};

const ISSUE_LABELS = {
  completed_without_expense: "Completed without expense",
  actual_cost_without_transaction: "Actual cost without transaction",
  actual_cost_without_document: "Actual cost without document",
  capital_improvement_without_asset: "Capital improvement needs asset",
  capital_treatment_without_asset: "Capital treatment needs asset",
  linked_transaction_missing_document: "Linked expense missing document",
  linked_transaction_not_capitalized: "Linked expense not capitalized",
  tenant_damage_without_recovery: "Tenant damage recovery open",
  vendor_missing_category: "Vendor/category missing",
  stale_open_work_order: "Stale open work order",
  accounting_treatment_needed: "Accounting treatment needed",
  accounting_review_open: "Accounting review open",
};

function issue(key, field) {
  return { key, label: ISSUE_LABELS[key] || key, help: ISSUE_HELP[key] || "", field };
}

function amount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function workOrderCost(workOrder) {
  return Math.max(amount(workOrder?.actualCost), amount(workOrder?.estimatedCost));
}

function hasWorkOrderDocument(workOrder, documents = []) {
  if (Array.isArray(workOrder?.sourceDocumentIds) && workOrder.sourceDocumentIds.length > 0) return true;
  return documents.some((document) => document.workOrderId === workOrder?.id);
}

function hasTransactionDocument(transaction, documents = []) {
  if (!transaction) return false;
  if (String(transaction.receiptName || "").trim()) return true;
  return documents.some((document) =>
    document.transactionId === transaction.id ||
    (Array.isArray(document.relatedTransactionIds) && document.relatedTransactionIds.includes(transaction.id))
  );
}

function assetLinkedToWorkOrder(workOrder, assets = []) {
  if (!workOrder) return null;
  if (workOrder.assetId) {
    const direct = assets.find((asset) => asset.id === workOrder.assetId);
    if (direct) return direct;
  }
  return assets.find((asset) => asset.sourceWorkOrderId === workOrder.id) || null;
}

function assetLinkedToTransaction(transactionId, assets = []) {
  if (!transactionId) return null;
  return assets.find((asset) =>
    asset.sourceTransactionId === transactionId ||
    (Array.isArray(asset.sourceTransactionIds) && asset.sourceTransactionIds.includes(transactionId))
  ) || null;
}

export function buildAssetDraftFromWorkOrder(workOrder, context = {}) {
  const cost = workOrderCost(workOrder);
  const linkedDocumentIds = (context.documents || [])
    .filter((document) => document.workOrderId === workOrder?.id)
    .map((document) => document.id);
  const description = workOrder?.title || workOrder?.description || "Capital improvement";

  return {
    propertyId: workOrder?.propertyId || "",
    unit: workOrder?.unit || "Shared",
    type: "Capital Improvement",
    description,
    placedInService: workOrder?.completedAt || workOrder?.dueDate || workOrder?.reportedOn || context.todayIso || "",
    cost: String(cost || ""),
    landValue: "",
    basis: String(cost || ""),
    life: String(context.defaultLifeForAssetType?.("Capital Improvement") || 27.5),
    bonusElected: "No",
    bonusRate: "",
    sourceWorkOrderId: workOrder?.id || "",
    sourceTransactionId: workOrder?.transactionId || "",
    sourceDocumentIds: linkedDocumentIds,
    assetReviewChecked: false,
    assetReviewNotes: "",
    createdFrom: "maintenance",
  };
}

export function getWorkOrderReviewIssues(workOrder, context = {}) {
  if (!workOrder) return [];
  const documents = context.documents || [];
  const assets = context.assets || [];
  const vendors = context.vendors || [];
  const transactions = context.transactions || [];
  const todayIso = context.todayIso || toLocalIsoDate();
  const linkedTransaction = workOrder.transactionId ? transactions.find((transaction) => transaction.id === workOrder.transactionId) : null;
  const treatment = workOrder.accountingTreatment || "needs_review";
  const actualCost = amount(workOrder.actualCost);
  const estimatedCost = amount(workOrder.estimatedCost);
  const hasLinkedTransaction = Boolean(linkedTransaction);
  const linkedAsset = assetLinkedToWorkOrder(workOrder, assets) || assetLinkedToTransaction(workOrder.transactionId, assets);
  const issues = [];

  if (COMPLETED_STATUSES.has(workOrder.status) && (actualCost > 0 || estimatedCost > 0) && !hasLinkedTransaction) {
    issues.push(issue("completed_without_expense", "transactionId"));
  }

  if (actualCost > 0 && !hasLinkedTransaction) {
    issues.push(issue("actual_cost_without_transaction", "transactionId"));
  }

  if (actualCost > 0 && !hasWorkOrderDocument(workOrder, documents) && !hasTransactionDocument(linkedTransaction, documents)) {
    issues.push(issue("actual_cost_without_document", "sourceDocumentIds"));
  }

  if (treatment === "capital_improvement" && !linkedAsset) {
    issues.push(issue("capital_improvement_without_asset", "assetId"));
    issues.push(issue("capital_treatment_without_asset", "assetId"));
  }

  if (treatment === "capital_improvement" && linkedTransaction && !linkedTransaction.capitalImprovement) {
    issues.push(issue("linked_transaction_not_capitalized", "transactionId"));
  }

  if (linkedTransaction && !hasTransactionDocument(linkedTransaction, documents) && !hasWorkOrderDocument(workOrder, documents)) {
    issues.push(issue("linked_transaction_missing_document", "transactionId"));
  }

  if (treatment === "tenant_damage" && !workOrder.tenantLedgerEntryId && !workOrder.reimbursementTransactionId && !String(workOrder.accountingReviewNotes || "").trim()) {
    issues.push(issue("tenant_damage_without_recovery", "tenantLedgerEntryId"));
  }

  const vendor = workOrder.vendorId ? vendors.find((item) => item.id === workOrder.vendorId) : null;
  if ((vendor && !String(vendor.defaultCategory || "").trim()) || (linkedTransaction && UNCLEAR_CATEGORIES.has(String(linkedTransaction.category || "")))) {
    issues.push(issue("vendor_missing_category", "vendorId"));
  }

  if (OPEN_STATUSES.has(workOrder.status) && workOrder.dueDate && workOrder.dueDate < todayIso) {
    issues.push(issue("stale_open_work_order", "dueDate"));
  }

  if (!workOrder.accountingTreatment || treatment === "needs_review") {
    issues.push(issue("accounting_treatment_needed", "accountingTreatment"));
  }

  if (!workOrder.accountingReviewed && (actualCost > 0 || hasLinkedTransaction || COMPLETED_STATUSES.has(workOrder.status) || treatment === "capital_improvement")) {
    issues.push(issue("accounting_review_open", "accountingReviewed"));
  }

  return issues.filter((item, index, list) => list.findIndex((candidate) => candidate.key === item.key) === index);
}

export function getWorkOrderReadiness(workOrder, context = {}) {
  const issues = getWorkOrderReviewIssues(workOrder, context);
  if (issues.length > 0) return { key: "needs_review", label: "Needs accounting review", issues };
  if (workOrder?.accountingTreatment === "owner_only" || workOrder?.accountingTreatment === "non_deductible") {
    return { key: "not_tax_relevant", label: "Not tax relevant", issues };
  }
  return { key: "ready", label: "Ready for Tax Center", issues };
}

function primaryActionForIssues(issues) {
  const keys = new Set(issues.map((item) => item.key));
  if (keys.has("completed_without_expense") || keys.has("actual_cost_without_transaction")) return "create_expense";
  if (keys.has("capital_improvement_without_asset") || keys.has("capital_treatment_without_asset")) return "create_asset";
  if (keys.has("actual_cost_without_document") || keys.has("linked_transaction_missing_document")) return "attach_file";
  if (keys.has("accounting_review_open")) return "mark_accounting_reviewed";
  return "edit_work_order";
}

export function buildMaintenanceReviewInbox(workOrders = [], context = {}) {
  const records = workOrders
    .map((workOrder) => {
      const issues = getWorkOrderReviewIssues(workOrder, context);
      return {
        workOrder,
        issues,
        readiness: getWorkOrderReadiness(workOrder, context),
        primaryAction: primaryActionForIssues(issues),
        accountingLabel: maintenanceAccountingTreatmentLabel(workOrder.accountingTreatment),
      };
    })
    .filter((record) => record.issues.length > 0)
    .sort((left, right) => {
      const costDelta = workOrderCost(right.workOrder) - workOrderCost(left.workOrder);
      if (costDelta !== 0) return costDelta;
      return String(left.workOrder.dueDate || left.workOrder.reportedOn || "").localeCompare(String(right.workOrder.dueDate || right.workOrder.reportedOn || ""));
    });

  const countIssue = (key) => records.filter((record) => record.issues.some((issue) => issue.key === key)).length;

  return {
    records,
    counts: {
      total: records.length,
      completedWithoutExpense: countIssue("completed_without_expense"),
      capitalImprovementWithoutAsset: countIssue("capital_improvement_without_asset"),
      actualCostWithoutDocument: countIssue("actual_cost_without_document"),
      staleOpen: countIssue("stale_open_work_order"),
    },
  };
}
