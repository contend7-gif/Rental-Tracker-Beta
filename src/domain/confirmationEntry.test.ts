import test from "node:test";
import assert from "node:assert/strict";
import { accountRouteKey, cashMovementBankSuggestion, confirmationDuplicateCandidates, confirmationDuplicateKey, confirmationSaveIssue, matchCashMovementRule, parsePaymentConfirmation, rentPaymentSummary, sanitizeCashMovementRules, validConfirmationDate } from "./confirmationEntry.js";
import { sanitizeAppSettings } from "../store/appSettings.ts";
import { normalizeTransaction } from "../store/transactionStore.ts";
import { buildGlobalSearchIndex, searchGlobalRecords } from "../app/globalSearch.ts";
import { matchesLedgerTransactionSearch } from "../app/ledgerSearch.ts";

const source = { text: "Example source", status: "completed", provider: "Venmo", reference: "EXAMPLE1234" };
const transaction = { id: "example-payment", propertyId: "example-property", unit: "B", type: "Income", category: "Rents received", date: "2026-10-30", rentPeriod: "2026-11", amount: 1500, status: "active", sourceConfirmation: source };

test("rent confirmation keeps payment date separate from a future rent month", () => {
  const draft = parsePaymentConfirmation("Venmo: Example Tenant paid you $1,500.00. Payment date: October 30, 2026. November 2026 rent. Transaction ID: EXAMPLE1234");
  assert.equal(draft.amount, "1500.00");
  assert.equal(draft.date, "2026-10-30");
  assert.equal(draft.rentPeriod, "2026-11");
  assert.equal(draft.type, "Income");
  assert.equal(draft.category, "Rents received");
  assert.equal(draft.status, "completed");
  assert.equal(draft.reference, "EXAMPLE1234");
});

test("transfers remain neutral until an account rule or user assigns the type", () => {
  const draft = parsePaymentConfirmation("Fidelity transfer from Fidelity account ending in 1234 to SoFi on October 29, 2026. Amount: $1,000.00. Processed successfully.");
  assert.equal(draft.type, "Transfer");
  assert.equal(draft.fromAccount, "Fidelity account ending in 1234");
  assert.equal(draft.toAccount, "SoFi");
  assert.equal(draft.status, "completed");
  assert.equal(accountRouteKey(draft.fromAccount), accountRouteKey("Fidelity 1234"));
});

test("pending and failed evidence cannot be posted, including optimistic wording", () => {
  const pendingRoute = parsePaymentConfirmation("Fidelity: Transfer from Fidelity 1234 to SoFi 5678 initiated on 2026-10-21. Amount: $342.75. Confirmation ID: DEMO-PENDING-1234");
  assert.equal(pendingRoute.fromAccount, "Fidelity 1234");
  assert.equal(pendingRoute.toAccount, "SoFi 5678");
  for (const text of ["Transfer of $1,000.00 initiated successfully on 2026-10-29", "Your transfer request was submitted successfully. Amount $1,000.00. 2026-10-29", "Your transfer was not completed. Amount $1,000.00. 2026-10-29", "Payment of $1,000.00 is scheduled for 2026-11-02"]) {
    const draft = parsePaymentConfirmation(text);
    assert.notEqual(draft.status, "completed");
    assert.match(confirmationSaveIssue({ ...transaction, sourceConfirmation: { text, status: draft.status } }, []), /completed/);
  }
  assert.match(confirmationSaveIssue({ ...transaction, date: "2026-11-02" }, [], "", "2026-10-31"), /payment date/);
});

test("ambiguous amounts and dates stay blank instead of selecting a balance or due date", () => {
  const unclear = parsePaymentConfirmation("$1,000.00 and $500.00 on 2026-10-29 and 2026-11-02");
  assert.equal(unclear.amount, "");
  assert.equal(unclear.date, "");
  const labelled = parsePaymentConfirmation("Balance $2,000.00. Amount: $500.00. Payment date: 10/29/2026. Due date: 11/02/2026.");
  assert.equal(labelled.amount, "500.00");
  assert.equal(labelled.date, "2026-10-29");
  assert.equal(validConfirmationDate("2026-02-30"), false);
  assert.equal(parsePaymentConfirmation("Amount $500.00. Payment date: 2026-02-30").date, "");
  assert.equal(parsePaymentConfirmation("You received $500.00. Due date: 2026-10-29").date, "");
  for (const amount of ["$1,55", "$500.999", "$1 500.00"]) assert.equal(parsePaymentConfirmation(`Amount: ${amount}`).amount, "");
});

test("year-end rent allocation without a stated year requires a manual month choice", () => {
  assert.equal(parsePaymentConfirmation("Venmo: Example Tenant paid you $500.00. Payment date: December 29, 2026. January rent.").rentPeriod, "");
  assert.match(confirmationSaveIssue({ ...transaction, rentPeriod: "" }, []), /rent month/);
});

test("bank import route suggestions respect cash direction and the source statement account", () => {
  const rule = { id: "example-route", propertyId: "example-property", unit: "Shared", fromAccount: "Fidelity 1234", toAccount: "SoFi 5678", type: "Owner Draw", reverseType: "Owner Contribution" };
  const defaults = { propertyId: rule.propertyId, unit: rule.unit, paidFrom: rule.fromAccount };
  const row = { amount: -500, description: "Transfer from Fidelity 1234 to SoFi 5678" };
  assert.equal(cashMovementBankSuggestion(row, defaults, [rule])?.type, "Owner Draw");
  assert.equal(cashMovementBankSuggestion({ ...row, amount: 500 }, defaults, [rule]), null);
  assert.equal(cashMovementBankSuggestion(row, { ...defaults, paidFrom: "Another bank" }, [rule]), null);
  assert.equal(cashMovementBankSuggestion({ amount: 500, description: "Transfer from SoFi 5678 to Fidelity 1234" }, defaults, [rule])?.type, "Owner Contribution");
});

