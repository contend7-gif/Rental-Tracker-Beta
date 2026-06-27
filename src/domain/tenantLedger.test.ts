import test from "node:test";
import assert from "node:assert/strict";
import { buildTenantLedgerSummary, tenantLedgerBalanceSignedAmount, tenantLedgerSignedAmount } from "./tenantLedger.ts";

test("tenantLedgerSignedAmount handles entry directions", () => {
  assert.equal(tenantLedgerSignedAmount({ kind: "charge", amount: 100 }), 100);
  assert.equal(tenantLedgerSignedAmount({ kind: "payment", amount: 100 }), -100);
  assert.equal(tenantLedgerSignedAmount({ kind: "credit", amount: 55 }), -55);
  assert.equal(tenantLedgerSignedAmount({ kind: "refund", amount: 55 }), 55);
  assert.equal(tenantLedgerSignedAmount({ kind: "adjustment", amount: -10 }), -10);
});

test("tenantLedgerBalanceSignedAmount excludes security deposit activity from rent balance math", () => {
  assert.equal(tenantLedgerBalanceSignedAmount({ kind: "payment", amount: 700, accountingTreatment: "security_deposit_liability" }), 0);
  assert.equal(tenantLedgerBalanceSignedAmount({ kind: "refund", amount: 700, accountingTreatment: "security_deposit_return" }), 0);
  assert.equal(tenantLedgerBalanceSignedAmount({ kind: "charge", amount: 400, accountingTreatment: "security_deposit_applied_damages" }), 0);
  assert.equal(tenantLedgerBalanceSignedAmount({ kind: "payment", amount: 1200, accountingTreatment: "rent_income" }), -1200);
});

test("buildTenantLedgerSummary allocates partial payments to oldest charges", () => {
  const summary = buildTenantLedgerSummary([
    { id: "c1", leaseId: "lease1", date: "2026-01-01", kind: "charge", amount: 1200, memo: "Jan rent", createdAt: "2026-01-01T08:00:00.000Z" },
    { id: "c2", leaseId: "lease1", date: "2026-02-01", kind: "charge", amount: 1200, memo: "Feb rent", createdAt: "2026-02-01T08:00:00.000Z" },
    { id: "p1", leaseId: "lease1", date: "2026-02-05", kind: "payment", amount: 1500, memo: "ACH", createdAt: "2026-02-05T08:00:00.000Z" },
  ]);

  assert.equal(summary.rows.length, 3);
  assert.equal(summary.totalDue, 900);
  assert.equal(summary.tenantCredit, 0);
  assert.equal(summary.chargeBalanceById.c1, 0);
  assert.equal(summary.chargeBalanceById.c2, 900);

  const payment = summary.rows[2];
  assert.equal(payment.unappliedAmount, 0);
  assert.deepEqual(payment.allocations, [
    { chargeEntryId: "c1", amount: 1200 },
    { chargeEntryId: "c2", amount: 300 },
  ]);
});

test("buildTenantLedgerSummary carries prepayments forward to future charges", () => {
  const summary = buildTenantLedgerSummary([
    { id: "p1", leaseId: "lease1", date: "2026-01-28", kind: "payment", amount: 1200, memo: "Early Feb rent", createdAt: "2026-01-28T08:00:00.000Z" },
    { id: "c1", leaseId: "lease1", date: "2026-02-01", kind: "charge", amount: 1200, memo: "Feb rent", createdAt: "2026-02-01T08:00:00.000Z" },
  ]);

  assert.equal(summary.totalDue, 0);
  assert.equal(summary.tenantCredit, 0);
  assert.equal(summary.chargeBalanceById.c1, 0);
  assert.equal(summary.rows[0].unappliedAmount, 1200);
  assert.equal(summary.rows[1].openBalance, 0);
  assert.equal(summary.rows[1].runningBalance, 0);
});

test("buildTenantLedgerSummary tracks tenant credits when payment exceeds charges", () => {
  const summary = buildTenantLedgerSummary([
    { id: "c1", leaseId: "lease1", date: "2026-01-01", kind: "charge", amount: 1200, memo: "Jan rent", createdAt: "2026-01-01T08:00:00.000Z" },
    { id: "p1", leaseId: "lease1", date: "2026-01-02", kind: "payment", amount: 1300, memo: "ACH", createdAt: "2026-01-02T08:00:00.000Z" },
    { id: "r1", leaseId: "lease1", date: "2026-01-03", kind: "refund", amount: 50, memo: "Refund credit", createdAt: "2026-01-03T08:00:00.000Z" },
  ]);

  assert.equal(summary.totalDue, 0);
  assert.equal(summary.tenantCredit, 50);

  const payment = summary.rows[1];
  assert.equal(payment.unappliedAmount, 100);
  assert.deepEqual(payment.allocations, [{ chargeEntryId: "c1", amount: 1200 }]);

  const refund = summary.rows[2];
  assert.equal(refund.runningBalance, -50);
  assert.equal(refund.openBalance, 0);
  assert.equal(summary.chargeBalanceById.r1, 0);
});

test("buildTenantLedgerSummary keeps security deposits visible without treating them as rent credit", () => {
  const summary = buildTenantLedgerSummary([
    { id: "sd1", leaseId: "lease1", date: "2025-12-30", kind: "payment", amount: 700, memo: "Security deposit received", accountingTreatment: "security_deposit_liability", createdAt: "2025-12-30T08:00:00.000Z" },
    { id: "p1", leaseId: "lease1", date: "2026-01-28", kind: "payment", amount: 1200, memo: "Early Feb rent", accountingTreatment: "rent_income", createdAt: "2026-01-28T08:00:00.000Z" },
    { id: "c1", leaseId: "lease1", date: "2026-02-01", kind: "charge", amount: 1200, memo: "Feb rent", accountingTreatment: "rent_income", createdAt: "2026-02-01T08:00:00.000Z" },
  ]);

  assert.equal(summary.totalDue, 0);
  assert.equal(summary.tenantCredit, 0);
  assert.equal(summary.chargeBalanceById.c1, 0);
  assert.equal(summary.rows[0].delta, -700);
  assert.equal(summary.rows[0].balanceDelta, 0);
  assert.equal(summary.rows[0].runningBalance, 0);
  assert.equal(summary.rows[0].unappliedAmount, 0);
});
