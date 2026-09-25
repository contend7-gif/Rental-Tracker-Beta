import type {
  DocumentItem,
  Lease,
  Loan,
  LoanPayment,
  TenantLedgerEntry,
  Transaction,
  WorkOrder,
} from "../models.ts";
import type { RecurringExpenseCheck } from "./recurringExpenseChecks.ts";
import { getMissingLoanPaymentMonths } from "./loanPaymentCoverage.ts";
import { buildTransactionSupportIndex, hasTransactionSupport } from "./transactionSupport.ts";

export type MonthlyCloseIssueKind =
  | "bank_match"
  | "missing_support"
  | "rent_balance"
  | "smart_check"
  | "loan_payment"
  | "maintenance_handoff"
  | "backup";

export type MonthlyCloseIssue = {
  id: string;
  kind: MonthlyCloseIssueKind;
  title: string;
  detail: string;
  count: number;
  severity: "attention" | "review";
};

export type MonthlyCloseReview = {
  month: string;
  monthStart: string;
  monthEnd: string;
  issues: MonthlyCloseIssue[];
  signature: string;
  summary: {
    transactionCount: number;
    income: number;
    expenses: number;
    rentCharged: number;
    rentPaid: number;
  };
};

function validMonth(value: unknown): value is string {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ""));
}

export function monthBounds(month: string) {
  if (!validMonth(month)) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const monthEnd = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  return { monthStart, monthEnd };
}

function inScope(propertyId: string | undefined, propertyFilter: string) {
  return propertyFilter === "all" || propertyId === propertyFilter;
}

function inMonth(date: string | undefined, monthStart: string, monthEnd: string) {
  return Boolean(date && date >= monthStart && date <= monthEnd);
}

