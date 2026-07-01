import { useEffect, useMemo, useState } from "react";
import { deductibleMortgageInterest, createLoanPayment } from "../domain/accounting.ts";
import {
  buildLoanPaymentDraft,
  buildLoanSelectorOptions,
  deriveLoanBalanceFromPayments,
  findLoanById,
  findLoanBySelectorValue,
  formatLoanPaymentDraftTotal,
  loanPaymentDraftTotalAmount,
  reconcileLoanPaymentsAgainstSchedule,
} from "../domain/loans.ts";
import { addMonths } from "./dateHelpers.js";
import { estimatePropertyValueAtDate } from "../features/properties/propertyOperations.js";
import { loanIdsNeedRepair } from "../store/loanStore.ts";

function createInitialLoanDraft(todayIso) {
  return {
    propertyId: "",
    lender: "",
    loanType: "Primary Mortgage",
    lienPosition: "1",
    originatedOn: todayIso,
    rate: "",
    originalBalance: "",
    currentBalance: "",
    scheduledPI: "",
    scheduledEscrow: "",
    scheduledMortgageInsurance: "",
    defaultExtraPrincipal: "0",
    nextPayment: todayIso,
  };
}

function createInitialLoanPaymentDraft(todayIso) {
  return {
    loanId: "",
    paymentDate: todayIso,
    interest: "",
    principal: "",
    escrow: "",
    mortgageInsurance: "",
    extraPrincipal: "0",
  };
}

