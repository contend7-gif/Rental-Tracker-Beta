import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSetupChecklist, shouldShowFullSetupChecklist } from "./setupChecklist.js";

test("empty app returns core checklist items needing setup", () => {
  const checklist = buildSetupChecklist();

  assert.equal(checklist.items.length, 11);
  assert.equal(checklist.items.find((item) => item.key === "property")?.status, "needs_setup");
  assert.equal(checklist.items.find((item) => item.key === "units")?.status, "needs_setup");
  assert.equal(checklist.items.find((item) => item.key === "loan")?.status, "optional");
  assert.equal(checklist.status, "needs_setup");
});

test("property with units but no occupancy returns occupancy item needs setup", () => {
  const checklist = buildSetupChecklist({
    properties: [{ id: "p1", name: "Sample Duplex" }],
    units: [{ id: "u1", propertyId: "p1", name: "Unit A" }],
  });

  assert.equal(checklist.items.find((item) => item.key === "property")?.status, "complete");
  assert.equal(checklist.items.find((item) => item.key === "units")?.status, "complete");
  assert.equal(checklist.items.find((item) => item.key === "occupancy")?.status, "needs_setup");
});

test("archived properties do not satisfy active setup readiness", () => {
  const checklist = buildSetupChecklist({
    properties: [{ id: "archived", name: "Former rental", archivedAt: "2026-06-12T00:00:00.000Z" }],
    units: [{ id: "u1", propertyId: "archived", name: "Unit A" }],
  });

  assert.equal(checklist.items.find((item) => item.key === "property")?.status, "needs_setup");
  assert.equal(checklist.items.find((item) => item.key === "units")?.status, "needs_setup");
});

test("property with document marks first document complete", () => {
  const checklist = buildSetupChecklist({
    properties: [{ id: "p1", name: "Sample Duplex" }],
    documents: [{ id: "d1", propertyId: "p1", name: "Example receipt" }],
  });

  assert.equal(checklist.items.find((item) => item.key === "document")?.status, "complete");
});

test("setup item targetView values are stable", () => {
  const checklist = buildSetupChecklist();
  const targets = Object.fromEntries(checklist.items.map((item) => [item.key, item.targetView]));

  assert.deepEqual(targets, {
    property: "properties",
    units: "properties",
    occupancy: "leaseHistory",
    lease: "leaseHistory",
    loan: "loans",
    assets: "assets",
    recurring: "ledger",
    tenantLedger: "leaseHistory",
    document: "documents",
    readiness: "tax",
    backup: "settings",
  });
});

test("complete sample property reports core setup complete except optional gaps", () => {
  const checklist = buildSetupChecklist({
    properties: [{ id: "p1", name: "Sample Duplex" }],
    units: [{ id: "u1", propertyId: "p1", name: "Unit A" }],
    usePeriods: [{ id: "up1", propertyId: "p1", unit: "Unit A" }],
    leases: [{ id: "l1", propertyId: "p1", unit: "Unit A" }],
    loans: [{ id: "loan1", propertyId: "p1" }],
    assets: [{ id: "a1", propertyId: "p1" }],
    transactions: [
      { id: "t1", propertyId: "p1", recurringTemplateId: "r1" },
      { id: "t2", propertyId: "p1" },
    ],
    documents: [{ id: "d1", propertyId: "p1" }],
    tenantLedgerEntries: [{ id: "e1", leaseId: "l1" }],
    desktopHealth: { lastBackupAt: "2026-12-31T12:00:00.000Z" },
    taxReadinessSummary: { status: "ready" },
  });

  assert.equal(checklist.needsSetupCount, 0);
  assert.equal(checklist.status, "complete");
});

test("readiness item reflects needs_review tax readiness", () => {
  const checklist = buildSetupChecklist({
    properties: [{ id: "p1", name: "Sample Duplex" }],
    taxReadinessSummary: { status: "needs_review" },
  });

  assert.equal(checklist.items.find((item) => item.key === "readiness")?.status, "needs_review");
  assert.equal(checklist.status, "needs_setup");
});

test("readiness item is complete when tax readiness is ready", () => {
  const checklist = buildSetupChecklist({
    properties: [{ id: "p1", name: "Sample Duplex" }],
    taxReadinessSummary: { status: "ready" },
  });

  assert.equal(checklist.items.find((item) => item.key === "readiness")?.status, "complete");
});

test("loan marked not_applicable no longer blocks completion", () => {
  const checklist = buildSetupChecklist({
    properties: [{ id: "p1", name: "Sample Duplex" }],
    units: [{ id: "u1", propertyId: "p1", name: "Unit A" }],
    usePeriods: [{ id: "up1", propertyId: "p1", unit: "Unit A" }],
    leases: [{ id: "l1", propertyId: "p1", unit: "Unit A" }],
    assets: [{ id: "a1", propertyId: "p1" }],
    transactions: [{ id: "t1", propertyId: "p1", recurringTemplateId: "r1" }],
    documents: [{ id: "d1", propertyId: "p1" }],
    tenantLedgerEntries: [{ id: "e1", leaseId: "l1" }],
    desktopHealth: { lastBackupAt: "2026-12-31T12:00:00.000Z" },
    taxReadinessSummary: { status: "ready" },
    overrides: { loan: { status: "not_applicable" } },
  });

  assert.equal(checklist.items.find((item) => item.key === "loan")?.status, "not_applicable");
  assert.equal(checklist.status, "complete");
});

test("dismissed item can be hidden or shown", () => {
  const hidden = buildSetupChecklist({ overrides: { document: { status: "dismissed" } } });
  const shown = buildSetupChecklist({ overrides: { document: { status: "dismissed" } }, showDismissed: true });

  assert.equal(hidden.items.some((item) => item.key === "document"), false);
  assert.equal(shown.items.find((item) => item.key === "document")?.status, "dismissed");
});

test("complete setup collapses by default display helper", () => {
  const complete = { status: "complete" };
  const incomplete = { status: "needs_setup" };

  assert.equal(shouldShowFullSetupChecklist(complete, {}), false);
  assert.equal(shouldShowFullSetupChecklist(complete, { setupChecklistShowCompleted: true }), true);
  assert.equal(shouldShowFullSetupChecklist(incomplete, {}), true);
});
