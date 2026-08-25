import { useMemo, useState } from "react";
import { buildTenantLedgerSummary, compareTenantLedgerEntries } from "../domain/tenantLedger.ts";
import {
  defaultTenantLedgerPostingDescription,
  isTenantLedgerKindAllowedForTreatment,
  normalizeTenantLedgerAccountingTreatment,
  tenantLedgerKindsForTreatment,
  tenantLedgerPostingTemplate,
} from "../domain/tenantLedgerPosting.ts";
import {
  TENANT_LEDGER_ACCOUNTING_OPTIONS,
  TENANT_LEDGER_KIND_OPTIONS,
  leaseIsActiveByDate,
} from "./leaseShared.js";
import {
  createBlankTenantLedgerDraft,
} from "./draftFactories.js";
import {
  leaseBillingAmount,
  leaseBillingIntervalDays,
  leaseMonthlyEquivalent,
  normalizeLeaseAgreementType,
  normalizeLeaseBillingCadence,
  normalizeLeaseDurationType,
} from "../domain/leaseTerms.js";

const FAR_FUTURE_DATE = "9999-12-31";

const rangesOverlap = (startA, endA, startB, endB) => startA <= endB && startB <= endA;

const previousDayIso = (isoDate) => {
  const dt = new Date(`${isoDate}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
};

const nextDayIso = (isoDate) => {
  const dt = new Date(`${isoDate}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
};

function createBlankUsePeriodDraft(todayIso) {
  return {
    useType: "Owner-Occupied",
    startDate: todayIso,
    endDate: "",
    reviewed: false,
    reviewNotes: "",
  };
}

export function useLeaseTenantLedgerController({
  actions,
  appSettings,
  confirmDestructiveActions,
  currency,
  documents,
  inferDocumentTags,
  leaseAutomationReminders,
  leasePdfInputRef,
  leases,
  openConfirmDialog,
  openTransaction,
  prefetchDialog,
  readFileAsDataUrl,
  requirePermission,
  setNotice,
  tenantLedgerEntries,
  todayIso,
  transactionById,
  usePeriods,
}) {
  const [leaseDraft, setLeaseDraft] = useState(null);
  const [leaseEditorMode, setLeaseEditorMode] = useState("full");
  const [editingUsePeriodId, setEditingUsePeriodId] = useState("");
  const [usePeriodDraft, setUsePeriodDraft] = useState(() => createBlankUsePeriodDraft(todayIso));
  const [leaseValidationDialog, setLeaseValidationDialog] = useState({ open: false, message: "" });
  const [editingTenantLedgerEntryId, setEditingTenantLedgerEntryId] = useState("");
  const [tenantLedgerDraft, setTenantLedgerDraft] = useState(() => createBlankTenantLedgerDraft());
  const [leaseTenantLedgerSort, setLeaseTenantLedgerSort] = useState("date_desc");

  const getUnitStatusForDate = (unit, date = todayIso) => {
    const hasActiveLease = leases.some(
      (lease) => lease.propertyId === unit.propertyId && lease.unit === unit.name && leaseIsActiveByDate(lease, date),
    );
    if (hasActiveLease) return "Rental";

    const matchingUse = usePeriods
      .filter(
        (period) =>
          period.propertyId === unit.propertyId &&
          period.unit === unit.name &&
          period.startDate <= date &&
          (!period.endDate || period.endDate >= date),
      )
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

    if (matchingUse?.useType === "Owner-Occupied") return "Owner-Occupied";
    return "Vacant";
  };

  const getUnitOccupancyPeriods = (propertyId, unitName) =>
    usePeriods
      .filter(
        (period) =>
          period.propertyId === propertyId &&
          period.unit === unitName &&
          (period.useType === "Owner-Occupied" || period.useType === "Vacant"),
      )
      .sort((a, b) => b.startDate.localeCompare(a.startDate));

  const selectedLeaseDocuments = useMemo(() => {
    if (!leaseDraft) return [];
    return documents.filter((doc) => doc.leaseId === leaseDraft.id);
  }, [documents, leaseDraft]);
  const leaseTenantLedgerSummary = useMemo(() => {
    if (!leaseDraft?.id) {
      return { rows: [], chargeBalanceById: {}, totalDue: 0, tenantCredit: 0 };
    }

    return buildTenantLedgerSummary(
      tenantLedgerEntries.filter((entry) => entry.leaseId === leaseDraft.id),
    );
  }, [leaseDraft, tenantLedgerEntries]);
  const leaseTenantLedgerRowById = useMemo(
    () => Object.fromEntries(leaseTenantLedgerSummary.rows.map((row) => [row.id, row])),
    [leaseTenantLedgerSummary.rows],
  );
  const leaseTenantLedgerHeadline = useMemo(() => {
    if (leaseTenantLedgerSummary.totalDue > 0) {
      return `Balance due: ${currency(leaseTenantLedgerSummary.totalDue)}`;
    }
    if (leaseTenantLedgerSummary.tenantCredit > 0) {
      return `Tenant credit: ${currency(leaseTenantLedgerSummary.tenantCredit)}`;
    }
    return `Current balance: ${currency(0)}`;
  }, [currency, leaseTenantLedgerSummary.tenantCredit, leaseTenantLedgerSummary.totalDue]);
  const displayedLeaseTenantLedgerRows = useMemo(() => {
    if (leaseTenantLedgerSort === "date_asc") return leaseTenantLedgerSummary.rows;
    return [...leaseTenantLedgerSummary.rows].sort((a, b) => compareTenantLedgerEntries(b, a));
  }, [leaseTenantLedgerSort, leaseTenantLedgerSummary.rows]);
  const selectedLeaseAutomationReminders = useMemo(() => {
    if (!leaseDraft?.id) return [];
    return leaseAutomationReminders.filter((reminder) => reminder.leaseId === leaseDraft.id);
  }, [leaseAutomationReminders, leaseDraft]);

  const resetTenantLedgerEditor = (leaseLike = null) => {
    const defaultAmount = leaseLike ? String(Math.max(0, Number(leaseLike.monthlyRent || 0))) : "";
    setEditingTenantLedgerEntryId("");
    setTenantLedgerDraft(createBlankTenantLedgerDraft(todayIso, defaultAmount));
  };

  const startTenantLedgerEntryEdit = (entry) => {
    setEditingTenantLedgerEntryId(entry.id);
    setTenantLedgerDraft({
      date: entry.date,
      kind: entry.kind,
      accountingTreatment: normalizeTenantLedgerAccountingTreatment(entry.accountingTreatment),
      amount: String(entry.amount),
      memo: entry.memo || "",
      automationKey: String(entry.automationKey || ""),
    });
  };

  const openLinkedTenantLedgerTransaction = (entry) => {
    if (!entry?.transactionId) {
      setNotice("No linked accounting transaction for this entry yet.");
      return;
    }
    const txn = transactionById[entry.transactionId];
    if (!txn) {
      setNotice("Linked accounting transaction was not found.");
      return;
    }
    openTransaction(txn, "leaseHistory", false);
  };

  const upsertTenantLedgerLinkedTransaction = (args) => {
    if (!leaseDraft) return { transactionId: "", note: "" };

    const postingTemplate = tenantLedgerPostingTemplate(args.accountingTreatment);
    if (!postingTemplate) {
      return { transactionId: args.existingTransactionId || "", note: "" };
    }

    const existingTxn = args.existingTransactionId ? transactionById[args.existingTransactionId] : null;
    const txnId = args.existingTransactionId || `t-ledger-${Date.now()}`;
    const amount = Math.abs(Number(args.amount || 0));
    const preview = actions.computeTransactionPreview({
      amount,
      type: postingTemplate.txType,
      capitalImprovement: false,
      propertyId: leaseDraft.propertyId,
      unit: leaseDraft.unit || "Shared",
      date: args.date,
      ownerUsePct: 0,
    });
    const description = defaultTenantLedgerPostingDescription({
      treatment: args.accountingTreatment,
      tenantName: leaseDraft.tenantName || "",
      unit: leaseDraft.unit || "",
      memo: args.memo,
    });

    actions.addOrUpdateTransaction({
      id: txnId,
      date: args.date,
      propertyId: leaseDraft.propertyId,
      unit: leaseDraft.unit || "Shared",
      type: postingTemplate.txType,
      category: postingTemplate.category,
      description,
      amount,
      ownerUsePct: 0,
      rentalUsePct: preview.rentalUsePct,
      deductibleAmount: postingTemplate.txType === "Transfer" ? 0 : preview.deductibleAmount,
      paidFrom: postingTemplate.paidFrom,
      paymentMethod: postingTemplate.paymentMethod,
      reimbursable: false,
      reimbursed: false,
      capitalImprovement: false,
      vendor: leaseDraft.tenantName || "Tenant",
      receiptName: existingTxn?.receiptName || "",
      notes: `Linked tenant ledger entry ${args.entryId}.`,
      taxChecked: postingTemplate.txType !== "Expense",
      reconciled: existingTxn?.reconciled === true,
      invoiceRef: existingTxn?.invoiceRef || "",
      invoiceAmount: existingTxn?.invoiceAmount ?? amount,
      tenantLedgerEntryId: args.entryId,
      status: existingTxn?.status === "voided" ? "voided" : "active",
    });

    const noteBase = postingTemplate.nonIncome
      ? " Posted as non-income security-deposit activity."
      : " Posted to accounting ledger.";
    const note =
      args.accountingTreatment === "security_deposit_applied_damages"
        ? `${noteBase} Add or keep repairs expenses separately for damage documentation.`
        : noteBase;
    return { transactionId: txnId, note };
  };

  const clearTenantLedgerEntryDraft = () => {
    resetTenantLedgerEditor(leaseDraft);
  };

  const saveTenantLedgerEntry = () => {
    if (!leaseDraft?.id) return;

    const date = String(tenantLedgerDraft.date || "").trim();
    const rawKind = String(tenantLedgerDraft.kind || "charge");
    const kind = TENANT_LEDGER_KIND_OPTIONS.some((option) => option.value === rawKind) ? rawKind : "charge";
    const accountingTreatment = normalizeTenantLedgerAccountingTreatment(tenantLedgerDraft.accountingTreatment);
    const amount = Number(tenantLedgerDraft.amount);
    const memo = String(tenantLedgerDraft.memo || "").trim();

    if (!date) {
      setNotice("Ledger date is required.");
      return;
    }

    if (!Number.isFinite(amount) || amount === 0) {
      setNotice("Enter a ledger amount that is not 0.");
      return;
    }

    if (!isTenantLedgerKindAllowedForTreatment(kind, accountingTreatment)) {
      const treatmentLabel =
        TENANT_LEDGER_ACCOUNTING_OPTIONS.find((option) => option.value === accountingTreatment)?.label || "Selected posting";
      const allowedKindLabels = tenantLedgerKindsForTreatment(accountingTreatment)
        .map((allowedKind) => TENANT_LEDGER_KIND_OPTIONS.find((option) => option.value === allowedKind)?.label?.toLowerCase() || allowedKind)
        .join(" or ");
      setNotice(`${treatmentLabel} should use a ${allowedKindLabels} entry.`);
      return;
    }

    if (kind !== "adjustment" && amount < 0) {
      setNotice("Use a positive amount for charges, payments, credits, and refunds.");
      return;
    }

    if (kind === "adjustment" && memo.length < 4) {
      setNotice("Adjustment memo is required for audit history.");
      return;
    }

    const existing = editingTenantLedgerEntryId
      ? tenantLedgerEntries.find((entry) => entry.id === editingTenantLedgerEntryId)
      : null;
    const entryId = existing?.id || `tle-${Date.now()}`;

    let linkedTransactionId = existing?.transactionId || "";
    let postingNote = "";
    if (accountingTreatment !== "none") {
      const posting = upsertTenantLedgerLinkedTransaction({
        entryId,
        accountingTreatment,
        existingTransactionId: existing?.transactionId || "",
        date,
        amount,
        memo,
      });
      linkedTransactionId = posting.transactionId || linkedTransactionId;
      postingNote = posting.note;
    } else if (existing?.transactionId) {
      postingNote = " Existing linked accounting transaction was kept.";
    }

    actions.addOrUpdateTenantLedgerEntry({
      id: entryId,
      leaseId: leaseDraft.id,
      date,
      kind,
      amount,
      memo,
      accountingTreatment,
      transactionId: linkedTransactionId || undefined,
      reviewed: existing?.reviewed || false,
      reviewedAt: existing?.reviewedAt || "",
      reviewNotes: existing?.reviewNotes || "",
      linkedWorkOrderId: existing?.linkedWorkOrderId || undefined,
      linkedDocumentIds: existing?.linkedDocumentIds || [],
      automationKey: String(existing?.automationKey || tenantLedgerDraft.automationKey || "").trim() || undefined,
      createdAt: existing?.createdAt || new Date().toISOString(),
    });

    const tenantLabel = leaseDraft.tenantName || leaseDraft.unit;
    setNotice((editingTenantLedgerEntryId ? `Ledger entry updated for ${tenantLabel}.` : `Ledger entry added for ${tenantLabel}.`) + postingNote);
    resetTenantLedgerEditor(leaseDraft);
  };

  const removeTenantLedgerEntry = (entry) => {
    const hadLinkedTransaction = Boolean(entry?.transactionId && transactionById[entry.transactionId]);
    actions.deleteTenantLedgerEntry(entry.id);
    if (editingTenantLedgerEntryId === entry.id) {
      resetTenantLedgerEditor(leaseDraft);
    }
    setNotice(hadLinkedTransaction ? "Ledger entry deleted. Linked accounting transaction was kept." : "Ledger entry deleted.");
  };

  const confirmAndDeleteTenantLedgerEntry = (entry) => {
    if (!requirePermission("delete_records", "Admin access is required to delete tenant ledger entries.")) return;
    const runDelete = () => removeTenantLedgerEntry(entry);
    if (!confirmDestructiveActions) {
      runDelete();
      return;
    }

    openConfirmDialog({
      title: "Delete ledger entry?",
      message:
        `Delete ${entry.kind} entry from ${entry.date} for ${currency(Math.abs(Number(entry.amount || 0)))}?` +
        (entry.transactionId ? " Linked accounting transaction will be kept." : ""),
      confirmLabel: "Delete entry",
      onConfirm: runDelete,
    });
  };

  const openLease = (lease) => {
    prefetchDialog("leaseEditor");
    const draft = {
      ...lease,
      monthlyRent: String(lease.monthlyRent),
      rentAmount: String(leaseBillingAmount(lease)),
      securityDeposit: String(lease.securityDeposit || ""),
      actualEndDate: lease.actualEndDate || "",
      rentalType: lease.rentalType || "Long-term",
      agreementType: normalizeLeaseAgreementType(lease),
      billingCadence: normalizeLeaseBillingCadence(lease),
      billingIntervalDays: leaseBillingIntervalDays(lease) || 30,
      firstRentDueDate: lease.firstRentDueDate || lease.startDate,
      prorationMethod: lease.prorationMethod === "none" ? "none" : "thirty_day",
      utilitiesIncluded: Boolean(lease.utilitiesIncluded),
      monthToMonthAfterTerm: lease.monthToMonthAfterTerm ?? true,
      extensionTermMonths: lease.extensionTermMonths ?? 0,
      rentDueDay: Number(lease.rentDueDay || appSettings.leaseDefaultRentDueDay || 1),
      reminderDaysBefore: Number(lease.reminderDaysBefore ?? appSettings.leaseReminderDaysBefore ?? 3),
      lateFeeGraceDays: Number(lease.lateFeeGraceDays ?? appSettings.leaseLateFeeGraceDays ?? 5),
      lateFeeType:
        lease.lateFeeType === "percent"
          ? "percent"
          : appSettings.leaseLateFeeType === "percent"
            ? "percent"
            : "flat",
      lateFeeValue: Number(lease.lateFeeValue ?? appSettings.leaseLateFeeValue ?? 50),
      autoLateFeeEnabled: lease.autoLateFeeEnabled === true ? true : appSettings.leaseAutoLateFeeEnabled === true,
    };
    setLeaseDraft(draft);
    setLeaseEditorMode("full");
    setEditingUsePeriodId("");
    const currentStatus = getUnitStatusForDate({ propertyId: lease.propertyId, name: lease.unit }, todayIso);
    setUsePeriodDraft({
      useType: currentStatus === "Rental" ? "Owner-Occupied" : currentStatus,
      startDate: "",
      endDate: "",
      reviewed: false,
      reviewNotes: "",
    });
    resetTenantLedgerEditor(draft);
  };

  const openNewLeaseForUnit = (propertyId, unitName, startDate = todayIso) => {
    prefetchDialog("leaseEditor");
    const leaseId = `lease-${Date.now()}`;
    const draft = {
      id: leaseId,
      propertyId,
      unit: unitName,
      tenantName: "",
      startDate,
      endDate: startDate,
      actualEndDate: "",
      monthlyRent: "0",
      rentAmount: "0",
      securityDeposit: "",
      rentalType: "Long-term",
      agreementType: "fixed_term",
      billingCadence: "monthly",
      billingIntervalDays: 30,
      firstRentDueDate: startDate,
      prorationMethod: "thirty_day",
      utilitiesIncluded: false,
      monthToMonthAfterTerm: false,
      extensionTermMonths: 0,
      status: "Active",
      notes: "",
      rentDueDay: Number(appSettings.leaseDefaultRentDueDay || 1),
      reminderDaysBefore: Number(appSettings.leaseReminderDaysBefore || 3),
      lateFeeGraceDays: Number(appSettings.leaseLateFeeGraceDays || 5),
      lateFeeType: appSettings.leaseLateFeeType === "percent" ? "percent" : "flat",
      lateFeeValue: Number(appSettings.leaseLateFeeValue || 50),
      autoLateFeeEnabled: appSettings.leaseAutoLateFeeEnabled === true,
    };
    setLeaseDraft(draft);
    setLeaseEditorMode("full");
    setEditingUsePeriodId("");
    setUsePeriodDraft({
      useType: "Vacant",
      startDate: "",
      endDate: "",
      reviewed: false,
      reviewNotes: "",
    });
    resetTenantLedgerEditor(draft);
  };

  const openLeaseForUnit = (propertyId, unitName) => {
    prefetchDialog("leaseEditor");
    const leaseId = `lease-${Date.now()}`;
    const currentStatus = getUnitStatusForDate({ propertyId, name: unitName }, todayIso);
    const draft = {
      id: leaseId,
      propertyId,
      unit: unitName,
      tenantName: "",
      startDate: todayIso,
      endDate: todayIso,
      actualEndDate: "",
      monthlyRent: "0",
      rentAmount: "0",
      securityDeposit: "",
      rentalType: "Long-term",
      agreementType: "fixed_term",
      billingCadence: "monthly",
      billingIntervalDays: 30,
      firstRentDueDate: todayIso,
      prorationMethod: "thirty_day",
      utilitiesIncluded: false,
      monthToMonthAfterTerm: false,
      extensionTermMonths: 0,
      status: "Active",
      notes: "",
      rentDueDay: Number(appSettings.leaseDefaultRentDueDay || 1),
      reminderDaysBefore: Number(appSettings.leaseReminderDaysBefore || 3),
      lateFeeGraceDays: Number(appSettings.leaseLateFeeGraceDays || 5),
      lateFeeType: appSettings.leaseLateFeeType === "percent" ? "percent" : "flat",
      lateFeeValue: Number(appSettings.leaseLateFeeValue || 50),
      autoLateFeeEnabled: appSettings.leaseAutoLateFeeEnabled === true,
    };
    setLeaseDraft(draft);
    setLeaseEditorMode("occupancy");
    setEditingUsePeriodId("");
    setUsePeriodDraft({
      useType: currentStatus === "Rental" ? "Owner-Occupied" : currentStatus,
      startDate: todayIso,
      endDate: "",
      reviewed: false,
      reviewNotes: "",
    });
    resetTenantLedgerEditor(draft);
  };

  const saveUnitOccupancyPeriod = (context) => {
    if (!context) return;
    if (!usePeriodDraft.startDate) {
      setNotice("Start date is required.");
      return;
    }
    if (usePeriodDraft.endDate && usePeriodDraft.endDate < usePeriodDraft.startDate) {
      setNotice("End date must be on or after start date.");
      return;
    }

    let effectiveEndDate = usePeriodDraft.endDate || "";
    if (!effectiveEndDate) {
      const nextLease = leases
        .filter(
          (lease) =>
            lease.propertyId === context.propertyId &&
            lease.unit === context.name &&
            lease.startDate > usePeriodDraft.startDate,
        )
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
      if (nextLease) effectiveEndDate = previousDayIso(nextLease.startDate);
    }

    const candidateEnd = effectiveEndDate || FAR_FUTURE_DATE;
    const existing = getUnitOccupancyPeriods(context.propertyId, context.name);
    const overlap = existing.some(
      (period) =>
        period.id !== editingUsePeriodId &&
        rangesOverlap(
          usePeriodDraft.startDate,
          candidateEnd,
          period.startDate,
          period.endDate || FAR_FUTURE_DATE,
        ),
    );
    if (overlap) {
      setNotice("Dates overlap an existing owner/vacancy period for this unit.");
      return;
    }

    actions.upsertUsePeriod({
      id: editingUsePeriodId || undefined,
      propertyId: context.propertyId,
      unit: context.name,
      startDate: usePeriodDraft.startDate,
      endDate: effectiveEndDate,
      useType: usePeriodDraft.useType,
      reviewed: Boolean(usePeriodDraft.reviewed),
      reviewedAt: usePeriodDraft.reviewed ? new Date().toISOString() : "",
      reviewNotes: String(usePeriodDraft.reviewNotes || "").trim(),
    });
    setNotice("Occupancy dates saved.");
    setEditingUsePeriodId("");
  };

  const removeUsePeriod = (periodId) => {
    actions.deleteUsePeriod(periodId);
    setNotice("Occupancy period removed.");
  };

  const confirmAndDeleteUsePeriod = (period) => {
    if (!requirePermission("delete_records", "Admin access is required to delete owner-use periods.")) return;
    const runDelete = () => removeUsePeriod(period.id);
    if (!confirmDestructiveActions) {
      runDelete();
      return;
    }
    openConfirmDialog({
      title: "Delete occupancy period?",
      message: `Remove ${period.useType} period ${period.startDate} to ${period.endDate || "open-ended"}?`,
      confirmLabel: "Delete period",
      onConfirm: runDelete,
    });
  };

  const openOccupancyEditor = (propertyId, unitName, period = null) => {
    if (!propertyId || !unitName) {
      setNotice("Unable to open occupancy editor for this unit.");
      return;
    }

    openLeaseForUnit(propertyId, unitName);
    if (!period) return;
    setEditingUsePeriodId(period.id);
    setUsePeriodDraft({
      useType: period.useType,
      startDate: period.startDate,
      endDate: period.endDate || "",
      reviewed: Boolean(period.reviewed),
      reviewNotes: period.reviewNotes || "",
    });
  };

  const closeLeaseEditor = () => {
    setLeaseDraft(null);
    setLeaseEditorMode("full");
    setEditingUsePeriodId("");
    setUsePeriodDraft(createBlankUsePeriodDraft(todayIso));
    setLeaseValidationDialog({ open: false, message: "" });
    resetTenantLedgerEditor(null);
    if (leasePdfInputRef?.current) leasePdfInputRef.current.value = "";
  };

  const confirmAndDeleteLease = () => {
    if (!requirePermission("delete_records", "Admin access is required to delete leases.")) return;
    if (!leaseDraft?.id) return;
    const leaseToDelete = leaseDraft;
    const runDelete = () => {
      actions.deleteLease(leaseToDelete.id);
      setNotice(`Lease deleted for ${leaseToDelete.tenantName || leaseToDelete.unit}.`);
      closeLeaseEditor();
    };
    if (!confirmDestructiveActions) {
      runDelete();
      return;
    }
    openConfirmDialog({
      title: "Delete lease?",
      message: `Delete lease for ${leaseToDelete.tenantName || leaseToDelete.unit}? This cannot be undone.`,
      confirmLabel: "Delete lease",
      onConfirm: runDelete,
    });
  };

  const saveLease = () => {
    if (!requirePermission("create_edit_records", "This access profile cannot save leases.")) return;
    if (!leaseDraft || leaseEditorMode !== "full") return;
    const rentAmount = Number(leaseDraft.rentAmount ?? leaseDraft.monthlyRent);
    if (!Number.isFinite(rentAmount) || rentAmount <= 0) {
      setLeaseValidationDialog({ open: true, message: "Enter a rent amount greater than 0." });
      return;
    }
    const agreementType = normalizeLeaseAgreementType(leaseDraft);
    if (agreementType !== "month_to_month" && (!leaseDraft.endDate || leaseDraft.endDate < leaseDraft.startDate)) {
      setLeaseValidationDialog({ open: true, message: "Enter a term end date on or after the start date." });
      return;
    }
    const billingCadence = normalizeLeaseBillingCadence(leaseDraft);
    if (billingCadence === "full_term" && agreementType !== "fixed_term") {
      setLeaseValidationDialog({ open: true, message: "Full-term upfront billing requires a fixed-term agreement." });
      return;
    }
    const normalizedActualEndDate = (leaseDraft.actualEndDate || "").trim();
    const leaseWithTerms = {
      ...leaseDraft,
      rentAmount,
      securityDeposit: Math.max(0, Number(leaseDraft.securityDeposit || 0)),
      actualEndDate: normalizedActualEndDate,
      rentalType: normalizeLeaseDurationType(leaseDraft),
      agreementType,
      billingCadence,
      billingIntervalDays: leaseBillingIntervalDays(leaseDraft),
      firstRentDueDate: String(leaseDraft.firstRentDueDate || leaseDraft.startDate).slice(0, 10),
      prorationMethod: leaseDraft.prorationMethod === "none" ? "none" : "thirty_day",
      utilitiesIncluded: Boolean(leaseDraft.utilitiesIncluded),
      monthToMonthAfterTerm: agreementType !== "fixed_term",
      extensionTermMonths: Number(leaseDraft.extensionTermMonths || 0),
      rentDueDay: Math.max(
        1,
        Math.min(28, Math.round(Number(leaseDraft.rentDueDay || appSettings.leaseDefaultRentDueDay || 1))),
      ),
      reminderDaysBefore: Math.max(
        0,
        Math.min(14, Math.round(Number(leaseDraft.reminderDaysBefore ?? appSettings.leaseReminderDaysBefore ?? 3))),
      ),
      lateFeeGraceDays: Math.max(
        0,
        Math.min(30, Math.round(Number(leaseDraft.lateFeeGraceDays ?? appSettings.leaseLateFeeGraceDays ?? 5))),
      ),
      lateFeeType: leaseDraft.lateFeeType === "percent" ? "percent" : "flat",
      lateFeeValue: Math.max(0, Number(leaseDraft.lateFeeValue ?? appSettings.leaseLateFeeValue ?? 0)),
      autoLateFeeEnabled: leaseDraft.autoLateFeeEnabled === true,
    };
    const savedLease = {
      ...leaseWithTerms,
      monthlyRent: leaseMonthlyEquivalent(leaseWithTerms),
    };
    actions.updateLease(savedLease);
    const leaseStart = savedLease.startDate;
    const leaseEnd =
      savedLease.actualEndDate ||
      (normalizeLeaseAgreementType(savedLease) !== "fixed_term" ? FAR_FUTURE_DATE : savedLease.endDate);
    getUnitOccupancyPeriods(savedLease.propertyId, savedLease.unit).forEach((period) => {
      const periodEnd = period.endDate || FAR_FUTURE_DATE;
      if (!rangesOverlap(period.startDate, periodEnd, leaseStart, leaseEnd)) return;

      const keepLeft = period.startDate < leaseStart;
      const keepRight = leaseEnd !== FAR_FUTURE_DATE && periodEnd > leaseEnd;

      if (keepLeft && keepRight) {
        actions.upsertUsePeriod({
          id: period.id,
          propertyId: period.propertyId,
          unit: period.unit,
          startDate: period.startDate,
          endDate: previousDayIso(leaseStart),
          useType: period.useType,
          reviewed: period.reviewed,
          reviewedAt: period.reviewedAt,
          reviewNotes: period.reviewNotes,
        });
        actions.upsertUsePeriod({
          propertyId: period.propertyId,
          unit: period.unit,
          startDate: nextDayIso(leaseEnd),
          endDate: period.endDate || "",
          useType: period.useType,
          reviewed: period.reviewed,
          reviewedAt: period.reviewedAt,
          reviewNotes: period.reviewNotes,
        });
        return;
      }

      if (keepLeft) {
        actions.upsertUsePeriod({
          id: period.id,
          propertyId: period.propertyId,
          unit: period.unit,
          startDate: period.startDate,
          endDate: previousDayIso(leaseStart),
          useType: period.useType,
          reviewed: period.reviewed,
          reviewedAt: period.reviewedAt,
          reviewNotes: period.reviewNotes,
        });
        return;
      }

      if (keepRight) {
        actions.upsertUsePeriod({
          id: period.id,
          propertyId: period.propertyId,
          unit: period.unit,
          startDate: nextDayIso(leaseEnd),
          endDate: period.endDate || "",
          useType: period.useType,
          reviewed: period.reviewed,
          reviewedAt: period.reviewedAt,
          reviewNotes: period.reviewNotes,
        });
        return;
      }

      actions.deleteUsePeriod(period.id);
    });

    setNotice(`Lease updated for ${savedLease.tenantName || savedLease.unit}.`);
    closeLeaseEditor();
  };

  const attachLeasePdfFile = async (file) => {
    if (!leaseDraft || !file) return;
    if (file.type && file.type !== "application/pdf") {
      setNotice("Only PDF files are supported.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      actions.addDocument({
        id: `d${Date.now()}`,
        propertyId: leaseDraft.propertyId,
        unit: leaseDraft.unit,
        leaseId: leaseDraft.id,
        name: file.name,
        type: "Lease",
        mimeType: file.type || "application/pdf",
        uploadedAt: new Date().toISOString(),
        dataUrl,
        tags: inferDocumentTags({
          document: { name: file.name, type: "Lease", tags: [] },
          lease: leaseDraft,
        }),
      });
      setNotice(`Attached ${file.name} to lease for ${leaseDraft.tenantName}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not attach PDF.");
    }
  };

  const onLeasePdfInputChange = async (event) => {
    const file = event.target.files?.[0];
    await attachLeasePdfFile(file);
    event.target.value = "";
  };

  const openLeasePdfPicker = () => {
    leasePdfInputRef.current?.click();
  };

  return {
    clearTenantLedgerEntryDraft,
    closeLeaseEditor,
    confirmAndDeleteLease,
    confirmAndDeleteTenantLedgerEntry,
    confirmAndDeleteUsePeriod,
    displayedLeaseTenantLedgerRows,
    editingTenantLedgerEntryId,
    editingUsePeriodId,
    leaseDraft,
    leaseEditorMode,
    leaseTenantLedgerHeadline,
    leaseTenantLedgerRowById,
    leaseTenantLedgerSort,
    leaseTenantLedgerSummary,
    leaseValidationDialog,
    openLease,
    openLeaseForUnit,
    onLeasePdfInputChange,
    openNewLeaseForUnit,
    openLinkedTenantLedgerTransaction,
    openOccupancyEditor,
    openLeasePdfPicker,
    saveTenantLedgerEntry,
    saveLease,
    saveUnitOccupancyPeriod,
    selectedLeaseAutomationReminders,
    selectedLeaseDocuments,
    setEditingUsePeriodId,
    setLeaseDraft,
    setLeaseEditorMode,
    setLeaseTenantLedgerSort,
    setLeaseValidationDialog,
    setTenantLedgerDraft,
    setUsePeriodDraft,
    startTenantLedgerEntryEdit,
    tenantLedgerDraft,
    usePeriodDraft,
  };
}
