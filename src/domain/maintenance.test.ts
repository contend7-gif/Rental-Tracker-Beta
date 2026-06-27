import test from "node:test";
import assert from "node:assert/strict";
import { buildWorkOrderStatusSummary, resolveWorkOrderCost, summarizeMaintenanceCostByPropertyUnit } from "./maintenance.ts";
import type { Transaction, WorkOrder } from "../models.ts";

const sampleWorkOrder: WorkOrder = {
  id: "wo1",
  propertyId: "p1",
  unit: "101",
  title: "Plumbing leak",
  description: "Kitchen sink leak",
  priority: "High",
  status: "Open",
  reportedOn: "2026-03-01",
  estimatedCost: 250,
  actualCost: 0,
  createdAt: "2026-03-01T12:00:00.000Z",
};

test("resolveWorkOrderCost prioritizes actual then linked transaction then estimate", () => {
  const txnsById = {
    t1: { amount: 480 },
  };

  assert.equal(resolveWorkOrderCost({ ...sampleWorkOrder, actualCost: 525, transactionId: "t1" }, txnsById), 525);
  assert.equal(resolveWorkOrderCost({ ...sampleWorkOrder, actualCost: undefined, transactionId: "t1" }, txnsById), 480);
  assert.equal(resolveWorkOrderCost({ ...sampleWorkOrder, actualCost: undefined, transactionId: "missing", estimatedCost: 275 }, txnsById), 275);
});

test("buildWorkOrderStatusSummary counts each workflow state", () => {
  const workOrders: WorkOrder[] = [
    { ...sampleWorkOrder, id: "wo-open", status: "Open" },
    { ...sampleWorkOrder, id: "wo-in-progress", status: "In Progress" },
    { ...sampleWorkOrder, id: "wo-waiting", status: "Waiting on Parts" },
    { ...sampleWorkOrder, id: "wo-done", status: "Completed" },
    { ...sampleWorkOrder, id: "wo-cancel", status: "Canceled" },
  ];

  const summary = buildWorkOrderStatusSummary(workOrders);
  const counts = Object.fromEntries(summary.map((row) => [row.status, row.count]));

  assert.deepEqual(counts, {
    Open: 1,
    "In Progress": 1,
    "Waiting on Parts": 1,
    Completed: 1,
    Closed: 0,
    Canceled: 1,
  });
});

test("summarizeMaintenanceCostByPropertyUnit groups costs and excludes canceled totals", () => {
  const transactions: Transaction[] = [
    {
      id: "t-repair",
      date: "2026-03-02",
      propertyId: "p1",
      unit: "101",
      type: "Expense",
      category: "Repairs",
      description: "Plumbing",
      amount: 500,
      ownerUsePct: 0,
      rentalUsePct: 1,
      deductibleAmount: 500,
      paidFrom: "Operating",
      paymentMethod: "ACH",
      reimbursable: false,
      reimbursed: false,
      capitalImprovement: false,
      vendor: "Vendor",
      receiptName: "",
      notes: "",
      taxChecked: true,
      status: "active",
    },
  ];

  const workOrders: WorkOrder[] = [
    { ...sampleWorkOrder, id: "wo1", propertyId: "p1", unit: "101", status: "Completed", transactionId: "t-repair", estimatedCost: 350, actualCost: undefined },
    { ...sampleWorkOrder, id: "wo2", propertyId: "p1", unit: "101", status: "Open", estimatedCost: 125, actualCost: undefined },
    { ...sampleWorkOrder, id: "wo3", propertyId: "p1", unit: "102", status: "Canceled", estimatedCost: 999, actualCost: undefined },
  ];

  const rows = summarizeMaintenanceCostByPropertyUnit(workOrders, transactions);

  assert.equal(rows.length, 2);
  const unit101 = rows.find((row) => row.unit === "101");
  assert.ok(unit101);
  assert.equal(unit101?.workOrderCount, 2);
  assert.equal(unit101?.completedCount, 1);
  assert.equal(unit101?.openCount, 1);
  assert.equal(unit101?.totalCost, 625);

  const unit102 = rows.find((row) => row.unit === "102");
  assert.ok(unit102);
  assert.equal(unit102?.totalCost, 0);
});
