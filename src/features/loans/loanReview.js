import { deriveLoanBalanceFromPayments, loanIdsMatch } from "../../domain/loans.ts";
import { toLocalIsoDate } from "../../lib/localDate.ts";

const ISSUE_LABELS = {
  missing_1098_review: "1098 review needed",
  missing_monthly_payments: "Missing payment months",
  interest_mismatch: "1098 interest mismatch",
  deductible_interest_mismatch: "Deductible interest mismatch",
  escrow_not_reviewed: "Escrow review open",
  property_tax_escrow_missing: "Property tax escrow missing",
  insurance_escrow_missing: "Insurance escrow missing",
  escrow_unallocated_difference: "Escrow allocation difference",
  pmi_review_needed: "PMI review needed",
  points_review_needed: "Points review needed",
  extra_principal_review_needed: "Extra principal review needed",
  loan_balance_mismatch: "Loan balance mismatch",
  occupancy_dependency_open: "Occupancy dependency open",
  loan_document_missing: "Loan document missing",
  year_end_review_open: "Year-end review open",
};

const ISSUE_HELP = {
  missing_1098_review: "Recorded mortgage interest exists, but the selected year has not been checked against a 1098 or marked reviewed.",
  missing_monthly_payments: "An active loan is missing one or more expected payment months in the selected year.",
  interest_mismatch: "Recorded interest and 1098 interest differ materially. Review before Tax Center reporting.",
  deductible_interest_mismatch: "The deductible interest override differs from the computed amount.",
  escrow_not_reviewed: "Escrow was paid, but property tax, insurance, and other escrow uses have not been reviewed.",
  property_tax_escrow_missing: "Escrow was paid and no property tax escrow allocation is recorded.",
  insurance_escrow_missing: "Escrow was paid and no insurance escrow allocation is recorded.",
  escrow_unallocated_difference: "Reviewed escrow uses do not match recorded escrow paid.",
  pmi_review_needed: "PMI or mortgage insurance was recorded and needs 1098/override review.",
  points_review_needed: "Loan points are entered and need a year-end review note or reviewed status.",
  extra_principal_review_needed: "Extra principal was paid and should be confirmed as non-deductible principal.",
  loan_balance_mismatch: "Recorded principal history implies a materially different balance than the saved loan balance.",
  occupancy_dependency_open: "Mortgage interest allocation depends on occupancy records that still need review.",
  loan_document_missing: "A reviewed 1098 or loan statement should be linked as supporting documentation when available.",
  year_end_review_open: "Loan activity exists, but the selected year has not been marked reviewed.",
};

function issue(key, field, detail) {
  return { key, label: ISSUE_LABELS[key] || key, help: ISSUE_HELP[key] || "", field, detail };
}

