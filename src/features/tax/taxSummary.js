import { loanIdsMatch } from "../../domain/loans.ts";
import { groupByLabel, supportStatusForTaxDetail } from "./taxPresentation.js";

const TAX_LINE_DEFS = [
  { key: "rentalIncome", line: "3", label: "Rents received", type: "income" },
  { key: "otherIncome", line: "4", label: "Royalties / other income", type: "income" },
  { key: "advertising", line: "5", label: "Advertising", type: "expense" },
  { key: "travel", line: "6", label: "Auto and travel", type: "expense" },
  { key: "cleaningMaintenance", line: "7", label: "Cleaning and maintenance", type: "expense" },
  { key: "commissions", line: "8", label: "Commissions", type: "expense" },
  { key: "insurance", line: "9", label: "Insurance", type: "expense" },
  { key: "legalProfessional", line: "10", label: "Legal and other professional fees", type: "expense" },
  { key: "managementFees", line: "11", label: "Management fees", type: "expense" },
  { key: "mortgageInterest", line: "12", label: "Mortgage interest paid to banks, etc.", type: "expense" },
  { key: "otherInterest", line: "13", label: "Other interest", type: "expense" },
  { key: "repairs", line: "14", label: "Repairs", type: "expense" },
  { key: "supplies", line: "15", label: "Supplies", type: "expense" },
  { key: "taxes", line: "16", label: "Taxes", type: "expense" },
  { key: "utilities", line: "17", label: "Utilities", type: "expense" },
  { key: "depreciation", line: "18", label: "Depreciation expense or depletion", type: "expense" },
  { key: "otherExpenses", line: "19", label: "Other", type: "expense" },
];

const FIELD_BY_LINE = {
  rentalIncome: "rentalIncome",
  otherIncome: "otherIncome",
  advertising: "otherExpenses",
  cleaningMaintenance: "cleaningMaintenance",
  commissions: "otherExpenses",
  repairs: "repairs",
  supplies: "supplies",
  utilities: "utilities",
  insurance: "insurance",
  taxes: "propertyTaxes",
  mortgageInterest: "mortgageInterest",
  legalProfessional: "otherExpenses",
  managementFees: "otherExpenses",
  travel: "otherExpenses",
  otherInterest: "otherExpenses",
  otherExpenses: "otherExpenses",
  depreciation: "depreciation",
};

