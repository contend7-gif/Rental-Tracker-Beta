import test from "node:test";
import assert from "node:assert/strict";
import { buildOperationsNotificationDigest } from "./operationsNotifications.ts";

test("operations digest summarizes due items and excludes separate rent reminders", () => {
  const digest = buildOperationsNotificationDigest([
    { id: "rent-1", source: "rent", date: "2026-08-31" },
    { id: "maintenance-1", source: "maintenance", date: "2026-08-30" },
    { id: "loan-1", source: "loan", date: "2026-08-31" },
  ] as never[], "2026-08-31");
  assert.ok(digest);
  assert.equal(digest.itemCount, 2);
  assert.match(digest.body, /1 overdue · 1 due today/);
  assert.match(digest.body, /maintenance/);
  assert.doesNotMatch(digest.signature, /rent-1/);
});

test("operations digest stays quiet when nothing is due", () => {
  assert.equal(buildOperationsNotificationDigest([
    { id: "future", source: "lease", date: "2026-09-01" },
  ] as never[], "2026-08-31"), null);
});

