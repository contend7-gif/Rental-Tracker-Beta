import assert from "node:assert/strict";
import { test } from "node:test";

import { BACKUP_SCHEMA_VERSION, validateBackupEnvelope } from "../electron/db.mjs";

function validBackup() {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: "2026-01-01T00:00:00.000Z",
    data: {
      properties: [],
      units: [],
      transactions: [],
      leases: [],
      tenantLedgerEntries: [],
      documents: [],
      assets: [],
      loans: [],
      workOrders: [],
    },
  };
}

test("valid backup envelope passes validation", () => {
  const result = validateBackupEnvelope({ backup: validBackup() });

  assert.equal(result.status, "valid");
  assert.deepEqual(result.errors, []);
});

test("missing backup collection is invalid", () => {
  const backup = validBackup();
  delete backup.data.transactions;

  const result = validateBackupEnvelope({ backup });

  assert.equal(result.status, "invalid");
  assert.equal(result.errors.some((error) => error.includes("transactions")), true);
});

test("missing document file in archive is a warning", () => {
  const backup = validBackup();
  backup.data.documents = [{ id: "d1", name: "Example receipt", relativePath: "2026/example.pdf" }];

  const result = validateBackupEnvelope({ backup, archiveFilePaths: new Set(["backup.json"]) });

  assert.equal(result.status, "valid_with_warnings");
  assert.equal(result.warnings.some((warning) => warning.includes("d1")), true);
});

test("unknown future schema is a warning", () => {
  const backup = validBackup();
  backup.schemaVersion = BACKUP_SCHEMA_VERSION + 1;

  const result = validateBackupEnvelope({ backup });

  assert.equal(result.status, "valid_with_warnings");
});

test("backup containing API key shaped field is invalid", () => {
  const backup = validBackup();
  backup.settings = { aiOpenAiApiKey: "not-a-real-key" };

  const result = validateBackupEnvelope({ backup });

  assert.equal(result.status, "invalid");
  assert.equal(result.errors.some((error) => error.includes("secret")), true);
});
