import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCurrentDataStatusPanel,
  buildDemoLoadWarning,
  createSampleDatasetReplacement,
  detectDataStatus,
  getMeaningfulDataCounts,
  isAppDataEmpty,
  prepareDemoScenarioForLoad,
} from "./dataSafety.ts";

test("isAppDataEmpty returns true for empty state", () => {
  assert.equal(isAppDataEmpty({}), true);
  assert.equal(isAppDataEmpty({ properties: [], transactions: [], documents: [] }), true);
});

test("isAppDataEmpty returns false when meaningful data exists", () => {
  assert.equal(isAppDataEmpty({ properties: [{ id: "p1" }] }), false);
  assert.equal(isAppDataEmpty({ transactions: [{ id: "t1" }] }), false);
  assert.equal(isAppDataEmpty({ documents: [{ id: "d1" }] }), false);
  assert.equal(isAppDataEmpty({ workOrders: [{ id: "wo1" }] }), false);
});

test("sample dataset replacement produces expected scenario state and activity", () => {
  const demo = createSampleDatasetReplacement();

  assert.equal(demo.properties.length > 0, true);
  assert.equal(demo.transactions.length > 0, true);
  assert.equal(demo.activityLog[0]?.summary, "Loaded fictional sample dataset");
});

test("meaningful data counts include real-entry collections", () => {
  const counts = getMeaningfulDataCounts({
    properties: [{ id: "p1" }],
    transactions: [{ id: "t1" }, { id: "t2" }],
    documents: [{ id: "d1" }],
    vendors: [{ id: "v1" }],
    loanPayments: [{ id: "lp1" }],
    usePeriods: [{ id: "up1" }],
  });

  assert.equal(counts.properties, 1);
  assert.equal(counts.transactions, 2);
  assert.equal(counts.documents, 1);
  assert.equal(counts.vendors, 1);
  assert.equal(counts.loanPayments, 1);
  assert.equal(counts.usePeriods, 1);
  assert.equal(counts.total, 7);
});

test("detectDataStatus distinguishes demo loaded from real data", () => {
  assert.equal(detectDataStatus({ properties: [{ id: "demo-property", name: "Sample Duplex" }] }).status, "demo_loaded");
  assert.equal(detectDataStatus({ properties: [{ id: "p1", name: "Rental property" }] }).status, "real_data_present");
  assert.equal(detectDataStatus({}).status, "empty");
});

test("destructive demo load warning appears for non-empty state", () => {
  assert.equal(buildDemoLoadWarning({}).requiresTypedConfirmation, false);
  const warning = buildDemoLoadWarning({ transactions: [{ id: "t1" }] });
  assert.equal(warning.requiresTypedConfirmation, true);
  assert.match(warning.message, /replace current local app data/i);
});

test("demo load preparation omits settings and secret-shaped fields", () => {
  const prepared = prepareDemoScenarioForLoad({ appSettings: { aiOpenAiApiKey: "secret" } });
  assert.equal("appSettings" in prepared, false);
  assert.equal("aiOpenAiApiKey" in prepared, false);
  assert.equal("hasAiOpenAiApiKey" in prepared, false);
});

test("current data status summarizes backup and document health", () => {
  const panel = buildCurrentDataStatusPanel({
    state: { documents: [{ id: "d1" }] },
    persistenceHealth: {
      persistenceAvailable: true,
      lastBackupAt: "2026-01-01T00:00:00.000Z",
      backupCount: 2,
      databaseIntegrityOk: true,
      documentStorageFileCount: 3,
      missingDocumentFileCount: 0,
      lastBackupValidationLabel: "Valid",
    },
  });

  assert.equal(panel.status, "real_data_present");
  assert.equal(panel.backupCount, 2);
  assert.equal(panel.databaseIntegrityLabel, "ok");
  assert.equal(panel.documentFileCount, 3);
  assert.equal(panel.lastValidationStatus, "Valid");
});