function money(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function stableSignature(parts: string[]) {
  let hash = 0x811c9dc5;
  const source = parts.join("|");
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `close-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function snapshotRecords(records: unknown[]) {
  const serialize = (value: unknown): string => {
    if (value == null || typeof value !== "object") return JSON.stringify(value) ?? "null";
    if (Array.isArray(value)) return `[${value.map(serialize).join(",")}]`;
    return `{${Object.keys(value).sort().filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${serialize(value[key])}`).join(",")}}`;
  };
  return records.map(serialize).sort().join("|");
}

function rentEntryAmount(entry: TenantLedgerEntry, transactionByLedgerEntryId: Map<string, Transaction>) {
  const memo = String(entry.memo || "").toLowerCase();
  const linkedTransaction = transactionByLedgerEntryId.get(entry.id);
  const linkedAsRent = linkedTransaction?.status === "active"
    && linkedTransaction.type === "Income"
    && String(linkedTransaction.category || "").toLowerCase().includes("rent");
  const explicitlyRent = entry.accountingTreatment === "rent_income"
    || String(entry.automationKey || "").startsWith("auto-rent:")
    || /(^|\s)rent(\s|$)/.test(memo)
    || linkedAsRent;
  if (!explicitlyRent) return { charged: 0, paid: 0 };
  if (entry.kind === "charge") return { charged: Number(entry.amount || 0), paid: 0 };
  if (entry.kind === "payment" || entry.kind === "credit") return { charged: 0, paid: Number(entry.amount || 0) };
  if (entry.kind === "refund") return { charged: Number(entry.amount || 0), paid: 0 };
  return { charged: 0, paid: 0 };
}

export function buildMonthlyCloseReview(args: {
  month: string;
  todayIso: string;
  propertyFilter?: string;
  transactions?: Transaction[];
  documents?: DocumentItem[];
  leases?: Lease[];
  tenantLedgerEntries?: TenantLedgerEntry[];
  recurringExpenseChecks?: RecurringExpenseCheck[];
  loans?: Loan[];
  loanPayments?: LoanPayment[];
  workOrders?: WorkOrder[];
  unmatchedBankImportCount?: number;
  backupValidated?: boolean;
}): MonthlyCloseReview | null {
  const bounds = monthBounds(args.month);
  if (!bounds) return null;
  const { monthStart, monthEnd } = bounds;
  const propertyFilter = args.propertyFilter || "all";
  const transactions = (args.transactions || []).filter((transaction) => (
    transaction.status === "active"
    && inScope(transaction.propertyId, propertyFilter)
  ));
  const monthTransactions = transactions.filter((transaction) => inMonth(transaction.date, monthStart, monthEnd));
  const issues: MonthlyCloseIssue[] = [];

  const unreconciled = monthTransactions.filter((transaction) => transaction.bankImportId && transaction.reconciled !== true);
  const unmatchedBankImportCount = propertyFilter === "all" ? Math.max(0, Number(args.unmatchedBankImportCount || 0)) : 0;
  const bankMatchCount = unreconciled.length + unmatchedBankImportCount;
  if (bankMatchCount > 0) {
    issues.push({
      id: "bank-match",
      kind: "bank_match",
      title: "Finish bank matching",
      detail: `${bankMatchCount} imported ${bankMatchCount === 1 ? "item still needs" : "items still need"} review or a confirmed match.`,
      count: bankMatchCount,
      severity: "attention",
    });
  }

  const supportedTransactionIds = buildTransactionSupportIndex(args.documents);
  const missingSupport = monthTransactions.filter((transaction) => (
    transaction.type === "Expense"
    && !(transaction.category === "Auto and travel" && Number(transaction.mileageMiles) > 0)
    && !hasTransactionSupport(transaction, supportedTransactionIds)
    && transaction.reviewOverrides?.missing_receipt !== "not_available"
  ));
  if (missingSupport.length > 0) {
    issues.push({
      id: "missing-support",
      kind: "missing_support",
      title: "Review missing receipts",
      detail: `${missingSupport.length} ${missingSupport.length === 1 ? "expense has" : "expenses have"} no receipt or an intentional no-receipt explanation.`,
      count: missingSupport.length,
      severity: "review",
    });
  }

  const leaseIds = new Set((args.leases || [])
    .filter((lease) => inScope(lease.propertyId, propertyFilter) && lease.startDate <= monthEnd)
    .map((lease) => lease.id));
  const transactionByLedgerEntryId = new Map(transactions
    .filter((transaction) => transaction.tenantLedgerEntryId)
    .map((transaction) => [transaction.tenantLedgerEntryId as string, transaction]));
  const rentByLease = new Map<string, { charged: number; paid: number }>();
  const monthRentTotals = { charged: 0, paid: 0 };
  (args.tenantLedgerEntries || []).forEach((entry) => {
    if (entry.voidedAt || !leaseIds.has(entry.leaseId) || entry.date > monthEnd) return;
    const amount = rentEntryAmount(entry, transactionByLedgerEntryId);
    if (inMonth(entry.date, monthStart, monthEnd)) {
      monthRentTotals.charged += amount.charged;
      monthRentTotals.paid += amount.paid;
    }
    const current = rentByLease.get(entry.leaseId) || { charged: 0, paid: 0 };
    rentByLease.set(entry.leaseId, {
      charged: current.charged + amount.charged,
      paid: current.paid + amount.paid,
    });
  });
  const openRentBalances = [...rentByLease.entries()].filter(([, totals]) => totals.charged - totals.paid > 0.01);
  if (openRentBalances.length > 0) {
    issues.push({
      id: "rent-balance",
      kind: "rent_balance",
      title: "Confirm outstanding rent",
      detail: `${openRentBalances.length} ${openRentBalances.length === 1 ? "lease has" : "leases have"} rent charges above recorded rent payments through month-end.`,
      count: openRentBalances.length,
      severity: "attention",
    });
  }

  const smartChecks = (args.recurringExpenseChecks || []).filter((check) => (
    inScope(check.propertyId, propertyFilter)
    && inMonth(check.expectedDate, monthStart, monthEnd)
  ));
  if (smartChecks.length > 0) {
    issues.push({
      id: "smart-check",
      kind: "smart_check",
      title: "Resolve recurring expense checks",
      detail: `${smartChecks.length} expected monthly ${smartChecks.length === 1 ? "expense is" : "expenses are"} still missing or awaiting an intentional choice.`,
      count: smartChecks.length,
      severity: "review",
    });
  }

  const monthIsDue = monthStart <= args.todayIso;
  const missingLoanPayments = monthIsDue ? (args.loans || []).filter((loan) => (
    inScope(loan.propertyId, propertyFilter)
    && Number(loan.scheduledPI || 0) + Number(loan.scheduledEscrow || 0) + Number(loan.scheduledMortgageInsurance || 0) > 0
    && getMissingLoanPaymentMonths(loan, args.loanPayments, {
      yearFilter: args.month.slice(0, 4), todayIso: args.todayIso,
    }).includes(args.month)
  )) : [];
  if (missingLoanPayments.length > 0) {
    issues.push({
      id: "loan-payment",
      kind: "loan_payment",
      title: "Confirm loan payments",
      detail: `${missingLoanPayments.length} scheduled ${missingLoanPayments.length === 1 ? "loan has" : "loans have"} no payment breakdown recorded for this month.`,
      count: missingLoanPayments.length,
      severity: "attention",
    });
  }

  const unbilledMaintenance = (args.workOrders || []).filter((workOrder) => {
    if (!inScope(workOrder.propertyId, propertyFilter) || workOrder.transactionId || Number(workOrder.actualCost || 0) <= 0) return false;
    if (workOrder.status !== "Completed" && workOrder.status !== "Closed") return false;
    const completionDate = workOrder.completedAt || workOrder.dueDate || workOrder.reportedOn;
    return Boolean(completionDate && completionDate <= monthEnd);
  });
  if (unbilledMaintenance.length > 0) {
    issues.push({
      id: "maintenance-handoff",
      kind: "maintenance_handoff",
      title: "Attach completed maintenance costs",
      detail: `${unbilledMaintenance.length} completed ${unbilledMaintenance.length === 1 ? "work order has" : "work orders have"} an actual cost but no linked transaction.`,
      count: unbilledMaintenance.length,
      severity: "review",
    });
  }

  if (args.backupValidated === false) {
    issues.push({
      id: "backup",
      kind: "backup",
      title: "Validate a recent backup",
      detail: "A valid or valid-with-warnings backup has not been confirmed in this session.",
      count: 1,
      severity: "review",
    });
  }

  const income = money(monthTransactions.filter((transaction) => transaction.type === "Income").reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0));
  const expenses = money(monthTransactions.filter((transaction) => transaction.type === "Expense").reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0));
  const monthTransactionIds = new Set(monthTransactions.map((transaction) => transaction.id));
  const scopedLoans = (args.loans || []).filter((loan) => inScope(loan.propertyId, propertyFilter) && loan.originatedOn <= monthEnd);
  const scopedLoanIds = new Set(scopedLoans.map((loan) => String(loan.id)));
  const signature = stableSignature([
    args.month,
    propertyFilter,
    ...issues.map((issue) => `${issue.id}:${issue.count}`),
    snapshotRecords(monthTransactions),
    snapshotRecords((args.leases || []).filter((lease) => leaseIds.has(lease.id))),
    snapshotRecords((args.tenantLedgerEntries || []).filter((entry) => leaseIds.has(entry.leaseId) && entry.date <= monthEnd)),
    snapshotRecords(scopedLoans),
    snapshotRecords((args.loanPayments || []).filter((payment) => scopedLoanIds.has(String(payment.loanId)) && payment.paymentDate <= monthEnd)),
    snapshotRecords(smartChecks),
    snapshotRecords(unbilledMaintenance),
    // Preview loading is transient. Only supporting-document metadata belongs in a close snapshot.
    snapshotRecords((args.documents || []).filter((document) => (
      monthTransactionIds.has(document.transactionId)
      || document.relatedTransactionIds?.some((id) => monthTransactionIds.has(id))
    )).map(({ id, name, type, transactionId, relatedTransactionIds }) => ({ id, name, type, transactionId, relatedTransactionIds }))),
  ]);

  return {
    month: args.month,
    monthStart,
    monthEnd,
    issues,
    signature,
    summary: {
      transactionCount: monthTransactions.length,
      income,
      expenses,
      rentCharged: money(monthRentTotals.charged),
      rentPaid: money(monthRentTotals.paid),
    },
  };
}
