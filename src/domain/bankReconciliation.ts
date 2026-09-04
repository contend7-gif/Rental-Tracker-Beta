import type { BankImportRow } from "./bankImport.ts";
import type { BankReconciliationRecord } from "../store/appSettings.ts";

type ImportedBankRow = BankImportRow & { importedTransactionId?: string };

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseBalance(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? roundMoney(parsed) : null;
}

function validIsoDate(value: unknown) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function signatureFor(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `recon-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function inferBankStatementPeriod(rows: BankImportRow[]) {
  const dates = rows.map((row) => row.date).filter(validIsoDate).sort();
  return { periodStart: dates[0] || "", periodEnd: dates.at(-1) || "" };
}

export function buildBankReconciliationSummary(args: {
  rows?: ImportedBankRow[];
  skippedRows?: number;
  periodStart?: string;
  periodEnd?: string;
  openingBalance?: unknown;
  closingBalance?: unknown;
}) {
  const rows = args.rows || [];
  const openingBalance = parseBalance(args.openingBalance);
  const closingBalance = parseBalance(args.closingBalance);
  const activityTotal = roundMoney(rows.reduce((total, row) => total + Number(row.amount || 0), 0));
  const expectedClosingBalance = openingBalance === null ? null : roundMoney(openingBalance + activityTotal);
  const difference = closingBalance === null || expectedClosingBalance === null
    ? null
    : roundMoney(closingBalance - expectedClosingBalance);
  const resolvedCount = rows.filter((row) => Boolean(row.importedTransactionId)).length;
  const skippedRows = Math.max(0, Math.round(Number(args.skippedRows || 0)));
  const issues: string[] = [];
  if (!validIsoDate(args.periodStart) || !validIsoDate(args.periodEnd) || String(args.periodEnd) < String(args.periodStart)) issues.push("Enter a valid statement period.");
  if (openingBalance === null || closingBalance === null) issues.push("Enter opening and closing statement balances.");
  if (rows.length === 0) issues.push("Import at least one statement row.");
  if (resolvedCount !== rows.length) issues.push(`${rows.length - resolvedCount} statement row${rows.length - resolvedCount === 1 ? " is" : "s are"} still unresolved.`);
  if (skippedRows > 0) issues.push(`${skippedRows} source line${skippedRows === 1 ? " was" : "s were"} skipped during import.`);
  if (difference !== null && Math.abs(difference) >= 0.005) issues.push(`Statement is out of balance by ${difference.toFixed(2)}.`);
  return {
    periodStart: String(args.periodStart || ""),
    periodEnd: String(args.periodEnd || ""),
    openingBalance,
    closingBalance,
    activityTotal,
    expectedClosingBalance,
    difference,
    rowCount: rows.length,
    resolvedCount,
    skippedRows,
    canClose: issues.length === 0,
    issues,
  };
}

export function createBankReconciliationRecord(args: {
  id: string;
  fileName?: string;
  accountLabel?: string;
  propertyId?: string;
  closedAt: string;
  summary: ReturnType<typeof buildBankReconciliationSummary>;
}): BankReconciliationRecord {
  if (!args.summary.canClose || args.summary.openingBalance === null || args.summary.closingBalance === null || args.summary.difference === null) {
    throw new Error("Statement is not ready to close.");
  }
  const signature = signatureFor(JSON.stringify({
    fileName: args.fileName || "",
    accountLabel: args.accountLabel || "",
    propertyId: args.propertyId || "",
    ...args.summary,
  }));
  return {
    id: args.id,
    fileName: String(args.fileName || ""),
    accountLabel: String(args.accountLabel || ""),
    propertyId: String(args.propertyId || ""),
    periodStart: args.summary.periodStart,
    periodEnd: args.summary.periodEnd,
    openingBalance: args.summary.openingBalance,
    closingBalance: args.summary.closingBalance,
    activityTotal: args.summary.activityTotal,
    difference: args.summary.difference,
    rowCount: args.summary.rowCount,
    resolvedCount: args.summary.resolvedCount,
    skippedRows: args.summary.skippedRows,
    closedAt: args.closedAt,
    signature,
  };
}