function money(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasMoneyOverride(value) {
  if (value === "" || value == null) return false;
  return Number.isFinite(Number(value));
}

function selectedYear(yearFilter) {
  return String(yearFilter || new Date().getFullYear());
}

function matchesScope(item, propertyFilter = "all") {
  return !propertyFilter || propertyFilter === "all" || item?.propertyId === propertyFilter;
}

function singleScopedPropertyId(...sourceGroups) {
  const propertyIds = new Set();
  sourceGroups.flat().forEach((item) => {
    if (item?.propertyId) propertyIds.add(item.propertyId);
  });
  return propertyIds.size === 1 ? Array.from(propertyIds)[0] : "";
}

function linkedDocumentCount(sourceId, documents = [], field = "transactionId") {
  return documents.filter((document) =>
    document[field] === sourceId ||
    (Array.isArray(document.relatedTransactionIds) && document.relatedTransactionIds.includes(sourceId))
  ).length;
}

function incomeLineForTransaction(transaction) {
  const text = [transaction.category, transaction.description, transaction.notes].join(" ").toLowerCase();
  if (text.includes("fee") || text.includes("deposit") || text.includes("late")) return "otherIncome";
  return "rentalIncome";
}

function expenseLineForTransaction(transaction) {
  const category = String(transaction.category || "");
  if (category === "Advertising") return "advertising";
  if (category === "Commissions") return "commissions";
  if (category === "Cleaning and maintenance") return "cleaningMaintenance";
  if (category === "Repairs") return "repairs";
  if (category === "Supplies") return "supplies";
  if (category === "Utilities") return "utilities";
  if (category === "Insurance") return "insurance";
  if (category === "Taxes") return "taxes";
  if (category === "Legal and other professional fees") return "legalProfessional";
  if (category === "Management fees") return "managementFees";
  if (category === "Auto and travel") return "travel";
  if (category === "Other interest") return "otherInterest";
  return "otherExpenses";
}

function transactionDetailDescription(transaction, fallback = "Expense") {
  const description = transaction.description || transaction.category || fallback;
  if (transaction.category !== "Auto and travel") return description;
  const miles = money(transaction.mileageMiles);
  const rate = money(transaction.mileageRate);
  if (miles <= 0 || rate <= 0) return description;
  return `${description} (${miles} miles x $${rate.toFixed(3)}/mi)`;
}

function createDetail({ lineKey, sourceType, source, description, propertyId, unit = "Shared", originalAmount, deductibleAmount, documentCount = 0, reviewStatus = "reviewed", actionTarget, supportSubtype = "" }) {
  return {
    id: `${lineKey}-${sourceType}-${source?.id || description}`,
    lineKey,
    date: source?.date || source?.paymentDate || source?.placedInService || "",
    sourceType,
    supportSubtype,
    description,
    propertyId,
    unit,
    originalAmount: money(originalAmount),
    deductibleAmount: money(deductibleAmount),
    documentCount,
    reviewStatus,
    actionTarget,
    source,
  };
}

function clampPct(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(0, Math.min(1, parsed));
}

function weightedLoanPaymentRentalUsePct(payments = [], getRentalUsePct, amountSelector = () => 1) {
  if (typeof getRentalUsePct !== "function") return 1;
  let weightedTotal = 0;
  let weightTotal = 0;
  payments.forEach((payment) => {
    const weight = Math.max(0, money(amountSelector(payment)));
    if (weight <= 0) return;
    weightedTotal += clampPct(getRentalUsePct(payment)) * weight;
    weightTotal += weight;
  });
  if (weightTotal <= 0) return 1;
  return weightedTotal / weightTotal;
}

export function compareFiledAmounts(computed = {}, filedAmounts = {}, tolerance = 5) {
  return Object.entries(filedAmounts || {})
    .filter(([, value]) => value !== "" && value != null && Number.isFinite(Number(value)))
    .map(([field, value]) => {
      const computedField = field === "taxes" ? "propertyTaxes" : field;
      const computedAmount = money(computed[computedField]);
      const filedAmount = money(value);
      const difference = filedAmount - computedAmount;
      const material = Math.abs(difference) > Math.max(tolerance, Math.abs(computedAmount) * 0.01);
      return { field, computedField, computedAmount, filedAmount, difference, material };
    })
    .filter((row) => row.material);
}

export function buildComputedFiledRows(computed = {}, filedAmounts = {}, overrideNotes = {}) {
  const labels = {
    rentalIncome: "Rental income",
    otherIncome: "Other income / fees",
    mortgageInterest: "Mortgage interest",
    propertyTaxes: "Property taxes",
    insurance: "Insurance",
    depreciation: "Depreciation",
    advertising: "Advertising",
    commissions: "Commissions",
    legalProfessional: "Legal and other professional fees",
    managementFees: "Management fees",
    otherInterest: "Other interest",
    repairs: "Repairs",
    utilities: "Utilities",
    supplies: "Supplies",
    cleaningMaintenance: "Cleaning and maintenance",
    otherExpenses: "Other expenses",
  };
  return Object.entries(labels).map(([field, label]) => {
    const filedField = field === "propertyTaxes" && filedAmounts?.taxes != null ? "taxes" : field;
    const noteField = field === "propertyTaxes" && overrideNotes?.taxes ? "taxes" : field;
    const hasFiledAmount = filedAmounts?.[filedField] !== "" && filedAmounts?.[filedField] != null;
    const computedAmount = money(computed[field]);
    const filedAmount = hasFiledAmount ? money(filedAmounts[filedField]) : null;
    const difference = hasFiledAmount ? filedAmount - computedAmount : 0;
    const material = hasFiledAmount && Math.abs(difference) > Math.max(5, Math.abs(computedAmount) * 0.01);
    const note = String(overrideNotes?.[noteField] || "");
    return {
      field,
      filedField,
      label,
      computedAmount,
      filedAmount,
      difference,
      note,
      status: !hasFiledAmount || !material ? "match" : note.trim() ? "difference" : "needs_note",
    };
  });
}

export function buildTaxSummaryTieOut({ taxSnapshot = {}, taxReportingSummary = {} } = {}) {
  const rows = [
    {
      key: "grossRent",
      label: "Income",
      legacyAmount: money(taxSnapshot.metrics?.grossRent),
      sourceAmount: money(taxReportingSummary.totalIncome),
      helperText: "Legacy snapshot gross rent compared to Schedule E-style rental plus fee income.",
      comparable: true,
    },
    {
      key: "opExp",
      label: "Operating expenses",
      legacyAmount: money(taxSnapshot.metrics?.opExp),
      sourceAmount: TAX_LINE_DEFS
        .filter((line) => line.type === "expense" && !["mortgageInterest", "depreciation"].includes(line.key))
        .reduce((sum, line) => sum + money(taxReportingSummary.totals?.[line.key]), 0) - money(taxReportingSummary.totals?.pmi),
      helperText: "Legacy snapshot operating expenses compared to Schedule E-style expense lines excluding loan interest, PMI, and depreciation.",
      comparable: true,
    },
    {
      key: "deductibleLoanInterest",
      label: "Mortgage interest",
      legacyAmount: money(taxSnapshot.metrics?.deductibleLoanInterest),
      sourceAmount: money(taxReportingSummary.totals?.mortgageInterest),
      helperText: "Legacy snapshot loan interest compared to Schedule E-style loan review interest.",
      comparable: true,
    },
    {
      key: "depreciation",
      label: "Depreciation",
      legacyAmount: money(taxSnapshot.metrics?.depreciation),
      sourceAmount: money(taxReportingSummary.totals?.depreciation),
      helperText: "Legacy snapshot depreciation compared to asset-sourced Schedule E-style depreciation.",
      comparable: true,
    },
    {
      key: "scheduleE",
      label: "Net rental income/loss",
      legacyAmount: money(taxSnapshot.metrics?.scheduleE),
      sourceAmount: money(taxReportingSummary.netRentalIncomeLoss),
      helperText: "These totals may use different grouping rules.",
      comparable: false,
    },
  ];

  return rows.map((row) => {
    const difference = row.sourceAmount - row.legacyAmount;
    const material = row.comparable && Math.abs(difference) > Math.max(5, Math.abs(row.legacyAmount) * 0.01);
    return { ...row, difference, material };
  });
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

export function buildTaxLineDetailsCsvRows(taxReportingSummary = {}) {
  const headers = [
    "Tax line",
    "Date",
    "Source type",
    "Description",
    "Property",
    "Unit",
    "Original amount",
    "Deductible/rental amount",
    "Document count",
    "Review status",
    "Source id",
  ];
  const labelsByKey = Object.fromEntries((taxReportingSummary.lineDefs || TAX_LINE_DEFS).map((line) => [line.key, line.label]));
  const rows = Object.entries(taxReportingSummary.details || {}).flatMap(([lineKey, details]) =>
    (details || []).map((detail) => [
      labelsByKey[lineKey] || lineKey,
      detail.date || "",
      detail.sourceType || "",
      detail.description || "",
      detail.propertyId || "",
      detail.unit || "",
      money(detail.originalAmount).toFixed(2),
      money(detail.deductibleAmount).toFixed(2),
      String(detail.documentCount || 0),
      detail.reviewStatus || "",
      detail.source?.id || "",
    ]),
  );
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

function hasLinkedIncomeForLedgerEntry(entry, transactions = []) {
  if (entry?.transactionId && transactions.some((transaction) => transaction.id === entry.transactionId)) return true;
  return transactions.some((transaction) => transaction.tenantLedgerEntryId === entry?.id);
}

export function getTaxDoubleCountingWarnings(args = {}) {
  const {
    transactions = [],
    loans = [],
    tenantLedgerEntries = [],
    yearFilter,
    propertyFilter = "all",
  } = args;
  const year = selectedYear(yearFilter);
  const scopedExpenseTransactions = transactions
    .filter((transaction) => transaction.type === "Expense" && String(transaction.date || "").startsWith(year) && matchesScope(transaction, propertyFilter));
  const scopedIncomeTransactions = transactions
    .filter((transaction) => transaction.type === "Income" && String(transaction.date || "").startsWith(year) && matchesScope(transaction, propertyFilter));
  const warnings = [];

  loans.filter((loan) => matchesScope(loan, propertyFilter)).forEach((loan) => {
    const review = (loan.yearEndReviews || []).find((item) => String(item.year) === year) || {};
    if (money(review.escrowPropertyTaxPaid) > 0 && scopedExpenseTransactions.some((transaction) => transaction.propertyId === loan.propertyId && transaction.category === "Taxes")) {
      warnings.push({ key: "escrow_tax_possible_duplicate", label: "Escrow tax allocation may duplicate a Taxes transaction", targetView: "loans", sourceId: loan.id });
    }
    if (money(review.escrowInsurancePaid) > 0 && scopedExpenseTransactions.some((transaction) => transaction.propertyId === loan.propertyId && transaction.category === "Insurance")) {
      warnings.push({ key: "escrow_insurance_possible_duplicate", label: "Escrow insurance allocation may duplicate an Insurance transaction", targetView: "loans", sourceId: loan.id });
    }
    if (hasMoneyOverride(review.deductibleInterestOverride)) {
      warnings.push({ key: "mortgage_interest_override_active", label: "Mortgage interest override is used instead of computed loan payment interest", targetView: "loans", sourceId: loan.id });
    }
  });

  tenantLedgerEntries
    .filter((entry) => String(entry.date || "").startsWith(year))
    .filter((entry) => matchesScope(entry, propertyFilter))
    .forEach((entry) => {
      const treatment = String(entry.accountingTreatment || "");
      if (treatment === "security_deposit_liability" || treatment === "security_deposit_return") return;
      const looksIncome = entry.kind === "charge" && (treatment.includes("income") || /rent|fee|cleaning|pet|late/i.test([entry.memo, treatment].join(" ")));
      if (looksIncome && !hasLinkedIncomeForLedgerEntry(entry, scopedIncomeTransactions)) {
        warnings.push({ key: "tenant_ledger_unposted_income", label: "Tenant ledger income is not posted to an income transaction", targetView: "leaseHistory", sourceId: entry.id });
      }
    });

  return warnings.filter((warning, index, list) => list.findIndex((candidate) => candidate.key === warning.key && candidate.sourceId === warning.sourceId) === index);
}

export function getTaxCenterReadinessLabel(taxReadinessSummary = {}) {
  if (taxReadinessSummary.status === "ready") {
    return { key: "ready", label: "Reviewed source records", helperText: "Source records are ready for Tax Center review." };
  }
  return { key: "preliminary", label: "Preliminary", helperText: "Source records still need cleanup. Review the items below before relying on tax totals." };
}

export function buildTaxLineDetails(args = {}) {
  const {
    transactions = [],
    loanPayments = [],
    loans = [],
    assets = [],
    documents = [],
    yearFilter,
    propertyFilter = "all",
    effectiveTransactionDeductibleAmount,
    effectiveLoanPaymentDeductibleInterest,
    effectiveLoanPaymentRentalUsePct,
    assetDepreciationForYear,
    escrowEstimateSupport = {},
  } = args;
  const year = selectedYear(yearFilter);
  const details = Object.fromEntries(TAX_LINE_DEFS.map((line) => [line.key, []]));

  transactions
    .filter((transaction) => String(transaction.date || "").startsWith(year))
    .filter((transaction) => matchesScope(transaction, propertyFilter))
    .forEach((transaction) => {
      if (transaction.type === "Income") {
        const lineKey = incomeLineForTransaction(transaction);
        details[lineKey].push(createDetail({
          lineKey,
          sourceType: "transaction",
          source: transaction,
          description: transaction.description || transaction.category || "Income",
          propertyId: transaction.propertyId,
          unit: transaction.unit,
          originalAmount: transaction.amount,
          deductibleAmount: transaction.amount,
          documentCount: linkedDocumentCount(transaction.id, documents),
          reviewStatus: transaction.taxChecked ? "reviewed" : "open",
          actionTarget: "ledger",
        }));
        return;
      }

      if (transaction.type !== "Expense" || transaction.capitalImprovement) return;
      const lineKey = expenseLineForTransaction(transaction);
      const deductibleAmount = effectiveTransactionDeductibleAmount?.(transaction) ?? transaction.deductibleAmount ?? transaction.amount;
      details[lineKey].push(createDetail({
        lineKey,
        sourceType: "transaction",
        source: transaction,
        description: transactionDetailDescription(transaction, "Expense"),
        propertyId: transaction.propertyId,
        unit: transaction.unit,
        originalAmount: transaction.amount,
        deductibleAmount,
        documentCount: linkedDocumentCount(transaction.id, documents),
        reviewStatus: transaction.taxChecked ? "reviewed" : "open",
        actionTarget: "ledger",
      }));
    });

  loans
    .filter((loan) => matchesScope(loan, propertyFilter))
    .forEach((loan) => {
      const review = (loan.yearEndReviews || []).find((item) => String(item.year) === year) || {};
      const paymentsForLoan = loanPayments.filter((payment) => loanIdsMatch(payment.loanId, loan.id) && String(payment.paymentDate || "").startsWith(year));
      const recordedInterest = paymentsForLoan.reduce((sum, payment) => sum + money(payment.interest), 0);
      const deductibleInterest = hasMoneyOverride(review.deductibleInterestOverride)
        ? money(review.deductibleInterestOverride)
        : paymentsForLoan.reduce((sum, payment) => sum + money(effectiveLoanPaymentDeductibleInterest?.(payment) ?? payment.deductibleInterest), 0);
      const pmi = hasMoneyOverride(review.pmiOverride)
        ? money(review.pmiOverride)
        : paymentsForLoan.reduce((sum, payment) => sum + money(payment.mortgageInsurance) * clampPct(effectiveLoanPaymentRentalUsePct?.(payment) ?? 1), 0);
      const escrowTotal = paymentsForLoan.reduce((sum, payment) => sum + money(payment.escrow), 0);
      const escrowRentalUsePct = weightedLoanPaymentRentalUsePct(
        paymentsForLoan,
        effectiveLoanPaymentRentalUsePct,
        (payment) => payment.escrow,
      );
      if (recordedInterest > 0 || deductibleInterest > 0 || hasMoneyOverride(review.form1098Interest)) {
        details.mortgageInterest.push(createDetail({
          lineKey: "mortgageInterest",
          sourceType: hasMoneyOverride(review.deductibleInterestOverride) ? "override" : "loan",
          source: loan,
          description: `${loan.lender} deductible interest`,
          propertyId: loan.propertyId,
          originalAmount: recordedInterest,
          deductibleAmount: deductibleInterest,
          documentCount: documents.filter((document) => document.propertyId === loan.propertyId && /1098|mortgage|loan/i.test([document.name, document.type, document.extractedText].join(" "))).length,
          reviewStatus: review.reviewed ? "reviewed" : "open",
          actionTarget: "loans",
        }));
      }
      if (pmi > 0) {
        details.insurance.push(createDetail({
          lineKey: "insurance",
          sourceType: "loan",
          source: loan,
          description: `${loan.lender} PMI / mortgage insurance`,
          propertyId: loan.propertyId,
          originalAmount: pmi,
          deductibleAmount: pmi,
          reviewStatus: review.reviewed ? "reviewed" : "open",
          actionTarget: "loans",
          supportSubtype: "pmi",
        }));
      }
      if (money(review.escrowPropertyTaxPaid) > 0) {
        details.taxes.push(createDetail({
          lineKey: "taxes",
          sourceType: "loan_review",
          source: loan,
          description: `${loan.lender} reviewed escrow property tax`,
          propertyId: loan.propertyId,
          originalAmount: escrowTotal,
          deductibleAmount: money(review.escrowPropertyTaxPaid) * escrowRentalUsePct,
          reviewStatus: review.reviewed ? "reviewed" : "open",
          actionTarget: "loans",
        }));
      }
      if (money(review.escrowInsurancePaid) > 0) {
        details.insurance.push(createDetail({
          lineKey: "insurance",
          sourceType: "loan_review",
          source: loan,
          description: `${loan.lender} reviewed escrow insurance`,
          propertyId: loan.propertyId,
          originalAmount: escrowTotal,
          deductibleAmount: money(review.escrowInsurancePaid) * escrowRentalUsePct,
          reviewStatus: review.reviewed ? "reviewed" : "open",
          actionTarget: "loans",
        }));
      }
    });

  const escrowEstimateRentalUsePct = weightedLoanPaymentRentalUsePct(
    loans
      .filter((loan) => matchesScope(loan, propertyFilter))
      .flatMap((loan) => loanPayments.filter((payment) => loanIdsMatch(payment.loanId, loan.id) && String(payment.paymentDate || "").startsWith(year))),
    effectiveLoanPaymentRentalUsePct,
    (payment) => payment.escrow,
  );
  const escrowEstimatePropertyId = propertyFilter === "all"
    ? singleScopedPropertyId(
        loans.filter((loan) => matchesScope(loan, propertyFilter)),
        transactions.filter((transaction) => String(transaction.date || "").startsWith(year) && matchesScope(transaction, propertyFilter)),
        assets.filter((asset) => matchesScope(asset, propertyFilter)),
      ) || "all"
    : propertyFilter;

  [
    {
      lineKey: "taxes",
      support: escrowEstimateSupport.taxes,
      description: "Escrow-derived property tax estimate",
    },
    {
      lineKey: "insurance",
      support: escrowEstimateSupport.insurance,
      description: "Escrow-derived insurance estimate",
    },
  ].forEach(({ lineKey, support, description }) => {
    const estimatedAmount = money(support?.estimatedAmount) * (support?.rentalUseApplied ? 1 : escrowEstimateRentalUsePct);
    if (!support?.estimatedFromEscrow || estimatedAmount <= 0) return;
    details[lineKey].push(createDetail({
      lineKey,
      sourceType: "escrow_estimate",
      source: { id: `${lineKey}-escrow-estimate`, date: year ? `${year}-12-31` : "" },
      description,
      propertyId: escrowEstimatePropertyId,
      originalAmount: estimatedAmount,
      deductibleAmount: estimatedAmount,
      documentCount: 0,
      reviewStatus: "open",
      actionTarget: "loans",
    }));
  });

  assets
    .filter((asset) => matchesScope(asset, propertyFilter))
    .forEach((asset) => {
      const depreciation = assetDepreciationForYear?.(asset, Number(year)) ?? 0;
      if (depreciation <= 0) return;
      details.depreciation.push(createDetail({
        lineKey: "depreciation",
        sourceType: "asset",
        source: asset,
        description: asset.description || "Asset depreciation",
        propertyId: asset.propertyId,
        unit: asset.unit,
        originalAmount: asset.basis || asset.cost,
        deductibleAmount: depreciation,
        documentCount: Array.isArray(asset.sourceDocumentIds) ? asset.sourceDocumentIds.length : 0,
        reviewStatus: asset.assetReviewChecked ? "reviewed" : "open",
        actionTarget: "assets",
      }));
    });

  return details;
}

export function buildTaxSummary(args = {}) {
  const details = buildTaxLineDetails(args);
  const totals = Object.fromEntries(TAX_LINE_DEFS.map((line) => [
    line.key,
    details[line.key].reduce((sum, row) => sum + money(row.deductibleAmount), 0),
  ]));
  totals.pmi = (details.insurance || [])
    .filter((row) => row.supportSubtype === "pmi")
    .reduce((sum, row) => sum + money(row.deductibleAmount), 0);
  const totalIncome = totals.rentalIncome + totals.otherIncome;
  const totalExpenses = TAX_LINE_DEFS
    .filter((line) => line.type === "expense")
    .reduce((sum, line) => sum + money(totals[line.key]), 0);
  const computed = {
    rentalIncome: totals.rentalIncome,
    otherIncome: totals.otherIncome,
    mortgageInterest: totals.mortgageInterest,
    propertyTaxes: totals.taxes,
    insurance: totals.insurance,
    depreciation: totals.depreciation,
    advertising: totals.advertising,
    commissions: totals.commissions,
    legalProfessional: totals.legalProfessional,
    managementFees: totals.managementFees,
    otherInterest: totals.otherInterest,
    repairs: totals.repairs,
    utilities: totals.utilities,
    supplies: totals.supplies,
    cleaningMaintenance: totals.cleaningMaintenance,
    otherExpenses: totals.otherExpenses + totals.travel,
  };
  const overrideNotes = args.filedAmounts?.overrideNotes || {};

  return {
    readiness: getTaxCenterReadinessLabel(args.taxReadinessSummary),
    lineDefs: TAX_LINE_DEFS,
    details,
    totals,
    totalIncome,
    totalExpenses,
    netRentalIncomeLoss: totalIncome - totalExpenses,
    filedDifferences: compareFiledAmounts(computed, args.filedAmounts || {}),
    computedFiledRows: buildComputedFiledRows(computed, args.filedAmounts || {}, overrideNotes),
    doubleCountingWarnings: getTaxDoubleCountingWarnings(args),
    status: args.taxReadinessSummary?.status === "ready" ? "reviewed" : "preliminary",
  };
}

export function buildTaxPacketSummary(args = {}) {
  const summary = buildTaxSummary(args);
  const stripDetailSource = (detail) => {
    const { source, ...safeDetail } = detail;
    return { ...safeDetail, sourceId: source?.id || "" };
  };
  const openItems = (args.taxReadinessSummary?.sections || [])
    .filter((section) => Number(section.reviewCount || 0) > 0)
    .map((section) => ({
      key: section.key,
      label: section.label,
      reviewCount: section.reviewCount,
      helperText: section.helperText,
      targetView: section.targetView,
    }));
  const allDetails = Object.values(summary.details).flat();
  const expenseSupportGaps = allDetails.filter((detail) =>
    detail.sourceType === "transaction" &&
    detail.lineKey !== "rentalIncome" &&
    detail.documentCount === 0
  );
  const loanDocumentGaps = allDetails.filter((detail) =>
    ["loan", "loan_review", "override"].includes(detail.sourceType) &&
    detail.documentCount === 0
  );
  const assetSourceGaps = allDetails.filter((detail) =>
    detail.sourceType === "asset" &&
    detail.documentCount === 0
  );
  const rentIncomeSupportWarnings = allDetails.filter((detail) =>
    detail.lineKey === "rentalIncome" &&
    supportStatusForTaxDetail(detail).key === "income_support_missing"
  );
  const missingSupport = [
    ...expenseSupportGaps,
    ...loanDocumentGaps,
    ...assetSourceGaps,
  ];
  const loanDocumentRows = allDetails.filter((detail) => detail.lineKey === "mortgageInterest" && detail.documentCount > 0);
  const groupedOpenItems = groupByLabel([
    ...openItems,
    ...summary.doubleCountingWarnings.map((warning) => ({
      key: warning.key,
      label: warning.label,
      reviewCount: 1,
      helperText: "Review source records before relying on packet totals.",
      targetView: warning.targetView,
    })),
  ]);

  return {
    readiness: summary.readiness,
    scheduleSummary: {
      ...summary,
      details: Object.fromEntries(Object.entries(summary.details).map(([key, rows]) => [key, rows.map(stripDetailSource)])),
    },
    filedDifferences: summary.filedDifferences,
    depreciationSummary: {
      total: summary.totals.depreciation,
      assets: summary.details.depreciation.map(stripDetailSource),
    },
    loanSummary: {
      mortgageInterest: summary.totals.mortgageInterest,
      pmi: summary.totals.pmi,
      reviewedEscrowTaxes: summary.details.taxes.filter((detail) => detail.sourceType === "loan_review").reduce((sum, detail) => sum + detail.deductibleAmount, 0),
      reviewedEscrowInsurance: summary.details.insurance.filter((detail) => detail.sourceType === "loan_review").reduce((sum, detail) => sum + detail.deductibleAmount, 0),
    },
    documentChecklist: {
      linkedDocumentCount: allDetails.reduce((sum, detail) => sum + Number(detail.documentCount || 0), 0),
      missingSupportCount: missingSupport.length,
      missingSupport: missingSupport.map(stripDetailSource),
      expenseSupportGaps: expenseSupportGaps.map(stripDetailSource),
      loanDocumentGaps: loanDocumentGaps.map(stripDetailSource),
      assetSourceGaps: assetSourceGaps.map(stripDetailSource),
      rentIncomeSupportWarnings: rentIncomeSupportWarnings.map(stripDetailSource),
      loanDocumentCount: loanDocumentRows.reduce((sum, detail) => sum + Number(detail.documentCount || 0), 0),
    },
    openItems: groupedOpenItems,
  };
}
