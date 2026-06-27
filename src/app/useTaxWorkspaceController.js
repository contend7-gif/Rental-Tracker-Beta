import { useEffect, useMemo, useState } from "react";
import { allocateAmountToYearByServicePeriod, getRentalUsePctForDate } from "../domain/accounting.ts";
import { findLoanById, loanIdsMatch } from "../domain/loans.ts";
import { buildEscrowAllocationEstimate } from "../domain/taxEscrow.ts";
import { isRecord } from "../lib/appSupport.ts";
import {
  buildRentalDayAllocationWeights,
  isDeMinimisCategoryEligible,
  scheduleELines,
  scheduleLineSourceNote,
} from "./accountingShared.js";
import { leaseIsActiveByDate } from "./leaseShared.js";

import { toLocalIsoDate } from "../lib/localDate.ts";

function buildDefaultEscrowDisbursementDate(yearFilter, todayIso) {
  const selectedYear = String(yearFilter || "");
  const currentYear = String(todayIso || "").slice(0, 4);
  if (selectedYear && selectedYear !== currentYear) {
    return `${selectedYear}-01-01`;
  }
  return String(todayIso || toLocalIsoDate());
}

function createBlankEscrowDisbursementDraft(defaultLoanId, yearFilter, todayIso) {
  return {
    loanId: defaultLoanId || "",
    date: buildDefaultEscrowDisbursementDate(yearFilter, todayIso),
    category: "Taxes",
    amount: "",
    description: "",
    vendor: "",
    coverageStart: "",
    coverageEnd: "",
    notes: "",
  };
}

function clampPct(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(0, Math.min(1, parsed));
}

function escrowEstimateSourceLabel(source) {
  if (source === "property_history") return "Provisional estimate from this property's escrow history.";
  if (source === "portfolio_history") return "Provisional estimate from portfolio escrow history.";
  if (source === "equal_split") return "Provisional 50/50 split from escrow because no tax/insurance history was found.";
  if (source === "residual_after_taxes") return "Provisional insurance estimate from escrow after known taxes.";
  if (source === "residual_after_insurance") return "Provisional tax estimate from escrow after known insurance.";
  return "";
}