test("saved routes require exact account identity, scope and explicit reverse permission", () => {
  const rule = { id: "example-route", propertyId: "example-property", unit: "B", fromAccount: "Fidelity 1234", toAccount: "SoFi 5678", type: "Owner Draw" };
  const route = { propertyId: rule.propertyId, unit: rule.unit, fromAccount: "Fidelity account ending in 1234", toAccount: "SoFi 5678" };
  assert.equal(matchCashMovementRule([rule], route)?.type, "Owner Draw");
  assert.equal(matchCashMovementRule([rule], { ...route, fromAccount: "Fidelity 9999" }), null);
  assert.equal(matchCashMovementRule([rule], { ...route, propertyId: "another-property" }), null);
  assert.equal(matchCashMovementRule([rule], { ...route, unit: "A" }), null);
  const backwards = { ...route, fromAccount: rule.toAccount, toAccount: rule.fromAccount };
  assert.equal(matchCashMovementRule([rule], backwards), null);
  assert.equal(matchCashMovementRule([{ ...rule, reverseType: "Owner Contribution" }], backwards)?.type, "Owner Contribution");
  assert.equal(matchCashMovementRule([rule, { ...rule, id: "conflict", type: "Transfer" }], route), null);
  assert.deepEqual(sanitizeCashMovementRules([{ ...rule, toAccount: rule.fromAccount }, { ...rule, type: "Income" }]), []);
  const settings = sanitizeAppSettings(JSON.parse(JSON.stringify({ cashMovementRules: [{ ...rule, reverseType: "Owner Contribution" }] })));
  assert.equal(settings.cashMovementRules[0].reverseType, "Owner Contribution");
});

test("confirmation reference blocks duplicate posting across scopes and legacy notes", () => {
  const draft = { ...transaction, propertyId: "another-property", sourceConfirmation: { ...source } };
  assert.equal(confirmationDuplicateCandidates(draft, [transaction])[0].exact, true);
  assert.match(confirmationSaveIssue(draft, [transaction]), /already recorded/);
  const legacy = { ...transaction, sourceConfirmation: undefined, description: "Example Venmo payment, transaction EXAMPLE1234" };
  assert.equal(confirmationDuplicateCandidates(draft, [legacy])[0].exact, true);
  assert.equal(confirmationDuplicateCandidates(draft, [{ ...transaction, status: "voided" }]).length, 0);
  assert.equal(confirmationDuplicateCandidates(draft, [transaction], transaction.id).length, 0);
});

test("similar payments need explicit acknowledgement which expires when facts change", () => {
  const draft = { ...transaction, sourceConfirmation: { ...source, reference: "ANOTHER1234" } };
  const candidates = confirmationDuplicateCandidates(draft, [transaction]);
  assert.equal(candidates[0].exact, false);
  assert.match(confirmationSaveIssue(draft, [transaction]), /separate payment/);
  const reviewed = { ...draft, confirmationDuplicateAcknowledged: confirmationDuplicateKey(draft, candidates) };
  assert.equal(confirmationSaveIssue(reviewed, [transaction]), "");
  assert.match(confirmationSaveIssue({ ...reviewed, date: "2026-10-31" }, [transaction]), /separate payment/);
});

test("rent preview handles partial payments, editing, credits and ambiguous tenant allocation", () => {
  const args = { transactions: [{ ...transaction, rentLeaseId: "example-lease", amount: 400 }], propertyId: transaction.propertyId, unit: "B", leaseId: "example-lease", rentPeriod: "2026-11", amount: 1000, expected: 1500 };
  assert.deepEqual(rentPaymentSummary(args), { recorded: 400, remaining: 100, credit: 0, ambiguous: false });
  assert.equal(rentPaymentSummary({ ...args, editingId: transaction.id }).recorded, 0);
  assert.equal(rentPaymentSummary({ ...args, amount: 1200 }).credit, 100);
  assert.equal(rentPaymentSummary({ ...args, transactions: [transaction] }).remaining, null);
  assert.equal(rentPaymentSummary({ ...args, transactions: [transaction], allowUnlinked: true }).recorded, 1500);
  assert.equal(rentPaymentSummary({ ...args, rentPeriod: "2026-10" }).recorded, 0);
  assert.equal(rentPaymentSummary({ ...args, todayIso: "2026-10-01" }).recorded, 0);
});

test("source metadata normalizes through storage and reference search excludes the raw email body", () => {
  const stored = normalizeTransaction({ ...transaction, fromAccount: " Example bank 1234 ", sourceConfirmation: { ...source, text: "private-raw-source-sentinel", status: "unexpected" } } as any);
  assert.equal(stored.fromAccount, "Example bank 1234");
  assert.equal(stored.sourceConfirmation.status, "unknown");
  assert.equal(stored.reconciled, false);
  assert.equal(matchesLedgerTransactionSearch(stored, "EXAMPLE1234"), true);
  assert.equal(matchesLedgerTransactionSearch(stored, "Example bank 1234"), true);
  const index = buildGlobalSearchIndex({ transaction: [stored] });
  assert.equal(searchGlobalRecords(index, "EXAMPLE1234").length, 1);
  assert.equal(searchGlobalRecords(index, "private-raw-source-sentinel").length, 0);
});
