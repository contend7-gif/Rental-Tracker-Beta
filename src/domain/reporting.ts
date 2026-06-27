import type { Loan, LoanPayment, Transaction } from "../models.ts";
import type { TenantLedgerRow } from "./tenantLedger.ts";
import { getRentalUsePctForDate } from "./accounting.ts";

export type OwnerMonthlyReportRow = {
  month: string;
  grossIncome: number;
  operatingExpenses: number;
  capex: number;
  debtService: number;
  netOperatingIncome: number;
  cashFlow: number;
};

export type OwnerMonthlyReportTotals = Omit<OwnerMonthlyReportRow, "month">;

export type ScheduleEFriendlyRow = {
  id: string;
  label: string;
  total: number;
  sourceNote?: string;
};

export type ScheduleEFriendlyMetrics = {
  grossRent: number;
  opExp: number;
  deductibleLoanInterest: number;
  depreciation: number;
  scheduleE: number;
  carryoverLoss?: number;
  adjustedScheduleE?: number;
};

export type ReportReadinessSummary = {
  label?: string;
  status?: string;
  blockingCount?: number;
  warningCount?: number;
  supportWarningCount?: number;
  sourceRowCount?: number;
  documentCount?: number;
  notes?: string[];
};

export type ScheduleEPropertyWorksheet = {
  columns: Array<{
    label: string;
    propertyName: string;
    address?: string;
    fairRentalDays?: number;
    personalUseDays?: number;
  }>;
  rows: Array<{
    line: string;
    label: string;
    values: number[];
    total: number;
  }>;
};

export function scheduleEWorksheetPages(worksheet: ScheduleEPropertyWorksheet, pageSize = 3) {
  const columns = worksheet?.columns || [];
  const rows = worksheet?.rows || [];
  if (!columns.length) return [];
  const size = Math.max(1, pageSize);
  const pages = [];
  for (let start = 0; start < columns.length; start += size) {
    const pageColumns = columns.slice(start, start + size);
    pages.push({
      pageNumber: (start / size) + 1,
      startIndex: start,
      columns: pageColumns.map((column, index) => ({
        ...column,
        formLabel: String.fromCharCode(65 + index),
        originalLabel: column.label,
      })),
      rows: rows.map((row) => ({
        ...row,
        values: pageColumns.map((_, index) => Number(row.values?.[start + index] || 0)),
        total: pageColumns.reduce((sum, _, index) => sum + Number(row.values?.[start + index] || 0), 0),
      })),
    });
  }
  return pages;
}

export function scheduleEWorksheetPageText(page: ReturnType<typeof scheduleEWorksheetPages>[number]) {
  if (!page) return "";
  const header = [
    `Schedule E ${page.pageNumber === 1 ? "page 1" : `continuation page ${page.pageNumber}`}`,
    ["Line", "Label", ...page.columns.map((column) => `Property ${column.formLabel}`), "Page total"].join("\t"),
  ];
  const propertyRows = [
    ["Property", "", ...page.columns.map((column) => column.propertyName || ""), ""],
    ["Fair rental days", "", ...page.columns.map((column) => String(column.fairRentalDays || "")), ""],
    ["Personal use days", "", ...page.columns.map((column) => String(column.personalUseDays || "")), ""],
  ].map((row) => row.join("\t"));
  const amountRows = page.rows.map((row) => [
    row.line,
    row.label,
    ...page.columns.map((_, index) => Number(row.values[index] || 0).toFixed(2)),
    Number(row.total || 0).toFixed(2),
  ].join("\t"));
  return [...header, ...propertyRows, ...amountRows].join("\n");
}

function fdfEscape(value: string | number) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ");
}

function taxFormDollar(value: number) {
  const amount = Number(value || 0);
  if (!amount) return "";
  return String(Math.round(amount));
}

