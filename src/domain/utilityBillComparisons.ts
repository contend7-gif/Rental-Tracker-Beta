import type { Transaction } from "../models.ts";
import { isValidIsoDate } from "./isoDate.ts";
import { buildUtilityForecast } from "./utilityForecast.ts";

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const round = (value: number) => Math.round(value * 100) / 100;
const monthIndex = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;

export type UtilityBillComparison = {
  id: string; propertyId: string; unit: string; vendor: string; month: string; date: string;
  actual: number; expected?: number; low?: number; high?: number; difference?: number;
  basis: string; confidence: "seasonal" | "consistent" | "limited" | "insufficient";
  flagged: boolean; currentMonth: boolean;
  records: { id: string; date: string; amount: number }[];
  supportingRecords: { id: string; date: string; amount: number }[];
};

// The review belongs to these exact recorded facts, not every future bill from a vendor.
function fingerprint(value: unknown) {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildUtilityBillComparisons(args: {
  today: string; transactions: Transaction[]; propertyId?: string; unit?: string;
}): UtilityBillComparison[] {
  if (!isValidIsoDate(args.today)) return [];
  const groups = new Map<string, Transaction[]>();
  for (const tx of args.transactions) {
    if (tx.status !== "active" || tx.type !== "Expense" || tx.category !== "Utilities"
      || tx.capitalImprovement || !isValidIsoDate(tx.date) || tx.date > args.today
      || !Number.isFinite(tx.amount) || !normalize(tx.vendor || "")
      || (args.propertyId && args.propertyId !== "all" && tx.propertyId !== args.propertyId)
      || (args.unit && args.unit !== "all" && tx.unit !== args.unit)) continue;
    const key = JSON.stringify([tx.propertyId, tx.unit, normalize(tx.vendor)]);
    groups.set(key, [...(groups.get(key) || []), tx]);
  }
  const comparisons: UtilityBillComparison[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    // Keep the latest three recorded months, so a new bill cannot hide an unresolved recent one.
    const months = [...new Set(sorted.map(tx => tx.date.slice(0, 7)))].slice(-3);
    for (const month of months) {
      if (monthIndex(args.today) - monthIndex(month) > 2) continue;
      const bills = sorted.filter(tx => tx.date.startsWith(month));
      const sample = bills.at(-1)!;
      const actual = round(bills.reduce((sum, tx) => sum + tx.amount, 0));
      if (actual <= 0) continue;
      const history = sorted.filter(tx => tx.date < `${month}-01`);
      const forecast = buildUtilityForecast({ today: `${month}-01`, targetMonth: month, transactions: history });
      const totals = new Map<string, number>();
      history.forEach(tx => totals.set(tx.date.slice(0, 7), (totals.get(tx.date.slice(0, 7)) || 0) + tx.amount));
      const recent = [...totals].filter(([, amount]) => amount > 0).slice(-6);
      const average = recent.reduce((sum, [, amount]) => sum + amount, 0) / Math.max(1, recent.length);
      const consistent = recent.length === 6 && recent.every(([key, amount], index) =>
        monthIndex(month) - monthIndex(key) === 6 - index && Math.abs(amount - average) <= average * 0.15);
      const confidence = forecast.seasonalProviders ? "seasonal" : forecast.providers
        ? consistent ? "consistent" : "limited" : "insufficient";
      const expected = forecast.providers ? forecast.amount : undefined;
      const difference = expected === undefined ? undefined : round(actual - expected);
      const flagged = (confidence === "seasonal" || confidence === "consistent")
        && actual > forecast.high && difference! >= Math.max(25, forecast.amount * 0.25);
      const records = bills.map(({ id, date, amount }) => ({ id, date, amount }));
      const supportingRecords = history.filter(tx => {
        const key = tx.date.slice(0, 7);
        return confidence === "seasonal" ? (key.slice(5) === month.slice(5) || recent.slice(-3).some(([m]) => key === m))
          : recent.slice(-3).some(([m]) => key === m);
      }).map(({ id, date, amount }) => ({ id, date, amount }));
      const basis = confidence === "insufficient" ? "Not enough consecutive monthly history to estimate this bill."
        : confidence === "seasonal" ? "Seasonal comparison using the matching calendar month and prior year cost trends."
        : confidence === "consistent" ? "Recent average supported by six consistent complete months."
        : "Limited history: recent three-month average; seasonal changes are not established. No amount alert is raised.";
      comparisons.push({
        id: `utility-amount:${fingerprint([sample.propertyId, sample.unit, normalize(sample.vendor), month, confidence, expected, forecast.high, records, supportingRecords])}`,
        propertyId: sample.propertyId, unit: sample.unit, vendor: sample.vendor.trim(), month, date: sample.date,
        actual, expected, low: expected === undefined ? undefined : forecast.low,
        high: expected === undefined ? undefined : forecast.high, difference, basis, confidence, flagged,
        currentMonth: month === args.today.slice(0, 7), records, supportingRecords,
      });
    }
  }
  return comparisons.sort((a, b) => b.month.localeCompare(a.month) || a.vendor.localeCompare(b.vendor) || a.id.localeCompare(b.id));
}
