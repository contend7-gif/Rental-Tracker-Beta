import assert from "node:assert/strict";
import test from "node:test";
import type { Transaction } from "../models.ts";
import { buildUtilityBillComparisons } from "./utilityBillComparisons.ts";
import { applyOperationsFollowUps, bucketOperationsCalendarItems, buildOperationsCalendarItems, operationsFollowUpRecord } from "./operationsCalendar.ts";
import { sanitizeAppSettings } from "../store/appSettings.ts";

const bill = (date: string, amount: number, extra: Partial<Transaction> = {}) => ({
  id: date, date, amount, vendor: "Example Gas", propertyId: "p1", unit: "Shared",
  status: "active", type: "Expense", category: "Utilities", capitalImprovement: false, ...extra,
} as Transaction);
const stable = Array.from({ length: 6 }, (_, i) => bill(`2026-${String(i + 4).padStart(2, "0")}-05`, 90));
const run = (transactions: Transaction[], today = "2026-10-25") => buildUtilityBillComparisons({ today, transactions });
const october = (transactions: Transaction[]) => run(transactions).find(item => item.month === "2026-10")!;

test("bill comparisons freeze the baseline before the month, aggregate entries, and include credits", () => {
  const transactions = [...stable, bill("2026-10-05", 150), bill("2026-10-06", -15)];
  const original = structuredClone(transactions);
  const item = october(transactions);
  assert.equal(item.expected, 90);
  assert.equal(item.actual, 135);
  assert.equal(item.difference, 45);
  assert.equal(item.flagged, true);
  assert.equal(item.confidence, "consistent");
  assert.equal(item.currentMonth, true);
  assert.ok(item.supportingRecords.every(record => record.date < "2026-10-01"));
  assert.deepEqual(run([...transactions].reverse()), run(transactions));
  assert.deepEqual(transactions, original);
  assert.equal(october([...stable, bill("2026-10-05", 900)]).expected, 90);
});

test("a full seasonal history compares winter gas to winter rather than summer", () => {
  const history = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(Date.UTC(2025, i, 5)).toISOString().slice(0, 10);
    return bill(date, ["01", "02", "12"].includes(date.slice(5, 7)) ? 300 : 60);
  });
  const normal = run([...history, bill("2026-01-05", 320)], "2026-01-25").find(item => item.month === "2026-01")!;
  assert.equal(normal.confidence, "seasonal");
  assert.equal(normal.expected, 300);
  assert.equal(normal.flagged, false);
  const high = run([...history, bill("2026-01-05", 450)], "2026-01-25").find(item => item.month === "2026-01")!;
  assert.equal(high.flagged, true);
});

test("limited, irregular, stale and missing histories do not raise amount alerts", () => {
  const limited = october([...stable.slice(-3), bill("2026-10-05", 500)]);
  assert.equal(limited.confidence, "limited");
  assert.equal(limited.expected, 90);
  assert.equal(limited.flagged, false);
  const missing = october([bill("2026-10-05", 500)]);
  assert.equal(missing.confidence, "insufficient");
  assert.equal(missing.expected, undefined);
  assert.equal(missing.flagged, false);
  assert.equal(october([...stable.filter(tx => tx.date !== "2026-08-05"), bill("2026-10-05", 500)]).flagged, false);
  assert.deepEqual(run(stable, "2027-05-01"), []);
  assert.deepEqual(run(stable, "2026-02-30"), []);
  assert.equal(october([...stable.map((tx, i) => ({ ...tx, amount: i % 2 ? 150 : 30 })), bill("2026-10-05", 500)]).flagged, false);
});

test("alerts require a material increase outside the allowance; lower and tiny bills remain quiet", () => {
  assert.equal(october([...stable, bill("2026-10-05", 121)]).flagged, false);
  assert.equal(october([...stable, bill("2026-10-05", 30)]).flagged, false);
  assert.equal(october([...stable.map(tx => ({ ...tx, amount: 10 })), bill("2026-10-05", 20)]).flagged, false);
});

test("comparisons isolate providers, properties and units and exclude invalid or future evidence", () => {
  const transactions = [...stable, bill("2026-10-05", 135),
    ...stable.map(tx => ({ ...tx, propertyId: "p2", id: `p2-${tx.id}`, amount: 900 })),
    ...stable.map(tx => ({ ...tx, unit: "616", id: `unit-${tx.id}`, amount: 900 })),
    bill("2026-10-12", 500, { status: "voided" }), bill("2026-10-13", 500, { type: "Income" }),
    bill("2026-10-14", 500, { capitalImprovement: true }), bill("2026-10-15", Number.NaN),
    bill("2026-10-16", 500, { category: "Other expenses" }), bill("2026-10-17", 500, { vendor: "" }),
    bill("2026-10-32", 500), bill("2026-10-26", 500),
  ];
  const result = buildUtilityBillComparisons({ today: "2026-10-25", transactions, propertyId: "p1", unit: "Shared" });
  assert.equal(result.find(item => item.month === "2026-10")!.actual, 135);
  assert.ok(result.every(item => item.propertyId === "p1" && item.unit === "Shared"));
  assert.equal(october([...stable.slice(-3).map((tx, i) => ({ ...tx, vendor: `different-${i}` })), bill("2026-10-05", 135)]).expected, undefined);
});

test("explained amounts survive settings normalization, stay in history and reappear after facts change", () => {
  const transactions = [...stable, bill("2026-10-05", 135)];
  const items = buildOperationsCalendarItems({ todayIso: "2026-10-25", transactions });
  assert.equal(items.length, 1);
  assert.equal(items[0].utilityComparison!.difference, 45);
  const settings = sanitizeAppSettings({ operationsFollowUps: {
    [items[0].id]: operationsFollowUpRecord(items[0], "done", "2026-10-25"),
  } });
  assert.equal(applyOperationsFollowUps(items, settings.operationsFollowUps).length, 0);
  const reviewed = applyOperationsFollowUps(items, settings.operationsFollowUps, { showHandled: true });
  assert.equal(reviewed.length, 1);
  assert.equal(bucketOperationsCalendarItems(reviewed, "2026-10-25").attention.length, 0);
  const changed = buildOperationsCalendarItems({ todayIso: "2026-10-25", transactions: [...stable, bill("2026-10-05", 155)] });
  assert.notEqual(changed[0].id, items[0].id);
  assert.equal(applyOperationsFollowUps(changed, settings.operationsFollowUps).length, 1);
  const next = buildOperationsCalendarItems({ todayIso: "2026-11-25", transactions: [...transactions, bill("2026-11-05", 160)] });
  assert.ok(next.some(item => item.id === items[0].id));
  assert.equal(applyOperationsFollowUps(items, {}).length, 1);
});
