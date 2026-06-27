import test from "node:test";
import assert from "node:assert/strict";
import {
  BACKUP_SCHEMA_VERSION,
  normalizeAndMigrateBackup,
  normalizeImportedBackup,
} from "./backupMigrations.ts";

test("normalizeAndMigrateBackup upgrades legacy v1 backups to current schema", () => {
  const legacyBackup = {
    exportedAt: "2026-03-10T00:00:00.000Z",
    transactions: [{ id: "t1", amount: 100, type: "Income" }],
    recurringTemplates: [{ id: "r1", description: "Rent" }],
    recurringDrafts: [{ id: "rd1", templateId: "r1" }],
    loans: [{ id: "l1", lender: "Bank" }],
    loanPayments: [{ id: "lp1", loanId: "l1" }],
    assets: [{ id: "a1", description: "Roof" }],
  };

  const migration = normalizeAndMigrateBackup(legacyBackup);

  assert.equal(migration.migratedFromSchemaVersion, 1);
  assert.deepEqual(migration.migrationsApplied, [2, 3, 4, 5]);
  assert.equal(migration.backup.schemaVersion, BACKUP_SCHEMA_VERSION);

  const data = migration.backup.data as Record<string, unknown>;
  const transactions = data.transactions as Array<Record<string, unknown>>;
  const recurringTemplates = data.recurringTemplates as Array<Record<string, unknown>>;
  const recurringDrafts = data.recurringDrafts as Array<Record<string, unknown>>;
  const loans = data.loans as Array<Record<string, unknown>>;
  const loanPayments = data.loanPayments as Array<Record<string, unknown>>;
  const assets = data.assets as Array<Record<string, unknown>>;
  const tenantLedgerEntries = data.tenantLedgerEntries as Array<Record<string, unknown>>;

  assert.equal(transactions[0].status, "active");
  assert.equal(transactions[0].reconciled, false);
  assert.equal(recurringTemplates[0].active, true);
  assert.equal(recurringTemplates[0].reviewRequired, true);
  assert.equal(recurringDrafts[0].status, "draft");
  assert.equal(loans[0].scheduledMortgageInsurance, 0);
  assert.equal(loans[0].defaultExtraPrincipal, 0);
  assert.equal(loanPayments[0].mortgageInsurance, 0);
  assert.equal(loanPayments[0].extraPrincipal, 0);
  assert.equal(assets[0].bonusEligible, false);
  assert.equal(assets[0].bonusElected, false);
  assert.equal(assets[0].bonusRate, 0);
  assert.deepEqual(tenantLedgerEntries, []);
});

test("normalizeImportedBackup preserves wrapped schema metadata", () => {
  const raw = {
    schemaVersion: 2,
    appVersion: "1.0.3",
    exportedAt: "2026-03-10T00:00:00.000Z",
    settings: { theme: "dark" },
    data: { transactions: [] },
  };

  const normalized = normalizeImportedBackup(raw);
  assert.ok(normalized);
  assert.equal(normalized?.schemaVersion, 2);
  assert.equal(normalized?.appVersion, "1.0.3");
  assert.equal(normalized?.exportedAt, "2026-03-10T00:00:00.000Z");
  assert.deepEqual(normalized?.settings, { theme: "dark" });
});

test("normalizeAndMigrateBackup does not migrate when schema is already current", () => {
  const wrappedBackup = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    data: {
      transactions: [{ id: "t1", status: "voided", reconciled: true }],
    },
  };

  const migration = normalizeAndMigrateBackup(wrappedBackup);
  assert.deepEqual(migration.migrationsApplied, []);
  assert.equal(migration.backup.schemaVersion, BACKUP_SCHEMA_VERSION);

  const txns = (migration.backup.data.transactions as Array<Record<string, unknown>>) || [];
  assert.equal(txns[0].status, "voided");
  assert.equal(txns[0].reconciled, true);
});

test("normalizeAndMigrateBackup rejects future schema versions", () => {
  assert.throws(
    () => normalizeAndMigrateBackup({ schemaVersion: BACKUP_SCHEMA_VERSION + 1, data: {} }),
    /newer than supported version/,
  );
});

test("normalizeAndMigrateBackup rejects invalid backup shapes", () => {
  assert.throws(() => normalizeAndMigrateBackup(null), /Invalid backup file/);
});


test("normalizeAndMigrateBackup migrates tenant ledger posting metadata in schema v4", () => {
  const v3Backup = {
    schemaVersion: 3,
    data: {
      tenantLedgerEntries: [
        {
          id: "tle1",
          leaseId: "lease1",
          date: "2026-03-01",
          kind: "charge",
          amount: 800,
          memo: "Deposit",
          accountingTreatment: "bad-value",
          transactionId: " tx-123 ",
          createdAt: "2026-03-01T00:00:00.000Z",
        },
      ],
      transactions: [
        {
          id: "tx-123",
          type: "Transfer",
          category: "Transfer",
          tenantLedgerEntryId: " tle1 ",
        },
      ],
    },
  };

  const migration = normalizeAndMigrateBackup(v3Backup);
  assert.deepEqual(migration.migrationsApplied, [4, 5]);

  const data = migration.backup.data as Record<string, unknown>;
  const entries = data.tenantLedgerEntries as Array<Record<string, unknown>>;
  const txns = data.transactions as Array<Record<string, unknown>>;

  assert.equal(entries[0].accountingTreatment, "none");
  assert.equal(entries[0].transactionId, "tx-123");
  assert.equal(txns[0].tenantLedgerEntryId, "tle1");
});



test("normalizeAndMigrateBackup migrates activity log metadata in schema v5", () => {
  const v4Backup = {
    schemaVersion: 4,
    data: {
      activityLog: [
        {
          id: " ale-1 ",
          at: "2026-03-11T00:00:00.000Z",
          actor: " local-user ",
          action: " update ",
          entityType: " transaction ",
          entityId: " t1 ",
          propertyId: " p1 ",
          unit: " Unit A ",
          summary: " Updated txn ",
          details: "  note  ",
          immutable: false,
        },
      ],
    },
  };

  const migration = normalizeAndMigrateBackup(v4Backup);
  assert.deepEqual(migration.migrationsApplied, [5]);

  const data = migration.backup.data as Record<string, unknown>;
  const activityLog = data.activityLog as Array<Record<string, unknown>>;

  assert.equal(activityLog.length, 1);
  assert.equal(activityLog[0].id, "ale-1");
  assert.equal(activityLog[0].actor, "local-user");
  assert.equal(activityLog[0].action, "update");
  assert.equal(activityLog[0].entityType, "transaction");
  assert.equal(activityLog[0].entityId, "t1");
  assert.equal(activityLog[0].propertyId, "p1");
  assert.equal(activityLog[0].unit, "Unit A");
  assert.equal(activityLog[0].summary, "Updated txn");
  assert.equal(activityLog[0].details, "note");
  assert.equal(activityLog[0].immutable, true);
});
