import assert from "node:assert/strict";
import { test } from "node:test";
import { buildYearEndChecklist } from "./yearEndChecklist.js";

const loan = { id: "primary", lender: "Servicer", loanType: "Primary Mortgage" };
const annualIssues = [{ key: "missing_1098_review", label: "1098 review needed" }, { key: "year_end_review_open", label: "Year-end review open" }];
const annualRecord = { loan, review: { form1098Received: false }, issues: annualIssues };
const context = { yearFilter: "2026", todayIso: "2026-11-12" };

test("defers only annual checks while keeping missing payments and escrow actionable", () => {
  const checklist = buildYearEndChecklist({ ...context, loanReviewInbox: { records: [{ ...annualRecord, issues: [...annualIssues, { key: "missing_monthly_payments", label: "Missing payment months" }, { key: "escrow_not_reviewed", label: "Escrow review open" }] }] } });
  assert.equal(checklist.awaitingDocuments.length, 1);
  assert.match(checklist.awaitingDocuments[0].helper, /Form 1098/);
  assert.equal(checklist.resolveNow[0].count, 2);
  assert.match(checklist.resolveNow[0].helper, /Missing payment months; Escrow review open/);
});

test("completed-year and received-document reviews need action now", () => {
  for (const overrides of [{ todayIso: "2027-01-01" }, { loanReviewInbox: { records: [{ ...annualRecord, review: { form1098Received: true } }] } }]) {
    const result = buildYearEndChecklist({ ...context, loanReviewInbox: { records: [annualRecord] }, ...overrides });
    assert.equal(result.awaitingDocuments.length, 0);
    assert.equal(result.resolveNow[0].count, 2);
  }
});

test("payment matching is independent of receipt support and tax sign-off", () => {
  const source = { id: "expense", type: "Expense", category: "Supplies", reconciled: false, taxChecked: true, receiptName: "paid-receipt.pdf" };
  const result = buildYearEndChecklist({ ...context, taxReportingSummary: { details: { supplies: [{ sourceType: "transaction", source, documentCount: 1 }] } } });
  assert.equal(result.paymentCount, 1);
  assert.equal(result.receiptCount, 0);
  assert.equal(source.taxChecked, true);
  const matched = buildYearEndChecklist({ ...context, taxReportingSummary: { details: { supplies: [{ sourceType: "transaction", source: { ...source, reconciled: true, receiptName: "" }, documentCount: 0 }] } } });
  assert.equal(matched.paymentCount, 0);
  assert.equal(matched.receiptCount, 1);
});

test("deduplicates expense rows and excludes mileage, income, and loans from cash checks", () => {
  const expense = { sourceType: "transaction", source: { id: "expense", type: "Expense", category: "Supplies", reconciled: false }, documentCount: 0 };
  const mileage = { sourceType: "transaction", source: { id: "mileage", type: "Expense", category: "Auto and travel", mileageMiles: 10 } };
  const result = buildYearEndChecklist({ taxReportingSummary: { details: { supplies: [expense, expense], travel: [mileage], income: [{ sourceType: "transaction", source: { id: "rent", type: "Income" } }], interest: [{ sourceType: "loan", source: loan }] } } });
  assert.equal(result.paymentCount, 1);
  assert.equal(result.receiptCount, 1);
});

test("explicitly unavailable receipts remain separate from payment checks", () => {
  const source = { id: "expense", type: "Expense", category: "Supplies", reviewOverrides: { missing_receipt: "not_available" } };
  const result = buildYearEndChecklist({ taxReportingSummary: { details: { supplies: [{ sourceType: "transaction", source }] } } });
  assert.equal(result.receiptCount, 0);
  assert.equal(result.paymentCount, 1);
});

test("year-end-only non-mortgage review does not promise a Form 1098", () => {
  const result = buildYearEndChecklist({ ...context, loanReviewInbox: { records: [{ ...annualRecord, loan: { ...loan, loanType: "Down Payment Loan" }, issues: [annualIssues[1]] }] } });
  assert.match(result.awaitingDocuments[0].helper, /final loan statement/);
  assert.doesNotMatch(result.awaitingDocuments[0].helper, /1098/);
});

test("empty scopes show no fabricated work or automatic sign-off", () => {
  assert.deepEqual(buildYearEndChecklist(), { resolveNow: [], awaitingDocuments: [], beforeYearEnd: false, paymentCount: 0, receiptCount: 0 });
});
