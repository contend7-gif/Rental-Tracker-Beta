import assert from "node:assert/strict";
import { test } from "node:test";

import { buildRealDataChecklist } from "./realDataChecklist.ts";

test("real-data checklist asks for first records and backup on empty app", () => {
  const checklist = buildRealDataChecklist({ state: {}, persistenceHealth: { persistenceAvailable: true, databaseIntegrityOk: true } });

  assert.equal(checklist.status, "needs_setup");
  assert.equal(checklist.items.find((item) => item.key === "first-property")?.status, "needs_setup");
  assert.equal(checklist.items.find((item) => item.key === "backup-before-real-records")?.status, "needs_setup");
});

test("real-data checklist flags sample dataset before real entry", () => {
  const checklist = buildRealDataChecklist({
    state: { properties: [{ id: "demo-property", name: "Sample Duplex" }], units: [{ id: "demo-unit" }] },
    persistenceHealth: { persistenceAvailable: true, databaseIntegrityOk: true },
  });

  assert.equal(checklist.items.find((item) => item.key === "fictional-data-awareness")?.status, "needs_review");
});

test("real-data checklist completes core items when real data and validation are healthy", () => {
  const checklist = buildRealDataChecklist({
    state: {
      properties: [{ id: "p1", name: "Rental property" }],
      units: [{ id: "u1", propertyId: "p1" }],
      transactions: [{ id: "t1" }],
    },
    persistenceHealth: { persistenceAvailable: true, databaseIntegrityOk: true, missingDocumentFileCount: 0 },
    backupValidationResult: { status: "valid", label: "Valid" },
  });

  assert.equal(checklist.items.find((item) => item.key === "backup-before-real-records")?.status, "complete");
  assert.equal(checklist.items.find((item) => item.key === "database-health")?.status, "complete");
  assert.equal(checklist.items.find((item) => item.key === "first-source-record")?.status, "complete");
});
