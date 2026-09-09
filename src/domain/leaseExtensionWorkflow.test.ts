import test from "node:test";
import assert from "node:assert/strict";
import { previewLeaseExtension } from "./leaseExtensionWorkflow.ts";
import { buildTenantLedgerSummary } from "./tenantLedger.ts";
import { scheduledRentForDate } from "./planning/shared.ts";

const lease = {
  id: "lease-616",
  propertyId: "p1",
  unit: "616",
  tenantName: "Extension Test Tenant",
  startDate: "2026-08-12",
  endDate: "2026-09-11",
  actualEndDate: "",
  monthlyRent: 1550,
  rentAmount: 1550,
  rentalType: "Mid-term",
  agreementType: "fixed_term",
  billingCadence: "full_term",
  utilitiesIncluded: false,
  monthToMonthAfterTerm: false,
  extensionTermMonths: 0,
  status: "Active",
  notes: "",
} as const;

test("paid extension preserves prepaid original rent and links charge/payment coverage", () => {
  const result = previewLeaseExtension({
    lease,
    draft: { startDate: "2026-09-11", endDate: "2026-09-18", rentAmount: 350, amountPaid: 350, signedDate: "2026-09-10", paymentReceivedDate: "2026-09-12" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.extension?.paymentStatus, "paid");
  assert.equal(result.extension?.paymentReceivedDate, "2026-09-12");
  assert.equal(result.extension?.endTime, undefined);
  assert.equal(result.charge?.leaseExtensionId, result.extension?.id);
  assert.equal(result.charge?.coverageStartDate, "2026-09-11");
  assert.equal(result.payment?.amount, 350);
  assert.equal(result.payment?.date, "2026-09-12");
  assert.equal(result.paymentTransaction?.rentLeaseId, "lease-616");
  assert.equal(result.paymentTransaction?.rentLeaseExtensionId, result.extension?.id);
  assert.equal(result.combinedRent, 1900);
});

test("expected departure can record noon while actual move-out remains independent", () => {
  const result = previewLeaseExtension({
    lease,
    draft: { startDate: "2026-09-11", endDate: "2026-09-18", endTime: "12:00", rentAmount: 350, amountPaid: 0 },
  });
  assert.equal(result.ok, true);
  assert.equal(result.extension?.endTime, "12:00");

  const blocked = previewLeaseExtension({
    lease: { ...lease, actualEndDate: "2026-09-15" },
    draft: { startDate: "2026-09-11", endDate: "2026-09-18", endTime: "12:00", rentAmount: 350, amountPaid: 0 },
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message || "", /actual move-out/i);
});

test("extension payment can be unpaid or partial without inferring receipt from signed date", () => {
  const unpaid = previewLeaseExtension({ lease, draft: { startDate: "2026-09-11", endDate: "2026-09-18", rentAmount: 350, amountPaid: 0, signedDate: "2026-09-10" } });
  assert.equal(unpaid.ok, true);
  assert.equal(unpaid.extension?.paymentStatus, "unpaid");
  assert.equal(unpaid.payment, undefined);

  const partial = previewLeaseExtension({ lease, draft: { startDate: "2026-09-11", endDate: "2026-09-18", rentAmount: 350, amountPaid: 100, signedDate: "2026-09-10", paymentReceivedDate: "2026-09-13" } });
  assert.equal(partial.ok, true);
  assert.equal(partial.extension?.paymentStatus, "partially_paid");
  assert.equal(partial.payment?.date, "2026-09-13");
});

test("contiguous repeated extensions are allowed but overlapping extensions are rejected", () => {
  const first = previewLeaseExtension({ lease, draft: { startDate: "2026-09-11", endDate: "2026-09-18", rentAmount: 350, amountPaid: 350, paymentReceivedDate: "2026-09-11" } });
  assert.equal(first.ok, true);
  const repeated = previewLeaseExtension({
    lease: { ...lease, endDate: "2026-09-18", extensions: [first.extension!] },
    draft: { startDate: "2026-09-18", endDate: "2026-09-25", rentAmount: 350, amountPaid: 0 },
  });
  assert.equal(repeated.ok, true);
  const overlap = previewLeaseExtension({
    lease: { ...lease, endDate: "2026-09-18", extensions: [first.extension!] },
    draft: { startDate: "2026-09-17", endDate: "2026-09-25", rentAmount: 350, amountPaid: 0 },
  });
  assert.equal(overlap.ok, false);
});

test("voided extension ledger entries do not affect the balance", () => {
  const summary = buildTenantLedgerSummary([
    { id: "charge", leaseId: "lease-616", date: "2026-09-11", kind: "charge", amount: 350, memo: "extension", createdAt: "2026-09-11T00:00:00Z" },
    { id: "payment", leaseId: "lease-616", date: "2026-09-11", kind: "payment", amount: 350, memo: "extension", voidedAt: "2026-09-12", createdAt: "2026-09-11T00:00:00Z" },
  ]);
  assert.equal(summary.totalDue, 350);
});

test("planning uses combined rent over the extended duration", () => {
  const extension = previewLeaseExtension({ lease, draft: { startDate: "2026-09-11", endDate: "2026-09-18", rentAmount: 350, amountPaid: 350, paymentReceivedDate: "2026-09-11" } }).extension!;
  const plannedLease = { ...lease, endDate: extension.endDate, monthlyRent: 1550, extensions: [extension] };
  assert.equal(scheduledRentForDate({ date: "2026-08-15", leases: [plannedLease] }), 1521.88);
  assert.equal(scheduledRentForDate({ date: "2026-09-15", leases: [plannedLease] }), 1521.88);
});

test("matching pre-existing manual charge and payment are adopted instead of duplicated", () => {
  const result = previewLeaseExtension({
    lease,
    draft: { reuseExistingEntries: true, startDate: "2026-09-11", endDate: "2026-09-18", rentAmount: 350, amountPaid: 350, paymentReceivedDate: "2026-09-12" },
    existingLedgerEntries: [
      { id: "manual-charge", leaseId: lease.id, date: "2026-09-11", kind: "charge", amount: 350, memo: "Extension rent", createdAt: "2026-09-11T00:00:00Z" },
      { id: "manual-payment", leaseId: lease.id, date: "2026-09-12", kind: "payment", amount: 350, memo: "Extension paid", createdAt: "2026-09-12T00:00:00Z", transactionId: "manual-payment-txn" },
    ],
    existingTransactions: [{ id: "manual-payment-txn", tenantLedgerEntryId: "manual-payment" } as never],
  });
  assert.equal(result.extension?.chargeEntryId, "manual-charge");
  assert.equal(result.extension?.paymentEntryId, "manual-payment");
  assert.equal(result.paymentTransaction?.id, "manual-payment-txn");
});

test("prepaid receipts are valid; negative amounts and unconfirmed existing entries are rejected", () => {
  const draft = { startDate: "2026-09-11", endDate: "2026-09-18", rentAmount: 350, amountPaid: 350, paymentReceivedDate: "2026-09-08" };
  assert.equal(previewLeaseExtension({ lease, draft }).ok, true);
  assert.equal(previewLeaseExtension({ lease, draft: { ...draft, amountPaid: -1 } }).ok, false);
  const result = previewLeaseExtension({ lease, draft, existingLedgerEntries: [{ id: "existing", leaseId: lease.id, kind: "payment", date: "2026-09-08", amount: 350, memo: "Review this payment", createdAt: "2026-09-08" }] });
  assert.equal(result.ok, false);
  assert.match(result.existingEntryNotice || "", /Review this payment/);
});

test("extension prepayment covers its own charge instead of an older unpaid original charge", () => {
  const result = previewLeaseExtension({ lease, draft: { startDate: "2026-09-11", endDate: "2026-09-18", rentAmount: 350, amountPaid: 350, paymentReceivedDate: "2026-09-08" } });
  const summary = buildTenantLedgerSummary([
    { id: "original", leaseId: lease.id, date: "2026-08-12", kind: "charge", amount: 1550, memo: "Original rent", createdAt: "2026-08-12" },
    result.charge!, result.payment!,
  ]);
  assert.equal(summary.chargeBalanceById.original, 1550);
  assert.equal(summary.chargeBalanceById[result.charge!.id], 0);
  assert.equal(summary.totalDue, 1550);
});
