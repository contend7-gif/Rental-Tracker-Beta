import assert from "node:assert/strict";
import test from "node:test";
import type { Transaction } from "../models.ts";
import { buildUtilityForecast } from "./utilityForecast.ts";
import { buildPlanningProjection } from "./planning/forecast.ts";

function bill(date: string, amount: number, extra: Partial<Transaction> = {}): Transaction {
  return { id: date, date, propertyId: "p1", unit: "Shared", type: "Expense", category: "Utilities",
    status: "active", vendor: "Example Gas", amount, capitalImprovement: false, ...extra } as Transaction;
}
const seasonalBills = Array.from({ length: 12 }, (_, i) => {
  const month = new Date(Date.UTC(2024, 11 + i, 5)).toISOString().slice(0, 10);
  return bill(month, ["12", "01", "02"].includes(month.slice(5, 7)) ? 300 : 60);
});

test("gas seasonality follows recorded calendar months rather than flattening winter and summer", () => {
  const input = { today: "2025-12-15", transactions: seasonalBills, propertyId: "p1" };
  const winter = buildUtilityForecast({ ...input, targetMonth: "2026-01" });
  const summer = buildUtilityForecast({ ...input, targetMonth: "2026-07" });
  assert.equal(winter.amount, 300);
  assert.equal(summer.amount, 60);
  assert.equal(winter.seasonalProviders, 1);
  assert.equal(winter.low, 240);
  assert.equal(winter.high, 360);
  assert.deepEqual(buildUtilityForecast({ ...input, targetMonth: "2026-01", transactions: [...seasonalBills].reverse() }), winter);
});

test("short history uses complete monthly totals and does not fabricate winter seasonality", () => {
  const transactions = [bill("2025-08-01", 30), bill("2025-08-15", 30), bill("2025-09-05", 60), bill("2025-10-05", 120), bill("2025-11-01", 9999)];
  const input = { today: "2025-11-15", transactions };
  const winter = buildUtilityForecast({ ...input, targetMonth: "2026-01" });
  assert.equal(winter.amount, 80);
  assert.equal(winter.recentProviders, 1);
  assert.equal(winter.seasonalProviders, 0);
  assert.equal(buildUtilityForecast({ ...input, targetMonth: "2026-07" }).amount, 80);
});

test("forecasts isolate properties and units, exclude invalid records, and reject stale or quarterly histories", () => {
  const transactions = [...seasonalBills,
    ...seasonalBills.map(tx => ({ ...tx, id: `other-${tx.id}`, propertyId: "p2", amount: 9999 })),
    bill("2025-11-04", 9999, { status: "voided" }), bill("2026-01-05", 9999),
    bill("2025-11-04", 9999, { capitalImprovement: true }), bill("2025-11-04", Number.NaN),
    bill("2025-11-04", 9999, { type: "Income" }), bill("2025-11-04", 9999, { date: "2025-02-30" }),
  ];
  const scoped = buildUtilityForecast({ today: "2025-12-15", targetMonth: "2026-01", propertyId: "p1", transactions });
  assert.equal(scoped.amount, 300);
  assert.equal(scoped.providers, 1);
  assert.equal(buildUtilityForecast({ today: "2026-06-15", targetMonth: "2026-07", transactions: seasonalBills }).providers, 0);
  assert.equal(buildUtilityForecast({ today: "2025-12-15", targetMonth: "2026-01", transactions: [bill("2025-03-05", 200), bill("2025-06-05", 200), bill("2025-09-05", 200)] }).providers, 0);
  const separateUnits = [bill("2025-08-01", 30), bill("2025-09-01", 30, { unit: "616" }), bill("2025-10-01", 30)];
  assert.equal(buildUtilityForecast({ today: "2025-11-15", targetMonth: "2026-01", transactions: separateUnits }).providers, 0);
});

test("recent matched year-over-year bills adjust the next seasonal cost", () => {
  const firstYear = Array.from({ length: 12 }, (_, i) => bill(`2024-${String(i + 1).padStart(2, "0")}-05`, 100));
  const secondYear = Array.from({ length: 11 }, (_, i) => bill(`2025-${String(i + 1).padStart(2, "0")}-05`, 120));
  const result = buildUtilityForecast({ today: "2025-12-15", targetMonth: "2026-01", transactions: [...firstYear, ...secondYear] });
  assert.equal(result.amount, 144);
});

test("projection includes learned utility costs once, applies growth, and preserves a manual override", () => {
  const input = { today: "2025-12-15", transactions: seasonalBills, properties: [], loans: [], leases: [], usePeriods: [], units: [],
    assumptions: { horizonMonths: 12, annualRentGrowthPct: 0, annualExpenseGrowthPct: 0, annualValueGrowthPct: 0, vacancyRatePct: 0, monthlyCapexReserve: 0 } };
  const forecast = buildPlanningProjection(input);
  assert.equal(forecast.rows[0].month, "2026-01");
  assert.equal(forecast.rows[0].operatingExpenses, 300);
  assert.equal(forecast.rows[6].operatingExpenses, 60);
  assert.equal(forecast.rows[0].cashFlow, -300);
  assert.equal(forecast.rows[0].utilityForecastMethod, "Seasonal utility estimate");
  assert.equal(forecast.rows[0].driverLabel, "Seasonal utilities");
  const grown = buildPlanningProjection({ ...input, assumptions: { ...input.assumptions, annualExpenseGrowthPct: 0.12 } });
  assert.ok(grown.rows[6].operatingExpenses > 60);
  const lease = { id: "l1", propertyId: "p1", unit: "616", startDate: "2025-01-01", endDate: "2027-12-31", monthlyRent: 1500, utilitiesIncluded: true, status: "Active" } as any;
  const manual = buildPlanningProjection({ ...input, leases: [lease], assumptions: { ...input.assumptions, includedUtilitiesMonthly: 425 } });
  assert.equal(manual.rows[0].utilityForecastAmount, 425);
  assert.equal(manual.rows[6].utilityForecastAmount, 425);
  assert.equal(manual.rows[0].utilityForecastMethod, "Manual utilities override");
});
