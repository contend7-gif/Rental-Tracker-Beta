import test from "node:test";
import assert from "node:assert/strict";
import type { DocumentItem, Lease, TenantLedgerEntry, Transaction } from "../models.ts";
import { buildMonthlyCloseReview } from "../domain/monthlyClose.ts";
import { deriveRentCollectionSummary } from "../features/dashboard/dashboardDerived.js";
import { getTaxDoubleCountingWarnings } from "../features/tax/taxSummary.js";
import { createLeaseExtensionActions } from "./leaseExtensionStore.ts";

const baseLease = {
  id: "lease-616",
  propertyId: "p1",
  unit: "616",
  tenantName: "Extension Test Tenant",
  startDate: "2026-08-12",
  endDate: "2026-09-11",
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
} as Lease;

test("extension bundle adopts existing manual records once and cancellation preserves voided history", () => {
  let leases: Lease[] = [baseLease];
  let entries: TenantLedgerEntry[] = [
    { id: "manual-charge", leaseId: baseLease.id, date: "2026-09-11", kind: "charge", amount: 350, memo: "Extension rent", createdAt: "2026-09-11T00:00:00Z" },
    { id: "manual-payment", leaseId: baseLease.id, date: "2026-09-12", kind: "payment", amount: 350, memo: "Extension paid", transactionId: "manual-payment-txn", createdAt: "2026-09-12T00:00:00Z" },
  ];
  let transactions: Transaction[] = [{ id: "manual-payment-txn", tenantLedgerEntryId: "manual-payment", propertyId: "p1", unit: "616", date: "2026-09-12", type: "Income", category: "Rents received", description: "Extension paid", amount: 350, ownerUsePct: 0, rentalUsePct: 1, deductibleAmount: 0, paidFrom: "Tenant", paymentMethod: "ACH", reimbursable: false, reimbursed: false, capitalImprovement: false, vendor: "Extension Test Tenant", receiptName: "", notes: "", taxChecked: true, status: "active" }];
  let documents: DocumentItem[] = [];
  const activity: string[] = [];
  const actions = createLeaseExtensionActions({
    getLeases: () => leases,
    getLedgerEntries: () => entries,
    getTransactions: () => transactions,
    getDocuments: () => documents,
    setLeases: (updater) => { leases = typeof updater === "function" ? updater(leases) : updater; },
    setLedgerEntries: (updater) => { entries = typeof updater === "function" ? updater(entries) : updater; },
    setTransactions: (updater) => { transactions = typeof updater === "function" ? updater(transactions) : updater; },
    setDocuments: (updater) => { documents = typeof updater === "function" ? updater(documents) : updater; },
    appendActivityLog: (entry) => activity.push(entry.summary),
  });

  const result = actions.applyLeaseExtension(baseLease.id, { reuseExistingEntries: true, startDate: "2026-09-11", endDate: "2026-09-18", rentAmount: 350, amountPaid: 350, paymentReceivedDate: "2026-09-12" }, { id: "extension-pdf", propertyId: "p1", unit: "616", leaseId: baseLease.id, name: "signed-extension.pdf", type: "Lease extension", mimeType: "application/pdf", dataUrl: "data:application/pdf;base64,AA==" });
  assert.equal(result.ok, true);
  const extension = leases[0].extensions?.[0];
  assert.ok(extension);
  assert.equal(leases[0].originalTerm?.endDate, "2026-09-11");
  assert.equal(leases[0].endDate, "2026-09-18");
  assert.equal(extension.chargeEntryId, "manual-charge");
  assert.equal(extension.paymentEntryId, "manual-payment");
  assert.deepEqual(extension.documentIds, ["extension-pdf"]);
  assert.equal(entries.filter((entry) => !entry.voidedAt).length, 2);
  assert.equal(transactions.length, 1);

  const canceled = actions.cancelLeaseExtension(baseLease.id, extension.id);
  assert.equal(canceled.ok, true);
  assert.equal(leases[0].extensions?.[0].canceledAt != null, true);
  assert.equal(entries.find((entry) => entry.kind === "charge")?.voidedAt != null, true);
  assert.equal(entries.find((entry) => entry.kind === "payment")?.voidedAt, undefined);
  assert.equal(transactions[0].status, "active");
  assert.ok(activity.some((message) => message.includes("canceled")));
});

function fixture() {
  const state = { leases: [structuredClone(baseLease)], entries: [] as TenantLedgerEntry[], transactions: [] as Transaction[], documents: [] as DocumentItem[] };
  const actions = createLeaseExtensionActions({
    getLeases: () => state.leases, getLedgerEntries: () => state.entries,
    getTransactions: () => state.transactions, getDocuments: () => state.documents,
    setLeases: (value) => { state.leases = typeof value === "function" ? value(state.leases) : value; },
    setLedgerEntries: (value) => { state.entries = typeof value === "function" ? value(state.entries) : value; },
    setTransactions: (value) => { state.transactions = typeof value === "function" ? value(state.transactions) : value; },
    setDocuments: (value) => { state.documents = typeof value === "function" ? value(state.documents) : value; },
    appendActivityLog: () => {},
  });
  return { state, actions };
}
const draft = { id: "extension-1", startDate: "2026-09-11", endDate: "2026-09-18", rentAmount: 350, amountPaid: 100, paymentReceivedDate: "2026-09-09" };

