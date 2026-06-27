import type { Lease, TenantLedgerEntry } from "../models.ts";
import { buildTenantLedgerSummary } from "./tenantLedger.ts";
import { normalizeTenantLedgerAccountingTreatment } from "./tenantLedgerPosting.ts";
import { proratedRentForMonth30Day } from "./rentProration.js";
import { formatUnitLabel } from "./unitLabels.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export type LeaseAutomationDefaults = {
  rentDueDay: number;
  reminderDaysBefore: number;
  lateFeeGraceDays: number;
  lateFeeType: "flat" | "percent";
  lateFeeValue: number;
  autoLateFeeEnabled: boolean;
};

export type LeaseAutomationConfig = LeaseAutomationDefaults;

export type LeaseReminderKind = "due_soon" | "due_today" | "late";

export type LeaseAutomationReminder = {
  id: string;
  leaseId: string;
  propertyId: string;
  unit: string;
  tenantName: string;
  kind: LeaseReminderKind;
  dueDate: string;
  daysUntilDue: number;
  amount: number;
  title: string;
  message: string;
};

export type LeaseAutomationPlan = {
  entries: TenantLedgerEntry[];
  reminders: LeaseAutomationReminder[];
};

export function isAutomatedRentChargeEntry(entry: Pick<TenantLedgerEntry, "id" | "kind" | "memo" | "automationKey">) {
  if (entry.kind !== "charge") return false;
  const key = String(entry.automationKey || "").trim();
  const id = String(entry.id || "").trim();
  const memo = String(entry.memo || "").trim().toLowerCase();
  return key.startsWith("auto-rent:") || id.startsWith("tle-auto-rent-") || memo.startsWith("auto rent charge (");
}

function isManualRentChargeEntryForDueDate(entry: TenantLedgerEntry, leaseId: string, dueDate: string) {
  if (!entry || entry.leaseId !== leaseId) return false;
  if (entry.kind !== "charge") return false;
  if (String(entry.date || "") !== dueDate) return false;
  if (isAutomatedRentChargeEntry(entry)) return false;

  const accountingTreatment = normalizeTenantLedgerAccountingTreatment(entry.accountingTreatment);
  const memo = String(entry.memo || "").trim().toLowerCase();
  return accountingTreatment === "rent_income" || memo.includes("rent");
}

