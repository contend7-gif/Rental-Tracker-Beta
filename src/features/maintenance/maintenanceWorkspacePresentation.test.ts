import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMaintenanceWorkspaceModes,
  defaultMaintenanceQuickFilter,
  formatMaintenanceDate,
  maintenanceQuickFiltersForMode,
  workOrderPrimaryActionKey,
} from "./maintenanceWorkspacePresentation.js";

test("maintenance modes separate active work, history, cleanup, and vendors", () => {
  const modes = buildMaintenanceWorkspaceModes({ activeCount: 3, historyCount: 7, cleanupCount: 2, vendorCount: 4 });
  assert.deepEqual(modes.map((mode) => mode.key), ["active", "history", "cleanup", "vendors"]);
  assert.deepEqual(modes.map((mode) => mode.badge), ["3 active", "7 closed", "2 open", "4 vendors"]);
  assert.match(modes[2].description, /asset handoffs/i);
});

test("maintenance modes expose only filters that belong to the current job", () => {
  assert.deepEqual(maintenanceQuickFiltersForMode("active").map((filter) => filter.key), ["active", "open", "in_progress", "waiting", "overdue"]);
  assert.deepEqual(maintenanceQuickFiltersForMode("history").map((filter) => filter.key), ["history", "completed", "closed", "canceled"]);
  assert.deepEqual(maintenanceQuickFiltersForMode("cleanup").map((filter) => filter.key), ["needs_review"]);
  assert.equal(defaultMaintenanceQuickFilter("history"), "history");
});

test("formatMaintenanceDate formats ISO and date-only work-order dates", () => {
  assert.equal(formatMaintenanceDate("2026-04-12T12:00:00.000Z"), "Apr 12, 2026");
  assert.equal(formatMaintenanceDate("2026-04-10"), "Apr 10, 2026");
  assert.equal(formatMaintenanceDate(""), "Not set");
});

test("workOrderPrimaryActionKey favors expense, asset, then management actions", () => {
  const base = {
    id: "wo1",
    status: "Open",
    accountingTreatment: "repair_maintenance",
  };

  assert.equal(workOrderPrimaryActionKey({ workOrder: { ...base, status: "Completed" }, linkedTxn: { id: "txn1" } }), "view_expense");
  assert.equal(workOrderPrimaryActionKey({ workOrder: { ...base, status: "Completed" }, linkedTxn: null }), "create_expense");
  assert.equal(workOrderPrimaryActionKey({ workOrder: { ...base, accountingTreatment: "capital_improvement" }, linkedAsset: null }), "create_asset");
  assert.equal(workOrderPrimaryActionKey({ workOrder: base }), "manage_work_order");
});