export function useLoanWorkspaceController({
  actions,
  confirmDestructiveActions,
  leases,
  loanPayments,
  loans,
  observedLoanDefaultsById,
  openConfirmDialog,
  planningAssumptions,
  prefetchDialog,
  properties,
  propertyFilter,
  requirePermission,
  setNotice,
  setView,
  todayIso,
  units,
  usePeriods,
}) {
  const [editingLoanId, setEditingLoanId] = useState("");
  const [editingLoanPaymentId, setEditingLoanPaymentId] = useState("");
  const [loanEditorOpen, setLoanEditorOpen] = useState(false);
  const [loanDraft, setLoanDraft] = useState(() => createInitialLoanDraft(todayIso));
  const [loanPaymentDraft, setLoanPaymentDraft] = useState(() => createInitialLoanPaymentDraft(todayIso));
  const [loanPaymentDraftTotalInput, setLoanPaymentDraftTotalInput] = useState("0");
  const [isEditingLoanPaymentTotal, setIsEditingLoanPaymentTotal] = useState(false);

  useEffect(() => {
    if (!loanDraft.propertyId && properties[0]?.id) {
      setLoanDraft((prev) => ({ ...prev, propertyId: properties[0].id }));
    }
  }, [loanDraft.propertyId, properties]);

  useEffect(() => {
    if (loanIdsNeedRepair(loans)) {
      actions.repairLoanIdentityCollisions?.();
    }
  }, [actions, loans]);

  const visibleLoans = useMemo(
    () => loans.filter((loan) => propertyFilter === "all" || loan.propertyId === propertyFilter),
    [loans, propertyFilter],
  );
  const visibleLoanOptions = useMemo(() => buildLoanSelectorOptions(visibleLoans), [visibleLoans]);

  const loanPropertySummaries = useMemo(() => {
    const grouped = new Map();
    visibleLoans.forEach((loan) => {
      const property = properties.find((entry) => entry.id === loan.propertyId);
      if (!property) return;
      const observedDefaults = observedLoanDefaultsById[loan.id] || {};
      const scheduledOutlay = Number(loan.scheduledPI || 0)
        + Number(observedDefaults.scheduledEscrow ?? loan.scheduledEscrow ?? 0)
        + Number(observedDefaults.scheduledMortgageInsurance ?? loan.scheduledMortgageInsurance ?? 0)
        + Number(loan.defaultExtraPrincipal || 0);
      if (!grouped.has(property.id)) {
        grouped.set(property.id, {
          property,
          loanCount: 0,
          totalBalance: 0,
          totalScheduledOutlay: 0,
        });
      }
      const bucket = grouped.get(property.id);
      bucket.loanCount += 1;
      bucket.totalBalance += Number(loan.currentBalance || 0);
      bucket.totalScheduledOutlay += scheduledOutlay;
    });
    return Array.from(grouped.values()).map((entry) => {
      const latestValuation = (entry.property.propertyValuations || [])[0];
      const supportedValue = Number(latestValuation?.value || entry.property.currentValue || entry.property.purchasePrice || 0);
      const valuationDate = latestValuation?.date || entry.property.purchasedOn || todayIso;
      const annualAppreciationPct = Number(planningAssumptions?.annualValueGrowthPct || 0);
      const estimatedCurrentValue = estimatePropertyValueAtDate(supportedValue, annualAppreciationPct, valuationDate, todayIso);
      const combinedLtv = estimatedCurrentValue > 0 ? (entry.totalBalance / estimatedCurrentValue) * 100 : null;
      return {
        ...entry,
        annualAppreciationPct,
        currentValue: estimatedCurrentValue,
        estimatedCurrentValue,
        supportedValue,
        valuationDate,
        combinedLtv,
      };
    });
  }, [visibleLoans, properties, observedLoanDefaultsById, planningAssumptions?.annualValueGrowthPct, todayIso]);

  const loanPaymentDraftTotal = useMemo(() => loanPaymentDraftTotalAmount(loanPaymentDraft), [loanPaymentDraft]);

  useEffect(() => {
    if (!isEditingLoanPaymentTotal) {
      setLoanPaymentDraftTotalInput(formatLoanPaymentDraftTotal(loanPaymentDraftTotal));
    }
  }, [loanPaymentDraftTotal, isEditingLoanPaymentTotal]);

  const effectiveLoanForDraft = (loan, excludedPaymentId = "") => {
    if (!loan) return loan;
    const paymentHistory = loanPayments.filter((payment) => String(payment.loanId ?? "") === String(loan.id ?? "") && payment.id !== excludedPaymentId);
    const insight = deriveLoanBalanceFromPayments(loan, paymentHistory);
    return insight.useDerivedBalance
      ? { ...loan, currentBalance: insight.derivedBalance }
      : loan;
  };

  useEffect(() => {
    if (!loanPaymentDraft.loanId && !loanPaymentDraft.loanSelectorValue && visibleLoanOptions[0]?.loan) {
      const loan = effectiveLoanForDraft(visibleLoanOptions[0].loan);
      const observedDefaults = observedLoanDefaultsById[loan.id] || {};
      setLoanPaymentDraft(buildLoanPaymentDraft(loan, observedDefaults, todayIso, {
        loanSelectorValue: visibleLoanOptions[0].value,
      }));
    }
  }, [loanPaymentDraft.loanId, loanPaymentDraft.loanSelectorValue, visibleLoanOptions, todayIso, observedLoanDefaultsById]);

  const clearLoanDraft = (propertyId) => {
    setEditingLoanId("");
    setLoanDraft({
      ...createInitialLoanDraft(todayIso),
      propertyId: propertyId || properties[0]?.id || "",
    });
  };

  const resetLoanPaymentDraftForLoan = (loan, overrides = {}) => {
    if (!loan) return;
    const effectiveLoan = effectiveLoanForDraft(loan);
    const observedDefaults = observedLoanDefaultsById[effectiveLoan.id] || {};
    const nextDraft = buildLoanPaymentDraft(effectiveLoan, observedDefaults, todayIso, overrides);
    setIsEditingLoanPaymentTotal(false);
    setLoanPaymentDraft(nextDraft);
    setLoanPaymentDraftTotalInput(formatLoanPaymentDraftTotal(loanPaymentDraftTotalAmount(nextDraft)));
  };

  const startEditLoanPayment = (payment) => {
    const loan = findLoanById(loans, payment.loanId);
    if (!loan) return;
    setEditingLoanPaymentId(payment.id);
    const nextDraft = buildLoanPaymentDraft(loan, observedLoanDefaultsById[loan.id] || {}, todayIso, {
      loanId: loan.id,
      paymentDate: payment.paymentDate,
      interest: payment.interest,
      principal: payment.principal,
      escrow: payment.escrow,
      mortgageInsurance: payment.mortgageInsurance,
      extraPrincipal: payment.extraPrincipal,
    });
    setIsEditingLoanPaymentTotal(false);
    setLoanPaymentDraft(nextDraft);
    setLoanPaymentDraftTotalInput(formatLoanPaymentDraftTotal(loanPaymentDraftTotalAmount(nextDraft)));
    setView("loans");
  };

  const cancelLoanPaymentEdit = () => {
    const loan = findLoanBySelectorValue(visibleLoanOptions, loanPaymentDraft.loanSelectorValue)
      || findLoanById(loans, loanPaymentDraft.loanId)
      || visibleLoans[0];
    setEditingLoanPaymentId("");
    if (loan) {
      resetLoanPaymentDraftForLoan(loan);
    }
  };

  const syncLoanBalanceFromHistory = (loan, balanceFromHistory) => {
    if (!requirePermission("create_edit_records", "This access profile cannot update loan balances.")) return;
    actions.addOrUpdateLoan({
      ...loan,
      currentBalance: Math.max(0, Number(balanceFromHistory || 0)),
    });
    setNotice("Loan balance synced to the recorded payment history.");
  };

  const repairLoanFromHistory = (loan) => {
    if (!requirePermission("create_edit_records", "This access profile cannot repair loan history.")) return;
    const paymentsForLoan = loanPayments.filter((payment) => String(payment.loanId ?? "") === String(loan.id ?? ""));
    const repaired = reconcileLoanPaymentsAgainstSchedule({
      loan,
      payments: paymentsForLoan,
      usePeriods,
      leases,
      units,
    });
    repaired.updatedPayments.forEach((payment) => {
      actions.updateLoanPayment?.(payment);
    });
    const currentYear = todayIso.slice(0, 4);
    const currentYearPayments = repaired.updatedPayments.filter((payment) => String(payment.paymentDate || "").startsWith(currentYear));
    const latestPaymentDate = repaired.updatedPayments
      .slice()
      .sort((left, right) => String(right.paymentDate || "").localeCompare(String(left.paymentDate || "")))[0]?.paymentDate;
    actions.addOrUpdateLoan({
      ...loan,
      currentBalance: repaired.derivedBalance,
      interestYTD: currentYearPayments.reduce((sum, payment) => sum + Number(payment.interest || 0), 0),
      principalYTD: currentYearPayments.reduce((sum, payment) => sum + Number(payment.principal || 0) + Number(payment.extraPrincipal || 0), 0),
      escrowYTD: currentYearPayments.reduce((sum, payment) => sum + Number(payment.escrow || 0), 0),
      nextPayment: latestPaymentDate ? addMonths(latestPaymentDate, 1) : loan.nextPayment,
    });
    setNotice("Loan history repaired from the recorded payment schedule.");
  };

  const startAddLoan = () => {
    prefetchDialog("loanEditor");
    clearLoanDraft(propertyFilter === "all" ? properties[0]?.id : propertyFilter);
    setLoanEditorOpen(true);
  };

  const saveLoan = () => {
    if (!requirePermission("create_edit_records", "This access profile cannot save loans.")) return;
    const propertyId = loanDraft.propertyId || properties[0]?.id;
    if (!propertyId || !loanDraft.lender.trim()) {
      setNotice("Loan property and lender are required.");
      return;
    }

    actions.addOrUpdateLoan({
      id: editingLoanId || `l${Date.now()}`,
      yearEndReviews: editingLoanId ? loans.find((loan) => loan.id === editingLoanId)?.yearEndReviews || [] : [],
      propertyId,
      lender: loanDraft.lender.trim(),
      loanType: loanDraft.loanType,
      lienPosition: Number(loanDraft.lienPosition || 1),
      originatedOn: loanDraft.originatedOn,
      rate: Number(loanDraft.rate || 0),
      originalBalance: Number(loanDraft.originalBalance || 0),
      currentBalance: Number(loanDraft.currentBalance || loanDraft.originalBalance || 0),
      scheduledPI: Number(loanDraft.scheduledPI || 0),
      scheduledEscrow: Number(loanDraft.scheduledEscrow || 0),
      scheduledMortgageInsurance: Number(loanDraft.scheduledMortgageInsurance || 0),
      defaultExtraPrincipal: Number(loanDraft.defaultExtraPrincipal || 0),
      interestYTD: 0,
      principalYTD: 0,
      escrowYTD: 0,
      nextPayment: loanDraft.nextPayment,
    });

    setNotice(editingLoanId ? "Loan updated." : "Loan added.");
    clearLoanDraft(propertyId);
    setLoanEditorOpen(false);
  };

  const startEditLoan = (loan) => {
    prefetchDialog("loanEditor");
    setEditingLoanId(loan.id);
    setLoanDraft({
      propertyId: loan.propertyId,
      lender: loan.lender,
      loanType: loan.loanType || "Primary Mortgage",
      lienPosition: String(loan.lienPosition || 1),
      originatedOn: loan.originatedOn || todayIso,
      rate: String(loan.rate || 0),
      originalBalance: String(loan.originalBalance || 0),
      currentBalance: String(loan.currentBalance || 0),
      scheduledPI: String(loan.scheduledPI || 0),
      scheduledEscrow: String(loan.scheduledEscrow || 0),
      scheduledMortgageInsurance: String(loan.scheduledMortgageInsurance || 0),
      defaultExtraPrincipal: String(loan.defaultExtraPrincipal || 0),
      nextPayment: loan.nextPayment || todayIso,
    });
    setView("loans");
    setLoanEditorOpen(true);
  };

  const recordLoanPayment = (selectedLoanOverride, loanSelectorValueOverride = "") => {
    if (!requirePermission("create_edit_records", "This access profile cannot record loan payments.")) return false;
    const loan = selectedLoanOverride
      || findLoanBySelectorValue(visibleLoanOptions, loanSelectorValueOverride)
      || findLoanBySelectorValue(visibleLoanOptions, loanPaymentDraft.loanSelectorValue)
      || findLoanById(loans, loanPaymentDraft.loanId);
    if (!loan) {
      setNotice("Select a loan first.");
      return false;
    }

    const existingPayment = editingLoanPaymentId ? loanPayments.find((item) => item.id === editingLoanPaymentId) : undefined;
    const paymentDate = String(loanPaymentDraft.paymentDate || "").slice(0, 10);
    const duplicatePayment = loanPayments.find((item) => (
      item.id !== editingLoanPaymentId
      && String(item.loanId ?? "") === String(loan.id ?? "")
      && String(item.paymentDate || "").slice(0, 10) === paymentDate
    ));
    if (duplicatePayment) {
      setNotice("A payment already exists for this loan and date. Edit or delete the existing payment first.");
      return false;
    }

    const effectiveLoan = effectiveLoanForDraft(loan, existingPayment?.id || "");
    if (Number(effectiveLoan?.currentBalance || 0) !== Number(loan.currentBalance || 0)) {
      actions.addOrUpdateLoan({
        ...loan,
        currentBalance: Number(effectiveLoan.currentBalance || 0),
      });
    }

    const interest = Number(loanPaymentDraft.interest || 0);
    const principal = Number(loanPaymentDraft.principal || 0);
    const escrow = Number(loanPaymentDraft.escrow || 0);
    const mortgageInsurance = Number(loanPaymentDraft.mortgageInsurance || 0);
    const extraPrincipal = Number(loanPaymentDraft.extraPrincipal || 0);

    const deductibleInterest = deductibleMortgageInterest({
      interest,
      propertyId: loan.propertyId,
      date: loanPaymentDraft.paymentDate,
      usePeriods,
      leases,
      units,
    });

    const payment = {
      ...createLoanPayment({
        loan: effectiveLoan,
        paymentDate,
        interest,
        principal,
        escrow,
        mortgageInsurance,
        extraPrincipal,
        deductibleInterest,
      }),
      id: editingLoanPaymentId || `lp-${Date.now()}`,
    };

    if (existingPayment) {
      actions.deleteLoanPayment(existingPayment.id);
    }
    actions.saveLoanPayment(payment);
    setNotice(existingPayment ? "Loan payment updated." : "Loan payment recorded.");
    setEditingLoanPaymentId("");
    const adjustedCurrentBalance = Math.max(
      0,
      Number(effectiveLoan.currentBalance || 0)
        + Number(existingPayment?.principal || 0)
        + Number(existingPayment?.extraPrincipal || 0)
        - principal
        - extraPrincipal,
    );
    resetLoanPaymentDraftForLoan({
      ...effectiveLoan,
      currentBalance: adjustedCurrentBalance,
    }, {
      loanSelectorValue: loanSelectorValueOverride || loanPaymentDraft.loanSelectorValue || String(loan.id ?? ""),
      paymentDate: addMonths(loanPaymentDraft.paymentDate, 1),
      escrow,
      mortgageInsurance,
      extraPrincipal: loan.defaultExtraPrincipal || 0,
    });
    return true;
  };

  const deleteLoanPayment = (payment) => {
    if (!requirePermission("delete_records", "Admin access is required to delete loan payments.")) return;
    const runDelete = () => {
      actions.deleteLoanPayment(payment.id);
      setEditingLoanPaymentId("");
      const loan = findLoanById(loans, payment.loanId);
      if (loan) {
        setLoanPaymentDraft(buildLoanPaymentDraft(loan, observedLoanDefaultsById[loan.id] || {}, todayIso, {
          loanId: payment.loanId,
          paymentDate: payment.paymentDate,
          interest: payment.interest,
          principal: payment.principal,
          escrow: payment.escrow,
          mortgageInsurance: payment.mortgageInsurance,
          extraPrincipal: payment.extraPrincipal,
        }));
      }
      setNotice("Mortgage payment deleted. Draft reset so you can re-enter it.");
    };
    if (!confirmDestructiveActions) {
      runDelete();
      return;
    }
    openConfirmDialog({
      title: "Delete mortgage payment?",
      message: `Delete mortgage payment dated ${payment.paymentDate}? This cannot be undone.`,
      confirmLabel: "Delete payment",
      onConfirm: runDelete,
    });
  };

  return {
    cancelLoanPaymentEdit,
    clearLoanDraft,
    deleteLoanPayment,
    editingLoanId,
    editingLoanPaymentId,
    effectiveLoanForDraft,
    isEditingLoanPaymentTotal,
    loanDraft,
    loanEditorOpen,
    loanPaymentDraft,
    loanPaymentDraftTotalInput,
    loanPropertySummaries,
    observedLoanDefaultsById,
    recordLoanPayment,
    repairLoanFromHistory,
    resetLoanPaymentDraftForLoan,
    saveLoan,
    setEditingLoanPaymentId,
    setIsEditingLoanPaymentTotal,
    setLoanDraft,
    setLoanEditorOpen,
    setLoanPaymentDraft,
    setLoanPaymentDraftTotalInput,
    startAddLoan,
    startEditLoan,
    startEditLoanPayment,
    syncLoanBalanceFromHistory,
    visibleLoans,
  };
}
