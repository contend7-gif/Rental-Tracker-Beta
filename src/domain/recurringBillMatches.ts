import type { Frequency, RecurringTemplate, Transaction } from "../models.ts";
import { isValidIsoDate } from "./isoDate.ts";

export type RecurringBillCycle = { date: string; status: "recorded" | "expected" | "needs_review"; records: Transaction[]; reason: string };
const DAY = 86400000;
const normalize = (value: string) => value.toLowerCase().replace(/\(recurring\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export function recurringCycleDate(anchor: string, frequency: Frequency, offset: number) {
  if (!isValidIsoDate(anchor) || !["Weekly", "Monthly", "Quarterly", "Yearly"].includes(frequency)) return "";
  const date = new Date(`${anchor}T00:00:00Z`);
  if (frequency === "Weekly") date.setUTCDate(date.getUTCDate() + offset * 7);
  else {
    const day = date.getUTCDate();
    const months = offset * (frequency === "Monthly" ? 1 : frequency === "Quarterly" ? 3 : 12);
    date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months);
    date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()));
  }
  return date.toISOString().slice(0, 10);
}

export function recurringBillCycles(template: RecurringTemplate, transactions: Transaction[], todayIso: string, options: { continueAfterReview?: boolean } = {}): RecurringBillCycle[] {
  if (!template.active || !isValidIsoDate(todayIso) || !recurringCycleDate(template.nextDueDate, template.frequency, 0)) return [];
  const eligible = transactions.filter(tx => tx.status === "active" && tx.propertyId === template.propertyId
    && tx.unit === template.unit && tx.type === template.type && tx.category === template.category
    && !tx.capitalImprovement && Number.isFinite(tx.amount) && tx.amount > 0
    && isValidIsoDate(tx.date) && tx.date <= todayIso);
  const used = new Set<string>();
  const cycles: RecurringBillCycle[] = [];
  for (let offset = 0; offset < 2400; offset += 1) {
    const date = recurringCycleDate(template.nextDueDate, template.frequency, offset);
    const near = eligible.filter(tx => !used.has(tx.id) && Math.abs((Date.parse(tx.date) - Date.parse(date)) / DAY) <= (template.frequency === "Weekly" ? 2 : 7));
    const linked = near.filter(tx => tx.recurringTemplateId === template.id);
    if (linked.length === 1) {
      used.add(linked[0].id);
      cycles.push({ date, status: "recorded", records: linked, reason: "An active transaction is explicitly linked to this recurring rule in the matching date window and scope. Recorded means present in your ledger; it does not assert bank reconciliation or verify the billed balance." });
      continue;
    }
    const candidates = near.filter(tx => {
      if (tx.recurringTemplateId) return false;
      const description = normalize(tx.description || ""), rule = normalize(template.description || ""), vendor = normalize(tx.vendor || "");
      return (rule.length >= 6 && description === rule)
        || (vendor.length >= 4 && rule.includes(vendor) && Math.abs(tx.amount - template.amount) < 0.01);
    });
    if (date > todayIso && linked.length === 0 && candidates.length === 0) {
      cycles.push({ date, status: "expected", records: [], reason: "Next expected cycle based on the saved recurring schedule. Future-dated entries are not evidence of a recorded payment today." });
      break;
    }
    cycles.push({ date, status: "needs_review", records: linked.length > 1 ? linked : candidates,
      reason: linked.length > 1 ? "Multiple linked transactions overlap this cycle. Review them before deciding whether this cycle is covered."
        : candidates.length ? "Possible matching entries exist, but none is linked to this rule. Confirm the correct existing entry; no new transaction will be created."
          : "No linked transaction was found for this cycle. Review your records before deciding whether a bill is missing." });
    if (!options.continueAfterReview) break; // Calendar never skips an unresolved older cycle.
  }
  return cycles;
}
