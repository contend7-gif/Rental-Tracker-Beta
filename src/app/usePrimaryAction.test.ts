import assert from "node:assert/strict";
import { test } from "node:test";

import { usePrimaryAction } from "./usePrimaryAction.js";

function buildAction(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const action = usePrimaryAction({
    openDocumentImportPicker: () => calls.push("document"),
    openNewLeaseForUnit: (propertyId: string, unit: string) => calls.push(`lease:${propertyId}:${unit}`),
    propertyFilter: "all",
    setPropertyQuickAddOpen: () => calls.push("property"),
    setView: (view: string) => calls.push(`view:${view}`),
    startAddAsset: () => calls.push("asset"),
    startAddLoan: () => calls.push("loan"),
    startNewWorkOrder: () => calls.push("workOrder"),
    unitFilter: "all",
    ...overrides,
  });
  return { action, calls };
}

test("global New menu exposes the supported creation workflows", () => {
  const { action } = buildAction();
  assert.equal(action.label, "New");
  assert.deepEqual(action.items.map((item) => item.key), [
    "transaction",
    "lease",
    "workOrder",
    "document",
    "property",
    "asset",
    "loan",
  ]);
});

test("transaction and work-order actions open their intended workflows", () => {
  const { action, calls } = buildAction();
  action.items.find((item) => item.key === "transaction")?.onClick();
  action.items.find((item) => item.key === "workOrder")?.onClick();
  assert.deepEqual(calls, ["view:quickAdd", "workOrder"]);
});

test("lease action opens the selected unit or routes to Leases for an unscoped view", () => {
  const scoped = buildAction({ propertyFilter: "property-1", unitFilter: "616" });
  scoped.action.items.find((item) => item.key === "lease")?.onClick();
  assert.deepEqual(scoped.calls, ["lease:property-1:616"]);

  const unscoped = buildAction();
  unscoped.action.items.find((item) => item.key === "lease")?.onClick();
  assert.deepEqual(unscoped.calls, ["view:leaseHistory"]);
});
