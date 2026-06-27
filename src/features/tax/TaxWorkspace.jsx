import React, { useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  ClipboardCheck,
  ClipboardCopy,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Landmark,
  Printer,
  Search,
  TableProperties,
  Wrench,
} from "lucide-react";
import { ResponsiveTableFrame } from "../shared/uiHelpers.jsx";
import { ComputedVsFiledPanel } from "./components/ComputedVsFiledPanel.jsx";
import { TaxDoubleCountingWarningsPanel } from "./components/TaxDoubleCountingWarningsPanel.jsx";
import { TaxCenterOverviewTab } from "./components/TaxCenterOverviewTab.jsx";
import { readinessBadgeClass } from "../shared/auditBadges.js";
import { normalizeReviewRoute, routeForReviewSection } from "../shared/reviewRouting.js";
import { loanIdsMatch } from "../../domain/loans.ts";
import { scheduleEWorksheetPages, scheduleEWorksheetPageText } from "../../domain/reporting.ts";
import { getLoanYearEndReview } from "../loans/loanReview.js";
import { readinessCounts, readinessForScheduleLine, supportBuckets } from "./taxPresentation.js";

const TAX_SOURCE_LABELS = {
  transaction: "From Ledger",
  loan: "From Loans",
  loan_review: "From loan review",
  override: "Manual override",
  asset: "From Assets",
};

