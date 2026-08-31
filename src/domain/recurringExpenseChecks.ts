import type { RecurringTemplate, Transaction } from "../models.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHLY_MIN_DAYS = 20;
const MONTHLY_MAX_DAYS = 45;
const DEFAULT_GRACE_DAYS = 7;
const WATCHED_CATEGORIES = new Set([
  "Utilities",
  "Insurance",
  "Management fees",
  "Cleaning and maintenance",
]);

export type RecurringExpenseCheck = {
  patternKey: string;
  reviewDate: string;
  expectedDate: string;
  lastRecordedDate: string;
  propertyId: string;
  unit: string;
  vendor: string;
  category: string;
  occurrenceCount: number;
};

function validIsoDate(value: unknown): value is string {
  const date = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function diffDays(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00.000Z`);
  const end = new Date(`${endIso}T00:00:00.000Z`);
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

function addDays(dateIso: string, days: number) {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonths(dateIso: string, monthOffset: number) {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  const day = date.getUTCDate();
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 1));
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next.toISOString().slice(0, 10);
}

function stablePatternKey(signature: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `repeat-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function likelyCoveredByTemplate(transactions: Transaction[], templates: RecurringTemplate[]) {
  const activeTemplates = templates.filter((template) => template.active && template.type === "Expense");
  const linkedIds = new Set(transactions.map((transaction) => transaction.recurringTemplateId).filter(Boolean));
  if (activeTemplates.some((template) => linkedIds.has(template.id))) return true;

  const sample = transactions.at(-1);
  if (!sample) return false;
  const vendor = normalize(sample.vendor);
  const description = normalize(sample.description);
  return activeTemplates.some((template) => {
    if (template.propertyId !== sample.propertyId || template.unit !== sample.unit || template.category !== sample.category) return false;
    const templateDescription = normalize(template.description);
    if (vendor.length >= 4 && templateDescription.includes(vendor)) return true;
    return description.length >= 6
      && (templateDescription.includes(description) || description.includes(templateDescription));
  });
}

export function buildRecurringExpenseChecks(args: {
  transactions?: Transaction[];
  recurringTemplates?: RecurringTemplate[];
  acknowledgements?: Record<string, string>;
  todayIso: string;
  graceDays?: number;
}): RecurringExpenseCheck[] {
  if (!validIsoDate(args.todayIso)) return [];
  const graceDays = Math.max(0, Math.min(30, Math.round(Number(args.graceDays ?? DEFAULT_GRACE_DAYS))));
  const groups = new Map<string, Transaction[]>();

  (args.transactions || []).forEach((transaction) => {
    const vendor = normalize(transaction.vendor);
    if (
      transaction.status !== "active"
      || transaction.type !== "Expense"
      || !WATCHED_CATEGORIES.has(transaction.category)
      || !vendor
      || !validIsoDate(transaction.date)
    ) return;
    const signature = [transaction.propertyId, transaction.unit, transaction.category, vendor].join("|");
    const group = groups.get(signature) || [];
    group.push(transaction);
    groups.set(signature, group);
  });

  const checks: RecurringExpenseCheck[] = [];
  groups.forEach((transactions, signature) => {
    const dates = [...new Set(transactions.map((transaction) => transaction.date))].sort();
    if (dates.length < 3) return;
    const recentDates = dates.slice(-5);
    const intervals = recentDates.slice(1).map((date, index) => diffDays(recentDates[index], date));
    if (intervals.some((days) => days < MONTHLY_MIN_DAYS || days > MONTHLY_MAX_DAYS)) return;
    if (likelyCoveredByTemplate(transactions, args.recurringTemplates || [])) return;

    const sample = transactions[transactions.length - 1];
    const patternKey = stablePatternKey(signature);
    const lastRecordedDate = dates[dates.length - 1];
    let monthOffset = 1;
    let expectedDate = addMonths(lastRecordedDate, monthOffset);
    const acknowledgedThrough = args.acknowledgements?.[patternKey];
    if (validIsoDate(acknowledgedThrough)) {
      while (expectedDate <= acknowledgedThrough) {
        monthOffset += 1;
        expectedDate = addMonths(lastRecordedDate, monthOffset);
      }
    }
    const reviewDate = addDays(expectedDate, graceDays);
    if (reviewDate > args.todayIso) return;

    checks.push({
      patternKey,
      reviewDate,
      expectedDate,
      lastRecordedDate,
      propertyId: sample.propertyId,
      unit: sample.unit,
      vendor: sample.vendor.trim(),
      category: sample.category,
      occurrenceCount: dates.length,
    });
  });

  return checks.sort((left, right) => left.reviewDate.localeCompare(right.reviewDate) || left.vendor.localeCompare(right.vendor));
}