export function useTaxWorkspaceController({
  activeTx,
  addAuditEntry,
  adjustedAssetDepreciationForYear,
  actions,
  appSettings,
  assets,
  currency,
  deMinimisThreshold,
  escrowDisbursements,
  effectiveLoanPaymentDeductibleInterest,
  effectiveTransactionDeductibleAmount,
  formatPropertyLabel,
  formatUnitLabel,
  getScheduleELineIdForTransaction,
  leases,
  loanPayments,
  loans,
  openConfirmDialog,
  properties,
  propertyFilter,
  propertyNameById,
  requirePermission,
  setNotice,
  setTaxCarryoverByScope,
  setTaxDayOverrides,
  setEscrowDisbursements,
  setTaxFiledAmountOverrides,
  setTaxPrintDialogOpen,
  setTaxPrintUnit,
  taxCarryoverByScope,
  taxDayOverrides,
  taxFiledAmountOverrides,
  taxPrintProperty,
  taxPrintScope,
  taxPrintUnit,
  todayIso,
  unitFilter,
  units,
  usePeriods,
  yearFilter,
}) {
  const getScheduleAmountTone = (lineId, amount) => {
    if (!amount) return "neutral";
    return lineId === "rents" ? "income" : "expense";
  };

  const formatScheduleAmount = (lineId, amount) => {
    const formatted = currency(Math.abs(amount));
    if (!amount) return formatted;
    return lineId === "rents" ? `+${formatted}` : `-${formatted}`;
  };

  const buildTaxScopeKey = (scopeProperty, scopeUnit = "all") => `${yearFilter}|${scopeProperty}|${scopeUnit}`;
  const buildCarryoverScopeKey = (scopeProperty) => `${yearFilter}|${scopeProperty}`;
  const buildTaxFiledAmountScopeKey = (scopeProperty) => `${yearFilter}|${scopeProperty}`;
  const loanById = useMemo(() => Object.fromEntries(loans.map((loan) => [loan.id, loan])), [loans]);
  const defaultEscrowLoanOptions = useMemo(
    () => loans.filter((loan) => propertyFilter === "all" || loan.propertyId === propertyFilter),
    [loans, propertyFilter],
  );
  const [editingEscrowDisbursementId, setEditingEscrowDisbursementId] = useState("");
  const [escrowDisbursementDraft, setEscrowDisbursementDraft] = useState(() =>
    createBlankEscrowDisbursementDraft(defaultEscrowLoanOptions[0]?.id || "", yearFilter, todayIso),
  );

  useEffect(() => {
    if (escrowDisbursementDraft.loanId || !defaultEscrowLoanOptions[0]?.id) return;
    setEscrowDisbursementDraft((prev) => ({
      ...prev,
      loanId: defaultEscrowLoanOptions[0].id,
      date: prev.date || buildDefaultEscrowDisbursementDate(yearFilter, todayIso),
    }));
  }, [defaultEscrowLoanOptions, escrowDisbursementDraft.loanId, todayIso, yearFilter]);

  const clearEscrowDisbursementDraft = () => {
    setEditingEscrowDisbursementId("");
    setEscrowDisbursementDraft(createBlankEscrowDisbursementDraft(defaultEscrowLoanOptions[0]?.id || "", yearFilter, todayIso));
  };

  const effectiveScheduleETransactionAmount = (transaction) => {
    if (transaction.type === "Income") return Number(transaction.amount || 0);
    if (transaction.type !== "Expense" || transaction.capitalImprovement) return 0;

    const deductibleAmount = Number(effectiveTransactionDeductibleAmount(transaction) || 0);
    if (transaction.category !== "Insurance") {
      return deductibleAmount;
    }

    return allocateAmountToYearByServicePeriod({
      amount: deductibleAmount,
      year: yearFilter,
      servicePeriodStart: transaction.servicePeriodStart,
      servicePeriodEnd: transaction.servicePeriodEnd,
    });
  };

  const clearTaxDayOverride = (scopeProperty, scopeUnit) => {
    const key = buildTaxScopeKey(scopeProperty, scopeUnit);
    setTaxDayOverrides((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const confirmResetTaxDayOverride = (row) => {
    openConfirmDialog({
      title: "Reset day overrides?",
      message: `Reset fair rental/personal use day overrides for ${row.propertyName} Unit ${row.unit} back to calculated values?`,
      confirmLabel: "Reset",
      onConfirm: () => {
        clearTaxDayOverride(row.propertyId, row.unit);
        setNotice("Fair/personal day overrides reset.");
      },
    });
  };

  const setTaxDayOverride = (scopeProperty, scopeUnit, field, value) => {
    const key = buildTaxScopeKey(scopeProperty, scopeUnit);
    const parsed = value === "" ? "" : Number(value);
    if (parsed !== "" && (!Number.isFinite(parsed) || parsed < 0)) return;
    setTaxDayOverrides((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: parsed,
      },
    }));
  };

  const setCarryoverForScope = (scopeProperty, value) => {
    const key = buildCarryoverScopeKey(scopeProperty);
    const parsed = value === "" ? "" : Number(value);
    if (parsed !== "" && (!Number.isFinite(parsed) || parsed < 0)) return;
    setTaxCarryoverByScope((prev) => ({ ...prev, [key]: parsed }));
  };

  const setTaxFiledAmountOverride = (scopeProperty, field, value) => {
    const key = buildTaxFiledAmountScopeKey(scopeProperty);
    const parsed = value === "" ? "" : Number(value);
    if (parsed !== "" && (!Number.isFinite(parsed) || parsed < 0)) return;
    setTaxFiledAmountOverrides((prev) => {
      const nextFieldValues = {
        ...(isRecord(prev[key]) ? prev[key] : {}),
        [field]: parsed,
      };
      const cleanedFieldValues = Object.fromEntries(
        Object.entries(nextFieldValues).filter(([, entryValue]) => entryValue !== ""),
      );
      if (Object.keys(cleanedFieldValues).length === 0) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return {
        ...prev,
        [key]: cleanedFieldValues,
      };
    });
  };

  const setTaxFiledAmountOverrideNote = (scopeProperty, field, value) => {
    const key = buildTaxFiledAmountScopeKey(scopeProperty);
    setTaxFiledAmountOverrides((prev) => {
      const existing = isRecord(prev[key]) ? prev[key] : {};
      const existingNotes = isRecord(existing.overrideNotes) ? existing.overrideNotes : {};
      const nextNotes = {
        ...existingNotes,
        [field]: String(value || ""),
      };
      const cleanedNotes = Object.fromEntries(Object.entries(nextNotes).filter(([, note]) => String(note || "").trim()));
      const next = {
        ...existing,
        overrideNotes: cleanedNotes,
      };
      if (Object.keys(cleanedNotes).length === 0) {
        delete next.overrideNotes;
      }
      if (Object.keys(next).length === 0) {
        const withoutScope = { ...prev };
        delete withoutScope[key];
        return withoutScope;
      }
      return { ...prev, [key]: next };
    });
  };

  const clearTaxFiledAmountOverride = (scopeProperty, field) => {
    const key = buildTaxFiledAmountScopeKey(scopeProperty);
    setTaxFiledAmountOverrides((prev) => {
      const existing = isRecord(prev[key]) ? prev[key] : null;
      if (!existing || !(field in existing)) return prev;
      const nextFields = { ...existing };
      delete nextFields[field];
      if (Object.keys(nextFields).length === 0) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return {
        ...prev,
        [key]: nextFields,
      };
    });
  };

  const escrowDisbursementRows = useMemo(() => {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    return escrowDisbursements
      .map((entry) => {
        const loan = loanById[entry.loanId] || null;
        const propertyId = String(entry.propertyId || loan?.propertyId || "");
        if (propertyFilter !== "all" && propertyId !== propertyFilter) return null;

        const linkedTransaction = entry.linkedTransactionId
          ? activeTx.find((transaction) => transaction.id === entry.linkedTransactionId) || null
          : null;
        const suggestedTransaction = linkedTransaction || activeTx.find((transaction) => {
          if (transaction.type !== "Expense") return false;
          if (transaction.propertyId !== propertyId) return false;
          if (transaction.category !== entry.category) return false;
          if (Math.abs(Number(transaction.amount || 0) - Number(entry.amount || 0)) >= 0.01) return false;
          const txnDate = Date.parse(`${transaction.date}T00:00:00Z`);
          const disbursementDate = Date.parse(`${entry.date}T00:00:00Z`);
          if (Number.isNaN(txnDate) || Number.isNaN(disbursementDate)) return false;
          return Math.abs(txnDate - disbursementDate) <= 14 * MS_PER_DAY;
        }) || null;

        const deductibleInSelectedYear = entry.category === "Insurance"
          ? allocateAmountToYearByServicePeriod({
            amount: Number(entry.amount || 0),
            year: yearFilter,
            servicePeriodStart: entry.coverageStart,
            servicePeriodEnd: entry.coverageEnd,
          })
          : Number(entry.amount || 0);

        return {
          ...entry,
          propertyId,
          propertyName: propertyNameById[propertyId] || propertyId || "Unknown property",
          loan,
          linkedTransaction,
          suggestedTransaction,
          deductibleInSelectedYear,
        };
      })
      .filter(Boolean)
      .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")));
  }, [activeTx, escrowDisbursements, loanById, propertyFilter, propertyNameById, yearFilter]);

  const saveEscrowDisbursement = () => {
    if (!requirePermission("create_edit_records", "This access profile cannot save escrow disbursements.")) return;
    const loan = loanById[escrowDisbursementDraft.loanId];
    if (!loan) {
      setNotice("Choose a loan for the escrow disbursement.");
      return;
    }
    const amount = Number(escrowDisbursementDraft.amount || 0);
    if (!escrowDisbursementDraft.date || !Number.isFinite(amount) || amount <= 0) {
      setNotice("Enter a valid disbursement date and amount.");
      return;
    }
    if (
      escrowDisbursementDraft.category === "Insurance" &&
      ((escrowDisbursementDraft.coverageStart && !escrowDisbursementDraft.coverageEnd)
        || (!escrowDisbursementDraft.coverageStart && escrowDisbursementDraft.coverageEnd)
        || (escrowDisbursementDraft.coverageStart && escrowDisbursementDraft.coverageEnd && escrowDisbursementDraft.coverageEnd < escrowDisbursementDraft.coverageStart))
    ) {
      setNotice("Insurance coverage dates must include a valid start and end date.");
      return;
    }

    const nextEntry = {
      id: editingEscrowDisbursementId || `escrow-${Date.now()}`,
      loanId: loan.id,
      propertyId: loan.propertyId,
      date: escrowDisbursementDraft.date,
      category: escrowDisbursementDraft.category === "Insurance" ? "Insurance" : "Taxes",
      amount,
      description: String(escrowDisbursementDraft.description || "").trim(),
      vendor: String(escrowDisbursementDraft.vendor || "").trim(),
      coverageStart: String(escrowDisbursementDraft.coverageStart || "").trim(),
      coverageEnd: String(escrowDisbursementDraft.coverageEnd || "").trim(),
      linkedTransactionId: editingEscrowDisbursementId
        ? (escrowDisbursements.find((entry) => entry.id === editingEscrowDisbursementId)?.linkedTransactionId || "")
        : "",
      notes: String(escrowDisbursementDraft.notes || "").trim(),
    };

    setEscrowDisbursements((prev) => {
      const existingIndex = prev.findIndex((entry) => entry.id === nextEntry.id);
      if (existingIndex < 0) return [nextEntry, ...prev];
      const next = [...prev];
      next[existingIndex] = nextEntry;
      return next;
    });
    addAuditEntry({
      action: editingEscrowDisbursementId ? "update" : "create",
      entityType: "escrow-disbursement",
      entityId: nextEntry.id,
      propertyId: nextEntry.propertyId,
      unit: "Shared",
      summary: `${editingEscrowDisbursementId ? "Updated" : "Logged"} ${nextEntry.category.toLowerCase()} escrow disbursement.`,
      details: `${nextEntry.date} | ${currency(nextEntry.amount)} | ${loan.lender}.`,
      category: "reporting",
    });
    setNotice(editingEscrowDisbursementId ? "Escrow disbursement updated." : "Escrow disbursement logged.");
    clearEscrowDisbursementDraft();
  };

  const startEditEscrowDisbursement = (entry) => {
    setEditingEscrowDisbursementId(entry.id);
    setEscrowDisbursementDraft({
      loanId: entry.loanId || "",
      date: entry.date || buildDefaultEscrowDisbursementDate(yearFilter, todayIso),
      category: entry.category === "Insurance" ? "Insurance" : "Taxes",
      amount: String(entry.amount || ""),
      description: entry.description || "",
      vendor: entry.vendor || "",
      coverageStart: entry.coverageStart || "",
      coverageEnd: entry.coverageEnd || "",
      notes: entry.notes || "",
    });
  };

  const deleteEscrowDisbursement = (entry) => {
    if (!requirePermission("delete_records", "Admin access is required to delete escrow disbursements.")) return;
    openConfirmDialog({
      title: "Delete escrow disbursement?",
      message: `Delete the ${entry.category.toLowerCase()} disbursement dated ${entry.date}?`,
      confirmLabel: "Delete",
      onConfirm: () => {
        setEscrowDisbursements((prev) => prev.filter((candidate) => candidate.id !== entry.id));
        addAuditEntry({
          action: "delete",
          entityType: "escrow-disbursement",
          entityId: entry.id,
          propertyId: entry.propertyId || loanById[entry.loanId]?.propertyId,
          unit: "Shared",
          summary: `Deleted ${entry.category.toLowerCase()} escrow disbursement.`,
          details: `${entry.date} | ${currency(entry.amount)}.`,
          category: "reporting",
        });
        if (editingEscrowDisbursementId === entry.id) {
          clearEscrowDisbursementDraft();
        }
        setNotice("Escrow disbursement deleted.");
      },
    });
  };

  const linkEscrowDisbursementToTransaction = (entryId, transactionId) => {
    if (!requirePermission("create_edit_records", "This access profile cannot link escrow disbursements.")) return;
    setEscrowDisbursements((prev) => prev.map((entry) => (
      entry.id === entryId ? { ...entry, linkedTransactionId: transactionId } : entry
    )));
    setNotice("Escrow disbursement linked to the ledger entry.");
  };

  const createEscrowTransaction = (entry) => {
    if (!requirePermission("create_edit_records", "This access profile cannot create escrow expense entries.")) return;
    const loan = loanById[entry.loanId];
    if (!loan) {
      setNotice("This disbursement is missing its loan link.");
      return;
    }
    if (entry.linkedTransactionId && activeTx.some((transaction) => transaction.id === entry.linkedTransactionId)) {
      setNotice("This disbursement is already linked to a ledger entry.");
      return;
    }
    if (entry.suggestedTransaction && !entry.linkedTransactionId) {
      linkEscrowDisbursementToTransaction(entry.id, entry.suggestedTransaction.id);
      return;
    }

    const preview = actions.computeTransactionPreview({
      amount: Number(entry.amount || 0),
      type: "Expense",
      capitalImprovement: false,
      propertyId: loan.propertyId,
      unit: "Shared",
      date: entry.date,
      ownerUsePct: 0,
      ownerUsePctOverride: false,
      servicePeriodStart: entry.category === "Insurance" ? entry.coverageStart : "",
      servicePeriodEnd: entry.category === "Insurance" ? entry.coverageEnd : "",
    });
    const transactionId = `t${Date.now()}`;
    const description = String(entry.description || "").trim()
      || (entry.category === "Insurance" ? "Insurance premium paid from escrow" : "Property tax paid from escrow");
    actions.addOrUpdateTransaction({
      id: transactionId,
      date: entry.date,
      propertyId: loan.propertyId,
      unit: "Shared",
      type: "Expense",
      category: entry.category,
      description,
      amount: Number(entry.amount || 0),
      ownerUsePct: Math.max(0, 1 - Number(preview.rentalUsePct || 0)),
      ownerUsePctOverride: false,
      rentalUsePct: Number(preview.rentalUsePct || 0),
      deductibleAmount: Number(preview.deductibleAmount || 0),
      paidFrom: `Escrow - ${loan.lender}`,
      paymentMethod: "Escrow",
      reimbursable: false,
      reimbursed: false,
      capitalImprovement: false,
      vendor: String(entry.vendor || "").trim(),
      receiptName: "",
      notes: String(entry.notes || "").trim(),
      taxChecked: false,
      invoiceRef: "",
      invoiceAmount: Number(entry.amount || 0),
      servicePeriodStart: entry.category === "Insurance" ? String(entry.coverageStart || "") : "",
      servicePeriodEnd: entry.category === "Insurance" ? String(entry.coverageEnd || "") : "",
      status: "active",
    });
    setEscrowDisbursements((prev) => prev.map((candidate) => (
      candidate.id === entry.id ? { ...candidate, linkedTransactionId: transactionId } : candidate
    )));
    addAuditEntry({
      action: "create",
      entityType: "transaction",
      entityId: transactionId,
      propertyId: loan.propertyId,
      unit: "Shared",
      summary: `Created ${entry.category.toLowerCase()} expense from escrow disbursement.`,
      details: `${entry.date} | ${currency(entry.amount)} | ${loan.lender}.`,
      category: "record",
    });
    setNotice(`${entry.category} transaction created from escrow.`);
  };

  const buildTaxUseDaysSummary = (snapshotPropertyFilter, snapshotUnitFilter) => {
    const yearStart = `${yearFilter}-01-01`;
    const yearEnd = `${yearFilter}-12-31`;

    const scopedUnits = units.filter((unit) => {
      if (unit.name === "Shared") return false;
      if (snapshotPropertyFilter !== "all" && unit.propertyId !== snapshotPropertyFilter) return false;
      if (snapshotUnitFilter !== "all" && unit.name !== snapshotUnitFilter) return false;
      return true;
    });

    const dayList = [];
    const dayCursor = new Date(`${yearStart}T00:00:00Z`);
    const dayEnd = new Date(`${yearEnd}T00:00:00Z`);
    while (dayCursor <= dayEnd) {
      dayList.push(dayCursor.toISOString().slice(0, 10));
      dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
    }

    const rows = scopedUnits.map((unit) => {
      const property = properties.find((entry) => entry.id === unit.propertyId) || null;
      const ownedStart = property?.purchasedOn && property.purchasedOn > yearStart ? property.purchasedOn : yearStart;
      const scopedDayList = ownedStart > yearEnd ? [] : dayList.filter((day) => day >= ownedStart);
      let rentalDays = 0;
      let personalDays = 0;
      let vacantDays = 0;
      let untrackedDays = 0;

      scopedDayList.forEach((day) => {
        const leaseActive = leases.some((lease) => lease.propertyId === unit.propertyId && lease.unit === unit.name && leaseIsActiveByDate(lease, day));
        if (leaseActive) {
          rentalDays += 1;
          return;
        }

        const usePeriod = usePeriods
          .filter((period) => period.propertyId === unit.propertyId && period.unit === unit.name && period.startDate <= day && (!period.endDate || period.endDate >= day))
          .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

        const useType = String(usePeriod?.useType || "").toLowerCase();
        if (useType.includes("owner")) {
          personalDays += 1;
          return;
        }
        if (useType.includes("vacant")) {
          vacantDays += 1;
          return;
        }
        if (useType.includes("rental")) {
          rentalDays += 1;
          return;
        }
        untrackedDays += 1;
      });

      const overrideKey = buildTaxScopeKey(unit.propertyId, unit.name);
      const override = taxDayOverrides[overrideKey] || {};
      const fairRentalDays = override.fairRentalDays === "" || override.fairRentalDays == null ? rentalDays : Number(override.fairRentalDays || 0);
      const personalUseDays = override.personalUseDays === "" || override.personalUseDays == null ? personalDays : Number(override.personalUseDays || 0);

      return {
        propertyId: unit.propertyId,
        propertyName: propertyNameById[unit.propertyId] || unit.propertyId,
        unit: unit.name,
        fairRentalDays,
        personalUseDays,
        vacantDays,
        untrackedDays,
        totalDays: scopedDayList.length,
        isOverridden: override.fairRentalDays != null || override.personalUseDays != null,
      };
    });

    const totals = rows.reduce(
      (acc, row) => {
        acc.fairRentalDays += row.fairRentalDays;
        acc.personalUseDays += row.personalUseDays;
        acc.vacantDays += row.vacantDays;
        acc.untrackedDays += row.untrackedDays;
        acc.totalDays += row.totalDays;
        return acc;
      },
      { fairRentalDays: 0, personalUseDays: 0, vacantDays: 0, untrackedDays: 0, totalDays: 0 },
    );

    return { rows, totals };
  };

  const taxPrintUnitOptions = useMemo(() => {
    if (taxPrintProperty === "all") return [{ value: "all", label: "All units" }];
    const names = ["Shared", ...units.filter((unit) => unit.propertyId === taxPrintProperty).map((unit) => unit.name)];
    return [{ value: "all", label: "All units" }, ...Array.from(new Set(names)).map((name) => ({ value: name, label: name }))];
  }, [taxPrintProperty, units]);

  useEffect(() => {
    if (taxPrintProperty === "all") {
      setTaxPrintUnit("all");
      return;
    }
    const valid = taxPrintUnitOptions.some((option) => option.value === taxPrintUnit);
    if (!valid) setTaxPrintUnit("all");
  }, [taxPrintProperty, taxPrintUnit, taxPrintUnitOptions, setTaxPrintUnit]);

  const buildTaxSnapshot = (snapshotPropertyFilter, snapshotUnitFilter, options = {}) => {
    const includeLoanPayments = options.includeLoanPayments !== false;
    const includeSharedAssets = options.includeSharedAssets !== false;
    const filteredTransactions = activeTx.filter(
      (transaction) =>
        transaction.date.startsWith(yearFilter) &&
        (snapshotPropertyFilter === "all" || transaction.propertyId === snapshotPropertyFilter) &&
        (snapshotUnitFilter === "all" || transaction.unit === snapshotUnitFilter),
    );

    const filteredLoanPayments = includeLoanPayments
      ? loanPayments.filter((payment) => {
        if (!payment.paymentDate?.startsWith(yearFilter)) return false;
        const linkedLoan = findLoanById(loans, payment.loanId);
        if (!linkedLoan) return false;
        if (snapshotPropertyFilter !== "all" && linkedLoan.propertyId !== snapshotPropertyFilter) return false;
        return true;
      })
      : [];

    const grossRent = filteredTransactions
      .filter((transaction) => transaction.type === "Income")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const calculatedDeductibleLoanInterest = filteredLoanPayments.reduce((sum, payment) => sum + effectiveLoanPaymentDeductibleInterest(payment), 0);
    const escrowEstimateRentalUse = (() => {
      let weightedTotal = 0;
      let weightTotal = 0;
      filteredLoanPayments.forEach((payment) => {
        const loan = findLoanById(loans, payment.loanId);
        if (!loan) return;
        const weight = Math.max(0, Number(payment.escrow || 0));
        if (weight <= 0) return;
        weightedTotal += clampPct(getRentalUsePctForDate({
          propertyId: loan.propertyId,
          unit: "Shared",
          date: payment.paymentDate,
          usePeriods,
          leases,
          units,
          fallbackOwnerUsePct: 0,
        })) * weight;
        weightTotal += weight;
      });
      return weightTotal > 0 ? weightedTotal / weightTotal : 1;
    })();

    const selectedYearNum = Number(yearFilter);
    const depreciationAssets = assets
      .filter((asset) => {
        if (snapshotPropertyFilter !== "all" && asset.propertyId !== snapshotPropertyFilter) return false;
        if (snapshotUnitFilter === "all") return true;
        if (asset.unit === snapshotUnitFilter) return true;
        return includeSharedAssets && asset.unit === "Shared";
      })
      .map((asset) => ({
        ...asset,
        yearDepreciation: adjustedAssetDepreciationForYear({ asset, year: selectedYearNum, usePeriods, leases, units }),
      }));
    const calculatedDepreciation = depreciationAssets.reduce((sum, asset) => sum + asset.yearDepreciation, 0);

    const filedAmountScope = snapshotPropertyFilter === "all" ? "all" : snapshotPropertyFilter;
    const rawFiledAmountOverrides = snapshotUnitFilter !== "all"
      ? {}
      : (isRecord(taxFiledAmountOverrides[buildTaxFiledAmountScopeKey(filedAmountScope)])
        ? taxFiledAmountOverrides[buildTaxFiledAmountScopeKey(filedAmountScope)]
        : {});
    const deductibleLoanInterest = rawFiledAmountOverrides.mortgageInterest === "" || rawFiledAmountOverrides.mortgageInterest == null
      ? calculatedDeductibleLoanInterest
      : Number(rawFiledAmountOverrides.mortgageInterest);
    const depreciation = rawFiledAmountOverrides.depreciation === "" || rawFiledAmountOverrides.depreciation == null
      ? calculatedDepreciation
      : Number(rawFiledAmountOverrides.depreciation);

    const totalsById = Object.fromEntries(scheduleELines.map((line) => [line.id, 0]));
    filteredTransactions.forEach((transaction) => {
      const lineId = getScheduleELineIdForTransaction(transaction);
      if (!lineId) return;
      const amount = effectiveScheduleETransactionAmount(transaction);
      totalsById[lineId] += amount;
    });
    const calculatedInsurance = Number(totalsById.insurance || 0);
    const calculatedTaxes = Number(totalsById.taxes || 0);
    const taxesOverridden = rawFiledAmountOverrides.taxes !== "" && rawFiledAmountOverrides.taxes != null;
    const insuranceOverridden = rawFiledAmountOverrides.insurance !== "" && rawFiledAmountOverrides.insurance != null;
    const escrowEstimate = buildEscrowAllocationEstimate({
      year: yearFilter,
      currentYear: String(todayIso || "").slice(0, 4),
      propertyFilter: snapshotPropertyFilter,
      unitFilter: snapshotUnitFilter,
      loans,
      loanPayments,
      transactions: activeTx,
      escrowDisbursements,
      directTaxesAmount: calculatedTaxes,
      directInsuranceAmount: calculatedInsurance,
      taxesOverridden,
      insuranceOverridden,
    });
    const taxes = taxesOverridden
      ? Number(rawFiledAmountOverrides.taxes)
      : calculatedTaxes + (Number(escrowEstimate.taxesEstimate || 0) * escrowEstimateRentalUse);
    const insurance = insuranceOverridden
      ? Number(rawFiledAmountOverrides.insurance)
      : calculatedInsurance + (Number(escrowEstimate.insuranceEstimate || 0) * escrowEstimateRentalUse);
    totalsById.insurance = insurance;
    totalsById.taxes = taxes;
    totalsById.mortgageInterest = deductibleLoanInterest;
    totalsById.depreciation = depreciation;

    const schedule = scheduleELines.map((line) => ({ ...line, total: totalsById[line.id] || 0 }));
    const opExp = schedule.reduce((sum, line) => {
      if (line.id === "rents" || line.id === "mortgageInterest" || line.id === "depreciation") {
        return sum;
      }
      return sum + Number(line.total || 0);
    }, 0);

    const expenseItems = filteredTransactions.filter((transaction) => transaction.type === "Expense");
    const reimbursableItems = expenseItems.filter((transaction) => transaction.reimbursable);

    const reviewSections = [
      { key: "unreimbursed", title: "Unreimbursed owner-paid expenses", flaggedItems: reimbursableItems.filter((transaction) => !transaction.reimbursed) },
      { key: "capital", title: "Capital improvements to verify", flaggedItems: expenseItems.filter((transaction) => transaction.capitalImprovement) },
      { key: "shared", title: "Shared expenses needing allocation", flaggedItems: expenseItems.filter((transaction) => transaction.unit === "Shared") },
      { key: "receipts", title: "Expenses missing receipt names", flaggedItems: expenseItems.filter((transaction) => !transaction.receiptName) },
    ];

    const openReviewCount = reviewSections.reduce(
      (sum, section) => sum + section.flaggedItems.filter((item) => !item.taxChecked).length,
      0,
    );

    const useDays = buildTaxUseDaysSummary(snapshotPropertyFilter, snapshotUnitFilter);
    const carryoverScopeForSnapshot = snapshotPropertyFilter === "all" ? "all" : snapshotPropertyFilter;
    const carryoverLoss = Number(taxCarryoverByScope[buildCarryoverScopeKey(carryoverScopeForSnapshot)] || 0);

    const otherExpenseDetail = filteredTransactions
      .filter((transaction) => getScheduleELineIdForTransaction(transaction) === "otherExpenses")
      .reduce((acc, transaction) => {
        const detailKey = `${transaction.category}::${transaction.description || "(No description)"}`;
        if (!acc[detailKey]) {
          acc[detailKey] = {
            category: transaction.category,
            description: transaction.description || "(No description)",
            total: 0,
          };
        }
          acc[detailKey].total += effectiveScheduleETransactionAmount(transaction);
        return acc;
      }, {});

    const deMinimisRows = filteredTransactions
      .filter((transaction) => transaction.type === "Expense" && !transaction.capitalImprovement)
      .map((transaction) => {
        const invoiceAmount = Number(transaction.invoiceAmount || transaction.amount || 0);
        const categoryEligible = isDeMinimisCategoryEligible(transaction.type, transaction.category);
        const qualifies = categoryEligible && invoiceAmount > 0 && invoiceAmount <= deMinimisThreshold;
        const treatment = transaction.deMinimisTreatment || "auto";
        const applied = appSettings.deMinimisElectionEnabled && (treatment === "yes" ? qualifies : treatment === "no" ? false : (transaction.deMinimisApplied ?? qualifies));
        const candidate = appSettings.deMinimisElectionEnabled && (transaction.deMinimisCandidate ?? qualifies);
        return {
          id: transaction.id,
          date: transaction.date,
          propertyId: transaction.propertyId,
          propertyName: propertyNameById[transaction.propertyId] || transaction.propertyId,
          unit: transaction.unit,
          category: transaction.category,
          description: transaction.description || "(No description)",
          amount: transaction.amount,
          deductibleAmount: effectiveScheduleETransactionAmount(transaction),
          invoiceRef: transaction.invoiceRef || "",
          invoiceAmount,
          treatment,
          candidate,
          applied,
          reason: transaction.deMinimisReason || (categoryEligible ? (qualifies ? "Within threshold" : `Exceeds threshold (${currency(deMinimisThreshold)})`) : "Category not eligible"),
        };
      })
      .sort((left, right) => right.date.localeCompare(left.date));

    const deMinimisAppliedRows = deMinimisRows.filter((row) => row.applied);
    const deMinimisSummary = {
      threshold: deMinimisThreshold,
      electionEnabled: appSettings.deMinimisElectionEnabled,
      hasAFS: appSettings.deMinimisHasAFS,
      statementPrepared: appSettings.deMinimisStatementPrepared,
      candidateCount: deMinimisRows.filter((row) => row.candidate).length,
      appliedCount: deMinimisAppliedRows.length,
      appliedDeductibleTotal: deMinimisAppliedRows.reduce((sum, row) => sum + row.deductibleAmount, 0),
    };

    const selectedProperties = snapshotPropertyFilter === "all"
      ? properties
      : properties.filter((property) => property.id === snapshotPropertyFilter);

    return {
      metrics: {
        grossRent,
        opExp,
        deductibleLoanInterest,
        depreciation,
        scheduleE: grossRent - opExp - deductibleLoanInterest - depreciation,
        carryoverLoss,
        adjustedScheduleE: grossRent - opExp - deductibleLoanInterest - depreciation - carryoverLoss,
      },
      filedAmountOverrides: {
        mortgageInterest: {
          calculated: calculatedDeductibleLoanInterest,
          actual: deductibleLoanInterest,
          overridden: rawFiledAmountOverrides.mortgageInterest !== "" && rawFiledAmountOverrides.mortgageInterest != null,
        },
        taxes: {
          calculated: calculatedTaxes,
          actual: taxes,
          overridden: taxesOverridden,
          estimatedFromEscrow: Number(escrowEstimate.taxesEstimate || 0) > 0,
          estimatedAmount: Number(escrowEstimate.taxesEstimate || 0) * escrowEstimateRentalUse,
          rentalUseApplied: true,
          estimatedSource: escrowEstimate.taxesSource,
          estimatedSourceLabel: escrowEstimateSourceLabel(escrowEstimate.taxesSource),
        },
        insurance: {
          calculated: calculatedInsurance,
          actual: insurance,
          overridden: insuranceOverridden,
          estimatedFromEscrow: Number(escrowEstimate.insuranceEstimate || 0) > 0,
          estimatedAmount: Number(escrowEstimate.insuranceEstimate || 0) * escrowEstimateRentalUse,
          rentalUseApplied: true,
          estimatedSource: escrowEstimate.insuranceSource,
          estimatedSourceLabel: escrowEstimateSourceLabel(escrowEstimate.insuranceSource),
        },
        depreciation: {
          calculated: calculatedDepreciation,
          actual: depreciation,
          overridden: rawFiledAmountOverrides.depreciation !== "" && rawFiledAmountOverrides.depreciation != null,
        },
      },
      useDays,
      schedule,
      reviewSections,
      openReviewCount,
      otherExpenseDetail: Object.values(otherExpenseDetail).sort((left, right) => right.total - left.total),
      deMinimis: {
        ...deMinimisSummary,
        rows: deMinimisRows,
      },
      depreciationAssets,
      selectedProperties,
    };
  };

  const taxSnapshot = useMemo(
    () => buildTaxSnapshot(propertyFilter, unitFilter),
    [
      propertyFilter,
      unitFilter,
      yearFilter,
      activeTx,
      loanPayments,
      loans,
      assets,
      usePeriods,
      leases,
      properties,
      units,
      taxDayOverrides,
      taxCarryoverByScope,
      taxFiledAmountOverrides,
      appSettings.deMinimisElectionEnabled,
      appSettings.deMinimisHasAFS,
      appSettings.deMinimisStatementPrepared,
    ],
  );

  const taxReportingSnapshot = useMemo(
    () => (unitFilter === "all" ? taxSnapshot : buildTaxSnapshot(propertyFilter, "all")),
    [propertyFilter, unitFilter, taxSnapshot],
  );

  const dashboardUnitAllocationWeight = useMemo(() => {
    if (propertyFilter === "all" || unitFilter === "all" || unitFilter === "Shared") return null;
    const unitNames = Array.from(new Set(units.filter((unit) => unit.propertyId === propertyFilter && unit.name !== "Shared").map((unit) => unit.name)));
    if (!unitNames.includes(unitFilter)) return null;
    const allocationWeights = buildRentalDayAllocationWeights(buildTaxUseDaysSummary(propertyFilter, "all").rows, unitNames);
    return allocationWeights[unitFilter] || 0;
  }, [propertyFilter, unitFilter, units, yearFilter, leases, usePeriods, taxDayOverrides]);

  const taxEscrowWarnings = useMemo(() => {
    const scopedEscrowLoans = loans.filter((loan) => {
      if (propertyFilter !== "all" && loan.propertyId !== propertyFilter) return false;
      const hasEscrowPayments = loanPayments.some((payment) => loanIdsMatch(payment.loanId, loan.id) && payment.paymentDate?.startsWith(yearFilter) && Number(payment.escrow || 0) > 0);
      return Number(loan.scheduledEscrow || 0) > 0 || hasEscrowPayments;
    });

    if (scopedEscrowLoans.length === 0) return [];

    const scopedDisbursements = escrowDisbursementRows;
    const scopedTaxTransactions = activeTx.filter((transaction) => (
      transaction.type === "Expense"
      && transaction.date.startsWith(yearFilter)
      && transaction.category === "Taxes"
      && (propertyFilter === "all" || transaction.propertyId === propertyFilter)
    ));
    const scopedInsuranceTransactions = activeTx.filter((transaction) => (
      transaction.type === "Expense"
      && transaction.date.startsWith(yearFilter)
      && transaction.category === "Insurance"
      && (propertyFilter === "all" || transaction.propertyId === propertyFilter)
    ));
    const unresolvedDisbursements = scopedDisbursements.filter((entry) => !entry.linkedTransaction && !entry.suggestedTransaction);
    const taxDisbursements = scopedDisbursements.filter((entry) => entry.category === "Taxes");
    const insuranceDisbursements = scopedDisbursements.filter((entry) => entry.category === "Insurance");
    const warnings = [];

    if (
      scopedTaxTransactions.length === 0
      && taxDisbursements.length === 0
      && !taxSnapshot.filedAmountOverrides.taxes.overridden
      && !taxSnapshot.filedAmountOverrides.taxes.estimatedFromEscrow
    ) {
      warnings.push({
        id: "missing-escrow-taxes",
        tone: "warning",
        title: "Escrowed loans but no tax expense support",
        message: "This scope has escrowed loans, but there are no property-tax ledger entries, escrow tax disbursements, or filed tax overrides yet.",
      });
    }

    if (taxSnapshot.filedAmountOverrides.taxes.estimatedFromEscrow) {
      warnings.push({
        id: "estimated-escrow-taxes",
        tone: "warning",
        title: "Using escrow-derived tax estimate",
        message: taxSnapshot.filedAmountOverrides.taxes.estimatedSourceLabel || "Taxes are being estimated from escrow until you add actual support.",
      });
    }

    if (
      scopedInsuranceTransactions.length === 0
      && insuranceDisbursements.length === 0
      && !taxSnapshot.filedAmountOverrides.insurance.overridden
      && !taxSnapshot.filedAmountOverrides.insurance.estimatedFromEscrow
    ) {
      warnings.push({
        id: "missing-escrow-insurance",
        tone: "warning",
        title: "Escrowed loans but no insurance expense support",
        message: "This scope has escrowed loans, but there are no insurance ledger entries, escrow insurance disbursements, or filed insurance overrides yet.",
      });
    }

    if (taxSnapshot.filedAmountOverrides.insurance.estimatedFromEscrow) {
      warnings.push({
        id: "estimated-escrow-insurance",
        tone: "warning",
        title: "Using escrow-derived insurance estimate",
        message: taxSnapshot.filedAmountOverrides.insurance.estimatedSourceLabel || "Insurance is being estimated from escrow until you add actual support.",
      });
    }

    if (unresolvedDisbursements.length > 0) {
      warnings.push({
        id: "unposted-escrow-disbursements",
        tone: "warning",
        title: "Escrow disbursements still need posting",
        message: `${unresolvedDisbursements.length} escrow disbursement${unresolvedDisbursements.length === 1 ? "" : "s"} are not linked to a ledger transaction yet.`,
      });
    }

    return warnings;
  }, [activeTx, escrowDisbursementRows, loanPayments, loans, propertyFilter, taxSnapshot.filedAmountOverrides, yearFilter]);

  const taxScheduleBreakdown = useMemo(
    () => taxSnapshot.schedule.map((line) => ({ ...line, sourceNote: scheduleLineSourceNote(line.source) })),
    [taxSnapshot.schedule],
  );

  const carryoverScope = propertyFilter === "all" ? "all" : propertyFilter;
  const carryoverInputValue = taxCarryoverByScope[buildCarryoverScopeKey(carryoverScope)] ?? "";
  const taxFiledAmountOverrideInput = isRecord(taxFiledAmountOverrides[buildTaxFiledAmountScopeKey(carryoverScope)])
    ? taxFiledAmountOverrides[buildTaxFiledAmountScopeKey(carryoverScope)]
    : {};

  const taxByUnitSchedule = useMemo(() => {
    if (propertyFilter === "all" || unitFilter !== "all") return null;

    const propertyRecord = properties.find((property) => property.id === propertyFilter);
    const unitColumns = units.filter((unit) => unit.propertyId === propertyFilter && unit.name !== "Shared").map((unit) => unit.name);
    const uniqueUnits = Array.from(new Set(unitColumns));
    if (uniqueUnits.length === 0) return null;

    const allocationWeights = buildRentalDayAllocationWeights(
      buildTaxUseDaysSummary(propertyFilter, "all").rows,
      uniqueUnits,
    );
    const sharedSnapshot = buildTaxSnapshot(propertyFilter, "Shared", { includeLoanPayments: true });
    const unitSnapshots = uniqueUnits.map((unitName) => ({
      unitName,
      snapshot: buildTaxSnapshot(propertyFilter, unitName, { includeLoanPayments: false, includeSharedAssets: false }),
    }));

    const rows = scheduleELines.map((line) => {
      const sharedLine = sharedSnapshot.schedule.find((item) => item.id === line.id);
      const unitValues = unitSnapshots.map((entry) => {
        const lineItem = entry.snapshot.schedule.find((item) => item.id === line.id);
        return {
          unitName: entry.unitName,
          amount: (lineItem?.total || 0) + ((sharedLine?.total || 0) * (allocationWeights[entry.unitName] || 0)),
        };
      });
      const totalValue = taxSnapshot.schedule.find((item) => item.id === line.id)?.total || 0;
      return { line, unitValues, totalValue };
    });

    return {
      propertyName: propertyRecord?.name || propertyFilter,
      unitNames: uniqueUnits,
      rows,
    };
  }, [propertyFilter, unitFilter, properties, units, taxSnapshot.schedule, yearFilter, leases, usePeriods, taxDayOverrides]);

  const taxByPropertySchedule = useMemo(() => {
    if (propertyFilter !== "all") return null;

    const propertySnapshots = properties.map((property) => ({
      property,
      snapshot: buildTaxSnapshot(property.id, "all"),
    }));

    const rows = scheduleELines.map((line) => {
      const propertyValues = propertySnapshots.map((entry) => ({
        propertyId: entry.property.id,
        propertyName: entry.property.name,
        amount: entry.snapshot.schedule.find((item) => item.id === line.id)?.total || 0,
      }));
      const totalValue = taxSnapshot.schedule.find((item) => item.id === line.id)?.total || 0;
      return { line, propertyValues, totalValue };
    });

    return {
      propertyNames: propertySnapshots.map((entry) => entry.property.name),
      rows,
    };
  }, [propertyFilter, properties, taxSnapshot.schedule]);

  const printTaxReport = () => {
    const effectiveProperty = taxPrintScope === "current" ? propertyFilter : taxPrintScope === "all" ? "all" : taxPrintProperty;
    const effectiveUnit = taxPrintScope === "current" ? unitFilter : taxPrintScope === "all" ? "all" : taxPrintUnit;

    const snapshot = buildTaxSnapshot(effectiveProperty, effectiveUnit);
    const title = `Tax Center Report (${yearFilter})`;
    const filtersLine = `Property: ${formatPropertyLabel(effectiveProperty)} | Unit: ${formatUnitLabel(effectiveUnit)}`;

    const escapeHtmlValue = (value) =>
      String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

    const summaryRows = [
      ["Gross rent", currency(snapshot.metrics.grossRent)],
      ["Operating expenses (deductible)", currency(snapshot.metrics.opExp)],
      ["Deductible mortgage interest", currency(snapshot.metrics.deductibleLoanInterest)],
      ["De minimis expenses deducted", currency(snapshot.deMinimis.appliedDeductibleTotal)],
      ["Depreciation estimate", currency(snapshot.metrics.depreciation)],
      ["Schedule E estimate (before carryover)", currency(snapshot.metrics.scheduleE)],
      ["Prior-year passive loss carryover", currency(snapshot.metrics.carryoverLoss)],
      ["Schedule E estimate (after carryover)", currency(snapshot.metrics.adjustedScheduleE)],
    ].map(([label, value]) => `<div class="kpi"><div class="kpi-label">${escapeHtmlValue(label)}</div><div class="kpi-value">${escapeHtmlValue(value)}</div></div>`).join("");

    const scheduleRows = snapshot.schedule
      .map((line) => {
        const tone = getScheduleAmountTone(line.id, line.total);
        const amountClass = tone === "income" ? "amount-income" : tone === "expense" ? "amount-expense" : "amount-neutral";
        return `<tr><td>${escapeHtmlValue(line.label)}</td><td class="num"><span class="${amountClass}">${escapeHtmlValue(formatScheduleAmount(line.id, line.total))}</span></td></tr>`;
      })
      .join("");

    const reviewRows = snapshot.reviewSections
      .map((section) => {
        const open = section.flaggedItems.filter((item) => !item.taxChecked).length;
        const checked = section.flaggedItems.filter((item) => item.taxChecked).length;
        return `<tr><td>${escapeHtmlValue(section.title)}</td><td class="num">${open}</td><td class="num">${checked}</td></tr>`;
      })
      .join("");

    const metadataRows = snapshot.selectedProperties
      .map((property) => `<tr><td>${escapeHtmlValue(property.name)}</td><td>${escapeHtmlValue(property.address || "")}</td><td>${escapeHtmlValue(property.purchasedOn || "")}</td></tr>`)
      .join("");

    const daysRows = snapshot.useDays.rows
      .map((row) => `<tr><td>${escapeHtmlValue(row.propertyName)}</td><td>${escapeHtmlValue(row.unit)}</td><td class="num">${row.fairRentalDays}</td><td class="num">${row.personalUseDays}</td><td class="num">${row.vacantDays}</td><td class="num">${row.untrackedDays}</td></tr>`)
      .join("");

    const otherExpenseRows = snapshot.otherExpenseDetail
      .map((detail) => `<tr><td>${escapeHtmlValue(detail.category)}</td><td>${escapeHtmlValue(detail.description)}</td><td class="num">${escapeHtmlValue(currency(detail.total))}</td></tr>`)
      .join("");

    const depreciationRows = snapshot.depreciationAssets
      .map((asset) => `<tr><td>${escapeHtmlValue(propertyNameById[asset.propertyId] || asset.propertyId)}</td><td>${escapeHtmlValue(asset.unit || "")}</td><td>${escapeHtmlValue(asset.description)}</td><td>${escapeHtmlValue(asset.placedInService || "")}</td><td class="num">${escapeHtmlValue(currency(asset.basis || 0))}</td><td class="num">${escapeHtmlValue(String(asset.life || ""))}</td><td class="num">${escapeHtmlValue(currency(asset.yearDepreciation || 0))}</td></tr>`)
      .join("");

    const deMinimisRows = snapshot.deMinimis.rows
      .filter((row) => row.applied)
      .map((row) => `<tr><td>${escapeHtmlValue(row.date)}</td><td>${escapeHtmlValue(`${row.propertyName} | ${row.unit}`)}</td><td>${escapeHtmlValue(row.description)}</td><td class="num">${escapeHtmlValue(currency(row.invoiceAmount))}</td><td class="num">${escapeHtmlValue(currency(row.deductibleAmount))}</td></tr>`)
      .join("");

    const tieOutRows = [
      ["Gross rent", snapshot.metrics.grossRent],
      ["Operating expenses", -snapshot.metrics.opExp],
      ["Mortgage interest", -snapshot.metrics.deductibleLoanInterest],
      ["Depreciation", -snapshot.metrics.depreciation],
      ["Schedule E estimate (before carryover)", snapshot.metrics.scheduleE],
      ["Prior-year passive loss carryover", -snapshot.metrics.carryoverLoss],
      ["Schedule E estimate (after carryover)", snapshot.metrics.adjustedScheduleE],
    ]
      .map((entry) => `<tr><td>${escapeHtmlValue(entry[0])}</td><td class="num">${escapeHtmlValue(currency(entry[1]))}</td></tr>`)
      .join("");

    let byUnitScheduleSection = "";
    if (effectiveProperty !== "all" && effectiveUnit === "all") {
      const propertyRecord = properties.find((property) => property.id === effectiveProperty);
      const unitColumns = units.filter((unit) => unit.propertyId === effectiveProperty && unit.name !== "Shared").map((unit) => unit.name);
      const uniqueColumns = Array.from(new Set(unitColumns));
      const allocationWeights = buildRentalDayAllocationWeights(
        buildTaxUseDaysSummary(effectiveProperty, "all").rows,
        uniqueColumns,
      );
      const sharedSnapshot = buildTaxSnapshot(effectiveProperty, "Shared", { includeLoanPayments: true });
      const unitSnapshots = uniqueColumns.map((unitName) => ({
        unitName,
        snapshot: buildTaxSnapshot(effectiveProperty, unitName, { includeLoanPayments: false, includeSharedAssets: false }),
      }));

      const headerCols = uniqueColumns.map((unitName) => `<th class="num">${escapeHtmlValue(unitName)}</th>`).join("");
      const bodyRows = scheduleELines.map((line) => {
        const sharedLine = sharedSnapshot.schedule.find((item) => item.id === line.id);
        const unitCells = unitSnapshots
          .map((entry) => {
            const lineItem = entry.snapshot.schedule.find((item) => item.id === line.id);
            const cellValue = (lineItem?.total || 0) + ((sharedLine?.total || 0) * (allocationWeights[entry.unitName] || 0));
            const tone = getScheduleAmountTone(line.id, cellValue);
            const amountClass = tone === "income" ? "amount-income" : tone === "expense" ? "amount-expense" : "amount-neutral";
            return `<td class="num"><span class="${amountClass}">${escapeHtmlValue(formatScheduleAmount(line.id, cellValue))}</span></td>`;
          })
          .join("");
        const totalLine = snapshot.schedule.find((item) => item.id === line.id);
        const totalValue = totalLine?.total || 0;
        const totalTone = getScheduleAmountTone(line.id, totalValue);
        const totalClass = totalTone === "income" ? "amount-income" : totalTone === "expense" ? "amount-expense" : "amount-neutral";
        return `<tr><td>${escapeHtmlValue(line.label)}</td>${unitCells}<td class="num"><strong class="${totalClass}">${escapeHtmlValue(formatScheduleAmount(line.id, totalValue))}</strong></td></tr>`;
      }).join("");

      byUnitScheduleSection = `<section class="section"><h2>Schedule E by Unit - ${escapeHtmlValue(propertyRecord?.name || effectiveProperty)}</h2><div class="muted" style="margin: 0 0 8px;">Shared line items are allocated by each unit&apos;s fair rental days.</div><table><thead><tr><th>Category</th>${headerCols}<th class="num">Total</th></tr></thead><tbody>${bodyRows}</tbody></table></section>`;
    }

    let allPropertiesScheduleSection = "";
    let allPropertiesEstimateSection = "";
    if (taxPrintScope === "all") {
      const propertySnapshots = properties.map((property) => ({ property, snapshot: buildTaxSnapshot(property.id, "all") }));

      const headerCols = propertySnapshots.map((entry) => `<th class="num">${escapeHtmlValue(entry.property.name)}</th>`).join("");
      const bodyRows = scheduleELines.map((line) => {
        const propertyCells = propertySnapshots
          .map((entry) => {
            const lineItem = entry.snapshot.schedule.find((item) => item.id === line.id);
            const cellValue = lineItem?.total || 0;
            const tone = getScheduleAmountTone(line.id, cellValue);
            const amountClass = tone === "income" ? "amount-income" : tone === "expense" ? "amount-expense" : "amount-neutral";
            return `<td class="num"><span class="${amountClass}">${escapeHtmlValue(formatScheduleAmount(line.id, cellValue))}</span></td>`;
          })
          .join("");
        const totalLine = snapshot.schedule.find((item) => item.id === line.id);
        const totalValue = totalLine?.total || 0;
        const totalTone = getScheduleAmountTone(line.id, totalValue);
        const totalClass = totalTone === "income" ? "amount-income" : totalTone === "expense" ? "amount-expense" : "amount-neutral";
        return `<tr><td>${escapeHtmlValue(line.label)}</td>${propertyCells}<td class="num"><strong class="${totalClass}">${escapeHtmlValue(formatScheduleAmount(line.id, totalValue))}</strong></td></tr>`;
      }).join("");

      allPropertiesScheduleSection = `<section class="section"><h2>Schedule E by Property (Portfolio Total Included)</h2><table><thead><tr><th>Category</th>${headerCols}<th class="num">Portfolio total</th></tr></thead><tbody>${bodyRows}</tbody></table></section>`;

      const estimateRows = propertySnapshots.map((entry) => {
        const metrics = entry.snapshot.metrics;
        return `<tr><td>${escapeHtmlValue(entry.property.name)}</td><td class="num">${escapeHtmlValue(currency(metrics.grossRent))}</td><td class="num">${escapeHtmlValue(currency(metrics.opExp))}</td><td class="num">${escapeHtmlValue(currency(metrics.deductibleLoanInterest))}</td><td class="num">${escapeHtmlValue(currency(metrics.depreciation))}</td><td class="num">${escapeHtmlValue(currency(metrics.scheduleE))}</td><td class="num">${escapeHtmlValue(currency(metrics.carryoverLoss))}</td><td class="num">${escapeHtmlValue(currency(metrics.adjustedScheduleE))}</td></tr>`;
      }).join("");

      allPropertiesEstimateSection = `<section class="section"><h2>Per-Property Estimates</h2><table><thead><tr><th>Property</th><th class="num">Gross rent</th><th class="num">OpEx</th><th class="num">Mortgage int.</th><th class="num">Depreciation</th><th class="num">Schedule E (before)</th><th class="num">Carryover</th><th class="num">Schedule E (after)</th></tr></thead><tbody>${estimateRows}</tbody></table></section>`;
    }

    const printHtml = "<!doctype html>"
      + `<html><head><meta charset="utf-8" /><title>${escapeHtmlValue(title)}</title>`
      + "<style>"
      + "body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 22px; color: #0f172a; }"
      + "h1 { margin: 0; font-size: 22px; }"
      + ".muted { color: #475569; margin-top: 6px; font-size: 13px; }"
      + ".section { margin-top: 18px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }"
      + ".section h2 { margin: 0 0 10px; font-size: 15px; }"
      + ".kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }"
      + ".kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; }"
      + ".kpi-label { color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }"
      + ".kpi-value { margin-top: 4px; font-size: 15px; font-weight: 600; }"
      + "table { width: 100%; border-collapse: collapse; font-size: 12px; }"
      + "th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }"
      + "th { background: #f8fafc; color: #475569; font-weight: 600; }"
      + ".num { text-align: right; white-space: nowrap; }"
      + ".amount-income { color: #047857; font-weight: 600; }"
      + ".amount-expense { color: #b91c1c; font-weight: 600; }"
      + ".amount-neutral { color: #0f172a; font-weight: 600; }"
      + "@media print { body { margin: 10mm; } .section { break-inside: avoid; } }"
      + `</style></head><body><h1>${escapeHtmlValue(title)}</h1><div class="muted">${escapeHtmlValue(filtersLine)}</div>`
      + `<section class="section"><h2>Summary</h2><div class="kpi-grid">${summaryRows}</div></section>`
      + `<section class="section"><h2>Filing Metadata</h2><table><thead><tr><th>Property</th><th>Address</th><th>Placed in service / purchased</th></tr></thead><tbody>${metadataRows}</tbody></table></section>`
      + `<section class="section"><h2>Fair Rental / Personal Use Days</h2><table><thead><tr><th>Property</th><th>Unit</th><th class="num">Fair rental</th><th class="num">Personal use</th><th class="num">Vacant</th><th class="num">Untracked</th></tr></thead><tbody>${daysRows}<tr><td colspan="2"><strong>Total</strong></td><td class="num"><strong>${snapshot.useDays.totals.fairRentalDays}</strong></td><td class="num"><strong>${snapshot.useDays.totals.personalUseDays}</strong></td><td class="num"><strong>${snapshot.useDays.totals.vacantDays}</strong></td><td class="num"><strong>${snapshot.useDays.totals.untrackedDays}</strong></td></tr></tbody></table></section>`
      + `<section class="section"><h2>Schedule E Tie-Out</h2><table><thead><tr><th>Item</th><th class="num">Amount</th></tr></thead><tbody>${tieOutRows}</tbody></table></section>`
      + (byUnitScheduleSection || allPropertiesScheduleSection ? "" : `<section class="section"><h2>Schedule E Breakdown</h2><table><thead><tr><th>Category</th><th class="num">Total</th></tr></thead><tbody>${scheduleRows}</tbody></table></section>`)
      + byUnitScheduleSection
      + allPropertiesScheduleSection
      + allPropertiesEstimateSection
      + (otherExpenseRows ? `<section class="section"><h2>Other Expenses Statement</h2><table><thead><tr><th>Category</th><th>Description</th><th class="num">Amount</th></tr></thead><tbody>${otherExpenseRows}</tbody></table></section>` : "")
      + (deMinimisRows ? `<section class="section"><h2>De minimis Safe Harbor Deductions</h2><div class="muted" style="margin: 0 0 8px;">Election ${escapeHtmlValue(snapshot.deMinimis.electionEnabled ? "on" : "off")} | Threshold ${escapeHtmlValue(currency(snapshot.deMinimis.threshold))} | Statement prepared ${escapeHtmlValue(snapshot.deMinimis.statementPrepared ? "yes" : "no")}</div><table><thead><tr><th>Date</th><th>Property/Unit</th><th>Description</th><th class="num">Invoice amount</th><th class="num">Deducted</th></tr></thead><tbody>${deMinimisRows}</tbody></table></section>` : "")
      + `<section class="section"><h2>Depreciation Support</h2><table><thead><tr><th>Property</th><th>Unit</th><th>Asset</th><th>Placed in service</th><th class="num">Basis</th><th class="num">Life</th><th class="num">Current-year depreciation</th></tr></thead><tbody>${depreciationRows}</tbody></table></section>`
      + `<section class="section"><h2>Tax Review Status</h2><div class="muted" style="margin: 0 0 8px;">Open items: ${snapshot.openReviewCount}</div><table><thead><tr><th>Section</th><th class="num">Open</th><th class="num">Checked</th></tr></thead><tbody>${reviewRows}</tbody></table></section>`
      + "</body></html>";

    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    printFrame.setAttribute("aria-hidden", "true");
    document.body.appendChild(printFrame);

    const cleanup = () => {
      if (printFrame.parentNode) {
        printFrame.parentNode.removeChild(printFrame);
      }
    };

    const frameDoc = printFrame.contentWindow?.document;
    if (!frameDoc || !printFrame.contentWindow) {
      cleanup();
      setNotice("Could not initialize print preview.");
      return;
    }

    frameDoc.open();
    frameDoc.write(printHtml);
    frameDoc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } finally {
        setTimeout(cleanup, 2000);
      }
    }, 120);

    setTaxPrintDialogOpen(false);
    setNotice("Print preview opened.");
  };

  return {
    carryoverInputValue,
    carryoverScope,
    clearTaxFiledAmountOverride,
    clearEscrowDisbursementDraft,
    confirmResetTaxDayOverride,
    createEscrowTransaction,
    deleteEscrowDisbursement,
    editingEscrowDisbursementId,
    escrowDisbursementDraft,
    escrowDisbursementRows,
    defaultEscrowLoanOptions,
    dashboardUnitAllocationWeight,
    formatScheduleAmount,
    getScheduleAmountTone,
    linkEscrowDisbursementToTransaction,
    printTaxReport,
    saveEscrowDisbursement,
    setCarryoverForScope,
    setEscrowDisbursementDraft,
    setTaxDayOverride,
    setTaxFiledAmountOverride,
    setTaxFiledAmountOverrideNote,
    startEditEscrowDisbursement,
    taxByPropertySchedule,
    taxByUnitSchedule,
    taxEscrowWarnings,
    taxFiledAmountOverrideInput,
    taxPrintUnitOptions,
    taxScheduleBreakdown,
    taxReportingSnapshot,
    taxSnapshot,
  };
}
