import { useEffect, useMemo, useRef, useState } from "react";
import {
  bankImportIdFromExternalId,
  findExistingImportedBankRows,
  matchBankRowsToTransactions,
  parseBankStatement,
  suggestBankTransactionTypeAndCategory,
} from "../domain/bankImport.ts";
import { BANK_IMPORT_MATCH_RULE_OPTIONS } from "./bankImportShared.js";
import { buildTransactionVendorMemory, findTransactionVendorMemoryForDescription } from "../features/transactions/transactionVendorMemory.js";
import { buildBankReconciliationSummary, createBankReconciliationRecord, inferBankStatementPeriod } from "../domain/bankReconciliation.ts";

const BANK_IMPORT_TYPE_OPTIONS = ["Income", "Expense", "Transfer", "Owner Contribution", "Owner Draw"];

function buildValidBankImportUnits(propertyId, units) {
  if (!propertyId) return ["Shared"];
  const names = ["Shared", ...units.filter((unit) => unit.propertyId === propertyId).map((unit) => unit.name)];
  return Array.from(new Set(names));
}

export function useBankImportController({
  actions,
  activeTx,
  addAuditEntry,
  categories,
  isTaxReviewRelevantTransaction,
  properties,
  propertyFilter,
  requirePermission,
  setNotice,
  setView,
  transactionById,
  transactions,
  units,
  appSettings,
  setSetting,
}) {
  const bankImportInputRef = useRef(null);
  const [bankImportFileName, setBankImportFileName] = useState("");
  const [bankImportRows, setBankImportRows] = useState([]);
  const [bankImportMatches, setBankImportMatches] = useState({});
  const [bankImportSkippedRows, setBankImportSkippedRows] = useState(0);
  const [bankImportDefaults, setBankImportDefaults] = useState({
    propertyId: "",
    unit: "Shared",
    paidFrom: "Duplex bank",
    paymentMethod: "ACH",
  });
  const [bankImportReviewOpen, setBankImportReviewOpen] = useState(false);
  const [bankImportReviewDrafts, setBankImportReviewDrafts] = useState({});
  const [bankImportMatchRule, setBankImportMatchRule] = useState("standard");
  const [bankReconciliationDraft, setBankReconciliationDraft] = useState({
    periodStart: "",
    periodEnd: "",
    openingBalance: "",
    closingBalance: "",
  });

  const bankImportUnitOptions = useMemo(
    () => buildValidBankImportUnits(bankImportDefaults.propertyId, units),
    [bankImportDefaults.propertyId, units],
  );
  const bankImportMatchedRows = useMemo(
    () => bankImportRows.filter((row) => !row.importedTransactionId && Boolean(bankImportMatches[row.id])),
    [bankImportRows, bankImportMatches],
  );
  const bankImportMatchCount = useMemo(
    () => bankImportMatchedRows.length,
    [bankImportMatchedRows],
  );
  const bankImportImportedCount = useMemo(
    () => bankImportRows.filter((row) => Boolean(row.importedTransactionId)).length,
    [bankImportRows],
  );
  const bankImportUnmatchedRows = useMemo(
    () => bankImportRows.filter((row) => !bankImportMatches[row.id] && !row.importedTransactionId),
    [bankImportRows, bankImportMatches],
  );
  const bankImportReviewRows = useMemo(
    () => bankImportUnmatchedRows,
    [bankImportUnmatchedRows],
  );
  const bankImportVendorMemory = useMemo(
    () => buildTransactionVendorMemory(activeTx),
    [activeTx],
  );
  const getBankImportRowVendorMemory = (row) => findTransactionVendorMemoryForDescription(row?.description || "", bankImportVendorMemory);
  const bankReconciliationSummary = useMemo(() => buildBankReconciliationSummary({
    rows: bankImportRows,
    skippedRows: bankImportSkippedRows,
    ...bankReconciliationDraft,
  }), [bankImportRows, bankImportSkippedRows, bankReconciliationDraft]);
  const bankReconciliationRecords = useMemo(
    () => Object.values(appSettings.bankReconciliationRecords || {}).sort((left, right) => String(right.closedAt).localeCompare(String(left.closedAt))),
    [appSettings.bankReconciliationRecords],
  );

  useEffect(() => {
    const fallbackPropertyId = propertyFilter !== "all" ? propertyFilter : (properties[0]?.id || "");
    setBankImportDefaults((prev) => {
      const propertyExists = prev.propertyId && properties.some((property) => property.id === prev.propertyId);
      const nextPropertyId = propertyExists ? prev.propertyId : fallbackPropertyId;
      const validUnits = new Set(buildValidBankImportUnits(nextPropertyId, units));
      const nextUnit = validUnits.has(prev.unit) ? prev.unit : "Shared";
      return { ...prev, propertyId: nextPropertyId, unit: nextUnit };
    });
  }, [propertyFilter, properties, units]);

  const computeBankImportMatches = (rows, ruleId = bankImportMatchRule) => {
    const rule = BANK_IMPORT_MATCH_RULE_OPTIONS[ruleId] || BANK_IMPORT_MATCH_RULE_OPTIONS.standard;
    return matchBankRowsToTransactions(
      rows.filter((row) => !row.importedTransactionId),
      activeTx.map((txn) => ({
        id: txn.id,
        date: txn.date,
        type: txn.type,
        amount: txn.amount,
        description: txn.description,
      })),
      rule.options,
    );
  };

  const clearBankImportPreview = () => {
    setBankImportRows([]);
    setBankImportMatches({});
    setBankImportSkippedRows(0);
    setBankImportFileName("");
    setBankImportReviewDrafts({});
    setBankImportReviewOpen(false);
    setBankReconciliationDraft({ periodStart: "", periodEnd: "", openingBalance: "", closingBalance: "" });
  };

  const openBankImportPicker = () => {
    if (!requirePermission("run_imports", "This access profile cannot import bank files.")) return;
    bankImportInputRef.current?.click();
  };

  const onBankImportMatchRuleChange = (value) => {
    const nextRule = Object.prototype.hasOwnProperty.call(BANK_IMPORT_MATCH_RULE_OPTIONS, value) ? value : "standard";
    setBankImportMatchRule(nextRule);
    if (bankImportRows.length === 0) return;
    setBankImportMatches(computeBankImportMatches(bankImportRows, nextRule));
    setNotice(`Bank matching rule: ${BANK_IMPORT_MATCH_RULE_OPTIONS[nextRule].label}.`);
  };

  const onBankImportInputChange = async (event) => {
    if (!requirePermission("run_imports", "This access profile cannot import bank files.")) return;
    const file = event.target?.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseBankStatement(text, file.name || "");
      const existingImportedByRowId = findExistingImportedBankRows(parsed.rows, transactions);

      const rowsWithImportStatus = parsed.rows.map((row) => ({
        ...row,
        importedTransactionId: existingImportedByRowId[row.id] || "",
        alreadyImported: Boolean(existingImportedByRowId[row.id]),
        matchedApplied: false,
      }));
      const matches = computeBankImportMatches(rowsWithImportStatus);
      setBankImportRows(rowsWithImportStatus);
      setBankImportMatches(matches);
      setBankImportSkippedRows(parsed.skippedRows);
      setBankImportFileName(file.name || "bank-statement");
      setBankReconciliationDraft({
        ...inferBankStatementPeriod(rowsWithImportStatus),
        openingBalance: "",
        closingBalance: "",
      });

      const alreadyImportedCount = rowsWithImportStatus.filter((row) => Boolean(row.importedTransactionId)).length;
      const matchCount = rowsWithImportStatus.filter((row) => !row.importedTransactionId && Boolean(matches[row.id])).length;
      const unmatchedCount = rowsWithImportStatus.length - matchCount - alreadyImportedCount;
      const skippedNote = parsed.skippedRows > 0 ? ` (${parsed.skippedRows} skipped)` : "";
      const alreadyImportedNote = alreadyImportedCount > 0 ? `, ${alreadyImportedCount} already imported` : "";
      addAuditEntry({
        action: "import",
        entityType: "bank-import",
        entityId: file.name || "bank-statement",
        propertyId: bankImportDefaults.propertyId || undefined,
        unit: bankImportDefaults.unit || undefined,
        summary: `Loaded ${parsed.format.toUpperCase()} bank import preview.`,
        details: `${rowsWithImportStatus.length} rows | ${matchCount} matched | ${unmatchedCount} unmatched${skippedNote}${alreadyImportedNote}.`,
        category: "workflow",
      });
      setNotice(`${parsed.format.toUpperCase()} ready: ${rowsWithImportStatus.length} rows, ${matchCount} matched, ${unmatchedCount} unmatched${skippedNote}${alreadyImportedNote}.`);
    } catch {
      setNotice("Could not parse bank statement file.");
    } finally {
      if (bankImportInputRef.current) {
        bankImportInputRef.current.value = "";
      }
    }
  };

  const buildBankImportReviewDraft = (row) => {
    const suggestion = suggestBankTransactionTypeAndCategory(row.amount, row.description);
    const memory = getBankImportRowVendorMemory(row);
    const expectedType = Number(row.amount || 0) > 0 ? "Income" : "Expense";
    const memoryMatchesSign = memory?.type === expectedType;
    return {
      type: memoryMatchesSign ? memory.type : suggestion.type,
      category: memoryMatchesSign ? memory.category : suggestion.category,
      description: row.description,
      propertyId: memory?.propertyId || bankImportDefaults.propertyId,
      unit: memory?.unit || bankImportDefaults.unit || "Shared",
      paidFrom: memory?.paidFrom || bankImportDefaults.paidFrom,
      paymentMethod: memory?.paymentMethod || bankImportDefaults.paymentMethod,
      vendor: memory?.vendor || "",
      vendorMemoryKey: memory?.key || "",
    };
  };

  const applyBankImportVendorMemoryToDraft = (rowId) => {
    setBankImportReviewDrafts((prev) => {
      const row = bankImportRows.find((item) => item.id === rowId);
      const memory = row ? getBankImportRowVendorMemory(row) : null;
      if (!row || !memory) return prev;

      const expectedType = Number(row.amount || 0) > 0 ? "Income" : "Expense";
      const memoryMatchesSign = memory.type === expectedType;
      const base = prev[rowId] || buildBankImportReviewDraft(row);
      return {
        ...prev,
        [rowId]: {
          ...base,
          type: memoryMatchesSign ? memory.type : base.type,
          category: memoryMatchesSign ? memory.category : base.category,
          propertyId: memory.propertyId || base.propertyId,
          unit: memory.unit || base.unit || "Shared",
          paidFrom: memory.paidFrom || base.paidFrom,
          paymentMethod: memory.paymentMethod || base.paymentMethod,
          vendor: memory.vendor || base.vendor || "",
          vendorMemoryKey: memory.key,
        },
      };
    });
  };

  const updateBankImportReviewDraft = (rowId, patch) => {
    setBankImportReviewDrafts((prev) => {
      const row = bankImportRows.find((item) => item.id === rowId);
      if (!row) return prev;
      const base = prev[rowId] || buildBankImportReviewDraft(row);
      const next = { ...base, ...patch };

      if (patch.type) {
        const options = categories[next.type] || [];
        if (!options.includes(next.category)) {
          next.category = options[0] || (next.type === "Income" ? "Other income" : "Other expenses");
        }
      }

      if (patch.propertyId) {
        const validUnits = new Set(buildValidBankImportUnits(next.propertyId, units));
        if (!validUnits.has(next.unit)) next.unit = "Shared";
      }

      return { ...prev, [rowId]: next };
    });
  };

  const openBankImportReview = () => {
    if (!requirePermission("run_imports", "This access profile cannot review bank import drafts.")) return;
    const propertyExists = properties.some((property) => property.id === bankImportDefaults.propertyId);
    if (!propertyExists) {
      setNotice("Select a property for imported bank rows.");
      setView("properties");
      return;
    }

    const validUnits = new Set(buildValidBankImportUnits(bankImportDefaults.propertyId, units));
    if (!validUnits.has(bankImportDefaults.unit)) {
      setNotice("Select a valid unit for imported bank rows.");
      return;
    }

    if (bankImportReviewRows.length === 0) {
      setNotice("No unmatched bank rows to review.");
      return;
    }

    setBankImportReviewDrafts((prev) => {
      const next = { ...prev };
      bankImportReviewRows.forEach((row) => {
        const existing = next[row.id];
        if (!existing) {
          next[row.id] = buildBankImportReviewDraft(row);
          return;
        }

        const options = categories[existing.type] || [];
        if (!options.includes(existing.category)) {
          next[row.id] = {
            ...existing,
            category: existing.type === "Income" ? "Other income" : "Other expenses",
          };
        }
      });
      return next;
    });

    setBankImportReviewOpen(true);
  };

  const applyBankImportMatches = () => {
    if (!requirePermission("reconcile_records", "This access profile cannot reconcile bank import matches.")) return;
    const rowsToApply = bankImportRows.filter((row) => !row.importedTransactionId && Boolean(bankImportMatches[row.id]));
    if (rowsToApply.length === 0) {
      setNotice("No matched rows ready to apply.");
      return;
    }

    const appliedByRow = {};
    let linkedExternalIdCount = 0;

    rowsToApply.forEach((row) => {
      const match = bankImportMatches[row.id];
      const txn = match ? transactionById[match.transactionId] : null;
      if (!txn) return;

      const fitId = bankImportIdFromExternalId(row.externalId);
      const nextBankImportId = txn.bankImportId || fitId || undefined;
      if (fitId && !txn.bankImportId) linkedExternalIdCount += 1;

      actions.addOrUpdateTransaction({
        ...txn,
        reconciled: true,
        bankImportId: nextBankImportId,
      });
      appliedByRow[row.id] = txn.id;
    });

    const appliedCount = Object.keys(appliedByRow).length;
    if (appliedCount === 0) {
      setNotice("Matched rows were not found in the current ledger.");
      return;
    }

    const nextRows = bankImportRows.map((row) =>
      appliedByRow[row.id]
        ? { ...row, importedTransactionId: appliedByRow[row.id], alreadyImported: false, matchedApplied: true }
        : row,
    );
    setBankImportRows(nextRows);
    setBankImportMatches(computeBankImportMatches(nextRows));

    const fitIdNote = linkedExternalIdCount > 0
      ? ` Linked FITID on ${linkedExternalIdCount} transaction${linkedExternalIdCount === 1 ? "" : "s"}.`
      : "";
    addAuditEntry({
      action: "reconcile",
      entityType: "bank-import",
      entityId: bankImportFileName || "bank-import-match",
      propertyId: bankImportDefaults.propertyId || undefined,
      unit: bankImportDefaults.unit || undefined,
      summary: `Applied ${appliedCount} matched bank row${appliedCount === 1 ? "" : "s"}.`,
      details: fitIdNote ? fitIdNote.trim() : "Matched rows linked to existing transactions.",
      category: "workflow",
    });
    setNotice(`Applied ${appliedCount} matched row${appliedCount === 1 ? "" : "s"}.${fitIdNote}`);
  };

  const importReviewedBankRows = () => {
    if (!requirePermission("run_imports", "This access profile cannot post reviewed bank rows.")) return;
    const propertyExists = properties.some((property) => property.id === bankImportDefaults.propertyId);
    if (!propertyExists) {
      setNotice("Select a property for imported bank rows.");
      setView("properties");
      return;
    }

    const validUnits = new Set(buildValidBankImportUnits(bankImportDefaults.propertyId, units));
    if (!validUnits.has(bankImportDefaults.unit)) {
      setNotice("Select a valid unit for imported bank rows.");
      return;
    }

    const rowsToImport = bankImportReviewRows;
    if (rowsToImport.length === 0) {
      setNotice("No unmatched bank rows to import.");
      setBankImportReviewOpen(false);
      return;
    }

    const createdByRow = {};
    rowsToImport.forEach((row, idx) => {
      const draft = bankImportReviewDrafts[row.id] || buildBankImportReviewDraft(row);
      const txnType = categories[draft.type] ? draft.type : (draft.type === "Income" ? "Income" : "Expense");
      const categoryOptions = categories[txnType] || [];
      const category = categoryOptions.includes(draft.category)
        ? draft.category
        : (categoryOptions[0] || (txnType === "Income" ? "Other income" : "Other expenses"));
      const amount = Math.abs(Number(row.amount || 0));
      const description = String(draft.description || row.description || "").trim() || row.description;
      const draftPropertyId = properties.some((property) => property.id === draft.propertyId)
        ? draft.propertyId
        : bankImportDefaults.propertyId;
      const validDraftUnits = new Set(buildValidBankImportUnits(draftPropertyId, units));
      const draftUnit = validDraftUnits.has(draft.unit) ? draft.unit : bankImportDefaults.unit || "Shared";
      const draftPaidFrom = draft.paidFrom || bankImportDefaults.paidFrom || "Duplex bank";
      const draftPaymentMethod = draft.paymentMethod || bankImportDefaults.paymentMethod || "ACH";

      const preview = actions.computeTransactionPreview({
        amount,
        type: txnType,
        capitalImprovement: false,
        propertyId: draftPropertyId,
        unit: draftUnit,
        date: row.date,
        ownerUsePct: 0,
      });

      const reviewRelevant = isTaxReviewRelevantTransaction({
        type: txnType,
        reimbursable: false,
        reimbursed: false,
        capitalImprovement: false,
        unit: draftUnit,
        receiptName: "",
      });

      const txnId = `t-bank-${Date.now()}-${idx}`;
      actions.addOrUpdateTransaction({
        id: txnId,
        date: row.date,
        propertyId: draftPropertyId,
        unit: draftUnit,
        type: txnType,
        category,
        description,
        amount,
        ownerUsePct: 0,
        rentalUsePct: preview.rentalUsePct,
        deductibleAmount: preview.deductibleAmount,
        paidFrom: draftPaidFrom,
        paymentMethod: draftPaymentMethod,
        reimbursable: false,
        reimbursed: false,
        capitalImprovement: false,
        vendor: draft.vendor || "",
        receiptName: "",
        notes: `Imported from bank statement (${bankImportFileName || "file"}) line ${row.sourceLine}`,
        bankImportId: bankImportIdFromExternalId(row.externalId) || undefined,
        taxChecked: reviewRelevant ? false : true,
        reconciled: true,
        status: "active",
      });

      createdByRow[row.id] = txnId;
    });

    const nextRows = bankImportRows.map((row) =>
      createdByRow[row.id]
        ? { ...row, importedTransactionId: createdByRow[row.id], alreadyImported: false, matchedApplied: false }
        : row,
    );
    setBankImportRows(nextRows);
    setBankImportMatches(computeBankImportMatches(nextRows));
    setBankImportReviewOpen(false);
    addAuditEntry({
      action: "import",
      entityType: "bank-import",
      entityId: bankImportFileName || "bank-import-reviewed",
      propertyId: bankImportDefaults.propertyId || undefined,
      unit: bankImportDefaults.unit || undefined,
      summary: `Imported ${rowsToImport.length} reviewed bank row${rowsToImport.length === 1 ? "" : "s"}.`,
      details: `Posted reviewed rows as bank-matched ${bankImportDefaults.unit || "Shared"} transactions.`,
      category: "workflow",
    });
    setNotice(`Imported and bank matched ${rowsToImport.length} reviewed bank row${rowsToImport.length === 1 ? "" : "s"}.`);
  };

  const updateBankReconciliationDraft = (patch) => {
    setBankReconciliationDraft((previous) => ({ ...previous, ...patch }));
  };

  const closeBankReconciliation = () => {
    if (!requirePermission("reconcile_records", "This access profile cannot close statement reconciliations.")) return;
    if (!bankReconciliationSummary.canClose) {
      setNotice(bankReconciliationSummary.issues[0] || "Finish the statement reconciliation before closing it.");
      return;
    }
    const closedAt = new Date().toISOString();
    const id = `bank-reconciliation-${Date.now()}`;
    const record = createBankReconciliationRecord({
      id,
      fileName: bankImportFileName,
      accountLabel: bankImportDefaults.paidFrom,
      propertyId: bankImportDefaults.propertyId,
      closedAt,
      summary: bankReconciliationSummary,
    });
    setSetting("bankReconciliationRecords", {
      ...appSettings.bankReconciliationRecords,
      [id]: record,
    });
    addAuditEntry({
      action: "close",
      entityType: "bank-reconciliation",
      entityId: id,
      propertyId: bankImportDefaults.propertyId || undefined,
      unit: bankImportDefaults.unit || undefined,
      summary: `Closed ${bankImportFileName || "bank statement"}.`,
      details: `${record.periodStart} through ${record.periodEnd} | ${record.rowCount} rows | Difference $${record.difference.toFixed(2)}.`,
      category: "workflow",
    });
    setNotice("Statement reconciled and closed with a $0.00 difference.");
    clearBankImportPreview();
  };

  const reopenBankReconciliation = (id) => {
    if (!requirePermission("reconcile_records", "This access profile cannot reopen statement reconciliations.")) return;
    const record = appSettings.bankReconciliationRecords?.[id];
    if (!record) return;
    const next = { ...appSettings.bankReconciliationRecords };
    delete next[id];
    setSetting("bankReconciliationRecords", next);
    addAuditEntry({
      action: "reopen",
      entityType: "bank-reconciliation",
      entityId: id,
      propertyId: record.propertyId || undefined,
      summary: `Reopened ${record.fileName || "bank statement"} reconciliation.`,
      details: `${record.periodStart} through ${record.periodEnd}. The ledger transactions remain bank matched.`,
      category: "workflow",
    });
    setNotice("Reconciliation snapshot reopened. Existing transaction matches were not changed.");
  };

  return {
    bankImportDefaults,
    bankImportFileName,
    bankImportImportedCount,
    bankImportInputRef,
    bankImportMatchCount,
    bankImportMatchRule,
    bankImportMatchRuleOptions: BANK_IMPORT_MATCH_RULE_OPTIONS,
    bankImportMatches,
    bankImportReviewDrafts,
    bankImportReviewOpen,
    bankImportReviewRows,
    bankImportRows,
    bankImportSkippedRows,
    bankImportTypeOptions: BANK_IMPORT_TYPE_OPTIONS,
    bankImportUnitOptions,
    bankImportUnmatchedRows,
    bankReconciliationDraft,
    bankReconciliationRecords,
    bankReconciliationSummary,
    applyBankImportVendorMemoryToDraft,
    applyBankImportMatches,
    buildBankImportReviewDraft,
    clearBankImportPreview,
    closeBankReconciliation,
    importReviewedBankRows,
    onBankImportInputChange,
    onBankImportMatchRuleChange,
    openBankImportPicker,
    openBankImportReview,
    reopenBankReconciliation,
    setBankImportDefaults,
    setBankImportReviewOpen,
    getBankImportRowVendorMemory,
    updateBankImportReviewDraft,
    updateBankReconciliationDraft,
  };
}