function money(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function selectedYear(yearFilter) {
  return String(yearFilter || new Date().getFullYear());
}

function monthKey(dateStr) {
  return String(dateStr || "").slice(0, 7);
}

function addMonths(dateStr, monthsToAdd) {
  const [year, month, day] = String(dateStr || "").split("-").map((part) => Number(part));
  if (![year, month, day].every(Number.isFinite)) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMonth(date.getUTCMonth() + monthsToAdd);
  return date.toISOString().slice(0, 10);
}

function firstMortgageDueDateAfterOrigination(dateStr) {
  const [year, month, day] = String(dateStr || "").slice(0, 10).split("-").map((part) => Number(part));
  if (![year, month, day].every(Number.isFinite)) return "";
  const date = new Date(Date.UTC(year, month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + (day === 1 ? 1 : 2));
  return date.toISOString().slice(0, 10);
}

function coveredPaymentMonths(paymentDate) {
  const normalized = String(paymentDate || "").slice(0, 10);
  const month = monthKey(normalized);
  if (!month) return [];
  const months = new Set([month]);
  const day = Number(normalized.slice(8, 10));
  if (Number.isFinite(day) && day >= 25) {
    const nextMonth = monthKey(addMonths(`${month}-01`, 1));
    if (nextMonth) months.add(nextMonth);
  }
  return Array.from(months);
}

function isMortgageReportingLoan(loan) {
  return ["Primary Mortgage", "Second Mortgage", "HELOC"].includes(String(loan?.loanType || "Primary Mortgage"));
}

function loanMatchesPropertyFilter(loan, propertyFilter) {
  return !propertyFilter || propertyFilter === "all" || loan?.propertyId === propertyFilter;
}

export function getLoanYearEndReview(loan, yearFilter) {
  const year = selectedYear(yearFilter);
  const existing = Array.isArray(loan?.yearEndReviews)
    ? loan.yearEndReviews.find((review) => String(review.year) === year)
    : null;
  return {
    year,
    form1098Received: false,
    reviewNotes: "",
    reviewed: false,
    reviewedAt: "",
    ...(existing || {}),
  };
}

export function upsertLoanYearEndReview(loan, review) {
  const year = selectedYear(review?.year);
  const existingReviews = Array.isArray(loan?.yearEndReviews) ? loan.yearEndReviews : [];
  const withoutYear = existingReviews.filter((item) => String(item.year) !== year);
  return {
    ...loan,
    yearEndReviews: [{ ...review, year }, ...withoutYear].sort((left, right) => String(right.year).localeCompare(String(left.year))),
  };
}

export function summarizeLoanPayments(loan, loanPayments = [], context = {}) {
  const year = selectedYear(context.yearFilter);
  const payments = loanPayments.filter((payment) => loanIdsMatch(payment.loanId, loan?.id) && String(payment.paymentDate || "").startsWith(year));
  return payments.reduce(
    (acc, payment) => {
      acc.paymentCount += 1;
      acc.interest += money(payment.interest);
      acc.deductibleInterest += money(context.getDeductibleInterest?.(payment) ?? payment.deductibleInterest);
      acc.principal += money(payment.principal);
      acc.extraPrincipal += money(payment.extraPrincipal);
      acc.escrow += money(payment.escrow);
      acc.pmi += money(payment.mortgageInsurance);
      acc.total += money(payment.totalPayment);
      coveredPaymentMonths(payment.paymentDate).forEach((coveredMonth) => acc.recordedMonths.add(coveredMonth));
      return acc;
    },
    { paymentCount: 0, interest: 0, deductibleInterest: 0, principal: 0, extraPrincipal: 0, escrow: 0, pmi: 0, total: 0, recordedMonths: new Set() },
  );
}

export function getExpectedLoanPaymentMonths(loan, context = {}) {
  const year = selectedYear(context.yearFilter);
  const todayIso = context.todayIso || toLocalIsoDate();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const cappedEnd = year === todayIso.slice(0, 4) ? todayIso : yearEnd;
  const originatedOn = String(loan?.originatedOn || yearStart).slice(0, 10);
  const firstDueDate = firstMortgageDueDateAfterOrigination(originatedOn) || originatedOn;
  if (!loan || firstDueDate > cappedEnd) return [];

  let cursor = firstDueDate > yearStart ? firstDueDate : yearStart;
  cursor = `${cursor.slice(0, 7)}-01`;
  const months = [];
  while (cursor && cursor <= cappedEnd) {
    months.push(cursor.slice(0, 7));
    cursor = addMonths(cursor, 1);
  }
  return months;
}

export function getMissingLoanPaymentMonths(loan, loanPayments = [], context = {}) {
  const summary = summarizeLoanPayments(loan, loanPayments, context);
  return getExpectedLoanPaymentMonths(loan, context).filter((month) => !summary.recordedMonths.has(month));
}

function hasLoanDocument(loan, documents = []) {
  const haystack = documents.filter((document) => !loan?.propertyId || document.propertyId === loan.propertyId);
  return haystack.some((document) => {
    const text = [document.name, document.type, Array.isArray(document.tags) ? document.tags.join(" ") : "", document.extractedText]
      .join(" ")
      .toLowerCase();
    return text.includes("1098") || text.includes("mortgage") || text.includes("loan statement");
  });
}

function occupancyDependencyOpen(loan, context = {}) {
  const records = context.occupancyReviewInbox?.records || [];
  return records.some((record) => record.property?.id === loan?.propertyId || record.row?.property?.id === loan?.propertyId || record.row?.propertyId === loan?.propertyId);
}

export function getLoanReviewIssues(loan, context = {}) {
  if (!loan) return [];
  const loanPayments = context.loanPayments || [];
  const documents = context.documents || [];
  const review = getLoanYearEndReview(loan, context.yearFilter);
  const summary = summarizeLoanPayments(loan, loanPayments, context);
  const allPaymentsForLoan = loanPayments.filter((payment) => loanIdsMatch(payment.loanId, loan.id));
  const missingMonths = getMissingLoanPaymentMonths(loan, loanPayments, context);
  const issues = [];
  const hasActivity = summary.paymentCount > 0 || summary.interest > 0 || summary.escrow > 0 || summary.pmi > 0;
  const escrowReviewedTotal = money(review.escrowPropertyTaxPaid) + money(review.escrowInsurancePaid) + money(review.escrowOtherPaid);
  const escrowHasReview = escrowReviewedTotal > 0 || money(review.form1098PropertyTaxPaid) > 0 || money(review.form1098InsurancePaid) > 0;

  if (summary.interest > 0 && isMortgageReportingLoan(loan) && !review.form1098Received && !review.reviewed) {
    issues.push(issue("missing_1098_review", "form1098Received"));
  }

  if (missingMonths.length > 0) {
    issues.push(issue("missing_monthly_payments", "loanPayments", missingMonths));
  }

  if (money(review.form1098Interest) > 0) {
    const tolerance = Math.max(5, money(review.form1098Interest) * 0.01);
    if (Math.abs(summary.interest - money(review.form1098Interest)) > tolerance) {
      issues.push(issue("interest_mismatch", "form1098Interest"));
    }
  }

  if (money(review.deductibleInterestOverride) > 0 && Math.abs(summary.deductibleInterest - money(review.deductibleInterestOverride)) > Math.max(5, summary.deductibleInterest * 0.01)) {
    issues.push(issue("deductible_interest_mismatch", "deductibleInterestOverride"));
  }

  if (summary.escrow > 0 && !escrowHasReview && !review.reviewed) {
    issues.push(issue("escrow_not_reviewed", "escrowPropertyTaxPaid"));
  }

  if (summary.escrow > 0 && money(review.escrowPropertyTaxPaid) === 0 && money(review.form1098PropertyTaxPaid) === 0) {
    issues.push(issue("property_tax_escrow_missing", "escrowPropertyTaxPaid"));
  }

  if (summary.escrow > 0 && money(review.escrowInsurancePaid) === 0 && money(review.form1098InsurancePaid) === 0) {
    issues.push(issue("insurance_escrow_missing", "escrowInsurancePaid"));
  }

  if (summary.escrow > 0 && escrowReviewedTotal > 0 && Math.abs(summary.escrow - escrowReviewedTotal) > Math.max(5, summary.escrow * 0.01)) {
    issues.push(issue("escrow_unallocated_difference", "escrowOtherPaid"));
  }

  if (summary.pmi > 0 && money(review.form1098MortgageInsurance) === 0 && money(review.pmiOverride) === 0 && !String(review.reviewNotes || "").trim() && !review.reviewed) {
    issues.push(issue("pmi_review_needed", "form1098MortgageInsurance"));
  }

  if (money(review.form1098Points) > 0 && !String(review.reviewNotes || "").trim() && !review.reviewed) {
    issues.push(issue("points_review_needed", "form1098Points"));
  }

  if (summary.extraPrincipal > 0 && !String(review.reviewNotes || "").trim() && !review.reviewed) {
    issues.push(issue("extra_principal_review_needed", "reviewNotes"));
  }

  const balanceInsight = deriveLoanBalanceFromPayments(loan, allPaymentsForLoan);
  if (balanceInsight.paymentCount > 0 && balanceInsight.discrepancy > Math.max(25, money(loan.originalBalance) * 0.005)) {
    issues.push(issue("loan_balance_mismatch", "currentBalance"));
  }

  if (occupancyDependencyOpen(loan, context)) {
    issues.push(issue("occupancy_dependency_open", "occupancy"));
  }

  if ((review.form1098Received || review.reviewed) && !hasLoanDocument(loan, documents)) {
    issues.push(issue("loan_document_missing", "documents"));
  }

  if (hasActivity && !review.reviewed) {
    issues.push(issue("year_end_review_open", "reviewed"));
  }

  return issues.filter((item, index, list) => list.findIndex((candidate) => candidate.key === item.key) === index);
}

export function getLoanReadiness(loan, context = {}) {
  const summary = summarizeLoanPayments(loan, context.loanPayments || [], context);
  const hasActivity = summary.paymentCount > 0 || summary.interest > 0 || summary.escrow > 0 || summary.pmi > 0;
  if (!hasActivity && getExpectedLoanPaymentMonths(loan, context).length === 0) {
    return { key: "not_applicable", label: "Not applicable", issues: [] };
  }
  const issues = getLoanReviewIssues(loan, context);
  if (issues.length > 0) return { key: "needs_review", label: "Needs loan review", issues };
  return { key: "ready", label: "Ready for Tax Center", issues };
}

function primaryActionForIssues(issues) {
  const keys = new Set(issues.map((item) => item.key));
  if (keys.has("missing_1098_review") || keys.has("interest_mismatch")) return "review_1098";
  if (keys.has("escrow_not_reviewed") || keys.has("escrow_unallocated_difference")) return "review_escrow";
  if (keys.has("missing_monthly_payments")) return "fill_missing_payments";
  if (keys.has("occupancy_dependency_open")) return "review_occupancy";
  return "mark_reviewed";
}

export function buildLoanReviewInbox({ loans = [], loanPayments = [], transactions = [], documents = [], occupancyReviewInbox, yearFilter, propertyFilter = "all", todayIso, getDeductibleInterest } = {}) {
  const context = { loanPayments, transactions, documents, occupancyReviewInbox, yearFilter, propertyFilter, todayIso, getDeductibleInterest };
  const records = loans
    .filter((loan) => loanMatchesPropertyFilter(loan, propertyFilter))
    .map((loan) => {
      const issues = getLoanReviewIssues(loan, context);
      const summary = summarizeLoanPayments(loan, loanPayments, context);
      return {
        loan,
        issues,
        readiness: getLoanReadiness(loan, context),
        review: getLoanYearEndReview(loan, yearFilter),
        summary,
        missingMonths: getMissingLoanPaymentMonths(loan, loanPayments, context),
        primaryAction: primaryActionForIssues(issues),
      };
    })
    .filter((record) => record.issues.length > 0)
    .sort((left, right) => right.issues.length - left.issues.length || String(left.loan.lender || "").localeCompare(String(right.loan.lender || "")));

  const countIssue = (key) => records.filter((record) => record.issues.some((issue) => issue.key === key)).length;

  return {
    records,
    counts: {
      total: records.length,
      missing1098Review: countIssue("missing_1098_review"),
      escrowReviewOpen: countIssue("escrow_not_reviewed") + countIssue("escrow_unallocated_difference"),
      missingPaymentMonths: countIssue("missing_monthly_payments"),
      occupancyDependencyWarnings: countIssue("occupancy_dependency_open"),
    },
  };
}

export function summarizeLoanReadiness(args = {}) {
  const context = {
    loanPayments: args.loanPayments || [],
    documents: args.documents || [],
    occupancyReviewInbox: args.occupancyReviewInbox,
    yearFilter: args.yearFilter,
    propertyFilter: args.propertyFilter,
    todayIso: args.todayIso,
    getDeductibleInterest: args.getDeductibleInterest,
  };
  const scopedLoans = (args.loans || []).filter((loan) => loanMatchesPropertyFilter(loan, args.propertyFilter));
  const readinessRows = scopedLoans.map((loan) => getLoanReadiness(loan, context));
  const inbox = buildLoanReviewInbox(args);
  return {
    ready: readinessRows.filter((item) => item.key === "ready").length,
    needsReview: readinessRows.filter((item) => item.key === "needs_review").length,
    notApplicable: readinessRows.filter((item) => item.key === "not_applicable").length,
    missing1098Review: inbox.counts.missing1098Review,
    escrowReviewOpen: inbox.counts.escrowReviewOpen,
    missingPaymentMonths: inbox.counts.missingPaymentMonths,
    occupancyDependencyWarnings: inbox.counts.occupancyDependencyWarnings,
  };
}