export function findStaleAutomatedRentChargeIds(entries: TenantLedgerEntry[]) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  return safeEntries
    .filter((entry) => {
      if (!isAutomatedRentChargeEntry(entry)) return false;
      const leaseId = String(entry.leaseId || "").trim();
      const dueDate = String(entry.date || "").trim();
      if (!leaseId || !dueDate) return false;
      return safeEntries.some((candidate) => candidate.id !== entry.id && isManualRentChargeEntryForDueDate(candidate, leaseId, dueDate));
    })
    .map((entry) => entry.id);
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function roundMoney(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function parseIsoDate(isoDate: string) {
  const [year, month, day] = String(isoDate || "").split("-").map(Number);
  return { year, month, day };
}

function toIsoDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthStartIso(isoDate: string) {
  const { year, month } = parseIsoDate(isoDate);
  return toIsoDate(year || 1970, month || 1, 1);
}

function addDaysIso(isoDate: string, days: number) {
  const base = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return isoDate;
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function nextMonthStartIso(isoDate: string) {
  const { year, month } = parseIsoDate(isoDate);
  const base = new Date(Date.UTC(year || 1970, (month || 1) - 1, 1));
  base.setUTCMonth(base.getUTCMonth() + 1);
  return base.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dueDateForMonth(year: number, month: number, dueDay: number) {
  const safeDay = Math.max(1, Math.min(daysInMonth(year, month), dueDay));
  return toIsoDate(year, month, safeDay);
}

function diffDays(startIsoDate: string, endIsoDate: string) {
  const start = new Date(`${startIsoDate}T00:00:00.000Z`);
  const end = new Date(`${endIsoDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS);
}

function minDate(a: string, b: string) {
  return a <= b ? a : b;
}

function isOpenEndedLease(lease: Lease) {
  return lease.rentalType === "Long-term" && lease.monthToMonthAfterTerm && !lease.actualEndDate;
}

function leaseEndForSchedules(lease: Lease, todayIso: string) {
  if (lease.actualEndDate) return lease.actualEndDate;
  if (isOpenEndedLease(lease)) return todayIso;
  return lease.endDate;
}

function leaseEndForReminders(lease: Lease) {
  if (lease.actualEndDate) return lease.actualEndDate;
  if (isOpenEndedLease(lease)) return "";
  return lease.endDate;
}

function leaseLabel(lease: Lease) {
  const tenant = String(lease.tenantName || "").trim();
  return tenant || formatUnitLabel(lease.unit);
}

function sanitizeAutomationEntryId(automationKey: string) {
  return `tle-${automationKey}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 120);
}

export function rentChargeAutomationKey(leaseId: string, dueDate: string) {
  return `auto-rent:${leaseId}:${dueDate}`;
}

export function lateFeeAutomationKey(leaseId: string, dueDate: string) {
  return `auto-late-fee:${leaseId}:${dueDate}`;
}

export function resolveLeaseAutomationConfig(lease: Lease, defaults: LeaseAutomationDefaults): LeaseAutomationConfig {
  return {
    rentDueDay: clampInt(lease.rentDueDay, 1, 28, clampInt(defaults.rentDueDay, 1, 28, 1)),
    reminderDaysBefore: clampInt(lease.reminderDaysBefore, 0, 14, clampInt(defaults.reminderDaysBefore, 0, 14, 3)),
    lateFeeGraceDays: clampInt(lease.lateFeeGraceDays, 0, 30, clampInt(defaults.lateFeeGraceDays, 0, 30, 5)),
    lateFeeType: lease.lateFeeType === "percent" ? "percent" : defaults.lateFeeType === "percent" ? "percent" : "flat",
    lateFeeValue: clampNumber(lease.lateFeeValue, 0, 100000, clampNumber(defaults.lateFeeValue, 0, 100000, 0)),
    autoLateFeeEnabled: lease.autoLateFeeEnabled === true ? true : defaults.autoLateFeeEnabled === true,
  };
}

function listRentDueDatesThroughToday(lease: Lease, todayIso: string, config: LeaseAutomationConfig) {
  if (!lease.startDate || !todayIso) return [];
  const effectiveEnd = minDate(todayIso, leaseEndForSchedules(lease, todayIso));
  const currentYearStart = `${todayIso.slice(0, 4)}-01-01`;
  const effectiveStart = lease.startDate > currentYearStart ? lease.startDate : currentYearStart;
  if (effectiveStart > effectiveEnd) return [];

  const dueDates: string[] = [];
  let cursor = monthStartIso(effectiveStart);
  const stopAt = monthStartIso(effectiveEnd);

  while (cursor <= stopAt) {
    const { year, month } = parseIsoDate(cursor);
    const dueDate = dueDateForMonth(year, month, config.rentDueDay);
    const chargeDate = dueDate < effectiveStart && dueDate.slice(0, 7) === effectiveStart.slice(0, 7) ? effectiveStart : dueDate;
    if (chargeDate >= effectiveStart && chargeDate <= effectiveEnd) {
      dueDates.push(chargeDate);
    }
    cursor = nextMonthStartIso(cursor);
  }

  return dueDates;
}

function findNextDueDate(lease: Lease, todayIso: string, config: LeaseAutomationConfig) {
  if (!todayIso) return "";
  const reminderEnd = leaseEndForReminders(lease);
  let cursor = monthStartIso(todayIso);

  for (let idx = 0; idx < 36; idx += 1) {
    const { year, month } = parseIsoDate(cursor);
    const dueDate = dueDateForMonth(year, month, config.rentDueDay);
    if (dueDate < lease.startDate) {
      cursor = nextMonthStartIso(cursor);
      continue;
    }
    if (reminderEnd && dueDate > reminderEnd) {
      return "";
    }
    if (dueDate >= todayIso) {
      return dueDate;
    }
    cursor = nextMonthStartIso(cursor);
  }

  return "";
}

function reminderPriority(kind: LeaseReminderKind) {
  if (kind === "late") return 0;
  if (kind === "due_today") return 1;
  return 2;
}

export function buildLeaseAutomationPlan(args: {
  leases: Lease[];
  tenantLedgerEntries: TenantLedgerEntry[];
  todayIso: string;
  defaults: LeaseAutomationDefaults;
}): LeaseAutomationPlan {
  const todayIso = String(args.todayIso || "").slice(0, 10);
  if (!todayIso) return { entries: [], reminders: [] };

  const leases = Array.isArray(args.leases) ? args.leases : [];
  const existingEntries = Array.isArray(args.tenantLedgerEntries) ? args.tenantLedgerEntries : [];
  const existingByAutomationKey = new Map(
    existingEntries
      .map((entry) => {
        const key = String(entry.automationKey || "").trim();
        if (!key) return null;
        return [key, entry] as const;
      })
      .filter((pair): pair is readonly [string, TenantLedgerEntry] => Boolean(pair)),
  );

  const generatedRentEntries: TenantLedgerEntry[] = [];
  const dueDateRowsByLease = new Map<string, { lease: Lease; dueDate: string; config: LeaseAutomationConfig; chargeEntry: TenantLedgerEntry }[]>();
  const generatedAtIso = new Date().toISOString();

  leases.forEach((lease) => {
    if (!lease?.id) return;
    const monthlyRent = roundMoney(Math.max(0, Number(lease.monthlyRent || 0)));
    if (monthlyRent <= 0) return;

    const config = resolveLeaseAutomationConfig(lease, args.defaults);
    const dueDates = listRentDueDatesThroughToday(lease, todayIso, config);

    dueDates.forEach((dueDate) => {
      const scheduledRent = roundMoney(proratedRentForMonth30Day(lease, dueDate) ?? monthlyRent);
      if (scheduledRent <= 0) return;
      const automationKey = rentChargeAutomationKey(lease.id, dueDate);
      const existing = existingByAutomationKey.get(automationKey);
      const matchingManualCharge = existingEntries.find((entry) => isManualRentChargeEntryForDueDate(entry, lease.id, dueDate));
      const chargeEntry =
        matchingManualCharge ||
        existing ||
        {
          id: sanitizeAutomationEntryId(automationKey),
          leaseId: lease.id,
          date: dueDate,
          kind: "charge",
          amount: scheduledRent,
          memo: `Auto rent charge (${dueDate.slice(0, 7)})`,
          accountingTreatment: "none",
          automationKey,
          createdAt: generatedAtIso,
        };

      if (!matchingManualCharge && !existing) {
        generatedRentEntries.push(chargeEntry);
      }

      if (!dueDateRowsByLease.has(lease.id)) {
        dueDateRowsByLease.set(lease.id, []);
      }

      dueDateRowsByLease.get(lease.id)?.push({ lease, dueDate, config, chargeEntry });
    });
  });

  const lateFeeEntries: TenantLedgerEntry[] = [];
  const reminders: LeaseAutomationReminder[] = [];

  leases.forEach((lease) => {
    if (!lease?.id) return;
    const monthlyRent = roundMoney(Math.max(0, Number(lease.monthlyRent || 0)));
    if (monthlyRent <= 0) return;
    if (!lease.startDate || lease.startDate > todayIso) return;

    const config = resolveLeaseAutomationConfig(lease, args.defaults);
    const leaseLabelText = leaseLabel(lease);

    const leaseRows = dueDateRowsByLease.get(lease.id) || [];
    const leaseEntryPool = [
      ...existingEntries.filter((entry) => entry.leaseId === lease.id),
      ...leaseRows
        .map((row) => row.chargeEntry)
        .filter((entry, idx, arr) => arr.findIndex((other) => other.id === entry.id) === idx),
    ].filter((entry, idx, arr) => arr.findIndex((other) => other.id === entry.id) === idx);

    const leaseSummary = buildTenantLedgerSummary(leaseEntryPool);
    const overdueRows = leaseRows
      .map((row) => {
        const openBalance = Number(leaseSummary.chargeBalanceById[row.chargeEntry.id] || 0);
        const daysLate = diffDays(row.dueDate, todayIso);
        return { ...row, openBalance, daysLate };
      })
      .filter((row) => row.daysLate > row.config.lateFeeGraceDays && row.openBalance > 0)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    if (overdueRows.length > 0) {
      const oldestOverdue = overdueRows[0];
      reminders.push({
        id: `lease-reminder:late:${lease.id}:${oldestOverdue.dueDate}`,
        leaseId: lease.id,
        propertyId: lease.propertyId,
        unit: lease.unit,
        tenantName: leaseLabelText,
        kind: "late",
        dueDate: oldestOverdue.dueDate,
        daysUntilDue: -oldestOverdue.daysLate,
        amount: roundMoney(oldestOverdue.openBalance),
        title: `Late rent: ${formatUnitLabel(lease.unit)}`,
        message: `${currencyLabel(oldestOverdue.openBalance)} unpaid, due ${formatDateLabel(oldestOverdue.dueDate)}.`,
      });
    }

    if (config.autoLateFeeEnabled && overdueRows.length > 0) {
      overdueRows.forEach((row) => {
        const lateAutomationKey = lateFeeAutomationKey(lease.id, row.dueDate);
        if (existingByAutomationKey.has(lateAutomationKey)) return;

        const monthlyRentValue = Number(row.chargeEntry.amount || monthlyRent);
        const lateAmount =
          row.config.lateFeeType === "percent"
            ? roundMoney((monthlyRentValue * row.config.lateFeeValue) / 100)
            : roundMoney(row.config.lateFeeValue);
        if (lateAmount <= 0) return;

        lateFeeEntries.push({
          id: sanitizeAutomationEntryId(lateAutomationKey),
          leaseId: lease.id,
          date: addDaysIso(row.dueDate, row.config.lateFeeGraceDays + 1),
          kind: "charge",
          amount: lateAmount,
          memo: `Auto late fee (${row.dueDate.slice(0, 7)})`,
          accountingTreatment: "none",
          automationKey: lateAutomationKey,
          createdAt: generatedAtIso,
        });
      });
    }

    const nextDueDate = findNextDueDate(lease, todayIso, config);
    if (!nextDueDate) return;

    const daysUntilDue = diffDays(todayIso, nextDueDate);
    if (daysUntilDue < 0 || daysUntilDue > config.reminderDaysBefore) return;

    const kind: LeaseReminderKind = daysUntilDue === 0 ? "due_today" : "due_soon";
    reminders.push({
      id: `lease-reminder:${kind}:${lease.id}:${nextDueDate}`,
      leaseId: lease.id,
      propertyId: lease.propertyId,
      unit: lease.unit,
      tenantName: leaseLabelText,
      kind,
      dueDate: nextDueDate,
      daysUntilDue,
      amount: roundMoney(proratedRentForMonth30Day(lease, nextDueDate) ?? monthlyRent),
      title: daysUntilDue === 0 ? `${leaseLabelText} rent due today` : `${leaseLabelText} rent due soon`,
      message:
        daysUntilDue === 0
          ? `Rent is due today (${nextDueDate}).`
          : `Rent is due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"} (${nextDueDate}).`,
    });
  });

  const dedupedReminders = Array.from(
    reminders
      .reduce((map, reminder) => {
        if (!map.has(reminder.id)) {
          map.set(reminder.id, reminder);
        }
        return map;
      }, new Map<string, LeaseAutomationReminder>())
      .values(),
  ).sort((a, b) => {
    const priorityDiff = reminderPriority(a.kind) - reminderPriority(b.kind);
    if (priorityDiff !== 0) return priorityDiff;
    const dateDiff = a.dueDate.localeCompare(b.dueDate);
    if (dateDiff !== 0) return dateDiff;
    return a.tenantName.localeCompare(b.tenantName);
  });

  return {
    entries: [...generatedRentEntries, ...lateFeeEntries],
    reminders: dedupedReminders,
  };
}

function currencyLabel(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function formatDateLabel(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}
