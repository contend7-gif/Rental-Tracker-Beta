import type { Transaction } from "../models.ts";
import { isValidIsoDate } from "./isoDate.ts";

export type UtilityForecast = {
  amount: number;
  low: number;
  high: number;
  seasonalProviders: number;
  recentProviders: number;
  providers: number;
  coveredTrailingMonthly: number;
  coveredObservedMonthly: number;
  detail: string;
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const round = (value: number) => Math.round(value * 100) / 100;
const monthIndex = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;

// Learn only from recorded bills; missing months are not zero-dollar bills.
// Keep provider/property/unit histories separate and omit the unfinished month.
export function buildUtilityForecast(args: {
  today: string;
  targetMonth: string;
  transactions: Transaction[];
  propertyId?: string;
}): UtilityForecast {
  const result: UtilityForecast = { amount: 0, low: 0, high: 0, seasonalProviders: 0,
    recentProviders: 0, providers: 0, coveredTrailingMonthly: 0, coveredObservedMonthly: 0, detail: "" };
  if (!isValidIsoDate(args.today) || !isValidIsoDate(`${args.targetMonth}-01`)) return result;
  const currentMonth = args.today.slice(0, 7);
  const cutoff = new Date(`${args.today}T00:00:00Z`);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 12);
  const trailingStart = cutoff.toISOString().slice(0, 10);
  const groups = new Map<string, Transaction[]>();
  const observedMonths = new Set<string>();
  for (const tx of args.transactions) {
    if (tx.status !== "active" || tx.type !== "Expense" || tx.category !== "Utilities"
      || tx.capitalImprovement || !isValidIsoDate(tx.date) || tx.date > args.today
      || !Number.isFinite(tx.amount) || (args.propertyId && args.propertyId !== "all" && tx.propertyId !== args.propertyId)) continue;
    if (tx.date >= trailingStart) observedMonths.add(tx.date.slice(0, 7));
    const vendor = normalize(tx.vendor || "");
    if (!vendor) continue;
    const key = JSON.stringify([tx.propertyId, tx.unit, vendor]);
    groups.set(key, [...(groups.get(key) || []), tx]);
  }
  for (const transactions of groups.values()) {
    const months = new Map<string, number>();
    for (const tx of transactions) {
      const month = tx.date.slice(0, 7);
      if (month >= currentMonth || monthIndex(currentMonth) - monthIndex(month) > 24) continue;
      months.set(month, (months.get(month) || 0) + tx.amount);
    }
    const history = [...months].filter(([, amount]) => amount > 0).sort(([a], [b]) => a.localeCompare(b));
    const recent = history.slice(-3);
    // Three consecutive complete months and a recently recorded bill establish monthly cadence.
    if (recent.length < 3 || monthIndex(currentMonth) - monthIndex(recent[2][0]) > 2
      || recent.some(([month], index) => index > 0 && monthIndex(month) - monthIndex(recent[index - 1][0]) !== 1)) continue;
    const calendarMonths = new Set(history.map(([month]) => month.slice(5)));
    const sameMonth = history.filter(([month]) => month.slice(5) === args.targetMonth.slice(5));
    const seasonal = calendarMonths.size === 12 && sameMonth.length > 0;
    const samples = seasonal ? sameMonth.map(([, amount]) => amount) : recent.map(([, amount]) => amount);
    // Adjust a prior-year month only when recent year-over-year pairs support a rate change.
    const ratios = recent.flatMap(([month, amount]) => {
      const prior = months.get(`${Number(month.slice(0, 4)) - 1}${month.slice(4)}`);
      return prior && prior > 0 ? [amount / prior] : [];
    });
    const trend = seasonal && ratios.length >= 2 ? Math.min(2, Math.max(0.5, mean(ratios))) : 1;
    // The most recent same-calendar-month bill anchors the next seasonal estimate.
    const estimate = seasonal ? samples.at(-1)! * trend : mean(samples);
    const margin = seasonal ? 0.2 : 0.35;
    result.amount += estimate;
    result.low += Math.min(estimate * (1 - margin), ...samples.map(value => value * trend));
    result.high += Math.max(estimate * (1 + margin), ...samples.map(value => value * trend));
    const trailing = transactions.filter(tx => tx.date >= trailingStart).reduce((sum, tx) => sum + tx.amount, 0);
    result.coveredTrailingMonthly += trailing / 12;
    result.coveredObservedMonthly += trailing / Math.max(1, observedMonths.size);
    result.providers += 1;
    if (seasonal) result.seasonalProviders += 1;
    else result.recentProviders += 1;
  }
  result.detail = result.providers ? `${result.seasonalProviders} seasonal provider histories; ${result.recentProviders} recent-average histories. Seasonal estimates use the latest matching calendar month from up to 24 complete months, adjusted by recent year-over-year costs when available. Shorter histories use the last 3 complete months. Range is a planning allowance, not a confidence interval or a bill. Missing months are not treated as zero.`
    : "Not enough recent monthly utility history to learn a pattern. Existing expense assumptions apply.";
  for (const key of ["amount", "low", "high", "coveredTrailingMonthly", "coveredObservedMonthly"] as const) result[key] = round(result[key]);
  return result;
}
