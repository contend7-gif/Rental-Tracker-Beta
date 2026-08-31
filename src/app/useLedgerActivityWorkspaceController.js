import { useCallback, useMemo } from "react";
import { getScheduleELineIdForTransaction, scheduleELines } from "./accountingShared.js";
import {
  buildTransactionReviewInbox,
  getTransactionReviewIssues,
  getTransactionTaxReadiness,
} from "../features/transactions/transactionReview.js";
import { matchesLedgerTransactionSearch } from "./ledgerSearch.ts";

export function useLedgerActivityWorkspaceController({
  activityActionFilter,
  activityCategoryFilter,
  activityEntityFilter,
  activityLog,
  activityRoleFilter,
  activitySearch,
  activeTx,
  assets,
  documents,
  isTaxReviewRelevantTransaction,
  ledgerCategoryFilter,
  ledgerReconciliationFilter,
  ledgerSort,
  propertyFilter,
  search,
  unitFilter,
  yearFilter,
}) {
  const filteredTransactions = useMemo(
    () =>
      activeTx.filter(
        (t) =>
          t.date.startsWith(yearFilter) &&
          (propertyFilter === "all" || t.propertyId === propertyFilter) &&
          (unitFilter === "all" || t.unit === unitFilter) &&
          matchesLedgerTransactionSearch(t, search),
      ),
    [activeTx, yearFilter, propertyFilter, unitFilter, search],
  );

  const ledgerCategories = useMemo(() => [{ id: "all", label: "All Schedule E lines" }, ...scheduleELines], []);

  const ledgerTransactions = useMemo(() => {
    const byCategory =
      ledgerCategoryFilter === "all"
        ? filteredTransactions
        : filteredTransactions.filter((t) => getScheduleELineIdForTransaction(t) === ledgerCategoryFilter);

    const byReconciliation =
      ledgerReconciliationFilter === "all"
        ? byCategory
        : byCategory.filter((t) =>
          ledgerReconciliationFilter === "reconciled"
            ? Boolean(t.reconciled)
            : Boolean(t.bankImportId) && !t.reconciled
        );

    const sorted = [...byReconciliation];
    if (ledgerSort === "date_asc") sorted.sort((a, b) => a.date.localeCompare(b.date));
    if (ledgerSort === "date_desc") sorted.sort((a, b) => b.date.localeCompare(a.date));
    if (ledgerSort === "amount_desc") sorted.sort((a, b) => b.amount - a.amount);
    if (ledgerSort === "amount_asc") sorted.sort((a, b) => a.amount - b.amount);
    if (ledgerSort === "category_asc") sorted.sort((a, b) => a.category.localeCompare(b.category));
    return sorted;
  }, [filteredTransactions, ledgerCategoryFilter, ledgerReconciliationFilter, ledgerSort]);

  const transactionReviewContext = useMemo(
    () => ({
      documents,
      assets,
      isTaxReviewRelevantTransaction,
    }),
    [documents, assets, isTaxReviewRelevantTransaction],
  );

  const transactionReviewInbox = useMemo(
    () => buildTransactionReviewInbox(filteredTransactions, transactionReviewContext),
    [filteredTransactions, transactionReviewContext],
  );

  const transactionReviewById = useMemo(
    () => Object.fromEntries(filteredTransactions.map((transaction) => [
      transaction.id,
      {
        issues: getTransactionReviewIssues(transaction, transactionReviewContext),
        readiness: getTransactionTaxReadiness(transaction, transactionReviewContext),
      },
    ])),
    [filteredTransactions, transactionReviewContext],
  );

  const getTransactionReview = useCallback(
    (transaction) => {
      if (!transaction) return null;
      return {
        issues: getTransactionReviewIssues(transaction, transactionReviewContext),
        readiness: getTransactionTaxReadiness(transaction, transactionReviewContext),
      };
    },
    [transactionReviewContext],
  );

  const activityActionOptions = useMemo(
    () => Array.from(new Set(activityLog.map((entry) => String(entry.action || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [activityLog],
  );

  const activityEntityOptions = useMemo(
    () => Array.from(new Set(activityLog.map((entry) => String(entry.entityType || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [activityLog],
  );

  const activityRoleOptions = useMemo(
    () => Array.from(new Set(activityLog.map((entry) => String(entry.actorRole || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [activityLog],
  );

  const activityCategoryOptions = useMemo(
    () => Array.from(new Set(activityLog.map((entry) => String(entry.category || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [activityLog],
  );

  const filteredActivityLog = useMemo(() => {
    const term = activitySearch.trim().toLowerCase();
    return activityLog.filter((entry) => {
      const at = String(entry.at || "");
      if (yearFilter && !at.startsWith(String(yearFilter))) return false;
      if (propertyFilter !== "all" && String(entry.propertyId || "") !== propertyFilter) return false;
      if (unitFilter !== "all" && String(entry.unit || "") !== unitFilter) return false;
      if (activityActionFilter !== "all" && String(entry.action || "") !== activityActionFilter) return false;
      if (activityEntityFilter !== "all" && String(entry.entityType || "") !== activityEntityFilter) return false;
      if (activityRoleFilter !== "all" && String(entry.actorRole || "") !== activityRoleFilter) return false;
      if (activityCategoryFilter !== "all" && String(entry.category || "") !== activityCategoryFilter) return false;
      if (!term) return true;
      const haystack = [entry.summary, entry.details, entry.entityType, entry.entityId, entry.actor, entry.actorRole, entry.category].join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [activityLog, activityActionFilter, activityCategoryFilter, activityEntityFilter, activityRoleFilter, activitySearch, propertyFilter, unitFilter, yearFilter]);

  return {
    activityActionOptions,
    activityCategoryOptions,
    activityEntityOptions,
    activityRoleOptions,
    filteredActivityLog,
    filteredTransactions,
    ledgerCategories,
    ledgerTransactions,
    getTransactionReview,
    transactionReviewById,
    transactionReviewContext,
    transactionReviewInbox,
  };
}