export function scheduleEFormFdf(args: {
  propertyWorksheet: ScheduleEPropertyWorksheet;
  pdfFileName?: string;
}) {
  const worksheet = args.propertyWorksheet;
  const fields: Array<[string, string | number]> = [];
  const columnFieldIndexes = [0, 1, 2];
  const rowByLine = Object.fromEntries((worksheet.rows || []).map((row) => [String(row.line), row]));
  const amountFieldForLine = (line: string, columnIndex: number) => {
    const numericLine = Number(line);
    if (numericLine === 3) return 16 + columnIndex;
    if (numericLine === 4) return 19 + columnIndex;
    if (numericLine >= 5 && numericLine <= 18) return 22 + ((numericLine - 5) * 3) + columnIndex;
    if (numericLine === 19) return 64 + columnIndex;
    if (numericLine === 20) return 68 + columnIndex;
    if (numericLine === 21) return 71 + columnIndex;
    return null;
  };

  columnFieldIndexes.forEach((columnIndex) => {
    const column = worksheet.columns[columnIndex];
    if (!column) return;
    const propertyOffset = columnIndex;
    fields.push([`topmostSubform[0].Page1[0].Table_Line1a[0].Row${column.label}[0].f1_${3 + propertyOffset}[0]`, column.propertyName || ""]);
    fields.push([`topmostSubform[0].Page1[0].Table_Line1b[0].Row${column.label}[0].f1_${6 + propertyOffset}[0]`, column.address || ""]);
    fields.push([`topmostSubform[0].Page1[0].Table_Line2[0].Row${column.label}[0].f1_${9 + (columnIndex * 2)}[0]`, column.fairRentalDays || ""]);
    fields.push([`topmostSubform[0].Page1[0].Table_Line2[0].Row${column.label}[0].f1_${10 + (columnIndex * 2)}[0]`, column.personalUseDays || ""]);
    Object.keys(rowByLine).forEach((line) => {
      const fieldIndex = amountFieldForLine(line, columnIndex);
      if (!fieldIndex) return;
      fields.push([
        `topmostSubform[0].Page1[0].${Number(line) <= 4 ? "Table_Income" : "Table_Expenses"}[0].Line${line}[0].f1_${fieldIndex}[0]`,
        taxFormDollar(Number(rowByLine[line].values?.[columnIndex] || 0)),
      ]);
    });
  });

  const fieldRows = fields
    .filter(([, value]) => String(value ?? "") !== "")
    .map(([name, value]) => `<< /T (${fdfEscape(name)}) /V (${fdfEscape(value)}) >>`)
    .join("\n");
  const pdfFile = args.pdfFileName || "f1040se.pdf";
  return `%FDF-1.2
1 0 obj
<<
/FDF << /F (${fdfEscape(pdfFile)}) /Fields [
${fieldRows}
] >>
>>
endobj
trailer
<< /Root 1 0 R >>
%%EOF
`;
}

export type OwnerCommunicationArgs = {
  recipientName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  propertyLabel: string;
  unitLabel: string;
  presetLabel?: string;
  statementPeriodLabel?: string;
  reportId?: string;
  preparedBy?: string;
  note?: string;
  totals?: OwnerMonthlyReportTotals | null;
  attachmentLabels?: string[];
};

export type TenantStatementArgs = {
  tenantName: string;
  propertyLabel: string;
  unitLabel: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  reportId?: string;
  recipientName?: string;
  preparedBy?: string;
  presetLabel?: string;
  statementPeriod?: StatementDateRange | null;
  note?: string;
  rows: Array<Pick<TenantLedgerRow, "date" | "kind" | "memo" | "delta" | "runningBalance">>;
  totalDue: number;
  tenantCredit: number;
  readiness?: ReportReadinessSummary;
  generatedAt?: string;
};

export type StatementDateRange = {
  start: string;
  end: string;
};

