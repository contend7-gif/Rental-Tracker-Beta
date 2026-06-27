import { useEffect, useMemo } from "react";
import { buildDashboardFiltersSummary, buildTrendDescriptor } from "../store/dashboardContext.ts";
import {
  scheduleELines,
  scheduleLineSourceNote,
} from "./accountingShared.js";
import { findLoanById } from "../domain/loans.ts";

export function useTaxOverviewModel({
  activeTx,
  adjustedAssetDepreciationForYear,
  appSettings,
  assets,
  currency,
  deMinimisThreshold,
  effectiveLoanPaymentDeductibleInterest,
  effectiveTransactionDeductibleAmount,
  getScheduleELineIdForTransaction,
  leases,
  loans,
  propertyFilter,
  propertyNameById,
  setNotice,
  setTaxReviewCollapsed,
  todayIso,
  unitFilter,
  units,
  usePeriods,
  yearFilter,
  loanPayments,
}) {
  const yearScopedTransactions = useMemo(
    () => activeTx.filter((t) => t.date.startsWith(yearFilter) && (propertyFilter === "all" || t.propertyId === propertyFilter) && (unitFilter === "all" || t.unit === unitFilter)),
    [activeTx, yearFilter, propertyFilter, unitFilter],
  );

  const yearScopedLoanPayments = useMemo(
    () =>
      loanPayments.filter((payment) => {
        if (!payment.paymentDate?.startsWith(yearFilter)) return false;
        if (propertyFilter === "all") return true;
        const linkedLoan = findLoanById(loans, payment.loanId);
        return linkedLoan?.propertyId === propertyFilter;
      }),
    [loanPayments, loans, propertyFilter, yearFilter],
  );

  const metrics = useMemo(() => {
    const grossRent = yearScopedTransactions.filter((t) => t.type === "Income").reduce((sum, t) => sum + t.amount, 0);
    const opExp = yearScopedTransactions.filter((t) => t.type === "Expense" && !t.capitalImprovement).reduce((sum, t) => sum + effectiveTransactionDeductibleAmount(t), 0);
    const deductibleLoanInterest = yearScopedLoanPayments.reduce((sum, lp) => sum + effectiveLoanPaymentDeductibleInterest(lp), 0);
    const mortgagePaid = yearScopedLoanPayments.reduce((sum, lp) => sum + lp.totalPayment, 0);
    const selectedYearNum = Number(yearFilter);
    const depreciation = assets.reduce((sum, a) => sum + adjustedAssetDepreciationForYear({ asset: a, year: selectedYearNum, usePeriods, leases, units }), 0);
    return {
      grossRent,
      opExp,
      deductibleLoanInterest,
      mortgagePaid,
      depreciation,
      scheduleE: grossRent - opExp - deductibleLoanInterest - depreciation,
    };
  }, [yearScopedTransactions, yearScopedLoanPayments, assets, yearFilter, usePeriods, leases, units, adjustedAssetDepreciationForYear, effectiveLoanPaymentDeductibleInterest, effectiveTransactionDeductibleAmount]);

  const trendComparisons = useMemo(() => {
    const selectedYear = Number(yearFilter);
    const currentYear = new Date().getFullYear();
    const periodEndMonthDay = selectedYear === currentYear ? todayIso.slice(5, 10) : "12-31";

    const inPeriod = (txn, year) => {
      if (!txn.date?.startsWith(String(year))) return false;
      if (txn.date.slice(5, 10) > periodEndMonthDay) return false;
      if (propertyFilter !== "all" && txn.propertyId !== propertyFilter) return false;
      if (unitFilter !== "all" && txn.unit !== unitFilter) return false;
      return true;
    };

    const currentYearTx = activeTx.filter((txn) => inPeriod(txn, selectedYear));
    const priorYearTx = activeTx.filter((txn) => inPeriod(txn, selectedYear - 1));

    return {
      currentGrossRent: currentYearTx.filter((txn) => txn.type === "Income").reduce((sum, txn) => sum + txn.amount, 0),
      priorGrossRent: priorYearTx.filter((txn) => txn.type === "Income").reduce((sum, txn) => sum + txn.amount, 0),
      currentDeductibleExpenses: currentYearTx.filter((txn) => txn.type === "Expense" && !txn.capitalImprovement).reduce((sum, txn) => sum + effectiveTransactionDeductibleAmount(txn), 0),
      priorDeductibleExpenses: priorYearTx.filter((txn) => txn.type === "Expense" && !txn.capitalImprovement).reduce((sum, txn) => sum + effectiveTransactionDeductibleAmount(txn), 0),
    };
  }, [activeTx, propertyFilter, unitFilter, yearFilter, todayIso, effectiveTransactionDeductibleAmount]);

  const grossRentTrend = useMemo(
    () => buildTrendDescriptor(trendComparisons.currentGrossRent, trendComparisons.priorGrossRent, true),
    [trendComparisons.currentGrossRent, trendComparisons.priorGrossRent],
  );

  const deductibleExpensesTrend = useMemo(
    () => buildTrendDescriptor(trendComparisons.currentDeductibleExpenses, trendComparisons.priorDeductibleExpenses, false),
    [trendComparisons.currentDeductibleExpenses, trendComparisons.priorDeductibleExpenses],
  );

  const annualLoanSummary = useMemo(
    () =>
      yearScopedLoanPayments.reduce(
        (acc, payment) => {
          acc.interest += Number(payment.interest || 0);
          acc.deductibleInterest += effectiveLoanPaymentDeductibleInterest(payment);
          acc.principal += Number(payment.principal || 0);
          acc.extraPrincipal += Number(payment.extraPrincipal || 0);
          acc.escrow += Number(payment.escrow || 0);
          acc.pmi += Number(payment.mortgageInsurance || 0);
          acc.total += Number(payment.totalPayment || 0);
          return acc;
        },
        { interest: 0, deductibleInterest: 0, principal: 0, extraPrincipal: 0, escrow: 0, pmi: 0, total: 0 },
      ),
    [yearScopedLoanPayments, effectiveLoanPaymentDeductibleInterest],
  );

  const scheduleEBreakdown = useMemo(() => {
    const totalsById = Object.fromEntries(scheduleELines.map((line) => [line.id, 0]));

    yearScopedTransactions.forEach((txn) => {
      const lineId = getScheduleELineIdForTransaction(txn);
      if (!lineId) return;
      const amount = txn.type === "Income" ? txn.amount : effectiveTransactionDeductibleAmount(txn);
      totalsById[lineId] += amount;
    });

    totalsById.mortgageInterest = metrics.deductibleLoanInterest;
    totalsById.depreciation = metrics.depreciation;

    return scheduleELines.map((line) => ({
      ...line,
      total: totalsById[line.id] || 0,
      sourceNote: scheduleLineSourceNote(line.source),
    }));
  }, [yearScopedTransactions, metrics.deductibleLoanInterest, metrics.depreciation, getScheduleELineIdForTransaction, effectiveTransactionDeductibleAmount]);

  const taxReviewSections = useMemo(() => {
    const expenseItems = yearScopedTransactions.filter((t) => t.type === "Expense");
    const reimbursableItems = expenseItems.filter((t) => t.reimbursable);

    return [
      {
        key: "unreimbursed",
        title: "Unreimbursed owner-paid expenses",
        hint: "Confirm reimbursement status before filing.",
        allItems: reimbursableItems,
        flaggedItems: reimbursableItems.filter((t) => !t.reimbursed),
      },
      {
        key: "capital",
        title: "Capital improvements to verify",
        hint: "Ensure capitalization/depreciation treatment is correct.",
        allItems: expenseItems,
        flaggedItems: expenseItems.filter((t) => t.capitalImprovement),
      },
      {
        key: "shared",
        title: "Shared expenses needing allocation",
        hint: "Confirm business-use allocation support.",
        allItems: expenseItems,
        flaggedItems: expenseItems.filter((t) => t.unit === "Shared"),
      },
      {
        key: "receipts",
        title: "Expenses missing receipt names",
        hint: "Attach or name documentation for audit trail.",
        allItems: expenseItems,
        flaggedItems: expenseItems.filter((t) => !t.receiptName),
      },
    ];
  }, [yearScopedTransactions]);

  useEffect(() => {
    setTaxReviewCollapsed((prev) => {
      const next = { ...prev };
      let changed = false;
      taxReviewSections.forEach((section) => {
        if (next[section.key] == null) {
          const openCount = section.flaggedItems.filter((item) => !item.taxChecked).length;
          next[section.key] = openCount === 0;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [taxReviewSections, setTaxReviewCollapsed]);

  const flags = {
    unreimbursed: taxReviewSections.find((s) => s.key === "unreimbursed")?.flaggedItems.length || 0,
    capReview: taxReviewSections.find((s) => s.key === "capital")?.flaggedItems.length || 0,
    sharedReview: taxReviewSections.find((s) => s.key === "shared")?.flaggedItems.length || 0,
    missingReceipts: taxReviewSections.find((s) => s.key === "receipts")?.flaggedItems.length || 0,
  };

  const dashboardUniqueOpenReviewItems = useMemo(() => {
    const groupedByTransactionId = {};

    taxReviewSections.forEach((section) => {
      section.flaggedItems
        .filter((item) => !item.taxChecked)
        .forEach((item) => {
          if (!groupedByTransactionId[item.id]) {
            groupedByTransactionId[item.id] = {
              ...item,
              reviewSectionKeys: [section.key],
              reviewSectionTitles: [section.title],
              reviewSectionHints: [section.hint].filter(Boolean),
            };
            return;
          }

          groupedByTransactionId[item.id] = {
            ...groupedByTransactionId[item.id],
            reviewSectionKeys: [...new Set([...groupedByTransactionId[item.id].reviewSectionKeys, section.key])],
            reviewSectionTitles: [...new Set([...groupedByTransactionId[item.id].reviewSectionTitles, section.title])],
            reviewSectionHints: [...new Set([...(groupedByTransactionId[item.id].reviewSectionHints || []), section.hint].filter(Boolean))],
          };
        });
    });

    return Object.values(groupedByTransactionId).sort((a, b) => b.date.localeCompare(a.date));
  }, [taxReviewSections]);

  const dashboardOpenReviewItems = useMemo(
    () => dashboardUniqueOpenReviewItems.slice(0, 6),
    [dashboardUniqueOpenReviewItems],
  );
  const taxReviewOpenCount = dashboardUniqueOpenReviewItems.length;

  const propertyFilterLabel = propertyFilter === "all" ? "All properties" : (propertyNameById[propertyFilter] || propertyFilter);
  const unitFilterLabel = unitFilter === "all" ? "All units" : unitFilter;
  const dashboardFiltersSummary = buildDashboardFiltersSummary(yearFilter, propertyFilterLabel, unitFilterLabel);

  const taxReviewCpaNotes = useMemo(() => {
    const totalFlagged = taxReviewSections.reduce((sum, section) => sum + section.flaggedItems.length, 0);
    const totalChecked = taxReviewSections.reduce(
      (sum, section) => sum + section.flaggedItems.filter((item) => item.taxChecked).length,
      0,
    );
    const appliedDeMinimisTotal = yearScopedTransactions
      .filter((txn) => txn.type === "Expense" && !txn.capitalImprovement && txn.deMinimisApplied)
      .reduce((sum, txn) => sum + effectiveTransactionDeductibleAmount(txn), 0);

    const lines = [
      `CPA Handoff - Rental Activity (${yearFilter})`,
      `Scope: ${propertyFilterLabel} | ${unitFilterLabel}`,
      "",
      "Schedule E estimate summary",
      `- Gross rent: ${currency(metrics.grossRent)}`,
      `- Deductible operating expenses: ${currency(metrics.opExp)}`,
      `- Deductible mortgage interest: ${currency(metrics.deductibleLoanInterest)}`,
      `- Depreciation estimate: ${currency(metrics.depreciation)}`,
      `- Estimated Schedule E (before carryover): ${currency(metrics.scheduleE)}`,
      "",
      "De minimis safe harbor",
      `- Election: ${appSettings.deMinimisElectionEnabled ? "On" : "Off"}`,
      `- AFS: ${appSettings.deMinimisHasAFS ? "Yes" : "No"}`,
      `- Threshold: ${currency(deMinimisThreshold)} per invoice/item`,
      `- Election statement prepared: ${appSettings.deMinimisStatementPrepared ? "Yes" : "No"}`,
      `- Applied de minimis deductions (selection): ${currency(appliedDeMinimisTotal)}`,
      "",
      "Tax review status",
      `- Flagged items: ${totalFlagged}`,
      `- Open items: ${taxReviewOpenCount}`,
      `- Checked items: ${totalChecked}`,
      "",
      "Open items by section",
    ];

    taxReviewSections.forEach((section) => {
      const unresolved = section.flaggedItems.filter((item) => !item.taxChecked);
      lines.push(`- ${section.title}: ${unresolved.length} open`);

      unresolved.slice(0, 8).forEach((item) => {
        const propertyName = propertyNameById[item.propertyId] || item.propertyId;
        lines.push(`  - ${item.date} | ${propertyName} | Unit ${item.unit} | ${item.category} | ${currency(item.amount)} | ${item.description || "(no description)"}`);
      });
    });

    if (taxReviewOpenCount === 0) {
      lines.push("- None. All flagged items are checked.");
    }

    lines.push("");
    lines.push("Generated from Rental Tracker Tax Center.");
    return lines.join("\n");
  }, [
    yearFilter,
    propertyFilterLabel,
    unitFilterLabel,
    taxReviewOpenCount,
    taxReviewSections,
    propertyNameById,
    metrics.grossRent,
    metrics.opExp,
    metrics.deductibleLoanInterest,
    metrics.depreciation,
    metrics.scheduleE,
    yearScopedTransactions,
    appSettings.deMinimisElectionEnabled,
    appSettings.deMinimisHasAFS,
    appSettings.deMinimisStatementPrepared,
    deMinimisThreshold,
    currency,
    effectiveTransactionDeductibleAmount,
  ]);

  const copyTaxReviewNotes = async () => {
    try {
      await navigator.clipboard.writeText(taxReviewCpaNotes);
      setNotice("CPA notes copied to clipboard.");
    } catch {
      setNotice("Could not copy notes. You can still copy from the text box.");
    }
  };

  return {
    annualLoanSummary,
    dashboardFiltersSummary,
    dashboardOpenReviewItems,
    dashboardUniqueOpenReviewItems,
    deductibleExpensesTrend,
    flags,
    grossRentTrend,
    metrics,
    propertyFilterLabel,
    scheduleEBreakdown,
    taxReviewCpaNotes,
    taxReviewOpenCount,
    taxReviewSections,
    unitFilterLabel,
    yearScopedLoanPayments,
    yearScopedTransactions,
    copyTaxReviewNotes,
  };
}
