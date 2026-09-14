import assert from "node:assert/strict";
import test from "node:test";
import { createDocumentWorkspaceController } from "./documentWorkspaceController.ts";

test("utility section draft preserves its unit and amount over another unit's vendor memory", () => {
  let draft: any;
  const noop = () => {};
  const oldWindow = globalThis.window;
  globalThis.window = { requestAnimationFrame: noop } as any;
  try {
    const controller = createDocumentWorkspaceController(new Proxy({
      actions: {}, properties: [{ id: "p1" }], units: [{ propertyId: "p1", name: "101" }, { propertyId: "p1", name: "102" }],
      categories: { Expense: ["Utilities"] },
      transactionVendorMemories: [{ key: "example utilities", vendor: "Example Utilities", type: "Expense", category: "Utilities", propertyId: "p1", unit: "101", paidFrom: "Checking", paymentMethod: "ACH" }],
      createBlankForm: () => ({}), getDocumentLinkedWorkOrder: () => null, getNextExpenseQueueRecord: () => null,
      getDocumentLinkSuggestions: () => [], txnAttachmentInputRef: { current: null }, setForm: (value: any) => { draft = value; },
    }, { get: (target, key) => key in target ? target[key as keyof typeof target] : noop }) as any);
    controller.openExpenseDraftFromUtilitySection({ id: "doc", propertyId: "p1", name: "combined.pdf", unit: "Shared" } as any,
      { propertyId: "p1", unit: "102", vendor: "Example Utilities", amount: 55.44, date: "2026-02-28", servicePeriodStart: "2026-01-15", servicePeriodEnd: "2026-02-15" });
    assert.equal(draft.unit, "102");
    assert.equal(draft.amount, "55.44");
    assert.equal(draft.invoiceAmount, "55.44");
    assert.equal(draft.servicePeriodStart, "2026-01-15");
    assert.equal(draft.servicePeriodEnd, "2026-02-15");
    assert.equal(draft.paidFrom, "Checking");
  } finally { globalThis.window = oldWindow; }
});
