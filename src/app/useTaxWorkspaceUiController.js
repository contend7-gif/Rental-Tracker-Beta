import { useMemo, useState } from "react";
import { isRecord } from "../lib/appSupport.ts";
import { DEFAULT_DASHBOARD_YEAR } from "./appStorageKeys.js";

function normalizeEscrowDisbursementsFromBackup(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => isRecord(entry))
    .map((entry) => ({
      id: String(entry.id || `escrow-${Date.now()}`),
      loanId: String(entry.loanId || ""),
      propertyId: String(entry.propertyId || ""),
      date: String(entry.date || ""),
      category: entry.category === "Insurance" ? "Insurance" : "Taxes",
      amount: Number(entry.amount || 0),
      description: String(entry.description || ""),
      vendor: String(entry.vendor || ""),
      coverageStart: String(entry.coverageStart || ""),
      coverageEnd: String(entry.coverageEnd || ""),
      linkedTransactionId: String(entry.linkedTransactionId || ""),
      notes: String(entry.notes || ""),
    }));
}

export function useTaxWorkspaceUiController() {
  const [taxReviewMode, setTaxReviewMode] = useState("flagged");
  const [taxReviewCollapsed, setTaxReviewCollapsed] = useState({});
  const [taxPrintDialogOpen, setTaxPrintDialogOpen] = useState(false);
  const [taxPrintScope, setTaxPrintScope] = useState("current");
  const [taxPrintProperty, setTaxPrintProperty] = useState("all");
  const [taxPrintUnit, setTaxPrintUnit] = useState("all");
  const [ownerStatementPreset, setOwnerStatementPreset] = useState("annual");
  const [ownerStatementCustomStart, setOwnerStatementCustomStart] = useState(() => `${DEFAULT_DASHBOARD_YEAR}-01-01`);
  const [ownerStatementCustomEnd, setOwnerStatementCustomEnd] = useState(() => `${DEFAULT_DASHBOARD_YEAR}-12-31`);
  const [taxDayOverrides, setTaxDayOverrides] = useState({});
  const [taxCarryoverByScope, setTaxCarryoverByScope] = useState({});
  const [taxFiledAmountOverrides, setTaxFiledAmountOverrides] = useState({});
  const [escrowDisbursements, setEscrowDisbursements] = useState([]);
  const [ownerStatementNoteDraft, setOwnerStatementNoteDraft] = useState("");
  const [ownerStatementNoteMode, setOwnerStatementNoteMode] = useState("default");
  const [ownerStatementNoteTemplate, setOwnerStatementNoteTemplate] = useState("monthly");
  const [ownerCommunicationCollapsed, setOwnerCommunicationCollapsed] = useState(true);
  const [taxReviewNotesCollapsed, setTaxReviewNotesCollapsed] = useState(true);

  const restoreTaxWorkspaceFromBackupData = (rawData) => {
    const data = isRecord(rawData) ? rawData : {};
    setTaxDayOverrides(isRecord(data.taxDayOverrides) ? data.taxDayOverrides : {});
    setTaxCarryoverByScope(isRecord(data.taxCarryoverByScope) ? data.taxCarryoverByScope : {});
    setTaxFiledAmountOverrides(isRecord(data.taxFiledAmountOverrides) ? data.taxFiledAmountOverrides : {});
    setEscrowDisbursements(normalizeEscrowDisbursementsFromBackup(data.escrowDisbursements));
  };

  const taxWorkspaceUiProps = useMemo(() => ({
    ownerCommunicationCollapsed,
    ownerStatementCustomEnd,
    ownerStatementCustomStart,
    ownerStatementNoteDraft,
    ownerStatementNoteTemplate,
    ownerStatementPreset,
    setOwnerCommunicationCollapsed,
    setOwnerStatementCustomEnd,
    setOwnerStatementCustomStart,
    setOwnerStatementNoteDraft,
    setOwnerStatementNoteMode,
    setOwnerStatementNoteTemplate,
    setOwnerStatementPreset,
    setTaxPrintDialogOpen,
    setTaxPrintProperty,
    setTaxPrintScope,
    setTaxPrintUnit,
    setTaxReviewCollapsed,
    setTaxReviewMode,
    setTaxReviewNotesCollapsed,
    taxReviewCollapsed,
    taxReviewMode,
    taxReviewNotesCollapsed,
  }), [
    ownerCommunicationCollapsed,
    ownerStatementCustomEnd,
    ownerStatementCustomStart,
    ownerStatementNoteDraft,
    ownerStatementNoteTemplate,
    ownerStatementPreset,
    taxReviewCollapsed,
    taxReviewMode,
    taxReviewNotesCollapsed,
  ]);

  const taxPrintDialogStateProps = useMemo(() => ({
    setTaxPrintDialogOpen,
    setTaxPrintProperty,
    setTaxPrintScope,
    setTaxPrintUnit,
    taxPrintProperty,
    taxPrintScope,
    taxPrintUnit,
  }), [taxPrintProperty, taxPrintScope, taxPrintUnit]);

  return {
    escrowDisbursements,
    ownerCommunicationCollapsed,
    ownerStatementCustomEnd,
    ownerStatementCustomStart,
    ownerStatementNoteDraft,
    ownerStatementNoteMode,
    ownerStatementNoteTemplate,
    ownerStatementPreset,
    restoreTaxWorkspaceFromBackupData,
    setEscrowDisbursements,
    setOwnerCommunicationCollapsed,
    setOwnerStatementCustomEnd,
    setOwnerStatementCustomStart,
    setOwnerStatementNoteDraft,
    setOwnerStatementNoteMode,
    setOwnerStatementNoteTemplate,
    setOwnerStatementPreset,
    setTaxCarryoverByScope,
    setTaxDayOverrides,
    setTaxFiledAmountOverrides,
    setTaxPrintDialogOpen,
    setTaxPrintProperty,
    setTaxPrintScope,
    setTaxPrintUnit,
    setTaxReviewCollapsed,
    setTaxReviewMode,
    setTaxReviewNotesCollapsed,
    taxCarryoverByScope,
    taxDayOverrides,
    taxFiledAmountOverrides,
    taxPrintDialogStateProps,
    taxPrintDialogOpen,
    taxPrintProperty,
    taxPrintScope,
    taxPrintUnit,
    taxReviewCollapsed,
    taxReviewMode,
    taxReviewNotesCollapsed,
    taxWorkspaceUiProps,
  };
}