const TAX_TAB_META = {
  overview: { label: "Overview", description: "Readiness", icon: ClipboardCheck, tone: "border-teal-200 bg-teal-50 text-teal-700" },
  schedule: { label: "Schedule E", description: "Line totals", icon: FileSpreadsheet, tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  details: { label: "Details", description: "Source rows", icon: TableProperties, tone: "border-blue-200 bg-blue-50 text-blue-700" },
  depreciation: { label: "Depreciation", description: "Asset support", icon: FileText, tone: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  loans: { label: "Loans & Escrow", description: "Interest + escrow", icon: Landmark, tone: "border-sky-200 bg-sky-50 text-sky-700" },
  packet: { label: "Tax Packet", description: "Handoff", icon: Printer, tone: "border-violet-200 bg-violet-50 text-violet-700" },
  tools: { label: "Tools", description: "Optional", icon: Wrench, tone: "border-slate-200 bg-slate-50 text-slate-600" },
};

const TAX_SECTION_CLASS = "space-y-3 rounded-xl border border-slate-200 bg-white p-4";
const TAX_SURFACE_CLASS = "rounded-lg border border-slate-200 bg-slate-50/80 p-3";
const TAX_TILE_CLASS = "rounded-lg border border-slate-200 bg-white p-3";

function scheduleLineStatus(readiness, filedRow) {
  if (filedRow?.status === "needs_note") return { key: "blocking", label: "Blocking", className: readinessBadgeClass("blocking") };
  if (readiness.key === "ready") return { key: "ready", label: "Ready", className: readinessBadgeClass("ready") };
  if (readiness.key === "no_sources") return { key: "no_sources", label: "No sources", className: "" };
  if (readiness.key === "override" || readiness.key === "needs_review") return { key: "needs_review", label: "Needs review", className: readinessBadgeClass("needs_review") };
  return { key: "blocking", label: "Blocking", className: readinessBadgeClass("blocking") };
}

function scheduleLineAmountTone(line, value) {
  const amount = money(value);
  if (amount === 0) return "text-slate-900";
  return line.type === "income" ? "text-emerald-700" : "text-rose-700";
}

function taxDetailStatus(row) {
  if (row.reviewStatus === "reviewed") return { label: row.sourceType === "transaction" ? "Ready" : "Linked", className: "!bg-emerald-50 !text-emerald-700" };
  if (row.documentCount > 0) return { label: "Linked", className: "!bg-blue-50 !text-blue-700" };
  return { label: "Needs review", className: "!bg-amber-100 !text-amber-800" };
}

function compareTaxDetailRows(a, b, sortKey) {
  if (sortKey === "amount_desc") return money(b.deductibleAmount) - money(a.deductibleAmount);
  if (sortKey === "amount_asc") return money(a.deductibleAmount) - money(b.deductibleAmount);
  const aTime = Date.parse(a.date || "") || 0;
  const bTime = Date.parse(b.date || "") || 0;
  return sortKey === "date_asc" ? aTime - bTime : bTime - aTime;
}

function taxSourceLabel(sourceType) {
  return TAX_SOURCE_LABELS[sourceType] || "Source record";
}

function money(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTaxDate(value) {
  if (!value) return "";
  const text = String(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formColumnLabel(index) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < alphabet.length) return alphabet[index];
  return `AA${index - alphabet.length + 1}`;
}

function buildScheduleEPropertyWorksheet({ lineDefs = [], propertyFilter = "all", propertyNameById = {}, taxByPropertySchedule, taxReportingSummary = {}, taxSnapshot = {} }) {
  const detailRows = Object.values(taxReportingSummary.details || {}).flat();
  const propertyColumnsFromSchedule = taxByPropertySchedule?.rows?.[0]?.propertyValues || [];
  const propertyIds = propertyColumnsFromSchedule.length > 0
    ? propertyColumnsFromSchedule.map((entry) => entry.propertyId)
    : Array.from(new Set(detailRows.map((row) => row.propertyId).filter(Boolean)));
  const selectedPropertyIds = propertyIds.length > 0
    ? propertyIds
    : propertyFilter && propertyFilter !== "all"
      ? [propertyFilter]
      : [];
  const selectedProperties = taxSnapshot.selectedProperties || [];
  const useDayRows = taxSnapshot.useDays?.rows || [];
  const columns = selectedPropertyIds.map((propertyId, index) => {
    const property = selectedProperties.find((item) => item.id === propertyId) || {};
    const useRows = useDayRows.filter((row) => row.propertyId === propertyId || row.propertyName === (property.name || propertyNameById[propertyId]));
    return {
      key: propertyId,
      label: formColumnLabel(index),
      propertyId,
      propertyName: property.name || propertyNameById[propertyId] || (propertyId === "all" ? "Unassigned / portfolio" : propertyId),
      address: property.address || "",
      fairRentalDays: useRows.reduce((sum, row) => sum + Number(row.fairRentalDays || 0), 0),
      personalUseDays: useRows.reduce((sum, row) => sum + Number(row.personalUseDays || 0), 0),
    };
  });
  const isSinglePropertyWorksheet = columns.length === 1;
  const rowBelongsToColumn = (row, propertyId) =>
    row.propertyId === propertyId ||
    (propertyId === "all" && (!row.propertyId || row.propertyId === "all")) ||
    (isSinglePropertyWorksheet && (!row.propertyId || row.propertyId === "all"));
  const amountFor = (lineKey, propertyId) => (taxReportingSummary.details?.[lineKey] || [])
    .filter((row) => rowBelongsToColumn(row, propertyId))
    .reduce((sum, row) => sum + money(row.deductibleAmount), 0);
  const lineRows = lineDefs.map((line) => ({
    key: line.key,
    line: line.line,
    label: line.label,
    type: line.type,
    values: columns.map((column) => amountFor(line.key, column.propertyId)),
    total: money(taxReportingSummary.totals?.[line.key]),
  }));
  const expenseLineRows = lineRows.filter((row) => row.type === "expense");
  const totalExpenseValues = columns.map((_, index) => expenseLineRows.reduce((sum, row) => sum + money(row.values[index]), 0));
  const netValues = columns.map((_, index) => (
    lineRows.filter((row) => row.type === "income").reduce((sum, row) => sum + money(row.values[index]), 0) -
    totalExpenseValues[index]
  ));
  return {
    columns,
    rows: [
      ...lineRows,
      { key: "totalExpenses", line: "20", label: "Total expenses. Add lines 5 through 19", type: "expense-total", values: totalExpenseValues, total: money(taxReportingSummary.totalExpenses) },
      { key: "netIncomeLoss", line: "21", label: "Income or (loss). Subtract line 20 from lines 3 and 4", type: "net", values: netValues, total: money(taxReportingSummary.netRentalIncomeLoss) },
    ],
  };
}

function hasMoneyOverride(value) {
  if (value === "" || value == null) return false;
  return Number.isFinite(Number(value));
}

function weightedRentalUsePct(payments = [], getRentalUsePct) {
  if (typeof getRentalUsePct !== "function") return 1;
  let weightedTotal = 0;
  let weightTotal = 0;
  payments.forEach((payment) => {
    const weight = Math.max(0, money(payment.interest));
    if (weight <= 0) return;
    weightedTotal += Math.max(0, Math.min(1, money(getRentalUsePct(payment)))) * weight;
    weightTotal += weight;
  });
  return weightTotal > 0 ? weightedTotal / weightTotal : 1;
}

function LoanYearEndTaxCard({
  currency,
  effectiveLoanPaymentDeductibleInterest,
  effectiveLoanPaymentRentalUsePct,
  loan,
  loanPayments,
  propertyNameById,
  updateLoanYearEndReview,
  yearFilter,
}) {
  const review = getLoanYearEndReview(loan, yearFilter);
  const payments = (loanPayments || []).filter((payment) => loanIdsMatch(payment.loanId, loan.id) && String(payment.paymentDate || "").startsWith(String(yearFilter)));
  const recordedInterest = payments.reduce((sum, payment) => sum + money(payment.interest), 0);
  const computedDeductibleInterest = payments.reduce((sum, payment) => sum + money(effectiveLoanPaymentDeductibleInterest?.(payment) ?? payment.deductibleInterest), 0);
  const rentalUsePct = weightedRentalUsePct(payments, effectiveLoanPaymentRentalUsePct);
  const reviewedEscrow = money(review.escrowPropertyTaxPaid) + money(review.escrowInsurancePaid) + money(review.escrowOtherPaid);
  const reviewedDeductibleInterest = hasMoneyOverride(review.deductibleInterestOverride) ? money(review.deductibleInterestOverride) : computedDeductibleInterest;
  const updateReviewField = (fieldName, value) => {
    updateLoanYearEndReview?.(loan.id, {
      ...review,
      [fieldName]: value,
      reviewedAt: fieldName === "reviewed" && value ? new Date().toISOString() : review.reviewedAt || "",
    });
  };
  const apply1098RentalPortion = () => {
    const form1098Interest = money(review.form1098Interest);
    if (form1098Interest <= 0) return;
    updateLoanYearEndReview?.(loan.id, {
      ...review,
      deductibleInterestOverride: Math.round(form1098Interest * rentalUsePct * 100) / 100,
      reviewNotes: review.reviewNotes || "Deductible interest set from 1098 interest multiplied by rental-use percentage.",
    });
  };
  const field = (label, fieldName, placeholder = "") => (
    <label className="min-w-0 text-xs font-medium text-slate-600">
      <span className="mb-1 block truncate">{label}</span>
      <Input
        className="h-9"
        type="number"
        min="0"
        step="0.01"
        value={review[fieldName] ?? ""}
        placeholder={placeholder}
        onChange={(event) => updateReviewField(fieldName, event.target.value)}
      />
    </label>
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{loan.lender || loan.loanType || "Loan"}</div>
          <div className="mt-1 text-xs text-slate-500">{propertyNameById[loan.propertyId] || loan.propertyId} | {loan.loanType || "Mortgage"}</div>
        </div>
        <Badge variant={review.reviewed ? "outline" : "secondary"} className={review.reviewed ? "!bg-emerald-50 !text-emerald-700" : "!bg-amber-100 !text-amber-800"}>
          {review.reviewed ? "Reviewed" : "Needs review"}
        </Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <div className={TAX_TILE_CLASS}><div className="text-[11px] font-medium uppercase text-slate-500">Recorded interest</div><div className="mt-1 font-semibold text-slate-900">{currency(recordedInterest)}</div></div>
        <div className={TAX_TILE_CLASS}><div className="text-[11px] font-medium uppercase text-slate-500">Rental-use share</div><div className="mt-1 font-semibold text-slate-900">{Math.round(rentalUsePct * 1000) / 10}%</div></div>
        <div className={TAX_TILE_CLASS}><div className="text-[11px] font-medium uppercase text-slate-500">Computed deductible interest</div><div className="mt-1 font-semibold text-slate-900">{currency(reviewedDeductibleInterest)}</div></div>
        <div className={TAX_TILE_CLASS}><div className="text-[11px] font-medium uppercase text-slate-500">Reviewed escrow uses</div><div className="mt-1 font-semibold text-slate-900">{currency(reviewedEscrow)}</div></div>
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <div className="mb-2 text-[11px] font-semibold uppercase text-slate-500">1098 interest review</div>
          <div className="grid gap-2">
            <label className="flex min-h-9 min-w-0 items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700">
              <input type="checkbox" checked={Boolean(review.form1098Received)} onChange={(event) => updateReviewField("form1098Received", event.target.checked)} />
              <span className="truncate">1098 received</span>
            </label>
            {field("1098 interest", "form1098Interest", String(Math.round(recordedInterest * 100) / 100 || ""))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <div className="mb-2 text-[11px] font-semibold uppercase text-slate-500">PMI / points review</div>
          <div className="grid gap-2">
            {field("1098 PMI / MI", "form1098MortgageInsurance")}
            {field("Points", "form1098Points")}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <div className="mb-2 text-[11px] font-semibold uppercase text-slate-500">Escrow tax / insurance review</div>
          <div className="grid gap-2">
            {field("Reviewed escrow tax", "escrowPropertyTaxPaid")}
            {field("Reviewed escrow insurance", "escrowInsurancePaid")}
            {field("Other escrow", "escrowOtherPaid")}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <div className="mb-2 text-[11px] font-semibold uppercase text-slate-500">Override</div>
          {field("Deductible interest override", "deductibleInterestOverride", String(Math.round(computedDeductibleInterest * 100) / 100 || ""))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={apply1098RentalPortion} disabled={money(review.form1098Interest) <= 0}>
          Use 1098 rental portion
        </Button>
        <label className="flex min-h-9 items-center gap-2 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700">
          <input type="checkbox" checked={Boolean(review.reviewed)} onChange={(event) => updateReviewField("reviewed", event.target.checked)} />
          Reviewed
        </label>
        <Input className="min-w-[16rem] flex-1" placeholder="Review notes" value={review.reviewNotes || ""} onChange={(event) => updateReviewField("reviewNotes", event.target.value)} />
      </div>
    </div>
  );
}

export function TaxWorkspace({
  WORKSPACE_FILTER_PANEL_CLASS,
  WORKSPACE_MUTED_PANEL_CLASS,
  WORKSPACE_PANEL_CLASS,
  WORKSPACE_STAT_TILE_CLASS,
  actions,
  applyOwnerStatementNoteTemplate,
  carryoverInputValue,
  carryoverScope,
  clearEscrowDisbursementDraft,
  clearTaxFiledAmountOverride,
  confirmResetTaxDayOverride,
  copyOwnerStatementBody,
  copyOwnerStatementSubject,
  copyTaxReviewNotes,
  createEscrowTransaction,
  currency,
  defaultEscrowLoanOptions,
  deleteEscrowDisbursement,
  editingEscrowDisbursementId,
  effectiveLoanPaymentDeductibleInterest,
  effectiveLoanPaymentRentalUsePct,
  escrowDisbursementDraft,
  escrowDisbursementRows,
  exportOwnerCommunicationBundle,
  exportOwnerReport,
  exportOwnerStatement,
  exportOwnerStatementPdf,
  exportScheduleEFilledPdf,
  exportScheduleEFormFdf,
  exportTaxDetailCsv,
  exportScheduleEReport,
  formatPropertyLabel,
  formatScheduleAmount,
  formatUnitLabel,
  getScheduleAmountTone,
  linkEscrowDisbursementToTransaction,
  loanPayments = [],
  navigateWithDashboardContext,
  openTransaction,
  ownerCommunicationCollapsed,
  ownerMonthlyRows,
  ownerMonthlyTotals,
  ownerStatementCustomEnd,
  ownerStatementCustomStart,
  ownerStatementEmailDraftBody,
  ownerStatementEmailDraftSubject,
  ownerStatementNoteDraft,
  ownerStatementNoteTemplate,
  ownerStatementPeriodLabel,
  ownerStatementPreparedBy,
  ownerStatementPreset,
  ownerStatementRange,
  ownerStatementRecipient,
  ownerStatementRecipientEmail,
  ownerStatementRecipientPhone,
  printOwnerStatement,
  printTaxPacket,
  propertyFilter,
  propertyNameById,
  saveEscrowDisbursement,
  selectedOwnerProperty,
  setCarryoverForScope,
  setEscrowDisbursementDraft,
  setOwnerCommunicationCollapsed,
  setOwnerStatementCustomEnd,
  setOwnerStatementCustomStart,
  setOwnerStatementNoteDraft,
  setOwnerStatementNoteMode,
  setOwnerStatementNoteTemplate,
  setOwnerStatementPreset,
  setTaxDayOverride,
  setTaxFiledAmountOverride,
  setTaxFiledAmountOverrideNote,
  setTaxPrintDialogOpen,
  setTaxPrintProperty,
  setTaxPrintScope,
  setTaxPrintUnit,
  setTaxReviewCollapsed,
  setTaxReviewMode,
  setTaxReviewNotesCollapsed,
  startEditEscrowDisbursement,
  taxByPropertySchedule,
  taxByUnitSchedule,
  taxEscrowWarnings,
  taxFiledAmountOverrideInput,
  taxReviewCollapsed,
  taxReviewCpaNotes,
  taxReviewMode,
  taxReviewNotesCollapsed,
  taxReviewOpenCount,
  taxReviewSections,
  taxPacketSummary,
  taxReadinessSummary,
  taxReportingSummary,
  taxScheduleBreakdown,
  taxSnapshot,
  unitFilter,
  updateLoanYearEndReview,
  visibleLoans = [],
  yearFilter,
}) {
  const [activeTaxTab, setActiveTaxTab] = useState("overview");
  const [detailsLineFilter, setDetailsLineFilter] = useState("all");
  const [detailsSearch, setDetailsSearch] = useState("");
  const [detailsPropertyFilter, setDetailsPropertyFilter] = useState("all");
  const [detailsSort, setDetailsSort] = useState("date_desc");
  const [detailsPageSize, setDetailsPageSize] = useState(25);
  const [detailsPage, setDetailsPage] = useState(1);
  const [showZeroScheduleLines, setShowZeroScheduleLines] = useState(true);
  const [copiedScheduleEPage, setCopiedScheduleEPage] = useState(null);
  const taxTabs = ["overview", "schedule", "details", "depreciation", "loans", "packet", "tools"];
  const taxLineDefs = taxReportingSummary?.lineDefs || [];
  const scheduleLineDefs = showZeroScheduleLines ? taxLineDefs : taxLineDefs.filter((line) => money(taxReportingSummary?.totals?.[line.key] || 0) !== 0);
  const scheduleEPropertyWorksheet = buildScheduleEPropertyWorksheet({ lineDefs: taxLineDefs, propertyFilter, propertyNameById, taxByPropertySchedule, taxReportingSummary, taxSnapshot });
  const scheduleEWorksheetPageGroups = scheduleEWorksheetPages(scheduleEPropertyWorksheet, 3);
  const taxPacketOpenItems = taxPacketSummary?.openItems || [];
  const taxReadinessCounts = readinessCounts({ taxPacketSummary, taxReadinessSummary, taxReportingSummary });
  const taxPacketSupportBuckets = supportBuckets(taxPacketSummary?.documentChecklist || {}).filter((bucket) => bucket.rows.length > 0);
  const taxPacketNeedsNotes = (taxReportingSummary?.computedFiledRows || []).filter((row) => row.status === "needs_note");
  const taxPacketNeedsCleanup = taxPacketOpenItems.length > 0 || taxPacketNeedsNotes.length > 0;
  const taxSourceRowCount = Object.values(taxReportingSummary?.details || {}).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
  const taxPacketContents = [
    { label: "Schedule E lines", value: taxLineDefs.length, helper: `${taxSourceRowCount} source row${taxSourceRowCount === 1 ? "" : "s"}` },
    { label: "Property worksheets", value: scheduleEWorksheetPageGroups.length, helper: `${scheduleEPropertyWorksheet.columns.length} propert${scheduleEPropertyWorksheet.columns.length === 1 ? "y" : "ies"}` },
    { label: "Linked support", value: taxPacketSummary?.documentChecklist?.linkedDocumentCount || 0, helper: `${taxPacketSummary?.documentChecklist?.missingSupportCount || 0} missing support` },
    { label: "Review notes", value: taxPacketNeedsNotes.length, helper: taxPacketNeedsNotes.length > 0 ? "Filed differences need notes" : "No note blockers" },
  ];
  const hasTaxCleanupWork = taxReviewOpenCount > 0 || taxReadinessCounts.blockingIssues > 0 || taxReadinessCounts.sourceWarnings > 0 || taxReadinessCounts.supportWarnings > 0;
  const taxPacketStatusLabel = taxPacketNeedsCleanup
    ? "Needs cleanup first"
    : taxReadinessCounts.supportWarnings > 0
      ? "Missing support"
      : "Ready to print";
  const taxPacketStatusClass = taxPacketNeedsCleanup
    ? "border-amber-200 bg-amber-50 text-amber-900"
    : taxReadinessCounts.supportWarnings > 0
      ? "border-blue-200 bg-blue-50 text-blue-900"
      : "border-emerald-200 bg-emerald-50 text-emerald-900";
  const loanEscrowWarnings = (taxReportingSummary?.doubleCountingWarnings || []).filter((warning) =>
    warning.key === "escrow_tax_possible_duplicate" ||
    warning.key === "escrow_insurance_possible_duplicate" ||
    warning.key === "mortgage_interest_override_active"
  );
  const openDetailsForLine = (lineKey) => {
    setDetailsLineFilter(lineKey);
    setActiveTaxTab("details");
  };
  const openTaxSourceRow = (row) => {
    if (row.actionTarget === "ledger" && row.source) {
      openTransaction(row.source);
      return;
    }
    if (row.actionTarget) {
      navigateWithDashboardContext(row.actionTarget);
    }
  };
  const openReviewRoute = (target) => {
    const route = normalizeReviewRoute(target);
    navigateWithDashboardContext(route);
  };
  const copyScheduleEPageTotals = async (page) => {
    const text = scheduleEWorksheetPageText(page);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (typeof document !== "undefined") {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.left = "-9999px";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      setCopiedScheduleEPage(page.pageNumber);
      if (typeof window !== "undefined") window.setTimeout(() => setCopiedScheduleEPage((current) => current === page.pageNumber ? null : current), 2000);
    } catch {
      setCopiedScheduleEPage("failed");
      if (typeof window !== "undefined") window.setTimeout(() => setCopiedScheduleEPage(null), 2000);
    }
  };

  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="space-y-4 !p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge variant={taxReportingSummary?.status === "preliminary" ? "secondary" : "outline"} className={taxReportingSummary?.status === "preliminary" ? "!bg-amber-100 !text-amber-800" : "!bg-emerald-50 !text-emerald-700"}>
              {taxReportingSummary?.status === "preliminary" ? "Preliminary" : "Reviewed"}
            </Badge>
            <span>{yearFilter} tax year | {formatPropertyLabel(propertyFilter)} | {formatUnitLabel(unitFilter)}</span>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <Badge variant="secondary" className={taxReadinessCounts.blockingIssues > 0 ? "!bg-rose-100 !text-rose-700" : "!bg-emerald-50 !text-emerald-700"}>{taxReadinessCounts.blockingIssues} blocking</Badge>
            <Badge variant="secondary" className={taxReadinessCounts.sourceWarnings > 0 ? "!bg-amber-100 !text-amber-800" : ""}>{taxReadinessCounts.sourceWarnings} source warnings</Badge>
            <Badge variant="secondary" className={taxReadinessCounts.supportWarnings > 0 ? "!bg-blue-100 !text-blue-700" : ""}>{taxReadinessCounts.supportWarnings} support warnings</Badge>
            {activeTaxTab !== "schedule" ? (
              <Button size="sm" variant="secondary" className="w-full gap-2 sm:w-auto" onClick={exportScheduleEReport}>
                <FileSpreadsheet className="h-4 w-4" />
                Export Schedule E
              </Button>
            ) : null}
            {activeTaxTab !== "details" ? (
              <Button size="sm" variant="secondary" className="w-full gap-2 sm:w-auto" onClick={exportTaxDetailCsv}>
                <Download className="h-4 w-4" />
                Export details
              </Button>
            ) : null}
            {activeTaxTab === "schedule" ? (
              <Button size="sm" variant="secondary" className="w-full gap-2 sm:w-auto" onClick={exportScheduleEFilledPdf}>
                <FileText className="h-4 w-4" />
                Print filled Schedule E
              </Button>
            ) : null}
            {activeTaxTab !== "packet" ? (
              <Button className="h-10 w-full gap-2 px-4 text-sm font-semibold shadow-sm sm:w-auto" onClick={() => { setTaxPrintScope("current"); setTaxPrintProperty(propertyFilter); setTaxPrintUnit(unitFilter); setTaxPrintDialogOpen(true); }}>
                <Printer className="h-4 w-4" />
                Print
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-1.5 text-sm sm:grid-cols-2 xl:grid-cols-7">
          {taxTabs.map((key) => {
            const tab = TAX_TAB_META[key];
            const Icon = tab.icon;
            const isToolsTab = key === "tools";
            return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTaxTab(key)}
              className={`flex min-h-[48px] items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${activeTaxTab === key ? "border-slate-900 bg-slate-900 text-white shadow-sm" : isToolsTab ? "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-800" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950"}`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${activeTaxTab === key ? "border-white/20 bg-white/10 text-white" : tab.tone}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold">{tab.label}</span>
                <span className={`block truncate text-[11px] ${activeTaxTab === key ? "text-slate-200" : "text-slate-500"}`}>{tab.description}</span>
              </span>
            </button>
          );})}
        </div>

        {activeTaxTab === "overview" ? (
          <TaxCenterOverviewTab
            WORKSPACE_STAT_TILE_CLASS={WORKSPACE_STAT_TILE_CLASS}
            currency={currency}
            exportTaxDetailCsv={exportTaxDetailCsv}
            goToTab={setActiveTaxTab}
            navigateWithDashboardContext={navigateWithDashboardContext}
            printTaxPacket={printTaxPacket}
            taxPacketSummary={taxPacketSummary}
            taxReadinessSummary={taxReadinessSummary}
            taxReportingSummary={taxReportingSummary}
            taxSnapshot={taxSnapshot}
          />
        ) : null}

        {activeTaxTab === "schedule" ? (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className={TAX_SECTION_CLASS}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-slate-900">Schedule E - Computed line totals</div>
                  <div className="mt-1 text-sm text-slate-600">Computed totals from source records for the selected filing scope.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" className="gap-2" onClick={exportScheduleEReport}>
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button size="sm" variant="secondary" className="gap-2" onClick={exportScheduleEFormFdf}>
                    <FileText className="h-4 w-4" />
                    Export IRS form data
                  </Button>
                  <Button size="sm" variant="secondary" className="gap-2" onClick={exportScheduleEFilledPdf}>
                    <Printer className="h-4 w-4" />
                    Print filled Schedule E
                  </Button>
                  <label className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700">
                    <input type="checkbox" className="h-3.5 w-3.5" checked={showZeroScheduleLines} onChange={(event) => setShowZeroScheduleLines(event.target.checked)} />
                    Show $0 lines
                  </label>
                </div>
              </div>

              <ResponsiveTableFrame
                minWidthClass="min-w-[900px]"
                hint="Swipe to review Schedule E line totals, source counts, readiness, and source actions."
                mobileCards={scheduleLineDefs.map((line, index) => {
                  const rows = taxReportingSummary?.details?.[line.key] || [];
                  const filedRow = (taxReportingSummary?.computedFiledRows || []).find((row) => row.field === (line.key === "taxes" ? "propertyTaxes" : line.key));
                  const readiness = readinessForScheduleLine({ line, rows, filedRow });
                  const status = scheduleLineStatus(readiness, filedRow);
                  const amount = taxReportingSummary?.totals?.[line.key] || 0;
                  return (
                    <div key={`schedule-mobile-${line.key}`} className={TAX_SURFACE_CLASS}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase text-slate-500">Line {line.line || index + 1}</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">{line.label}</div>
                          <div className="mt-1 text-xs text-slate-500">{rows.length} source row{rows.length === 1 ? "" : "s"}</div>
                        </div>
                        <div className={`text-right text-sm font-semibold ${scheduleLineAmountTone(line, amount)}`}>{currency(amount)}</div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className={status.className}>{status.label}</Badge>
                        <Button size="sm" variant="secondary" onClick={() => openDetailsForLine(line.key)} disabled={rows.length === 0}>View sources</Button>
                      </div>
                    </div>
                  );
                })}
              >
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="w-14 px-3 py-2 text-left">Line</th>
                      <th className="px-3 py-2 text-left">Schedule E category</th>
                      <th className="px-3 py-2 text-right">Computed amount</th>
                      <th className="px-3 py-2 text-left">Source rows</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                    {scheduleLineDefs.map((line, index) => {
                      const rows = taxReportingSummary?.details?.[line.key] || [];
                      const filedRow = (taxReportingSummary?.computedFiledRows || []).find((row) => row.field === (line.key === "taxes" ? "propertyTaxes" : line.key));
                      const readiness = readinessForScheduleLine({ line, rows, filedRow });
                      const status = scheduleLineStatus(readiness, filedRow);
                      const amount = taxReportingSummary?.totals?.[line.key] || 0;
                      return (
                        <tr key={`schedule-line-${line.key}`}>
                          <td className="px-3 py-2 font-medium text-slate-600">{line.line || index + 1}</td>
                          <td className="px-3 py-2 font-medium text-slate-800">{line.label}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${scheduleLineAmountTone(line, amount)}`}>{currency(amount)}</td>
                          <td className="px-3 py-2">{rows.length}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <Badge variant="secondary" className={status.className}>{status.label}</Badge>
                              {status.key === "needs_review" ? <Info className="h-3.5 w-3.5 text-slate-500" /> : null}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button size="sm" variant="secondary" onClick={() => openDetailsForLine(line.key)} disabled={rows.length === 0}>View sources</Button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-50 font-semibold text-slate-900">
                      <td className="px-3 py-2">20</td>
                      <td className="px-3 py-2">Total expenses. Add lines 5 through 19</td>
                      <td className="px-3 py-2 text-right">{currency(taxReportingSummary?.totalExpenses || 0)}</td>
                      <td className="px-3 py-2">{Object.values(taxReportingSummary?.details || {}).reduce((sum, rows) => sum + rows.length, 0)}</td>
                      <td className="px-3 py-2" colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              </ResponsiveTableFrame>

              <details className="rounded-lg border border-amber-200 bg-amber-50/40">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3">
                  <span>
                    <span className="block text-sm font-semibold text-amber-900">Computed vs filed amounts</span>
                    <span className="mt-0.5 block text-xs text-amber-800">Compare computed amounts to filed amounts or overrides. Add notes where needed.</span>
                  </span>
                  <span className="inline-flex h-8 items-center gap-2 rounded-md border border-amber-200 bg-white px-3 text-xs font-medium text-slate-700">
                    <TableProperties className="h-4 w-4" />
                    View comparison
                  </span>
                </summary>
                <div className="border-t border-amber-200 bg-white p-3">
                  <ComputedVsFiledPanel carryoverScope={carryoverScope} currency={currency} rows={taxReportingSummary?.computedFiledRows || []} setTaxFiledAmountOverrideNote={setTaxFiledAmountOverrideNote} />
                </div>
              </details>

              <div className="rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <div>
                    <div className="text-base font-semibold text-slate-900">Schedule E form worksheet</div>
                    <div className="mt-1 text-xs text-slate-500">Copy these property groups into Schedule E Part I. Each page uses columns A-C; properties after the third are shown as continuation pages.</div>
                    {scheduleEPropertyWorksheet.columns.length > 3 ? (
                      <div className="mt-1 text-xs text-amber-700">PDF data export fills the first Schedule E page. Use the CSV/worksheet continuation pages for additional properties.</div>
                    ) : null}
                  </div>
                  <Badge variant="secondary">{scheduleEPropertyWorksheet.columns.length} propert{scheduleEPropertyWorksheet.columns.length === 1 ? "y" : "ies"}</Badge>
                </div>
                {scheduleEPropertyWorksheet.columns.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    <div className="font-medium text-slate-700">No property columns available.</div>
                    <div className="mt-1 text-xs text-slate-500">Add property-linked tax source rows before using the form worksheet.</div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 p-3">
                      {scheduleEWorksheetPageGroups.map((page) => (
                        <div key={`schedule-e-page-${page.pageNumber}`} className="rounded-lg border border-slate-200 bg-white">
                          <div className="border-b border-slate-100 px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-slate-900">
                                {page.pageNumber === 1 ? "Schedule E page 1" : `Continuation page ${page.pageNumber}`}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-xs text-slate-500">
                                  Use form columns A-C for these {page.columns.length} propert{page.columns.length === 1 ? "y" : "ies"}.
                                </div>
                                <Button size="sm" variant="secondary" className="h-8 gap-1.5" onClick={() => copyScheduleEPageTotals(page)}>
                                  <ClipboardCopy className="h-3.5 w-3.5" />
                                  {copiedScheduleEPage === page.pageNumber ? "Copied" : "Copy page totals"}
                                </Button>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                              {page.columns.map((column) => (
                                <span key={`page-map-${page.pageNumber}-${column.originalLabel}`} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                                  <strong className="text-slate-900">{column.formLabel}:</strong> {column.propertyName}
                                  {column.originalLabel !== column.formLabel ? <span className="text-slate-400"> (app {column.originalLabel})</span> : null}
                                  <span className="text-slate-400"> | {column.fairRentalDays || "-"} rental / {column.personalUseDays || "-"} personal days</span>
                                </span>
                              ))}
                            </div>
                          </div>
                          <ResponsiveTableFrame minWidthClass="min-w-[760px]" hint="Swipe to copy IRS Schedule E property columns.">
                            <table className="min-w-full text-xs">
                              <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                                <tr>
                                  <th className="w-14 px-3 py-2 text-left">Line</th>
                                  <th className="px-3 py-2 text-left">Form label</th>
                                  {page.columns.map((column) => (
                                    <th key={`form-head-${page.pageNumber}-${column.originalLabel}`} className="px-3 py-2 text-right">
                                      Property {column.formLabel}
                                      {column.originalLabel !== column.formLabel ? <span className="block normal-case text-[10px] font-medium text-slate-400">App {column.originalLabel}</span> : null}
                                    </th>
                                  ))}
                                  <th className="px-3 py-2 text-right">Page total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {page.rows.map((row) => (
                                  <tr key={`form-row-${page.pageNumber}-${row.key}`} className={row.key === "totalExpenses" || row.key === "netIncomeLoss" ? "bg-slate-50 font-semibold text-slate-900" : ""}>
                                    <td className="px-3 py-2 font-medium text-slate-600">{row.line}</td>
                                    <td className="px-3 py-2 text-slate-800">{row.label}</td>
                                    {row.values.map((value, index) => (
                                      <td key={`${row.key}-${page.columns[index]?.originalLabel}`} className={`px-3 py-2 text-right font-medium ${row.type === "income" || row.type === "net" ? (money(value) < 0 ? "text-rose-700" : "text-emerald-700") : money(value) > 0 ? "text-rose-700" : "text-slate-700"}`}>
                                        {currency(value)}
                                      </td>
                                    ))}
                                    <td className={`px-3 py-2 text-right font-semibold ${row.type === "income" || row.type === "net" ? (money(row.total) < 0 ? "text-rose-700" : "text-emerald-700") : money(row.total) > 0 ? "text-rose-700" : "text-slate-900"}`}>{currency(row.total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </ResponsiveTableFrame>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <aside className="space-y-3">
              <div className={TAX_SECTION_CLASS}>
                <div className="text-base font-semibold text-slate-900">Schedule E summary</div>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3"><span className="text-slate-600">Total income</span><span className="font-semibold text-slate-900">{currency(taxReportingSummary?.totalIncome || 0)}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-slate-600">Total expenses</span><span className="font-semibold text-rose-700">{currency(taxReportingSummary?.totalExpenses || 0)}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-slate-600">Net rental income (loss)</span><span className={`font-semibold ${scheduleLineAmountTone({ type: "expense" }, taxReportingSummary?.netRentalIncomeLoss || 0)}`}>{currency(taxReportingSummary?.netRentalIncomeLoss || 0)}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-slate-600">Net before passive limitation</span><span className={`font-semibold ${scheduleLineAmountTone({ type: "expense" }, taxReportingSummary?.netRentalIncomeLoss || 0)}`}>{currency(taxReportingSummary?.netRentalIncomeLoss || 0)}</span></div>
                </div>
              </div>

              <div className={TAX_SECTION_CLASS}>
                <div className="text-base font-semibold text-slate-900">Line status summary</div>
                {(() => {
                  const statusCounts = taxLineDefs.reduce((acc, line) => {
                    const rows = taxReportingSummary?.details?.[line.key] || [];
                    const filedRow = (taxReportingSummary?.computedFiledRows || []).find((row) => row.field === (line.key === "taxes" ? "propertyTaxes" : line.key));
                    const readiness = readinessForScheduleLine({ line, rows, filedRow });
                    const status = scheduleLineStatus(readiness, filedRow);
                    acc[status.key] = (acc[status.key] || 0) + 1;
                    return acc;
                  }, {});
                  const summaryRows = [
                    { key: "ready", label: "Ready", count: statusCounts.ready || 0, className: "text-emerald-700" },
                    { key: "needs_review", label: "Needs review", count: statusCounts.needs_review || 0, className: "text-amber-700" },
                    { key: "no_sources", label: "No sources", count: statusCounts.no_sources || 0, className: "text-slate-600" },
                    { key: "blocking", label: "Blocking", count: statusCounts.blocking || 0, className: "text-rose-700" },
                  ];
                  return (
                    <div className="mt-3 space-y-3">
                      {summaryRows.map((row) => (
                        <div key={row.key} className="flex items-center justify-between gap-3 text-sm">
                          <span className={`font-medium ${row.className}`}>{row.label}</span>
                          <span className={`font-semibold ${row.className}`}>{row.count}</span>
                        </div>
                      ))}
                      <div className="border-t border-slate-200 pt-3">
                        <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-900">
                          <span>Total lines</span>
                          <span>{taxLineDefs.length}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </aside>
          </div>
        ) : null}

        {activeTaxTab === "details" ? (
          (() => {
            const allDetailRows = taxLineDefs.flatMap((line) => (taxReportingSummary?.details?.[line.key] || []).map((row) => ({ ...row, line })));
            const selectedLine = detailsLineFilter === "all" ? null : taxLineDefs.find((line) => line.key === detailsLineFilter);
            const scopedRows = allDetailRows
              .filter((row) => detailsLineFilter === "all" || row.line.key === detailsLineFilter)
              .filter((row) => detailsPropertyFilter === "all" || row.propertyId === detailsPropertyFilter)
              .filter((row) => {
                const query = detailsSearch.trim().toLowerCase();
                if (!query) return true;
                return [
                  row.description,
                  row.date,
                  row.line.label,
                  propertyNameById[row.propertyId] || row.propertyId,
                  row.unit,
                  taxSourceLabel(row.sourceType),
                ].join(" ").toLowerCase().includes(query);
              })
              .sort((a, b) => compareTaxDetailRows(a, b, detailsSort));
            const totalPages = Math.max(1, Math.ceil(scopedRows.length / detailsPageSize));
            const currentPage = Math.min(detailsPage, totalPages);
            const pageRows = scopedRows.slice((currentPage - 1) * detailsPageSize, currentPage * detailsPageSize);
            const selectedTotal = scopedRows.reduce((sum, row) => sum + money(row.deductibleAmount), 0);
            const reviewedCount = scopedRows.filter((row) => row.reviewStatus === "reviewed").length;
            const openIssueCount = scopedRows.filter((row) => row.reviewStatus !== "reviewed").length;
            const linkedAmount = scopedRows.filter((row) => row.reviewStatus === "reviewed" || row.documentCount > 0).reduce((sum, row) => sum + money(row.deductibleAmount), 0);
            const linkedPct = selectedTotal > 0 ? Math.round((linkedAmount / selectedTotal) * 100) : 0;
            const selectedLabel = selectedLine?.label || "All lines";
            const propertyOptions = [...new Map(allDetailRows.map((row) => [row.propertyId, propertyNameById[row.propertyId] || row.propertyId])).entries()].filter(([id]) => id);

            return (
              <div className={TAX_SECTION_CLASS}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-slate-900">Details</div>
                    <div className="mt-1 text-sm text-slate-600">Expandable source rows behind each Schedule E line. Use filters to focus on categories and review source transactions.</div>
                  </div>
                  <Button size="sm" variant="secondary" className="gap-2" onClick={exportTaxDetailCsv}>
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${detailsLineFilter === "all" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}
                    onClick={() => { setDetailsLineFilter("all"); setDetailsPage(1); }}
                  >
                    All lines
                  </button>
                  {taxLineDefs.map((line) => {
                    const rows = taxReportingSummary?.details?.[line.key] || [];
                    return (
                      <button
                        key={`details-filter-${line.key}`}
                        type="button"
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium ${detailsLineFilter === line.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}
                        onClick={() => { setDetailsLineFilter(line.key); setDetailsPage(1); }}
                      >
                        {line.label}: {rows.length}
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_180px_180px_auto]">
                    <label className="relative block">
                      <span className="sr-only">Search source rows</span>
                      <Input className="h-10 pr-9" placeholder="Search source rows..." value={detailsSearch} onChange={(event) => { setDetailsSearch(event.target.value); setDetailsPage(1); }} />
                      <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-500" />
                    </label>
                    <label className="text-[11px] font-medium text-slate-500">
                      Property / Unit
                      <select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700" value={detailsPropertyFilter} onChange={(event) => { setDetailsPropertyFilter(event.target.value); setDetailsPage(1); }}>
                        <option value="all">All properties</option>
                        {propertyOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                      </select>
                    </label>
                    <label className="text-[11px] font-medium text-slate-500">
                      Sort by
                      <select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700" value={detailsSort} onChange={(event) => setDetailsSort(event.target.value)}>
                        <option value="date_desc">Date (newest)</option>
                        <option value="date_asc">Date (oldest)</option>
                        <option value="amount_desc">Amount (high)</option>
                        <option value="amount_asc">Amount (low)</option>
                      </select>
                    </label>
                    <Button size="icon" variant="secondary" className="h-10 w-10 self-end" aria-label="Source row list view">
                      <TableProperties className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 xl:grid-cols-[310px_minmax(0,1fr)]">
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                      <span>Schedule E categories</span>
                      <span>Total</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {taxLineDefs.map((line) => {
                        const rows = taxReportingSummary?.details?.[line.key] || [];
                        const total = taxReportingSummary?.totals?.[line.key] || 0;
                        const active = detailsLineFilter === line.key;
                        return (
                          <button key={`details-side-${line.key}`} type="button" className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition ${active ? "border-l-4 border-blue-600 bg-blue-50" : "border-l-4 border-transparent hover:bg-slate-50"}`} onClick={() => { setDetailsLineFilter(line.key); setDetailsPage(1); }}>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-slate-900">{line.label}</span>
                              <span className="mt-0.5 block text-xs text-slate-500">{rows.length} source row{rows.length === 1 ? "" : "s"}</span>
                            </span>
                            <span className={`shrink-0 text-sm font-semibold ${scheduleLineAmountTone(line, total)}`}>{currency(total)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                      <div className="text-sm font-semibold text-slate-900">
                        Source rows for: <span className="text-blue-700">{selectedLabel}</span>
                        <Badge variant="secondary" className="ml-2 !bg-blue-50 !text-blue-700">{scopedRows.length} rows</Badge>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        Show
                        <select className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs" value={detailsPageSize} onChange={(event) => { setDetailsPageSize(Number(event.target.value)); setDetailsPage(1); }}>
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                        </select>
                        rows
                      </label>
                    </div>
                    <ResponsiveTableFrame minWidthClass="min-w-[880px]" hint="Swipe to review source rows, status, and source actions.">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Source / Description</th>
                            <th className="px-3 py-2 text-left">Property / Unit</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                          {pageRows.map((row) => {
                            const status = taxDetailStatus(row);
                            return (
                              <tr key={`detail-row-${row.id}`}>
                                <td className="whitespace-nowrap px-3 py-2 text-sm text-slate-700">{formatTaxDate(row.date) || "No date"}</td>
                                <td className="px-3 py-2">
                                  <div className="text-sm font-medium text-slate-900">{row.description}</div>
                                  <div className="mt-0.5 text-xs text-slate-500">{taxSourceLabel(row.sourceType)} | {row.line.label}</div>
                                </td>
                                <td className="px-3 py-2 text-sm">
                                  <div>{propertyNameById[row.propertyId] || row.propertyId}</div>
                                  <div className="text-xs text-slate-500">{row.unit && row.unit !== "Shared" ? `Unit ${row.unit}` : "Property"}</div>
                                </td>
                                <td className={`px-3 py-2 text-right text-sm font-semibold ${scheduleLineAmountTone(row.line, row.deductibleAmount)}`}>{currency(row.deductibleAmount)}</td>
                                <td className="px-3 py-2"><Badge variant="secondary" className={status.className}>{status.label}</Badge></td>
                                <td className="px-3 py-2 text-right">
                                  <div className="flex justify-end gap-1.5">
                                    {row.actionTarget ? <Button size="sm" variant="secondary" onClick={() => openTaxSourceRow(row)}>View source</Button> : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {pageRows.length === 0 ? (
                            <tr>
                              <td className="px-3 py-8 text-center text-sm text-slate-500" colSpan={6}>
                                <div className="font-medium text-slate-700">No source rows match this view.</div>
                                <div className="mt-1 text-xs text-slate-500">Adjust filters or check Schedule E categories with source counts.</div>
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </ResponsiveTableFrame>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
                      <span>Showing {scopedRows.length === 0 ? 0 : (currentPage - 1) * detailsPageSize + 1} to {Math.min(currentPage * detailsPageSize, scopedRows.length)} of {scopedRows.length} rows</span>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="secondary" disabled={currentPage <= 1} onClick={() => setDetailsPage((page) => Math.max(1, page - 1))}>Prev</Button>
                        <Badge variant="secondary">{currentPage}</Badge>
                        <Button size="sm" variant="secondary" disabled={currentPage >= totalPages} onClick={() => setDetailsPage((page) => Math.min(totalPages, page + 1))}>Next</Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 xl:grid-cols-[minmax(0,1fr)_400px]">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Selection summary</div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-4">
                      <div><div className="text-[11px] font-semibold uppercase text-slate-500">Total amount</div><div className={`mt-1 text-base font-semibold ${scheduleLineAmountTone(selectedLine || { type: "income" }, selectedTotal)}`}>{currency(selectedTotal)}</div></div>
                      <div><div className="text-[11px] font-semibold uppercase text-slate-500">Reviewed rows</div><div className="mt-1 text-base font-semibold text-slate-900">{reviewedCount} / {scopedRows.length} {scopedRows.length > 0 ? `(${Math.round((reviewedCount / scopedRows.length) * 100)}%)` : ""}</div></div>
                      <div><div className="text-[11px] font-semibold uppercase text-slate-500">Open issues</div><div className="mt-1 text-base font-semibold text-amber-700">{openIssueCount} row{openIssueCount === 1 ? "" : "s"}</div></div>
                      <div><div className="text-[11px] font-semibold uppercase text-slate-500">Linked to Schedule E</div><div className="mt-1 text-base font-semibold text-blue-700">{currency(linkedAmount)} ({linkedPct}%)</div></div>
                    </div>
                  </div>
                  <div className={`rounded-lg border p-3 ${openIssueCount > 0 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
                    <div className="text-sm font-semibold">{openIssueCount > 0 ? "Source cleanup needed" : "Source rows look ready"}</div>
                    <div className="mt-1 text-xs">{openIssueCount > 0 ? `${openIssueCount} row${openIssueCount === 1 ? "" : "s"} still needs review or missing source.` : "All rows in this selection are reviewed or linked."}</div>
                    {openIssueCount > 0 ? <Button size="sm" variant="secondary" className="mt-3" onClick={() => navigateWithDashboardContext("review")}>Open Review Center</Button> : null}
                  </div>
                </div>
              </div>
            );
          })()
        ) : null}

        {activeTaxTab === "depreciation" ? (
          (() => {
            const depreciationAssets = taxSnapshot.depreciationAssets || [];
            const assetReviewCount = taxReadinessSummary?.sections?.find((section) => section.key === "assets")?.reviewCount || 0;
            const missingSourceCount = depreciationAssets.filter((asset) => {
              const hasSource = Boolean(asset.sourceTransactionId || asset.sourceWorkOrderId || (Array.isArray(asset.sourceDocumentIds) && asset.sourceDocumentIds.length));
              return !(asset.assetReviewChecked || hasSource);
            }).length;

            return (
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className={TAX_SECTION_CLASS}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-slate-900">Depreciation support</div>
                      <div className="mt-1 text-sm text-slate-600">Asset source rows and current-year depreciation for the selected filing scope.</div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => navigateWithDashboardContext("assets")}>Open Assets</Button>
                  </div>
                  <ResponsiveTableFrame className="mt-2" minWidthClass="min-w-[880px]" hint="Swipe to review asset depreciation support.">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase">Property / unit</th>
                          <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase">Asset</th>
                          <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase">Placed in service</th>
                          <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase">Status</th>
                          <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase">Basis</th>
                          <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase">Current-year dep.</th>
                          <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {depreciationAssets.map((asset) => {
                          const hasSource = Boolean(asset.sourceTransactionId || asset.sourceWorkOrderId || (Array.isArray(asset.sourceDocumentIds) && asset.sourceDocumentIds.length));
                          const taxReady = asset.assetReviewChecked || hasSource;
                          return (
                            <tr key={asset.id} className="border-t border-slate-100 align-top">
                              <td className="px-3 py-2">
                                <div className="font-medium text-slate-900">{propertyNameById[asset.propertyId] || asset.propertyId}</div>
                                <div className="text-[11px] text-slate-500">{asset.unit || "All units"}</div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-slate-900">{asset.description || "Asset"}</div>
                                <div className="text-[11px] text-slate-500">{asset.type || asset.assetType || "Asset"}</div>
                              </td>
                              <td className="px-3 py-2">{formatTaxDate(asset.placedInService) || "-"}</td>
                              <td className="px-3 py-2"><Badge variant="secondary" className={taxReady ? "!bg-emerald-50 !text-emerald-700" : "!bg-amber-100 !text-amber-800"}>{taxReady ? "Tax ready" : "Source missing"}</Badge></td>
                              <td className="px-3 py-2 text-right font-medium text-slate-900">{currency(asset.basis || 0)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-900">{currency(asset.yearDepreciation || 0)}</td>
                              <td className="px-3 py-2 text-right"><Button size="sm" variant="secondary" onClick={() => navigateWithDashboardContext("assets")}>View asset</Button></td>
                            </tr>
                          );
                        })}
                        {depreciationAssets.length === 0 ? (
                          <tr>
                            <td className="px-3 py-8 text-center text-sm text-slate-500" colSpan={7}>
                              <div className="font-medium text-slate-700">No depreciable assets in this view.</div>
                              <div className="mt-1 text-xs text-slate-500">Add assets or narrow the filing scope to review depreciation support.</div>
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </ResponsiveTableFrame>
                </div>
                <div className="space-y-3">
                  <div className={TAX_SECTION_CLASS}>
                    <div className="text-sm font-semibold text-slate-900">Depreciation summary</div>
                    <div className="mt-3 space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-3"><span className="text-slate-600">Current-year depreciation</span><span className="font-semibold text-slate-900">{currency(taxPacketSummary?.depreciationSummary?.total || 0)}</span></div>
                      <div className="flex items-center justify-between gap-3"><span className="text-slate-600">Assets</span><span className="font-semibold text-slate-900">{depreciationAssets.length}</span></div>
                      <div className="flex items-center justify-between gap-3"><span className="text-slate-600">Source missing</span><span className={`font-semibold ${missingSourceCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>{missingSourceCount}</span></div>
                      <div className="flex items-center justify-between gap-3"><span className="text-slate-600">Review checks</span><span className={`font-semibold ${assetReviewCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>{assetReviewCount}</span></div>
                    </div>
                  </div>
                  {assetReviewCount > 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="text-sm font-semibold text-amber-900">Asset review needed</div>
                      <div className="mt-1 text-xs text-amber-800">Review asset source support before relying on depreciation totals.</div>
                      <Button size="sm" variant="secondary" className="mt-3" onClick={() => navigateWithDashboardContext("review")}>Open Review Center</Button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })()
        ) : null}

        {activeTaxTab === "loans" ? (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className={TAX_SECTION_CLASS}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-slate-900">Loans & Escrow</div>
                  <div className="mt-1 text-sm text-slate-600">Recorded interest, 1098 review, PMI, and reviewed escrow tax/insurance support.</div>
                </div>
                <Button size="sm" variant="secondary" className="gap-2" onClick={() => setActiveTaxTab("tools")}>
                  <Wrench className="h-4 w-4" />
                  Escrow tools
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className={TAX_TILE_CLASS}><div className="text-[11px] font-semibold uppercase text-slate-500">Mortgage interest</div><div className="mt-1 text-base font-semibold text-slate-900">{currency(taxPacketSummary?.loanSummary?.mortgageInterest || 0)}</div></div>
                <div className={TAX_TILE_CLASS}><div className="text-[11px] font-semibold uppercase text-slate-500">PMI / insurance</div><div className="mt-1 text-base font-semibold text-slate-900">{currency(taxPacketSummary?.loanSummary?.pmi || 0)}</div></div>
                <div className={TAX_TILE_CLASS}><div className="text-[11px] font-semibold uppercase text-slate-500">Escrow tax</div><div className="mt-1 text-base font-semibold text-slate-900">{currency(taxPacketSummary?.loanSummary?.reviewedEscrowTaxes || 0)}</div></div>
                <div className={TAX_TILE_CLASS}><div className="text-[11px] font-semibold uppercase text-slate-500">Escrow insurance</div><div className="mt-1 text-base font-semibold text-slate-900">{currency(taxPacketSummary?.loanSummary?.reviewedEscrowInsurance || 0)}</div></div>
              </div>
              <TaxDoubleCountingWarningsPanel warnings={loanEscrowWarnings} />
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Year-end loan review</div>
                  <div className="mt-1 text-xs text-slate-500">Enter 1098 interest, PMI, points, reviewed escrow uses, and optional deductible-interest overrides for the selected tax year.</div>
                </div>
                {visibleLoans.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-500">
                    <div className="font-medium text-slate-700">No loans match the current property scope.</div>
                    <div className="mt-1 text-xs text-slate-500">Change the property filter or add a loan before reviewing 1098 and escrow support.</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleLoans.map((loan) => (
                      <LoanYearEndTaxCard
                        key={loan.id}
                        currency={currency}
                        effectiveLoanPaymentDeductibleInterest={effectiveLoanPaymentDeductibleInterest}
                        effectiveLoanPaymentRentalUsePct={effectiveLoanPaymentRentalUsePct}
                        loan={loan}
                        loanPayments={loanPayments}
                        propertyNameById={propertyNameById}
                        updateLoanYearEndReview={updateLoanYearEndReview}
                        yearFilter={yearFilter}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <div className={TAX_SECTION_CLASS}>
                <div className="text-sm font-semibold text-slate-900">Loan review summary</div>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3"><span className="text-slate-600">Loans in scope</span><span className="font-semibold text-slate-900">{visibleLoans.length}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-slate-600">Escrow entries</span><span className="font-semibold text-slate-900">{escrowDisbursementRows.length}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-slate-600">Warnings</span><span className={`font-semibold ${loanEscrowWarnings.length > 0 ? "text-amber-700" : "text-emerald-700"}`}>{loanEscrowWarnings.length}</span></div>
                </div>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="text-sm font-semibold text-blue-950">Escrow timing</div>
                <div className="mt-1 text-xs text-blue-900">Use reviewed escrow disbursements for taxes and insurance paid by the servicer. Escrow deposits are not deducted by themselves.</div>
                <Button size="sm" variant="secondary" className="mt-3" onClick={() => setActiveTaxTab("tools")}>Open escrow tools</Button>
              </div>
            </div>
          </div>
        ) : null}

        {activeTaxTab === "packet" ? (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className={TAX_SECTION_CLASS}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-slate-900">Tax Packet</div>
                  <div className="mt-1 text-sm text-slate-600">Final handoff summary for printing or preparer review.</div>
                </div>
                <Button size="sm" className="gap-2" onClick={printTaxPacket}>
                  <Printer className="h-4 w-4" />
                  Print packet
                </Button>
              </div>
              <div className={`rounded-xl border p-4 ${taxPacketStatusClass}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{taxPacketStatusLabel}</div>
                    <div className="mt-1 text-xs">
                      {taxPacketNeedsCleanup
                        ? "Resolve Review Center items or add notes for filed amount differences before relying on this packet."
                        : taxReadinessCounts.supportWarnings > 0
                          ? "Totals can be reviewed, but some source rows still need support review."
                          : "Source records and support look ready for the selected scope."}
                    </div>
                  </div>
                  {taxPacketNeedsCleanup ? <Button size="sm" variant="secondary" onClick={() => navigateWithDashboardContext("review")}>Open Review Center</Button> : null}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Packet contents</div>
                    <div className="mt-1 text-xs text-slate-500">What will travel with the print packet and Schedule E exports.</div>
                  </div>
                  <Badge variant="secondary" className={taxPacketNeedsCleanup ? "!bg-amber-100 !text-amber-800" : "!bg-emerald-50 !text-emerald-700"}>
                    {taxPacketNeedsCleanup ? "Review before handoff" : "Handoff ready"}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  {taxPacketContents.map((item) => (
                    <div key={`packet-content-${item.label}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div className="text-[11px] font-semibold uppercase text-slate-500">{item.label}</div>
                      <div className="mt-1 text-base font-semibold text-slate-900">{item.value}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{item.helper}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className={TAX_TILE_CLASS}><div className="text-[11px] font-semibold uppercase text-slate-500">Net before passive limitation</div><div className="mt-1 text-base font-semibold text-slate-900">{currency(taxPacketSummary?.scheduleSummary?.netRentalIncomeLoss || 0)}</div></div>
                <div className={TAX_TILE_CLASS}><div className="text-[11px] font-semibold uppercase text-slate-500">Depreciation</div><div className="mt-1 text-base font-semibold text-slate-900">{currency(taxPacketSummary?.depreciationSummary?.total || 0)}</div></div>
                <div className={TAX_TILE_CLASS}><div className="text-[11px] font-semibold uppercase text-slate-500">Loan interest</div><div className="mt-1 text-base font-semibold text-slate-900">{currency(taxPacketSummary?.loanSummary?.mortgageInterest || 0)}</div></div>
                <div className={TAX_TILE_CLASS}><div className="text-[11px] font-semibold uppercase text-slate-500">Open packet checks</div><div className="mt-1 text-base font-semibold text-slate-900">{taxPacketOpenItems.length + taxPacketNeedsNotes.length}</div></div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">Blocking items</div>
                    <Badge variant="secondary" className={taxPacketOpenItems.length + taxPacketNeedsNotes.length > 0 ? "!bg-rose-100 !text-rose-700" : "!bg-emerald-50 !text-emerald-700"}>{taxPacketOpenItems.length + taxPacketNeedsNotes.length}</Badge>
                  </div>
                  <div className="mt-2 space-y-2 text-xs">
                    {taxPacketOpenItems.slice(0, 4).map((item) => (
                      <div key={`packet-open-${item.key}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-2.5">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900">{item.label}{item.reviewCount > 1 ? ` - ${item.reviewCount} entries` : ""}</div>
                          <div className="truncate text-slate-500">{item.helperText || "Review source records before relying on packet totals."}</div>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => openReviewRoute({ ...routeForReviewSection(item.key || item.sectionKey), view: item.targetView || "review" })}>Fix</Button>
                      </div>
                    ))}
                    {taxPacketNeedsNotes.slice(0, 3).map((row) => (
                      <div key={`packet-note-${row.field}`} className="rounded-lg border border-slate-200 bg-white p-2.5">
                        <div className="font-medium text-slate-900">{row.label} needs a filed amount note</div>
                        <div className="text-slate-500">Add the note in Schedule E computed-vs-filed before handoff.</div>
                      </div>
                    ))}
                    {taxPacketOpenItems.length === 0 && taxPacketNeedsNotes.length === 0 ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">No blocking packet items.</div> : null}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">Support warnings</div>
                    <Badge variant="secondary" className={taxPacketSupportBuckets.length > 0 ? "!bg-blue-100 !text-blue-700" : "!bg-emerald-50 !text-emerald-700"}>{taxPacketSupportBuckets.length}</Badge>
                  </div>
                  <div className="mt-2 space-y-2 text-xs">
                    {taxPacketSupportBuckets.slice(0, 4).map((bucket) => (
                      <div key={`packet-support-${bucket.key}`} className="rounded-lg border border-slate-200 bg-white p-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-slate-900">{bucket.label}</div>
                          <span className="text-slate-500">{bucket.rows.length} row{bucket.rows.length === 1 ? "" : "s"}</span>
                        </div>
                        {bucket.rows[0] ? (
                          <div className="mt-1 truncate text-slate-500">{bucket.rows[0].description} | {propertyNameById[bucket.rows[0].propertyId] || bucket.rows[0].propertyId} | {currency(bucket.rows[0].deductibleAmount)}</div>
                        ) : null}
                      </div>
                    ))}
                    {taxPacketSupportBuckets.length === 0 ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">No support warnings in this scope.</div> : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className={TAX_SECTION_CLASS}>
                <div className="text-sm font-semibold text-slate-900">Handoff actions</div>
                <div className="mt-3 grid gap-2">
                  <Button size="sm" variant="secondary" className="justify-start gap-2" onClick={exportScheduleEFormFdf}><FileText className="h-4 w-4" />Export IRS form data</Button>
                  <Button size="sm" variant="secondary" className="justify-start gap-2" onClick={exportScheduleEFilledPdf}><Printer className="h-4 w-4" />Print filled Schedule E</Button>
                  <Button size="sm" variant="secondary" className="justify-start gap-2" onClick={exportTaxDetailCsv}><Download className="h-4 w-4" />Export detail CSV</Button>
                  <Button size="sm" variant="secondary" className="justify-start" onClick={() => setActiveTaxTab("schedule")}>Review Schedule E</Button>
                  <Button size="sm" variant="secondary" className="justify-start" onClick={() => setActiveTaxTab("details")}>Review source rows</Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTaxTab === "tools" ? (
          <div className="space-y-3">

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold text-slate-900">Review cleanup</div>
                <div className="mt-1 text-xs text-slate-500">
                  {hasTaxCleanupWork
                    ? "Use Review Center for transaction, document, asset, maintenance, occupancy, tenant ledger, and loan cleanup."
                    : "No tax cleanup items are open in the current filing scope."}
                </div>
              </div>
              {hasTaxCleanupWork ? (
                <Button size="sm" variant="secondary" onClick={() => navigateWithDashboardContext("review")}>Open Review Center</Button>
              ) : (
                <Badge variant="secondary" className="!bg-emerald-50 !text-emerald-700">Clear</Badge>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold text-slate-900">Escrow disbursement tools</div>
                <div className="mt-1 text-xs text-slate-500">
                  Log servicer-paid tax or insurance disbursements and create the matching ledger entry when needed.
                </div>
              </div>
              <Badge variant="secondary">{escrowDisbursementRows.length} logged</Badge>
            </div>
          </div>
        </div>

          <div id="tax-loans-escrow" className="scroll-mt-6 self-start rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-medium text-slate-900">Escrow taxes & insurance</div>
                <div className="mt-1 text-xs text-slate-500">Log escrow disbursements, create the matching `Taxes` or `Insurance` ledger entry, and track prepaid insurance coverage periods for Schedule E timing. Escrow deposits are not automatically deducted as taxes/insurance.</div>
              </div>
              <Badge variant="secondary">{escrowDisbursementRows.length} logged</Badge>
            </div>
            <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2 text-xs md:grid-cols-4">
              <div><span className="text-slate-500">Mortgage interest:</span> <span className="font-semibold">{currency(taxPacketSummary?.loanSummary?.mortgageInterest || 0)}</span></div>
              <div><span className="text-slate-500">PMI:</span> <span className="font-semibold">{currency(taxPacketSummary?.loanSummary?.pmi || 0)}</span></div>
              <div><span className="text-slate-500">Reviewed escrow tax:</span> <span className="font-semibold">{currency(taxPacketSummary?.loanSummary?.reviewedEscrowTaxes || 0)}</span></div>
              <div><span className="text-slate-500">Reviewed escrow insurance:</span> <span className="font-semibold">{currency(taxPacketSummary?.loanSummary?.reviewedEscrowInsurance || 0)}</span></div>
            </div>

            {taxEscrowWarnings.length > 0 ? (
              <div className="mt-3 space-y-2">
                {taxEscrowWarnings.map((warning) => (
                  <div key={warning.id} className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
                    <div className="text-sm font-medium text-amber-900">{warning.title}</div>
                    <div className="mt-1 text-xs text-amber-800">{warning.message}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-900">
                Escrow tax and insurance support looks complete for the current scope.
              </div>
            )}

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-slate-900">
                  {editingEscrowDisbursementId ? "Edit escrow disbursement" : "Add escrow disbursement"}
                </div>
                {editingEscrowDisbursementId ? (
                  <Button size="sm" variant="ghost" onClick={clearEscrowDisbursementDraft}>Cancel edit</Button>
                ) : null}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <Label className="text-xs text-slate-600">Loan</Label>
                  <Select
                    value={escrowDisbursementDraft.loanId || ""}
                    onValueChange={(value) => setEscrowDisbursementDraft((prev) => ({ ...prev, loanId: value }))}
                  >
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue placeholder="Select loan" />
                    </SelectTrigger>
                    <SelectContent>
                      {defaultEscrowLoanOptions.map((loan) => (
                        <SelectItem key={loan.id} value={loan.id}>
                          {(propertyNameById[loan.propertyId] || loan.propertyId) + " | " + loan.lender}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Disbursement date</Label>
                  <Input
                    className="mt-1 h-9"
                    type="date"
                    value={escrowDisbursementDraft.date || ""}
                    onChange={(e) => setEscrowDisbursementDraft((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Category</Label>
                  <Select
                    value={escrowDisbursementDraft.category || "Taxes"}
                    onValueChange={(value) => setEscrowDisbursementDraft((prev) => ({
                      ...prev,
                      category: value,
                      coverageStart: value === "Insurance" ? prev.coverageStart : "",
                      coverageEnd: value === "Insurance" ? prev.coverageEnd : "",
                    }))}
                  >
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Taxes">Taxes</SelectItem>
                      <SelectItem value="Insurance">Insurance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Amount</Label>
                  <Input
                    className="mt-1 h-9"
                    type="number"
                    min="0"
                    step="0.01"
                    value={escrowDisbursementDraft.amount || ""}
                    onChange={(e) => setEscrowDisbursementDraft((prev) => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-slate-600">Description</Label>
                  <Input
                    className="mt-1 h-9"
                    value={escrowDisbursementDraft.description || ""}
                    onChange={(e) => setEscrowDisbursementDraft((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="County tax installment, hazard policy renewal, etc."
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Vendor / payee</Label>
                  <Input
                    className="mt-1 h-9"
                    value={escrowDisbursementDraft.vendor || ""}
                    onChange={(e) => setEscrowDisbursementDraft((prev) => ({ ...prev, vendor: e.target.value }))}
                    placeholder="County assessor, insurer, servicer"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Notes</Label>
                  <Input
                    className="mt-1 h-9"
                    value={escrowDisbursementDraft.notes || ""}
                    onChange={(e) => setEscrowDisbursementDraft((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Optional memo"
                  />
                </div>
                {escrowDisbursementDraft.category === "Insurance" ? (
                  <>
                    <div>
                      <Label className="text-xs text-slate-600">Coverage start</Label>
                      <Input
                        className="mt-1 h-9"
                        type="date"
                        value={escrowDisbursementDraft.coverageStart || ""}
                        onChange={(e) => setEscrowDisbursementDraft((prev) => ({ ...prev, coverageStart: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Coverage end</Label>
                      <Input
                        className="mt-1 h-9"
                        type="date"
                        value={escrowDisbursementDraft.coverageEnd || ""}
                        onChange={(e) => setEscrowDisbursementDraft((prev) => ({ ...prev, coverageEnd: e.target.value }))}
                      />
                    </div>
                  </>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={saveEscrowDisbursement}>
                  {editingEscrowDisbursementId ? "Save changes" : "Log disbursement"}
                </Button>
                <Button size="sm" variant="secondary" onClick={clearEscrowDisbursementDraft}>Reset form</Button>
              </div>
            </div>

            {escrowDisbursementRows.length === 0 ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-500">
                <div className="font-medium text-slate-700">No escrow disbursements logged yet.</div>
                <div className="mt-1 text-xs text-slate-500">Log servicer-paid taxes or insurance only when you need actual escrow disbursement support.</div>
              </div>
            ) : (
              <ResponsiveTableFrame
                className="mt-3"
                minWidthClass="min-w-[980px]"
                hint="Swipe to review escrow disbursement support, prepaid coverage periods, and ledger posting status."
                mobileCards={escrowDisbursementRows.map((entry) => (
                  <div key={`escrow-card-${entry.id}`} className={WORKSPACE_MUTED_PANEL_CLASS}>
                    <div className="text-sm font-medium text-slate-900">{entry.category} | {currency(entry.amount)}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatTaxDate(entry.date)} | {entry.propertyName}</div>
                    <div className="mt-1 text-xs text-slate-500">{entry.description || (entry.loan?.lender || "Escrow disbursement")}</div>
                    {entry.category === "Insurance" && entry.coverageStart && entry.coverageEnd ? (
                      <div className="mt-2 text-xs text-slate-600">Coverage {formatTaxDate(entry.coverageStart)} to {formatTaxDate(entry.coverageEnd)} | {yearFilter} alloc. {currency(entry.deductibleInSelectedYear)}</div>
                    ) : null}
                    <div className="mt-2 text-xs text-slate-600">
                      Status: {entry.linkedTransaction ? "Posted" : entry.suggestedTransaction ? "Match found" : "Needs ledger entry"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => startEditEscrowDisbursement(entry)}>Edit</Button>
                      <Button size="sm" variant="secondary" onClick={() => createEscrowTransaction(entry)}>
                        {entry.linkedTransaction ? "Linked" : entry.suggestedTransaction ? "Link match" : "Create expense"}
                      </Button>
                    </div>
                  </div>
                ))}
              >
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-2 py-1 text-left">Date</th>
                      <th className="px-2 py-1 text-left">Property / loan</th>
                      <th className="px-2 py-1 text-left">Category</th>
                      <th className="px-2 py-1 text-left">Description</th>
                      <th className="px-2 py-1 text-left">Coverage</th>
                      <th className="px-2 py-1 text-right">Amount</th>
                      <th className="px-2 py-1 text-right">{yearFilter} alloc.</th>
                      <th className="px-2 py-1 text-left">Ledger status</th>
                      <th className="px-2 py-1 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escrowDisbursementRows.map((entry) => {
                      const linkedOrSuggested = entry.linkedTransaction || entry.suggestedTransaction;
                      const statusLabel = entry.linkedTransaction
                        ? "Posted"
                        : entry.suggestedTransaction
                          ? "Matching ledger entry found"
                          : "Needs ledger entry";

                      return (
                        <tr key={entry.id} className="border-t border-slate-100">
                          <td className="px-2 py-1">{formatTaxDate(entry.date)}</td>
                          <td className="px-2 py-1">
                            <div>{entry.propertyName}</div>
                            <div className="text-[11px] text-slate-500">{entry.loan?.lender || "Unknown loan"}</div>
                          </td>
                          <td className="px-2 py-1">{entry.category}</td>
                          <td className="px-2 py-1">{entry.description || "-"}</td>
                          <td className="px-2 py-1">
                            {entry.category === "Insurance" && entry.coverageStart && entry.coverageEnd
                              ? `${formatTaxDate(entry.coverageStart)} to ${formatTaxDate(entry.coverageEnd)}`
                              : "-"}
                          </td>
                          <td className="px-2 py-1 text-right">{currency(entry.amount)}</td>
                          <td className="px-2 py-1 text-right">{entry.category === "Insurance" ? currency(entry.deductibleInSelectedYear) : currency(entry.amount)}</td>
                          <td className="px-2 py-1">
                            <div>{statusLabel}</div>
                            {linkedOrSuggested ? (
                              <button
                                type="button"
                                className="mt-1 text-[11px] text-blue-700 underline-offset-2 hover:underline"
                                onClick={() => openTransaction(linkedOrSuggested)}
                              >
                                Open ledger entry
                              </button>
                            ) : null}
                          </td>
                          <td className="px-2 py-1 text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button size="sm" variant="secondary" onClick={() => startEditEscrowDisbursement(entry)}>Edit</Button>
                              {!entry.linkedTransaction && entry.suggestedTransaction ? (
                                <Button size="sm" variant="secondary" onClick={() => linkEscrowDisbursementToTransaction(entry.id, entry.suggestedTransaction.id)}>Link match</Button>
                              ) : (
                                <Button size="sm" variant="secondary" onClick={() => createEscrowTransaction(entry)}>
                                  {entry.linkedTransaction ? "Posted" : "Create expense"}
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => deleteEscrowDisbursement(entry)}>Delete</Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ResponsiveTableFrame>
            )}
          </div>

        <div id="tax-tools" className="scroll-mt-6 space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-base font-semibold text-slate-900">Tax review & notes</div>
              <div className="text-xs text-slate-500">Review queue, checklists, and CPA-ready notes for the current filing scope.</div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <Badge variant="secondary" className={taxReviewOpenCount > 0 ? "!bg-rose-100 !text-rose-700" : ""}>{taxReviewOpenCount} open</Badge>
              <Button
                size="sm"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => setTaxReviewNotesCollapsed((prev) => !prev)}
              >
                {taxReviewNotesCollapsed ? "Expand" : "Collapse"}
              </Button>
            </div>
          </div>

          {taxReviewNotesCollapsed ? (
            <div className="rounded-xl border border-white/70 bg-white px-3 py-3 text-sm text-slate-500">
              Review sections and CPA notes are hidden until you expand this area.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white shadow-sm p-3">
                <div>
                  <div className="text-base font-semibold text-slate-900">Tax Review Queue</div>
                  <div className="text-xs text-slate-500">Review, check off, and document items before filing.</div>
                </div>
                <Select value={taxReviewMode} onValueChange={setTaxReviewMode}>
                  <SelectTrigger className="w-[190px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flagged">Only flagged items</SelectItem>
                    <SelectItem value="all">All candidate items</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {taxReviewSections.map((section) => {
                const openFlaggedItems = section.flaggedItems.filter((item) => !item.taxChecked);
                const checkedCount = section.flaggedItems.filter((item) => item.taxChecked).length;
                const visibleItems = (taxReviewMode === "all" ? section.allItems : openFlaggedItems).slice(0, 8);
                const isCollapsed = taxReviewCollapsed[section.key] ?? (openFlaggedItems.length === 0);
                const hasOpen = openFlaggedItems.length > 0;
                const allChecked = section.flaggedItems.length > 0 && checkedCount === section.flaggedItems.length;

                return (
                  <div key={section.key} className="self-start rounded-xl border border-slate-300 bg-white shadow-sm p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium text-slate-900">{section.title}</div>
                        <div className="text-xs text-slate-500">{section.hint}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={hasOpen ? "!bg-rose-100 !text-rose-700" : ""}>{openFlaggedItems.length} open</Badge>
                        <Badge variant="secondary" className={allChecked ? "!bg-emerald-100 !text-emerald-700" : ""}>{checkedCount} checked</Badge>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setTaxReviewCollapsed((prev) => ({ ...prev, [section.key]: !(prev[section.key] ?? (openFlaggedItems.length === 0)) }))}
                        >
                          {isCollapsed ? "Expand" : "Collapse"}
                        </Button>
                      </div>
                    </div>

                    {isCollapsed ? (
                      <div className="mt-2 text-sm text-slate-500">Section collapsed.</div>
                    ) : (
                      <>
                        {visibleItems.length === 0 && (
                          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-500">
                            <div className="font-medium text-slate-700">No items in current view.</div>
                            <div className="mt-1 text-xs text-slate-500">Switch to all candidate items if you want to audit already-clear records.</div>
                          </div>
                        )}

                        {visibleItems.map((item) => {
                          const isFlagged = section.flaggedItems.some((flagged) => flagged.id === item.id);
                          const isChecked = item.taxChecked;
                          const statusLabel = isChecked ? "Checked" : isFlagged ? "Needs review" : "OK";

                          return (
                            <div key={item.id} className="mt-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2 text-sm">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-medium text-slate-900">{item.description || item.category}</div>
                                  <div className="text-xs text-slate-500">{formatTaxDate(item.date)} | {propertyNameById[item.propertyId] || item.propertyId} | Unit {item.unit} | {item.category}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-semibold text-slate-900">{currency(item.amount)}</div>
                                  <div className="text-xs text-slate-500">{statusLabel}</div>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Button size="sm" variant="secondary" onClick={() => openTransaction(item)}>
                                  Review item
                                </Button>
                                {(isFlagged || isChecked) && (
                                  <Button size="sm" variant="secondary" onClick={() => actions.setTransactionTaxChecked(item.id, !item.taxChecked)}>
                                    {isChecked ? "Uncheck" : "Mark checked"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              })}

              <div className="self-start rounded-xl border border-slate-300 bg-white shadow-sm p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-900">CPA Notes</div>
                    <div className="text-xs text-slate-500">Export-ready summary using your current filters and checkmarks.</div>
                  </div>
                  <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={copyTaxReviewNotes}>
                    Copy notes
                  </Button>
                </div>
                <textarea
                  className="mt-2 h-52 w-full rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700"
                  value={taxReviewCpaNotes}
                  readOnly
                />
              </div>
            </>
          )}
        </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
