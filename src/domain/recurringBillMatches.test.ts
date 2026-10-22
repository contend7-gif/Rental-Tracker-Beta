import test from "node:test";
import assert from "node:assert/strict";
import type { RecurringTemplate, Transaction } from "../models.ts";
import { recurringBillCycles, recurringCycleDate } from "./recurringBillMatches.ts";
import { createRecurringActions } from "../store/recurringStore.ts";
import { buildOperationsCalendarItems, applyOperationsFollowUps, bucketOperationsCalendarItems } from "./operationsCalendar.ts";

const rule: RecurringTemplate = { id: "r1", propertyId: "p1", unit: "Shared", description: "Example subscription", type: "Expense", category: "Other expenses", amount: 20, frequency: "Monthly", nextDueDate: "2026-10-05", active: true, reviewRequired: true, ownerUsePct: 0 };
const bill = (extra: Partial<Transaction> = {}) => ({ id: "t1", date: "2026-10-05", propertyId: "p1", unit: "Shared", description: "Example subscription", vendor: "Example", type: "Expense", category: "Other expenses", amount: 20, status: "active", capitalImprovement: false, ...extra } as Transaction);

test("explicit linked entries cover cycles, show next expected date, and never imply bank verification", () => {
  const records = [bill({ recurringTemplateId: "r1", date: "2026-10-07", amount: 23 })];
  const original = structuredClone(records);
  const cycles = recurringBillCycles(rule, records, "2026-10-21");
  assert.deepEqual(cycles.map(c => [c.date, c.status]), [["2026-10-05", "recorded"], ["2026-11-05", "expected"]]);
  assert.match(cycles[0].reason, /does not assert bank reconciliation/);
  const items = buildOperationsCalendarItems({ recurringTemplates: [rule], transactions: records, todayIso: "2026-10-21" });
  assert.equal(applyOperationsFollowUps(items).length, 1);
  const shown = applyOperationsFollowUps(items, {}, { showHandled: true });
  assert.equal(shown.length, 2);
  assert.equal(bucketOperationsCalendarItems(shown, "2026-10-21").attention.length, 0);
  assert.deepEqual(records, original);
});

test("unlinked and ambiguous matches require explicit selection; wrong scopes and future or voided rows are excluded", () => {
  const candidate = recurringBillCycles(rule, [bill()], "2026-10-21")[0];
  assert.equal(candidate.status, "needs_review"); assert.equal(candidate.records.length, 1);
  assert.equal(recurringBillCycles(rule, [bill(), bill({ id: "t2" })], "2026-10-21")[0].records.length, 2);
  for (const extra of [{ status: "voided" }, { propertyId: "p2" }, { unit: "616" }, { type: "Income" }, { category: "Utilities" }, { date: "2026-11-05" }, { recurringTemplateId: "other" }, { capitalImprovement: true }, { amount: Number.NaN }]) {
    assert.equal(recurringBillCycles(rule, [bill(extra as Partial<Transaction>)], "2026-10-21")[0].records.length, 0);
  }
  assert.equal(recurringBillCycles(rule, [bill({ recurringTemplateId: "r1" }), bill({ id: "t2", recurringTemplateId: "r1" })], "2026-10-21")[0].status, "needs_review");
  assert.equal(recurringBillCycles(rule, [bill({ date: "2026-11-05", recurringTemplateId: "r1" })], "2026-11-21")[0].date, "2026-10-05");
});

test("monthly, quarterly, yearly and weekly cycles preserve calendar boundaries", () => {
  assert.equal(recurringCycleDate("2026-01-31", "Monthly", 1), "2026-02-28");
  assert.equal(recurringCycleDate("2026-01-31", "Monthly", 2), "2026-03-31");
  assert.equal(recurringCycleDate("2024-02-29", "Yearly", 1), "2025-02-28");
  assert.equal(recurringCycleDate("2026-01-31", "Quarterly", 1), "2026-04-30");
  assert.equal(recurringCycleDate("2026-12-28", "Weekly", 1), "2027-01-04");
  assert.deepEqual(recurringBillCycles({ ...rule, nextDueDate: "invalid" }, [], "2026-10-21"), []);
});

test("a recorded early payment covers an upcoming cycle while a future-dated entry does not", () => {
  const upcoming = { ...rule, nextDueDate: "2026-11-05" };
  const recorded = recurringBillCycles(upcoming, [bill({ date: "2026-11-03", recurringTemplateId: "r1" })], "2026-11-04");
  assert.deepEqual(recorded.map(c => [c.date, c.status]), [["2026-11-05", "recorded"], ["2026-12-05", "expected"]]);
  assert.equal(recurringBillCycles(upcoming, [bill({ date: "2026-11-05", recurringTemplateId: "r1" })], "2026-11-04")[0].status, "expected");
  const possible = recurringBillCycles(upcoming, [bill({ date: "2026-11-03" })], "2026-11-04")[0];
  assert.equal(possible.status, "needs_review"); assert.equal(possible.records.length, 1);
});

test("confirming a match changes only its link and prevents a second generated transaction", () => {
  let transactions = [bill({ date: "2026-10-07", amount: 21 })], templates = [structuredClone(rule)], drafts: any[] = [];
  const original = structuredClone(transactions[0]);
  const actions = createRecurringActions({ getTransactions: () => transactions, getTemplates: () => templates, getDrafts: () => drafts, getUsePeriods: () => [],
    setTransactions: updater => { transactions = typeof updater === "function" ? updater(transactions) : updater; },
    setTemplates: updater => { templates = typeof updater === "function" ? updater(templates) : updater; },
    setDrafts: updater => { drafts = typeof updater === "function" ? updater(drafts) : updater; } });
  assert.equal(actions.materializeRecurringTransactions("2026-10-21"), 0);
  assert.equal(actions.confirmRecurringBillMatch("r1", "2026-10-05", "wrong", "2026-10-21"), false);
  assert.equal(actions.confirmRecurringBillMatch("r1", "2026-10-05", "t1", "2026-10-21"), true);
  assert.deepEqual(transactions, [{ ...original, recurringTemplateId: "r1" }]);
  assert.equal(actions.generateDrafts(templates[0], "2026-10-21"), 0);
  assert.equal(actions.materializeRecurringTransactions("2026-10-21"), 0);
  assert.equal(transactions.length, 1); assert.equal(templates[0].nextDueDate, "2026-11-05");
});

test("generation scans later cycles for possible existing bills instead of duplicating them after an older gap", () => {
  let transactions = [bill({ date: "2026-11-05" })], templates = [structuredClone(rule)];
  const actions = createRecurringActions({ getTransactions: () => transactions, getTemplates: () => templates, getDrafts: () => [], getUsePeriods: () => [], setDrafts: () => {},
    setTransactions: updater => { transactions = typeof updater === "function" ? updater(transactions) : updater; },
    setTemplates: updater => { templates = typeof updater === "function" ? updater(templates) : updater; } });
  assert.equal(actions.materializeRecurringTransactions("2026-11-21"), 0);
  assert.equal(transactions.length, 1); assert.equal(templates[0].nextDueDate, "2026-10-05");
});
