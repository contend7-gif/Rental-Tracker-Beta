import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  BACKUP_SCHEMA_VERSION,
  createPersistenceService,
  expectedPersistenceTableNames,
  sanitizeSettingsForPersistence,
} from "../electron/db.mjs";

async function withPersistence(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rental-tracker-persistence-"));
  const service = await createPersistenceService({ userDataPath: dir, appVersion: "9.9.9-test" });
  t.after(async () => {
    service.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  return service;
}

function sampleBackup(overrides = {}) {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: "9.9.9-test",
    exportedAt: "2026-05-05T12:00:00.000Z",
    settings: {
      aiDocumentCopilotEnabled: true,
      aiOpenAiApiKey: "OPENAI-TEST-SECRET",
      aiOpenAiModel: "gpt-4o-mini",
    },
    data: {
      properties: [{ id: "p1", name: "Duplex", address: "1 Main", type: "Duplex" }],
      units: [{ id: "u1", propertyId: "p1", name: "A", status: "Rental" }],
      transactions: [{
        id: "t1",
        date: "2026-05-01",
        propertyId: "p1",
        unit: "A",
        type: "Expense",
        category: "Repairs",
        description: "Sink repair",
        amount: 125.5,
        status: "active",
      }],
      leases: [{ id: "l1", propertyId: "p1", unit: "A", tenantName: "Tenant", startDate: "2026-01-01", endDate: "2026-12-31", monthlyRent: 1200, status: "Active" }],
      tenantLedgerEntries: [{ id: "tle1", leaseId: "l1", date: "2026-05-01", kind: "charge", amount: 1200, memo: "May rent", createdAt: "2026-05-01T00:00:00.000Z" }],
      documents: [{
        id: "d1",
        propertyId: "p1",
        name: "invoice.pdf",
        type: "Invoice",
        transactionId: "t1",
        relatedTransactionIds: ["t2", "t3"],
        uploadedAt: "2026-05-02T00:00:00.000Z",
        mimeType: "application/pdf",
        dataUrl: "data:application/pdf;base64,SGVsbG8=",
        tags: ["repair", "plumbing"],
        extractedText: "Invoice total $125.50",
        ocrStatus: "completed",
        aiAnalysis: { summary: "Plumbing repair invoice", totalAmount: 125.5, model: "gpt-4o-mini" },
      }],
      loans: [{ id: "loan1", propertyId: "p1", lender: "Bank", loanType: "Primary Mortgage", currentBalance: 250000, nextPayment: "2026-06-01" }],
      loanPayments: [{ id: "lp1", loanId: "loan1", paymentDate: "2026-05-01", totalPayment: 1800, interest: 1000, principal: 300, escrow: 500 }],
      assets: [{ id: "a1", propertyId: "p1", unit: "Shared", description: "Building", type: "Residential Building", placedInService: "2026-01-01", cost: 300000, basis: 250000, life: 27.5, currentYearDep: 1000 }],
      usePeriods: [{ id: "up1", propertyId: "p1", unit: "A", startDate: "2026-01-01", useType: "Rental", rentalUsePct: 1 }],
      recurringTemplates: [{ id: "rt1", propertyId: "p1", unit: "A", description: "Rent", type: "Income", category: "Rent", amount: 1200, frequency: "Monthly", nextDueDate: "2026-06-01", reviewRequired: false, ownerUsePct: 0, active: true }],
      recurringDrafts: [{ id: "rd1", templateId: "rt1", dueDate: "2026-06-01", status: "draft", transactionSeed: { date: "2026-06-01" } }],
      vendors: [{ id: "v1", name: "Plumber", active: true }],
      workOrders: [{ id: "wo1", propertyId: "p1", unit: "A", title: "Fix sink", description: "Leak", priority: "Medium", status: "Open", reportedOn: "2026-05-01", createdAt: "2026-05-01T00:00:00.000Z" }],
      activityLog: [{ id: "ale1", at: "2026-05-01T00:00:00.000Z", actor: "local-user", action: "create", entityType: "transaction", entityId: "t1", summary: "Created transaction.", immutable: true }],
      planningActiveScenarioId: "base",
      taxDayOverrides: { p1: true },
      ...overrides.data,
    },
    ...overrides,
  };
}

test("database schema migration creates expected tables", async (t) => {
  const service = await withPersistence(t);
  const tables = service.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
  for (const tableName of expectedPersistenceTableNames()) {
    assert.ok(tables.includes(tableName), `missing table ${tableName}`);
  }
});

test("saving and loading app data round-trips core rental records", async (t) => {
  const service = await withPersistence(t);
  await service.saveAppData(sampleBackup());
  const loaded = await service.loadAppData();

  assert.equal(loaded.ok, true);
  assert.equal(loaded.hasData, true);
  assert.equal(loaded.backup.data.properties[0].id, "p1");
  assert.equal(loaded.backup.data.units[0].id, "u1");
  assert.equal(loaded.backup.data.transactions[0].amount, 125.5);
  assert.equal(loaded.backup.data.leases[0].tenantName, "Tenant");
  assert.equal(loaded.backup.data.tenantLedgerEntries[0].id, "tle1");
  assert.equal(loaded.backup.data.loans[0].id, "loan1");
  assert.equal(loaded.backup.data.loanPayments[0].id, "lp1");
  assert.equal(loaded.backup.data.activityLog[0].id, "ale1");
  assert.equal(loaded.backup.data.planningActiveScenarioId, "base");
  assert.deepEqual(loaded.backup.data.taxDayOverrides, { p1: true });
});

test("activity history can load after the primary app data", async (t) => {
  const service = await withPersistence(t);
  await service.saveAppData(sampleBackup());

  const initial = await service.loadAppData({ deferredCollectionKeys: ["activityLog"] });
  assert.deepEqual(initial.backup.data.activityLog, []);
  assert.deepEqual(initial.meta.deferredCollectionKeys, ["activityLog"]);

  const deferred = await service.loadDeferredCollections(["activityLog"]);
  assert.equal(deferred.ok, true);
  assert.equal(deferred.collections.activityLog[0].id, "ale1");
});

test("activity history supports indexed filters and pages", async (t) => {
  const service = await withPersistence(t);
  const backup = sampleBackup({
    data: {
      activityLog: [
        { id: "a-new", at: "2026-05-04T12:00:00.000Z", action: "update", category: "record", entityType: "transaction", entityId: "t1", propertyId: "p1", unit: "A", summary: "Newest" },
        { id: "a-old", at: "2026-04-04T12:00:00.000Z", action: "create", category: "record", entityType: "document", entityId: "d1", propertyId: "p1", unit: "Shared", summary: "Older" },
      ],
    },
  });
  await service.saveAppData(backup);

  const firstPage = await service.queryActivityLogPage({ filters: { year: "2026", propertyId: "p1" }, limit: 1 });
  assert.equal(firstPage.total, 2);
  assert.equal(firstPage.rows[0].id, "a-new");
  assert.equal(firstPage.hasMore, true);

  const nextPage = await service.queryActivityLogPage({ filters: { action: "create" }, limit: 1, offset: 0 });
  assert.equal(nextPage.rows[0].id, "a-old");
});

test("persistence health reports non-sensitive collection counts", async (t) => {
  const service = await withPersistence(t);
  await service.saveAppData(sampleBackup());
  const health = await service.getHealth();

  assert.equal(health.persistenceAvailable, true);
  assert.equal(health.databaseIntegrityOk, true);
  assert.equal(health.databaseIntegrityResult, "ok");
  assert.equal(health.collectionCounts.properties, 1);
  assert.equal(health.collectionCounts.transactions, 1);
  assert.equal(health.collectionCounts.documents, 1);
  assert.equal(health.collectionCounts.tenantLedgerEntries, 1);
  assert.ok(health.structuredDataRecordCount >= 12);
  assert.equal(JSON.stringify(health).includes("Tenant"), false);
  assert.equal(JSON.stringify(health).includes("Sink repair"), false);
});

test("persistence health reports orphan and missing document files without tenant data", async (t) => {
  const service = await withPersistence(t);
  await service.saveAppData(sampleBackup());
  const loaded = await service.loadAppData();
  const relativePath = loaded.backup.data.documents[0].relativePath;

  await fs.writeFile(path.join(service.paths.documentsDir, "orphan-note.txt"), "orphan");
  const orphanHealth = await service.getHealth();
  assert.equal(orphanHealth.orphanDocumentFileCount, 1);
  assert.equal(orphanHealth.orphanDocumentBytes, 6);
  assert.equal(orphanHealth.missingDocumentFileCount, 0);
  assert.equal(JSON.stringify(orphanHealth).includes("invoice.pdf"), false);

  await fs.rm(path.join(service.paths.documentsDir, relativePath), { force: true });
  const missingHealth = await service.getHealth();
  assert.equal(missingHealth.orphanDocumentFileCount, 1);
  assert.equal(missingHealth.missingDocumentFileCount, 1);
});

test("legacy localStorage-shaped data can be imported and persisted", async (t) => {
  const service = await withPersistence(t);
  const legacy = sampleBackup({ schemaVersion: 1 });
  await service.importLegacyLocalStorageData(legacy);
  const loaded = await service.loadAppData();

  assert.equal(loaded.hasData, true);
  assert.equal(loaded.backup.data.transactions[0].id, "t1");
  assert.match(loaded.meta.legacyLocalStorageImportedAt, /^202/);
});

test("document metadata and file-backed blobs survive round-trip", async (t) => {
  const service = await withPersistence(t);
  await service.saveAppData(sampleBackup());
  const loaded = await service.loadAppData();
  const document = loaded.backup.data.documents[0];

  assert.deepEqual(document.relatedTransactionIds, ["t2", "t3"]);
  assert.equal(document.aiAnalysis.summary, "Plumbing repair invoice");
  assert.equal(document.fileHash.length, 64);
  assert.equal(document.fileSize, 5);
  assert.match(document.relativePath, /d1-invoice/);
  assert.equal(document.dataUrl, undefined);
  assert.equal(await service.readDocumentDataUrl(document), "data:application/pdf;base64,SGVsbG8=");
});

test("secret settings are excluded from persisted settings and backups", async (t) => {
  const service = await withPersistence(t);
  await service.saveAppData(sampleBackup());
  const exported = await service.exportBackup();
  const settingsRow = service.db.prepare("SELECT value FROM app_data WHERE key = 'settings'").get();

  assert.equal(sanitizeSettingsForPersistence({ aiOpenAiApiKey: "OPENAI-TEST" }).aiOpenAiApiKey, undefined);
  assert.equal(exported.settings.aiOpenAiApiKey, undefined);
  assert.equal(exported.settings.hasAiOpenAiApiKey, true);
  assert.equal(JSON.stringify(exported).includes("OPENAI-TEST-SECRET"), false);
  assert.equal(String(settingsRow.value).includes("aiOpenAiApiKey"), false);
  assert.equal(String(settingsRow.value).includes("OPENAI-TEST-SECRET"), false);
});

test("zip backup archives include document files and restore them into a fresh database", async (t) => {
  const source = await withPersistence(t);
  await source.saveAppData(sampleBackup());
  const archive = await source.exportBackupArchive();

  assert.equal(archive.ok, true);
  assert.equal(archive.embeddedDocumentFileCount, 1);
  assert.deepEqual(archive.missingDocumentFiles, []);
  assert.match(archive.fileName, /\.zip$/);

  const target = await withPersistence(t);
  const imported = await target.importBackupArchive(archive.buffer);
  const loaded = await target.loadAppData();
  const document = loaded.backup.data.documents[0];

  assert.equal(imported.ok, true);
  assert.equal(imported.restoredDocumentFiles.length, 1);
  assert.deepEqual(imported.missingDocumentFiles, []);
  assert.equal(document.dataUrl, undefined);
  assert.equal(await target.readDocumentDataUrl(document), "data:application/pdf;base64,SGVsbG8=");
  assert.equal(document.aiAnalysis.summary, "Plumbing repair invoice");
});

test("zip backup archives include existing file-backed documents and restore exact file bytes", async (t) => {
  const source = await withPersistence(t);
  const documentBytes = Buffer.from("%PDF-1.4\nreal-file-backed-document\n%%EOF\n");
  const relativePath = "nested/real-invoice.pdf";
  await fs.mkdir(path.join(source.paths.documentsDir, "nested"), { recursive: true });
  await fs.writeFile(path.join(source.paths.documentsDir, relativePath), documentBytes);

  await source.saveAppData(sampleBackup({
    data: {
      documents: [{
        id: "d-file",
        propertyId: "p1",
        name: "real-invoice.pdf",
        type: "Invoice",
        relatedTransactionIds: ["t1"],
        uploadedAt: "2026-05-02T00:00:00.000Z",
        mimeType: "application/pdf",
        relativePath,
        fileHash: "existing-hash",
        fileSize: documentBytes.length,
        aiAnalysis: { summary: "Existing file document", totalAmount: 125.5 },
      }],
    },
  }));

  const archive = await source.exportBackupArchive();
  assert.equal(archive.ok, true);
  assert.equal(archive.embeddedDocumentFileCount, 1);
  assert.deepEqual(archive.missingDocumentFiles, []);

  const target = await withPersistence(t);
  const imported = await target.importBackupArchive(archive.buffer);
  const restoredBytes = await fs.readFile(path.join(target.paths.documentsDir, relativePath));
  const loaded = await target.loadAppData();
  const document = loaded.backup.data.documents[0];

  assert.equal(imported.ok, true);
  assert.equal(imported.restoredDocumentFiles.length, 1);
  assert.deepEqual(restoredBytes, documentBytes);
  assert.equal(document.dataUrl, undefined);
  assert.equal(await target.readDocumentDataUrl(document), `data:application/pdf;base64,${documentBytes.toString("base64")}`);
  assert.deepEqual(document.relatedTransactionIds, ["t1"]);
  assert.equal(document.aiAnalysis.summary, "Existing file document");
});

test("zip backup archives report missing document files without blocking structured restore", async (t) => {
  const source = await withPersistence(t);
  await source.saveAppData(sampleBackup());
  const loaded = await source.loadAppData();
  await fs.rm(path.join(source.paths.documentsDir, loaded.backup.data.documents[0].relativePath), { force: true });

  const archive = await source.exportBackupArchive();
  assert.equal(archive.embeddedDocumentFileCount, 0);
  assert.equal(archive.missingDocumentFiles.length, 1);

  const target = await withPersistence(t);
  const imported = await target.importBackupArchive(archive.buffer);
  const restored = await target.loadAppData();

  assert.equal(imported.ok, true);
  assert.equal(imported.missingDocumentFiles.length, 1);
  assert.equal(restored.backup.data.documents[0].id, "d1");
  assert.equal(restored.backup.data.documents[0].dataUrl, undefined);
  assert.deepEqual(restored.errors, []);
  await assert.rejects(() => target.readDocumentDataUrl(restored.backup.data.documents[0]));
});

test("manual restore points force a fresh managed backup with the latest data", async (t) => {
  const service = await withPersistence(t);
  await service.saveAppData(sampleBackup());
  const firstBackupFiles = (await fs.readdir(service.paths.backupsDir)).filter((name) => name.endsWith(".zip"));
  assert.equal(firstBackupFiles.length, 1);

  await service.createRestorePoint(sampleBackup({
    exportedAt: "2026-05-06T12:00:00.000Z",
    data: {
      transactions: [{
        id: "t2",
        date: "2026-05-06",
        propertyId: "p1",
        unit: "A",
        type: "Income",
        category: "Rent",
        description: "June rent",
        amount: 1200,
        status: "active",
      }],
    },
  }));

  const backupFiles = (await fs.readdir(service.paths.backupsDir)).filter((name) => name.endsWith(".zip"));
  const exported = await service.exportBackup();
  const health = await service.getHealth();
  assert.equal(backupFiles.length, 2);
  assert.equal(exported.data.transactions[0].id, "t2");
  assert.match(health.lastBackupAt, /^202/);
});
