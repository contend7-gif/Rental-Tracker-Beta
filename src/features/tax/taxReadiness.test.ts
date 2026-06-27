import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTaxReadinessSummary } from "./taxReadiness.js";

test("all sections empty or ready returns overall ready", () => {
  const summary = buildTaxReadinessSummary();
  assert.equal(summary.status, "ready");
  assert.equal(summary.reviewCount, 0);
});

test("transaction review items make Transactions needs_review", () => {
  const summary = buildTaxReadinessSummary({ transactionReviewInbox: [{ id: "txn-1" }] });
  assert.equal(summary.sections.find((section) => section.key === "transactions")?.status, "needs_review");
});

test("asset review items make Assets needs_review", () => {
  const summary = buildTaxReadinessSummary({ assetReviewInbox: { transactionCandidates: [{ id: "candidate-1" }], assetRecords: [] } });
  assert.equal(summary.sections.find((section) => section.key === "assets")?.status, "needs_review");
});

test("maintenance review items make Maintenance needs_review", () => {
  const summary = buildTaxReadinessSummary({ maintenanceReviewInbox: { records: [{ id: "work-1" }] } });
  assert.equal(summary.sections.find((section) => section.key === "maintenance")?.status, "needs_review");
});

test("occupancy review items make Occupancy needs_review", () => {
  const summary = buildTaxReadinessSummary({ occupancyReviewInbox: { records: [{ id: "unit-1" }] } });
  assert.equal(summary.sections.find((section) => section.key === "occupancy")?.status, "needs_review");
});

test("tenant ledger review items make Tenant Ledger needs_review", () => {
  const summary = buildTaxReadinessSummary({ tenantLedgerReviewInbox: { records: [{ id: "lease-1" }] } });
  assert.equal(summary.sections.find((section) => section.key === "tenantLedger")?.status, "needs_review");
});

test("loan review items make Loans needs_review", () => {
  const summary = buildTaxReadinessSummary({ loanReviewInbox: { records: [{ id: "loan-1" }] } });
  assert.equal(summary.sections.find((section) => section.key === "loans")?.status, "needs_review");
});

test("document pending queues make Documents needs_review", () => {
  const summary = buildTaxReadinessSummary({ documents: [{ id: "doc-1", ocrStatus: "pending", name: "Example receipt" }] });
  assert.equal(summary.sections.find((section) => section.key === "documents")?.status, "needs_review");
});

test("section targetView values are stable", () => {
  const summary = buildTaxReadinessSummary();
  assert.deepEqual(
    Object.fromEntries(summary.sections.map((section) => [section.key, section.targetView])),
    {
      transactions: "ledger",
      documents: "documents",
      assets: "assets",
      maintenance: "maintenance",
      occupancy: "leaseHistory",
      tenantLedger: "leaseHistory",
      loans: "loans",
    },
  );
});
