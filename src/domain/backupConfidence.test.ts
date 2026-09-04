import assert from "node:assert/strict";
import test from "node:test";
import { buildBackupConfidence } from "./backupConfidence.ts";

test("backup confidence requires a verified recoverable restore point", () => {
  assert.equal(buildBackupConfidence({ now: "2026-09-03T12:00:00Z" }).status, "missing");
  assert.equal(buildBackupConfidence({ now: "2026-09-03T12:00:00Z", lastBackupAt: "2026-09-02T12:00:00Z" }).status, "needs_verification");
  assert.equal(buildBackupConfidence({ now: "2026-09-03T12:00:00Z", lastBackupAt: "2026-09-02T12:00:00Z", lastRecoverableBackupAt: "2026-09-02T12:00:00Z", intervalDays: 3, latestEncrypted: true, encryptionAvailable: true }).status, "ready");
});

test("backup confidence identifies overdue and legacy unencrypted restore points", () => {
  assert.equal(buildBackupConfidence({ now: "2026-09-07T12:00:00Z", lastBackupAt: "2026-09-02T12:00:00Z", lastRecoverableBackupAt: "2026-09-02T12:00:00Z", intervalDays: 3 }).status, "overdue");
  assert.equal(buildBackupConfidence({ now: "2026-09-03T12:00:00Z", lastBackupAt: "2026-09-02T12:00:00Z", lastRecoverableBackupAt: "2026-09-02T12:00:00Z", intervalDays: 3, encryptionAvailable: true, latestEncrypted: false }).status, "needs_encryption");
});
