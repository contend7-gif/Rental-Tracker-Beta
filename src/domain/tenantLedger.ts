import type { TenantLedgerEntry } from "../models.ts";

export type TenantLedgerAllocation = {
  chargeEntryId: string;
  amount: number;
};

export type TenantLedgerRow = TenantLedgerEntry & {
  delta: number;
  balanceDelta: number;
  runningBalance: number;
  openBalance: number;
  allocations: TenantLedgerAllocation[];
  unappliedAmount: number;
};

export type TenantLedgerSummary = {
  rows: TenantLedgerRow[];
  chargeBalanceById: Record<string, number>;
  totalDue: number;
  tenantCredit: number;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAccountingTreatment(value: unknown) {
  return String(value || "").trim();
}

export function tenantLedgerSignedAmount(entry: Pick<TenantLedgerEntry, "kind" | "amount">) {
  const amount = toNumber(entry.amount);

  if (entry.kind === "charge") return Math.abs(amount);
  if (entry.kind === "payment") return -Math.abs(amount);
  if (entry.kind === "credit") return -Math.abs(amount);
  if (entry.kind === "refund") return Math.abs(amount);
  return amount;
}

export function tenantLedgerBalanceSignedAmount(entry: Pick<TenantLedgerEntry, "kind" | "amount" | "accountingTreatment">) {
  const delta = tenantLedgerSignedAmount(entry);
  const accountingTreatment = normalizeAccountingTreatment(entry.accountingTreatment);
  if (
    accountingTreatment === "security_deposit_liability" ||
    accountingTreatment === "security_deposit_return" ||
    accountingTreatment === "security_deposit_applied_damages"
  ) {
    return 0;
  }
  return delta;
}

export function compareTenantLedgerEntries(a: TenantLedgerEntry, b: TenantLedgerEntry) {
  const byDate = String(a.date || "").localeCompare(String(b.date || ""));
  if (byDate !== 0) return byDate;

  const byCreated = String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  if (byCreated !== 0) return byCreated;

  return String(a.id || "").localeCompare(String(b.id || ""));
}

export function buildTenantLedgerSummary(entries: TenantLedgerEntry[]): TenantLedgerSummary {
  const sorted = [...entries].sort(compareTenantLedgerEntries);
  const openCharges: Array<{ entryId: string; remaining: number }> = [];
  const unappliedCredits: Array<{ entryId: string; remaining: number }> = [];
  const chargeBalanceById: Record<string, number> = {};
  const rows: TenantLedgerRow[] = [];

  let runningBalance = 0;

  sorted.forEach((entry) => {
    const delta = tenantLedgerSignedAmount(entry);
    const balanceDelta = tenantLedgerBalanceSignedAmount(entry);
    const allocations: TenantLedgerAllocation[] = [];
    let unappliedAmount = 0;

    if (balanceDelta > 0) {
      let remainingCharge = balanceDelta;

      for (let idx = 0; idx < unappliedCredits.length && remainingCharge > 0; idx += 1) {
        const credit = unappliedCredits[idx];
        if (!credit || credit.remaining <= 0) continue;

        const applied = Math.min(credit.remaining, remainingCharge);
        credit.remaining -= applied;
        remainingCharge -= applied;
      }

      chargeBalanceById[entry.id] = remainingCharge;
      if (remainingCharge > 0) {
        openCharges.push({ entryId: entry.id, remaining: remainingCharge });
      }
    } else if (balanceDelta < 0) {
      let toAllocate = Math.abs(balanceDelta);
      for (let idx = 0; idx < openCharges.length && toAllocate > 0; idx += 1) {
        const charge = openCharges[idx];
        if (!charge || charge.remaining <= 0) continue;

        const applied = Math.min(charge.remaining, toAllocate);
        charge.remaining -= applied;
        toAllocate -= applied;

        chargeBalanceById[charge.entryId] = Math.max(0, (chargeBalanceById[charge.entryId] || 0) - applied);
        allocations.push({ chargeEntryId: charge.entryId, amount: applied });
      }
      unappliedAmount = toAllocate;
      if (unappliedAmount > 0) {
        unappliedCredits.push({ entryId: entry.id, remaining: unappliedAmount });
      }
    }

    runningBalance += balanceDelta;
    const openBalance = openCharges.reduce((sum, charge) => sum + Math.max(0, charge.remaining), 0);

    rows.push({
      ...entry,
      delta,
      balanceDelta,
      runningBalance,
      openBalance,
      allocations,
      unappliedAmount,
    });
  });

  return {
    rows,
    chargeBalanceById,
    totalDue: Math.max(0, runningBalance),
    tenantCredit: Math.max(0, runningBalance * -1),
  };
}
