import test from "node:test";
import assert from "node:assert/strict";
import { formatMaintenanceDate, workOrderPrimaryActionKey } from "./maintenanceWorkspacePresentation.js";

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
