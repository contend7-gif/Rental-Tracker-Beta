import assert from "node:assert/strict";
import test from "node:test";
import { buildBankReconciliationSummary, createBankReconciliationRecord, inferBankStatementPeriod } from "./bankReconciliation.ts";

const rows = [
  { id: "1", sourceLine: 2, date: "2026-08-02", description: "Rent", amount: 1000, rawAmount: "1000", importedTransactionId: "t1" },
  { id: "2", sourceLine: 3, date: "2026-08-28", description: "Repair", amount: -125, rawAmount: "-125", importedTransactionId: "t2" },
];

test("statement reconciliation ties balances only after every row is resolved", () => {
  assert.deepEqual(inferBankStatementPeriod(rows), { periodStart: "2026-08-02", periodEnd: "2026-08-28" });
  const summary = buildBankReconciliationSummary({ rows, periodStart: "2026-08-01", periodEnd: "2026-08-31", openingBalance: "2,000.00", closingBalance: "2875", skippedRows: 0 });
  assert.equal(summary.activityTotal, 875);
  assert.equal(summary.expectedClosingBalance, 2875);
  assert.equal(summary.difference, 0);
  assert.equal(summary.canClose, true);
  const record = createBankReconciliationRecord({ id: "reconciliation-1", fileName: "august.ofx", accountLabel: "Duplex bank", propertyId: "p1", closedAt: "2026-09-03T12:00:00.000Z", summary });
  assert.match(record.signature, /^recon-[0-9a-f]{8}$/);
});

test("statement reconciliation reports unresolved, skipped, and out-of-balance work", () => {
  const summary = buildBankReconciliationSummary({ rows: [{ ...rows[0], importedTransactionId: "" }, rows[1]], periodStart: "2026-08-01", periodEnd: "2026-08-31", openingBalance: 2000, closingBalance: 2800, skippedRows: 1 });
  assert.equal(summary.canClose, false);
  assert.equal(summary.difference, -75);
  assert.ok(summary.issues.some((issue) => /unresolved/.test(issue)));
  assert.ok(summary.issues.some((issue) => /skipped/.test(issue)));
  assert.ok(summary.issues.some((issue) => /out of balance/.test(issue)));
});
