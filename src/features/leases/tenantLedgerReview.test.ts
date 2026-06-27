import assert from "node:assert/strict";
import test from "node:test";

import {
  getTenantLedgerReadiness,
  getTenantLedgerReviewIssues,
} from "./tenantLedgerReview.js";

const lease = {
  id: "lease-1",
  propertyId: "p1",
  unit: "101",
  tenantName: "Jordan Lee",
  startDate: "2026-01-01",
  endDate: "2026-06-30",
  actualEndDate: "2026-06-30",
  monthlyRent: 1000,
  securityDeposit: 700,
  rentalType: "Long-term",
  monthToMonthAfterTerm: false,
  status: "Ended",
  notes: "",
};

const baseContext = { todayIso: "2026-07-15", yearFilter: "2026", documents: [], workOrders: [], transactions: [] };

test("lease with security deposit and no liability entry returns missing liability issue", () => {
  const issues = getTenantLedgerReviewIssues(lease, [], baseContext);

  assert.ok(issues.some((issue) => issue.key === "security_deposit_missing_liability_entry"));
});

test("ended lease with deposit liability but no refund/application returns disposition issue", () => {
  const issues = getTenantLedgerReviewIssues(
    lease,
    [{ id: "tle-dep", leaseId: lease.id, date: "2026-01-01", kind: "payment", amount: 700, memo: "Security deposit", accountingTreatment: "security_deposit_liability", transactionId: "t-dep", createdAt: "2026-01-01T00:00:00.000Z" }],
    baseContext,
  );

  assert.ok(issues.some((issue) => issue.key === "security_deposit_liability_without_refund_or_application"));
});

test("applied damages entry without support returns damage support issue", () => {
  const issues = getTenantLedgerReviewIssues(
    { ...lease, securityDeposit: 0 },
    [{ id: "tle-dmg", leaseId: lease.id, date: "2026-06-30", kind: "charge", amount: 250, memo: "Damage", accountingTreatment: "security_deposit_applied_damages", createdAt: "2026-06-30T00:00:00.000Z" }],
    baseContext,
  );

  assert.ok(issues.some((issue) => issue.key === "security_deposit_applied_without_damage_support"));
});

test("ended lease with open balance returns lease_ended_with_open_balance", () => {
  const issues = getTenantLedgerReviewIssues(
    { ...lease, securityDeposit: 0 },
    [{ id: "tle-rent", leaseId: lease.id, date: "2026-06-01", kind: "charge", amount: 1000, memo: "June rent", accountingTreatment: "none", createdAt: "2026-06-01T00:00:00.000Z" }],
    baseContext,
  );

  assert.ok(issues.some((issue) => issue.key === "lease_ended_with_open_balance"));
});

test("ended lease with tenant credit returns lease_ended_with_unapplied_credit", () => {
  const issues = getTenantLedgerReviewIssues(
    { ...lease, securityDeposit: 0 },
    [{ id: "tle-pay", leaseId: lease.id, date: "2026-06-01", kind: "payment", amount: 200, memo: "Overpayment", accountingTreatment: "rent_income", transactionId: "t-pay", createdAt: "2026-06-01T00:00:00.000Z" }],
    baseContext,
  );

  assert.ok(issues.some((issue) => issue.key === "lease_ended_with_unapplied_credit"));
});

test("payment entry without linked income transaction returns payment link issue", () => {
  const issues = getTenantLedgerReviewIssues(
    { ...lease, securityDeposit: 0, status: "Active", actualEndDate: "" },
    [{ id: "tle-pay", leaseId: lease.id, date: "2026-03-01", kind: "payment", amount: 1000, memo: "March rent", accountingTreatment: "rent_income", createdAt: "2026-03-01T00:00:00.000Z" }],
    baseContext,
  );

  assert.ok(issues.some((issue) => issue.key === "tenant_payment_not_linked_to_income_transaction"));
});

test("cleaning fee missing classification returns cleaning fee issue", () => {
  const issues = getTenantLedgerReviewIssues(
    { ...lease, securityDeposit: 0, status: "Active", actualEndDate: "" },
    [{ id: "tle-clean", leaseId: lease.id, date: "2026-03-01", kind: "charge", amount: 150, memo: "Cleaning fee", accountingTreatment: "none", reviewed: true, createdAt: "2026-03-01T00:00:00.000Z" }],
    baseContext,
  );

  assert.ok(issues.some((issue) => issue.key === "cleaning_fee_not_classified"));
});

test("pet fee missing classification returns pet fee issue", () => {
  const issues = getTenantLedgerReviewIssues(
    { ...lease, securityDeposit: 0, status: "Active", actualEndDate: "" },
    [{ id: "tle-pet", leaseId: lease.id, date: "2026-03-01", kind: "charge", amount: 50, memo: "Pet fee", accountingTreatment: "none", reviewed: true, createdAt: "2026-03-01T00:00:00.000Z" }],
    baseContext,
  );

  assert.ok(issues.some((issue) => issue.key === "pet_fee_not_classified"));
});

test("ready lease ledger returns readiness key ready", () => {
  const entries = [
    { id: "tle-dep", leaseId: lease.id, date: "2026-01-01", kind: "payment", amount: 700, memo: "Security deposit", accountingTreatment: "security_deposit_liability", transactionId: "t-dep", reviewed: true, createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "tle-rent", leaseId: lease.id, date: "2026-06-01", kind: "charge", amount: 1000, memo: "June rent", accountingTreatment: "none", reviewed: true, createdAt: "2026-06-01T00:00:00.000Z" },
    { id: "tle-pay", leaseId: lease.id, date: "2026-06-02", kind: "payment", amount: 1000, memo: "June rent paid", accountingTreatment: "rent_income", transactionId: "t-pay", reviewed: true, createdAt: "2026-06-02T00:00:00.000Z" },
    { id: "tle-refund", leaseId: lease.id, date: "2026-06-30", kind: "refund", amount: 700, memo: "Security deposit returned", accountingTreatment: "security_deposit_return", transactionId: "t-refund", reviewed: true, createdAt: "2026-06-30T00:00:00.000Z" },
  ];

  assert.equal(getTenantLedgerReadiness(lease, entries, baseContext).key, "ready");
});
