import { useMemo, useState } from "react";

export function useWorkspaceFilterController({ appSettings }) {
  const [search, setSearch] = useState("");
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState("all");
  const [ledgerSort, setLedgerSort] = useState(() => appSettings.ledgerDefaultSort || "date_desc");
  const [ledgerReconciliationFilter, setLedgerReconciliationFilter] = useState("all");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityActionFilter, setActivityActionFilter] = useState("all");
  const [activityEntityFilter, setActivityEntityFilter] = useState("all");
  const [activityRoleFilter, setActivityRoleFilter] = useState("all");
  const [activityCategoryFilter, setActivityCategoryFilter] = useState("all");
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentSort, setDocumentSort] = useState("uploaded_desc");
  const [documentStatusFilter, setDocumentStatusFilter] = useState("all");
  const [expenseQueueShowDismissed, setExpenseQueueShowDismissed] = useState(false);

  const ledgerFilters = useMemo(() => ({
    ledgerCategoryFilter,
    ledgerReconciliationFilter,
    ledgerSort,
    search,
    setLedgerCategoryFilter,
    setLedgerReconciliationFilter,
    setLedgerSort,
    setSearch,
  }), [ledgerCategoryFilter, ledgerReconciliationFilter, ledgerSort, search]);

  const activityFilters = useMemo(() => ({
    activityActionFilter,
    activityCategoryFilter,
    activityEntityFilter,
    activityRoleFilter,
    activitySearch,
    setActivityActionFilter,
    setActivityCategoryFilter,
    setActivityEntityFilter,
    setActivityRoleFilter,
    setActivitySearch,
  }), [activityActionFilter, activityCategoryFilter, activityEntityFilter, activityRoleFilter, activitySearch]);

  const documentFilters = useMemo(() => ({
    documentSearch,
    documentSort,
    documentStatusFilter,
    expenseQueueShowDismissed,
    setDocumentSearch,
    setDocumentSort,
    setDocumentStatusFilter,
    setExpenseQueueShowDismissed,
  }), [documentSearch, documentSort, documentStatusFilter, expenseQueueShowDismissed]);

  return {
    activityFilters,
    documentFilters,
    ledgerFilters,
    activityActionFilter,
    activityCategoryFilter,
    activityEntityFilter,
    activityRoleFilter,
    activitySearch,
    documentSearch,
    documentSort,
    documentStatusFilter,
    expenseQueueShowDismissed,
    ledgerCategoryFilter,
    ledgerReconciliationFilter,
    ledgerSort,
    search,
    setActivityActionFilter,
    setActivityCategoryFilter,
    setActivityEntityFilter,
    setActivityRoleFilter,
    setActivitySearch,
    setDocumentSearch,
    setDocumentSort,
    setDocumentStatusFilter,
    setExpenseQueueShowDismissed,
    setLedgerCategoryFilter,
    setLedgerReconciliationFilter,
    setLedgerSort,
    setSearch,
  };
}