test("retry, correction to unpaid and replacement payment never duplicate records or lose revision history", () => {
  const { state, actions } = fixture();
  assert.equal(actions.applyLeaseExtension(baseLease.id, draft).ok, true);
  assert.equal(actions.applyLeaseExtension(baseLease.id, draft).ok, true);
  assert.equal(state.leases[0].extensions?.length, 1);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.entries.length, 2);
  assert.equal(actions.applyLeaseExtension(baseLease.id, { ...draft, amountPaid: 0 }).ok, true);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0].status, "voided");
  assert.equal(state.entries.length, 2);
  assert.equal(state.leases[0].extensionRevisions?.at(-1)?.extension.amountPaid, 100);
  assert.equal(actions.applyLeaseExtension(baseLease.id, { ...draft, amountPaid: 350 }).ok, true);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.entries.length, 2);
  assert.equal(state.transactions[0].status, "active");
  assert.equal(state.leases[0].monthlyRent, 1521.88);
});

test("correction to an earlier extension keeps the latest departure and cancellation preserves cash", () => {
  const { state, actions } = fixture();
  actions.applyLeaseExtension(baseLease.id, draft);
  const second = { ...draft, id: "extension-2", startDate: "2026-09-18", endDate: "2026-09-25", amountPaid: 0 };
  assert.equal(actions.applyLeaseExtension(baseLease.id, second).ok, true);
  assert.equal(actions.applyLeaseExtension(baseLease.id, { ...draft, notes: "Corrected wording" }).ok, true);
  assert.equal(state.leases[0].endDate, "2026-09-25");
  assert.equal(actions.cancelLeaseExtension(baseLease.id, draft.id).ok, false);
  assert.equal(actions.cancelLeaseExtension(baseLease.id, second.id).ok, true);
  assert.equal(actions.cancelLeaseExtension(baseLease.id, draft.id).ok, true);
  assert.equal(state.leases[0].endDate, baseLease.endDate);
  assert.equal(state.transactions[0].status, "active");
});

test("registering a manually extended lease requires original dates and preserves unrelated transactions", () => {
  const { state, actions } = fixture();
  state.leases[0].endDate = "2026-09-18";
  state.transactions.push({ id: "unrelated", amount: 900, date: "2026-09-09", status: "active" } as Transaction);
  const before = structuredClone(state.transactions[0]);
  assert.equal(actions.applyLeaseExtension(baseLease.id, { ...draft, originalEndDate: "2026-09-11" }).ok, true);
  assert.equal(state.leases[0].originalTerm?.endDate, "2026-09-11");
  assert.deepEqual(state.transactions.find((item) => item.id === "unrelated"), before);
  assert.equal(state.transactions.length, 2);
});

test("overlapping tenants and recurring billing leases are blocked without changing any state", () => {
  const { state, actions } = fixture();
  state.leases.push({ ...baseLease, id: "next-tenant", startDate: "2026-09-17", endDate: "2026-10-17" });
  const before = structuredClone(state);
  assert.equal(actions.applyLeaseExtension(baseLease.id, draft).ok, false);
  assert.deepEqual(state, before);
  state.leases = [{ ...baseLease, billingCadence: "monthly" }];
  assert.equal(actions.applyLeaseExtension(baseLease.id, draft).ok, false);
});

test("additional receipts keep their original dates and sum to the extension coverage", () => {
  const { state, actions } = fixture();
  actions.applyLeaseExtension(baseLease.id, draft);
  assert.equal(actions.applyLeaseExtension(baseLease.id, { ...draft, amountPaid: 350, paymentReceivedDate: "2026-09-10" }).ok, true);
  assert.deepEqual(state.transactions.map((item) => [item.date, item.amount]).sort(), [["2026-09-09", 100], ["2026-09-10", 250]]);
  assert.equal(state.leases[0].extensions?.[0].amountPaid, 350);
  assert.equal(actions.applyLeaseExtension(baseLease.id, { ...draft, amountPaid: 350, paymentReceivedDate: "2026-09-10" }).ok, true);
  assert.equal(state.transactions.length, 2);
});

test("extension summaries include rent exactly once and cancellation excludes voided charges", () => {
  const { state, actions } = fixture();
  actions.applyLeaseExtension(baseLease.id, draft);
  const dashboard = () => deriveRentCollectionSummary({ leases: state.leases, tenantLedgerEntries: state.entries, transactions: state.transactions, yearFilter: "2026", asOfDate: "2026-09-20" });
  assert.equal(dashboard().expectedYtd, 1900);
  let close = buildMonthlyCloseReview({ month: "2026-09", todayIso: "2026-09-20", leases: state.leases, tenantLedgerEntries: state.entries, transactions: state.transactions });
  assert.equal(close?.summary.rentCharged, 350);
  actions.cancelLeaseExtension(baseLease.id, draft.id);
  close = buildMonthlyCloseReview({ month: "2026-09", todayIso: "2026-09-20", leases: state.leases, tenantLedgerEntries: state.entries, transactions: state.transactions });
  assert.equal(close?.summary.rentCharged, 0);
  assert.equal(close?.summary.rentPaid, 100);
  assert.equal(dashboard().expectedYtd, 1550);
  const warnings = getTaxDoubleCountingWarnings({ yearFilter: "2026", tenantLedgerEntries: state.entries, transactions: state.transactions });
  assert.equal(warnings.some((item) => item.key === "tenant_ledger_unposted_income"), false);
});