function monthIso(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthFromDate(dateText: string) {
  return String(dateText || "").slice(0, 7);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function compareIsoDate(a: string, b: string) {
  return a.localeCompare(b);
}

function monthRangeBetween(startDate: string, endDate: string) {
  if (!isIsoDate(startDate) || !isIsoDate(endDate) || compareIsoDate(startDate, endDate) > 0) return [];

  const [startYear, startMonth] = startDate.split("-").map(Number);
  const [endYear, endMonth] = endDate.split("-").map(Number);
  const months: string[] = [];

  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(monthIso(year, month));
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

export function buildOwnerPeriodReport(args: {
  startDate: string;
  endDate: string;
  transactions: Array<Pick<Transaction, "date" | "type" | "amount" | "capitalImprovement" | "propertyId" | "unit">>;
  loanPayments: Array<Pick<LoanPayment, "paymentDate" | "loanId" | "totalPayment">>;
  loans: Array<Pick<Loan, "id" | "propertyId">>;
  propertyId?: string;
  unit?: string;
  usePeriods?: UsePeriod[];
  leases?: Lease[];
  units?: Unit[];
}): OwnerMonthlyReportRow[] {
  const propertyId = args.propertyId || "all";
  const unit = args.unit || "all";
  const usePeriods = args.usePeriods || [];
  const leases = args.leases || [];
  const units = args.units || [];
  const months = monthRangeBetween(args.startDate, args.endDate);
  const rowsByMonth: Record<string, OwnerMonthlyReportRow> = {};

  months.forEach((month) => {
    rowsByMonth[month] = {
      month,
      grossIncome: 0,
      operatingExpenses: 0,
      capex: 0,
      debtService: 0,
      netOperatingIncome: 0,
      cashFlow: 0,
    };
  });

  args.transactions.forEach((txn) => {
    const txnDate = String(txn.date || "");
    if (!isIsoDate(txnDate)) return;
    if (compareIsoDate(txnDate, args.startDate) < 0 || compareIsoDate(txnDate, args.endDate) > 0) return;
    if (propertyId !== "all" && txn.propertyId !== propertyId) return;
    if (unit !== "all" && txn.unit !== unit) return;

    const row = rowsByMonth[monthFromDate(txnDate)];
    if (!row) return;

    if (txn.type === "Income") {
      row.grossIncome += Number(txn.amount || 0);
      return;
    }

    if (txn.type !== "Expense") return;

    if (txn.capitalImprovement) {
      row.capex += Number(txn.amount || 0);
    } else {
      row.operatingExpenses += Number(txn.amount || 0);
    }
  });

  const propertyIdByLoanId = Object.fromEntries(args.loans.map((loan) => [loan.id, loan.propertyId]));

  args.loanPayments.forEach((payment) => {
    const paymentDate = String(payment.paymentDate || "");
    if (!isIsoDate(paymentDate)) return;
    if (compareIsoDate(paymentDate, args.startDate) < 0 || compareIsoDate(paymentDate, args.endDate) > 0) return;

    const linkedPropertyId = propertyIdByLoanId[payment.loanId];
    if (propertyId !== "all" && linkedPropertyId !== propertyId) return;

    const row = rowsByMonth[monthFromDate(paymentDate)];
    if (!row) return;

    const rentalUsePct =
      unit === "all"
        ? getRentalUsePctForDate({
            propertyId: linkedPropertyId,
            unit: "Shared",
            date: paymentDate,
            usePeriods,
            leases,
            units,
            fallbackOwnerUsePct: 0,
          })
        : 1;

    row.debtService += Number(payment.totalPayment || 0) * rentalUsePct;
  });

  const rows = Object.values(rowsByMonth);
  rows.forEach((row) => {
    row.netOperatingIncome = row.grossIncome - row.operatingExpenses;
    row.cashFlow = row.netOperatingIncome - row.capex - row.debtService;
  });

  return rows;
}

export function buildOwnerMonthlyReport(args: {
  year: string | number;
  transactions: Array<Pick<Transaction, "date" | "type" | "amount" | "capitalImprovement" | "propertyId" | "unit">>;
  loanPayments: Array<Pick<LoanPayment, "paymentDate" | "loanId" | "totalPayment">>;
  loans: Array<Pick<Loan, "id" | "propertyId">>;
  propertyId?: string;
  unit?: string;
  usePeriods?: UsePeriod[];
  leases?: Lease[];
  units?: Unit[];
}): OwnerMonthlyReportRow[] {
  const year = Number(args.year);
  return buildOwnerPeriodReport({
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    transactions: args.transactions,
    loanPayments: args.loanPayments,
    loans: args.loans,
    propertyId: args.propertyId,
    unit: args.unit,
    usePeriods: args.usePeriods,
    leases: args.leases,
    units: args.units,
  });
}

export function summarizeOwnerMonthlyReport(rows: OwnerMonthlyReportRow[]): OwnerMonthlyReportTotals {
  return rows.reduce(
    (totals, row) => {
      totals.grossIncome += row.grossIncome;
      totals.operatingExpenses += row.operatingExpenses;
      totals.capex += row.capex;
      totals.debtService += row.debtService;
      totals.netOperatingIncome += row.netOperatingIncome;
      totals.cashFlow += row.cashFlow;
      return totals;
    },
    {
      grossIncome: 0,
      operatingExpenses: 0,
      capex: 0,
      debtService: 0,
      netOperatingIncome: 0,
      cashFlow: 0,
    },
  );
}

function csvCell(value: string | number) {
  const asText = String(value ?? "");
  if (/[,"\n]/.test(asText)) {
    return `"${asText.replace(/"/g, '""')}"`;
  }
  return asText;
}

export function statementDateRangeFromRows(rows: Array<{ date?: string }>) {
  const dates = rows
    .map((row) => String(row?.date || "").trim())
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();

  if (dates.length === 0) return null;

  return {
    start: dates[0],
    end: dates[dates.length - 1],
  } satisfies StatementDateRange;
}

export function ownerStatementActivitySummary(rows: OwnerMonthlyReportRow[]) {
  const activeRows = rows.filter((row) =>
    Number(row.grossIncome || 0) !== 0 ||
    Number(row.operatingExpenses || 0) !== 0 ||
    Number(row.capex || 0) !== 0 ||
    Number(row.debtService || 0) !== 0,
  );

  const totals = summarizeOwnerMonthlyReport(rows);
  const activeMonthCount = activeRows.length;

  return {
    activeMonthCount,
    averageMonthlyIncome: rows.length > 0 ? totals.grossIncome / rows.length : 0,
    averageMonthlyCashFlow: rows.length > 0 ? totals.cashFlow / rows.length : 0,
    period: rows.length > 0 ? {
      start: rows[0]?.month ? `${rows[0].month}-01` : "",
      end: rows[rows.length - 1]?.month ? `${rows[rows.length - 1].month}-31` : "",
    } : null,
  };
}

export function tenantStatementSummary(rows: TenantStatementArgs["rows"]) {
  return rows.reduce(
    (summary, row) => {
      const delta = Number(row.delta || 0);
      if (delta > 0) {
        summary.totalCharges += delta;
      } else if (delta < 0) {
        summary.totalCredits += Math.abs(delta);
      }
      summary.entryCount += 1;
      return summary;
    },
    {
      totalCharges: 0,
      totalCredits: 0,
      entryCount: 0,
      period: statementDateRangeFromRows(rows),
    },
  );
}

export function ownerMonthlyReportCsv(rows: OwnerMonthlyReportRow[], totals?: OwnerMonthlyReportTotals) {
  const summary = totals || summarizeOwnerMonthlyReport(rows);
  const header = ["Month", "Gross Income", "Operating Expenses", "CapEx", "Debt Service", "NOI", "Cash Flow"];

  const body = rows.map((row) => [
    row.month,
    row.grossIncome.toFixed(2),
    row.operatingExpenses.toFixed(2),
    row.capex.toFixed(2),
    row.debtService.toFixed(2),
    row.netOperatingIncome.toFixed(2),
    row.cashFlow.toFixed(2),
  ]);

  body.push([
    "TOTAL",
    summary.grossIncome.toFixed(2),
    summary.operatingExpenses.toFixed(2),
    summary.capex.toFixed(2),
    summary.debtService.toFixed(2),
    summary.netOperatingIncome.toFixed(2),
    summary.cashFlow.toFixed(2),
  ]);

  return [header, ...body].map((line) => line.map(csvCell).join(",")).join("\n");
}

export function ownerStatementCsv(args: {
  year: string | number;
  propertyLabel: string;
  unitLabel: string;
  reportId?: string;
  recipientName?: string;
  preparedBy?: string;
  presetLabel?: string;
  statementPeriod?: StatementDateRange | null;
  note?: string;
  rows: OwnerMonthlyReportRow[];
  totals?: OwnerMonthlyReportTotals;
  readiness?: ReportReadinessSummary;
  generatedAt?: string;
}) {
  const generatedAt = args.generatedAt || new Date().toISOString();
  const summary = args.totals || summarizeOwnerMonthlyReport(args.rows);
  const activity = ownerStatementActivitySummary(args.rows);
  const statementPeriod = args.statementPeriod || activity.period;
  const metadataRows = [
    ["Report", "Owner Statement"],
    ["Report ID", args.reportId || ""],
    ["Year", String(args.year)],
    ["Preset", args.presetLabel || ""],
    ["Property", args.propertyLabel],
    ["Unit", args.unitLabel],
    ["Recipient", args.recipientName || ""],
    ["Prepared By", args.preparedBy || ""],
    ["Generated At", generatedAt],
    ["Statement Period", statementPeriod ? `${statementPeriod.start} to ${statementPeriod.end}` : ""],
    ["Active Months", String(activity.activeMonthCount)],
    ["Average Monthly Income", summary.grossIncome && args.rows.length > 0 ? (summary.grossIncome / args.rows.length).toFixed(2) : "0.00"],
    ["Average Monthly Cash Flow", activity.averageMonthlyCashFlow.toFixed(2)],
    ["Net Cash Flow", summary.cashFlow.toFixed(2)],
    ["Report Contents", "Monthly income, operating expenses, NOI, CapEx, debt service, cash flow"],
    ["Readiness", args.readiness?.label || "Owner-facing summary"],
    ["Open Checks", String(Number(args.readiness?.blockingCount || 0))],
    ["Warnings", String(Number(args.readiness?.warningCount || 0))],
    ["Note", args.note || ""],
  ];

  const monthly = ownerMonthlyReportCsv(args.rows, summary);
  return [...metadataRows.map((line) => line.map(csvCell).join(",")), "", monthly].join("\n");
}

export function ownerStatementEmailSubject(args: Pick<OwnerCommunicationArgs, "propertyLabel" | "unitLabel" | "presetLabel" | "statementPeriodLabel">) {
  const scopeLabel = args.unitLabel && args.unitLabel !== "All units"
    ? `${args.propertyLabel} - ${args.unitLabel}`
    : args.propertyLabel;
  const presetLabel = String(args.presetLabel || "Owner statement").trim();
  const periodLabel = String(args.statementPeriodLabel || "").trim();
  return [scopeLabel, presetLabel, periodLabel].filter(Boolean).join(" | ");
}

export function ownerStatementEmailBody(args: OwnerCommunicationArgs) {
  const recipientName = String(args.recipientName || "Owner").trim() || "Owner";
  const preparedBy = String(args.preparedBy || "Rental Tracker").trim() || "Rental Tracker";
  const presetLabel = String(args.presetLabel || "Owner statement").trim() || "Owner statement";
  const periodLabel = String(args.statementPeriodLabel || "").trim();
  const lines = [
    `Hi ${recipientName},`,
    "",
    `Attached is your ${presetLabel.toLowerCase()} for ${args.propertyLabel}${args.unitLabel && args.unitLabel !== "All units" ? ` (${args.unitLabel})` : ""}.`,
  ];

  if (periodLabel) {
    lines.push(`Statement period: ${periodLabel}`);
  }

  if (args.totals) {
    lines.push(
      `Gross income: ${Number(args.totals.grossIncome || 0).toFixed(2)}`,
      `Operating expenses: ${Number(args.totals.operatingExpenses || 0).toFixed(2)}`,
      `Net cash flow: ${Number(args.totals.cashFlow || 0).toFixed(2)}`,
    );
  }

  if (args.note) {
    lines.push("", String(args.note || "").trim());
  }

  if (Array.isArray(args.attachmentLabels) && args.attachmentLabels.length > 0) {
    lines.push("", "Attachments:");
    args.attachmentLabels.forEach((label) => {
      lines.push(`- ${label}`);
    });
  }

  lines.push("", `Prepared by: ${preparedBy}`);
  if (args.reportId) {
    lines.push(`Statement ID: ${args.reportId}`);
  }
  if (args.recipientPhone) {
    lines.push(`Owner phone: ${args.recipientPhone}`);
  }
  if (args.recipientEmail) {
    lines.push(`Owner email: ${args.recipientEmail}`);
  }
  lines.push("", "Thank you,");
  lines.push(preparedBy);

  return lines.join("\n").trim();
}

export function ownerStatementCommunicationTxt(args: OwnerCommunicationArgs) {
  const subject = ownerStatementEmailSubject(args);
  const body = ownerStatementEmailBody(args);
  const lines = [
    "Owner Statement Communication",
    `To: ${String(args.recipientName || "Owner").trim() || "Owner"}`,
    `Email: ${String(args.recipientEmail || "").trim()}`,
    `Phone: ${String(args.recipientPhone || "").trim()}`,
    `Subject: ${subject}`,
    "",
    body,
  ];

  return lines.join("\n").trim();
}

export function tenantStatementKindLabel(kind: string) {
  if (kind === "charge") return "Charge";
  if (kind === "payment") return "Payment";
  if (kind === "credit") return "Credit";
  if (kind === "refund") return "Refund";
  if (kind === "adjustment") return "Adjustment";
  return kind || "";
}

export function tenantStatementBalanceLabel(balance: number) {
  const numericBalance = Number(balance || 0);
  if (numericBalance < 0) return `Credit ${Math.abs(numericBalance).toFixed(2)}`;
  return numericBalance.toFixed(2);
}

export function tenantStatementCsv(args: TenantStatementArgs) {
  const generatedAt = args.generatedAt || new Date().toISOString();
  const summary = tenantStatementSummary(args.rows);
  const statementPeriod = args.statementPeriod || summary.period;
  const currentBalance = Number(args.tenantCredit || 0) > 0
    ? `Credit ${Number(args.tenantCredit || 0).toFixed(2)}`
    : Number(args.totalDue || 0).toFixed(2);

  const metadataRows = [
    ["Report", "Tenant Statement"],
    ["Report ID", args.reportId || ""],
    ["Tenant", args.tenantName],
    ["Recipient", args.recipientName || args.tenantName],
    ["Prepared By", args.preparedBy || ""],
    ["Preset", args.presetLabel || ""],
    ["Property", args.propertyLabel],
    ["Unit", args.unitLabel],
    ["Lease Start", args.leaseStartDate || ""],
    ["Lease End", args.leaseEndDate || ""],
    ["Generated At", generatedAt],
    ["Statement Period", statementPeriod ? `${statementPeriod.start} to ${statementPeriod.end}` : ""],
    ["Entries", String(summary.entryCount)],
    ["Total Charges", summary.totalCharges.toFixed(2)],
    ["Total Credits", summary.totalCredits.toFixed(2)],
    ["Balance Due", Number(args.totalDue || 0).toFixed(2)],
    ["Tenant Credit", Number(args.tenantCredit || 0).toFixed(2)],
    ["Current Status", currentBalance],
    ["Report Contents", "Tenant ledger charges, payments, credits, refunds, adjustments, running balance"],
    ["Readiness", args.readiness?.label || "Tenant-facing ledger statement"],
    ["Open Checks", String(Number(args.readiness?.blockingCount || 0))],
    ["Warnings", String(Number(args.readiness?.warningCount || 0))],
    ["Note", args.note || ""],
  ];

  const header = ["Date", "Type", "Memo", "Charge", "Credit", "Balance"];
  const body = args.rows.map((row) => [
    row.date,
    tenantStatementKindLabel(row.kind),
    row.memo || "",
    row.delta > 0 ? Number(row.delta || 0).toFixed(2) : "",
    row.delta < 0 ? Math.abs(Number(row.delta || 0)).toFixed(2) : "",
    tenantStatementBalanceLabel(row.runningBalance),
  ]);

  body.push([
    "CURRENT BALANCE",
    "",
    "",
    Number(args.totalDue || 0) > 0 ? Number(args.totalDue || 0).toFixed(2) : "",
    Number(args.tenantCredit || 0) > 0 ? Number(args.tenantCredit || 0).toFixed(2) : "",
    currentBalance,
  ]);

  return [
    ...metadataRows.map((line) => line.map(csvCell).join(",")),
    "",
    header.map(csvCell).join(","),
    ...body.map((line) => line.map(csvCell).join(",")),
  ].join("\n");
}

function signedScheduleAmount(lineId: string, amount: number) {
  const numericAmount = Number(amount || 0);
  if (!numericAmount) return 0;
  return lineId === "rents" || lineId === "rentalIncome" || lineId === "otherIncome" ? numericAmount : -Math.abs(numericAmount);
}

export function scheduleEFriendlyCsv(args: {
  year: string | number;
  propertyLabel: string;
  unitLabel: string;
  rows: ScheduleEFriendlyRow[];
  metrics: ScheduleEFriendlyMetrics;
  propertyWorksheet?: ScheduleEPropertyWorksheet;
  readiness?: ReportReadinessSummary;
  generatedAt?: string;
}) {
  const generatedAt = args.generatedAt || new Date().toISOString();
  const carryoverLoss = Number(args.metrics.carryoverLoss || 0);
  const adjustedScheduleE =
    args.metrics.adjustedScheduleE != null
      ? Number(args.metrics.adjustedScheduleE || 0)
      : Number(args.metrics.scheduleE || 0) - carryoverLoss;

  const metadataRows = [
    ["Report", "Schedule E Friendly Export"],
    ["Year", String(args.year)],
    ["Property", args.propertyLabel],
    ["Unit", args.unitLabel],
    ["Generated At", generatedAt],
    ["Readiness", args.readiness?.label || "Not reviewed"],
    ["Open Checks", String(Number(args.readiness?.blockingCount || 0))],
    ["Source Warnings", String(Number(args.readiness?.warningCount || 0))],
    ["Support Warnings", String(Number(args.readiness?.supportWarningCount || 0))],
    ["Source Rows", String(Number(args.readiness?.sourceRowCount || 0))],
    ["Linked Documents", String(Number(args.readiness?.documentCount || 0))],
    ["Contents", "Schedule E line totals, tie-out totals, property worksheet"],
    ...(Array.isArray(args.readiness?.notes) ? args.readiness.notes.slice(0, 4).map((note, index) => [`Export Note ${index + 1}`, note]) : []),
  ];

  const lineHeader = ["Line ID", "Schedule E line", "Amount", "Source"];
  const lineRows = args.rows.map((row) => [
    row.id,
    row.label,
    signedScheduleAmount(row.id, row.total).toFixed(2),
    row.sourceNote || "",
  ]);

  const tieOutHeader = ["Tie-Out Item", "Amount"];
  const tieOutRows = [
    ["Gross rent", Number(args.metrics.grossRent || 0).toFixed(2)],
    ["Operating expenses", (-Math.abs(Number(args.metrics.opExp || 0))).toFixed(2)],
    ["Mortgage interest", (-Math.abs(Number(args.metrics.deductibleLoanInterest || 0))).toFixed(2)],
    ["Depreciation", (-Math.abs(Number(args.metrics.depreciation || 0))).toFixed(2)],
    ["Schedule E estimate (before carryover)", Number(args.metrics.scheduleE || 0).toFixed(2)],
    ["Prior-year passive loss carryover", (-Math.abs(carryoverLoss)).toFixed(2)],
    ["Schedule E estimate (after carryover)", adjustedScheduleE.toFixed(2)],
  ];
  const propertyWorksheet = args.propertyWorksheet;
  const worksheetPages = propertyWorksheet ? scheduleEWorksheetPages(propertyWorksheet, 3) : [];
  const propertyWorksheetRows = worksheetPages.length
    ? worksheetPages.flatMap((page) => [
        "",
        [page.pageNumber === 1 ? "Schedule E Form Worksheet" : `Schedule E Continuation Worksheet ${page.pageNumber}`],
        ["Form column", ...page.columns.map((column) => `Property ${column.formLabel}`), "Page total"],
        ["App property", ...page.columns.map((column) => `Property ${column.originalLabel}`), ""],
        ["Property", ...page.columns.map((column) => column.propertyName || ""), ""],
        ["Address", ...page.columns.map((column) => column.address || ""), ""],
        ["Fair rental days", ...page.columns.map((column) => String(column.fairRentalDays || "")), ""],
        ["Personal use days", ...page.columns.map((column) => String(column.personalUseDays || "")), ""],
        "",
        ["Line", "Schedule E label", ...page.columns.map((column) => `Property ${column.formLabel}`), "Page total"],
        ...page.rows.map((row) => [
          row.line,
          row.label,
          ...page.columns.map((_, index) => Number(row.values[index] || 0).toFixed(2)),
          Number(row.total || 0).toFixed(2),
        ]),
      ]).map((row) => Array.isArray(row) ? row.map(csvCell).join(",") : row).join("\n")
    : "";

  return [
    ...metadataRows.map((line) => line.map(csvCell).join(",")),
    "",
    lineHeader.map(csvCell).join(","),
    ...lineRows.map((line) => line.map(csvCell).join(",")),
    "",
    tieOutHeader.map(csvCell).join(","),
    ...tieOutRows.map((line) => line.map(csvCell).join(",")),
    propertyWorksheetRows,
  ].join("\n");
}
