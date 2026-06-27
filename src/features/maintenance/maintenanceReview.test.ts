import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAssetDraftFromWorkOrder,
  getWorkOrderReadiness,
  getWorkOrderReviewIssues,
} from "./maintenanceReview.js";

const baseWorkOrder = {
  id: "wo-1",
  propertyId: "p1",
  unit: "Shared",
  title: "Replace water heater",
  description: "Old unit failed",
  priority: "Medium",
  status: "Completed",
  reportedOn: "2026-04-01",
  dueDate: "2026-04-10",
  vendorId: "v1",
  estimatedCost: 900,
  actualCost: 1000,
  transactionId: "",
  accountingTreatment: "repair_maintenance",
  accountingReviewed: false,
  accountingReviewNotes: "",
  createdAt: "2026-04-01T00:00:00.000Z",
  completedAt: "2026-04-09",
  notes: "",
};

const linkedTransaction = {
  id: "txn-1",
  date: "2026-04-09",
  propertyId: "p1",
  unit: "Shared",
  type: "Expense",
  category: "Repairs",
  description: "Work order: Replace water heater",
  amount: 1000,
  capitalImprovement: false,
  receiptName: "receipt.pdf",
  taxChecked: true,
  status: "active",
};

const context = {
  todayIso: "2026-05-01",
  transactions: [],
  documents: [],
  assets: [],
  vendors: [{ id: "v1", name: "Vendor", defaultCategory: "Repairs", active: true }],
};

test("completed work order with actual cost and no transaction is flagged", () => {
  const keys = getWorkOrderReviewIssues(baseWorkOrder, context).map((issue) => issue.key);

  assert.ok(keys.includes("completed_without_expense"));
  assert.ok(keys.includes("actual_cost_without_transaction"));
});

test("actual cost without document is flagged", () => {
  const keys = getWorkOrderReviewIssues(baseWorkOrder, context).map((issue) => issue.key);

  assert.ok(keys.includes("actual_cost_without_document"));
});

test("capital improvement work order without asset is flagged", () => {
  const keys = getWorkOrderReviewIssues({ ...baseWorkOrder, accountingTreatment: "capital_improvement" }, context).map((issue) => issue.key);

  assert.ok(keys.includes("capital_improvement_without_asset"));
});

test("capital improvement with linked transaction not capitalized is flagged", () => {
  const keys = getWorkOrderReviewIssues(
    { ...baseWorkOrder, accountingTreatment: "capital_improvement", transactionId: linkedTransaction.id },
    { ...context, transactions: [linkedTransaction], documents: [{ id: "doc-1", transactionId: linkedTransaction.id }] },
  ).map((issue) => issue.key);

  assert.ok(keys.includes("linked_transaction_not_capitalized"));
});

test("tenant damage without recovery is flagged", () => {
  const keys = getWorkOrderReviewIssues({ ...baseWorkOrder, accountingTreatment: "tenant_damage" }, context).map((issue) => issue.key);

  assert.ok(keys.includes("tenant_damage_without_recovery"));
});

test("missing accounting treatment is flagged", () => {
  const keys = getWorkOrderReviewIssues({ ...baseWorkOrder, accountingTreatment: undefined }, context).map((issue) => issue.key);

  assert.ok(keys.includes("accounting_treatment_needed"));
});

test("unreviewed completed or actual-cost work order is flagged", () => {
  const keys = getWorkOrderReviewIssues(baseWorkOrder, context).map((issue) => issue.key);

  assert.ok(keys.includes("accounting_review_open"));
});

test("unreviewed capital-improvement work order is flagged even before cost is final", () => {
  const keys = getWorkOrderReviewIssues(
    {
      ...baseWorkOrder,
      status: "Open",
      actualCost: undefined,
      estimatedCost: 0,
      transactionId: "",
      accountingTreatment: "capital_improvement",
      accountingReviewed: false,
    },
    context,
  ).map((issue) => issue.key);

  assert.ok(keys.includes("accounting_review_open"));
});

test("stale open work order past due is flagged", () => {
  const keys = getWorkOrderReviewIssues({ ...baseWorkOrder, status: "Open", actualCost: undefined, transactionId: "", dueDate: "2026-04-01" }, context).map((issue) => issue.key);

  assert.ok(keys.includes("stale_open_work_order"));
});

test("ready completed repair with linked expense, document, treatment, and review returns ready", () => {
  const readiness = getWorkOrderReadiness(
    {
      ...baseWorkOrder,
      transactionId: linkedTransaction.id,
      accountingReviewed: true,
    },
    {
      ...context,
      transactions: [linkedTransaction],
      documents: [{ id: "doc-1", workOrderId: baseWorkOrder.id }, { id: "doc-2", transactionId: linkedTransaction.id }],
    },
  );

  assert.equal(readiness.key, "ready");
});

test("reviewed owner-only work order returns not tax relevant", () => {
  const readiness = getWorkOrderReadiness(
    {
      ...baseWorkOrder,
      status: "Open",
      actualCost: undefined,
      estimatedCost: 0,
      transactionId: "",
      accountingTreatment: "owner_only",
      accountingReviewed: true,
      dueDate: "2026-06-01",
    },
    context,
  );

  assert.equal(readiness.key, "not_tax_relevant");
});

test("work-order-to-asset draft mapping creates sensible defaults", () => {
  const draft = buildAssetDraftFromWorkOrder(baseWorkOrder, {
    todayIso: "2026-05-01",
    defaultLifeForAssetType: () => 27.5,
  });

  assert.equal(draft.propertyId, "p1");
  assert.equal(draft.unit, "Shared");
  assert.equal(draft.description, "Replace water heater");
  assert.equal(draft.placedInService, "2026-04-09");
  assert.equal(draft.cost, "1000");
  assert.equal(draft.basis, "1000");
  assert.equal(draft.sourceWorkOrderId, "wo-1");
});
