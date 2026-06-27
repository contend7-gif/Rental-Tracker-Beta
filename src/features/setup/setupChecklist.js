const SETUP_ITEMS = [
  {
    key: "property",
    label: "Add property",
    targetView: "properties",
    explanation: "Create the rental property record that all accounting, lease, and document records attach to.",
  },
  {
    key: "units",
    label: "Add units",
    targetView: "properties",
    explanation: "Add each rentable, owner-occupied, or shared unit so occupancy and allocation checks have a home.",
  },
  {
    key: "occupancy",
    label: "Set occupancy periods",
    targetView: "leaseHistory",
    explanation: "Record rental, owner-occupied, and vacancy periods before relying on owner-use allocation.",
  },
  {
    key: "lease",
    label: "Add lease or tenant arrangement",
    targetView: "leaseHistory",
    explanation: "Enter lease dates, rent, and deposits for each tenant arrangement.",
  },
  {
    key: "loan",
    label: "Add loan or mortgage",
    targetView: "loans",
    explanation: "Add mortgage details when the property has debt; otherwise keep this as optional.",
    optionalWhenIncomplete: true,
  },
  {
    key: "assets",
    label: "Add opening asset/basis information",
    targetView: "assets",
    explanation: "Enter building basis and improvements so depreciation review can work.",
  },
  {
    key: "recurring",
    label: "Add recurring bills",
    targetView: "ledger",
    explanation: "Set up recurring utilities, insurance, taxes, or loan-related transactions when useful.",
    optionalWhenIncomplete: true,
  },
  {
    key: "tenantLedger",
    label: "Add starting tenant ledger entries",
    targetView: "leaseHistory",
    explanation: "Record security deposits, opening balances, rent charges, and payments when applicable.",
  },
  {
    key: "document",
    label: "Upload first receipt/document",
    targetView: "documents",
    explanation: "Attach at least one support document so document linking and review queues are exercised.",
  },
  {
    key: "readiness",
    label: "Run readiness check",
    targetView: "tax",
    explanation: "Review Dashboard Tax Readiness or Tax Center before year-end reporting.",
  },
  {
    key: "backup",
    label: "Create first backup",
    targetView: "settings",
    explanation: "Create or export a backup before entering a large real-world dataset.",
  },
];

function selectedPropertyIds(properties = [], propertyFilter = "all") {
  if (propertyFilter && propertyFilter !== "all") return new Set([propertyFilter]);
  return new Set(properties.filter((property) => !property.archivedAt).map((property) => property.id));
}

function inSelectedProperty(item, propertyIds) {
  return !item?.propertyId || propertyIds.has(item.propertyId);
}

function completeItem(item, complete) {
  const optional = item.optionalWhenIncomplete && !complete;
  return {
    ...item,
    status: complete ? "complete" : optional ? "optional" : "needs_setup",
    statusLabel: complete ? "Complete" : optional ? "Optional" : "Needs setup",
  };
}

function statusLabel(status) {
  if (status === "complete") return "Complete";
  if (status === "optional") return "Optional";
  if (status === "not_applicable") return "Not applicable";
  if (status === "dismissed") return "Dismissed";
  if (status === "needs_review") return "Needs review";
  return "Needs setup";
}

function applyOverride(item, overrides = {}) {
  const override = overrides?.[item.key];
  if (!override || typeof override !== "object") return item;
  if (override.status !== "not_applicable" && override.status !== "dismissed") return item;
  return {
    ...item,
    status: override.status,
    statusLabel: statusLabel(override.status),
    overrideNote: String(override.note || "").trim(),
    overrideUpdatedAt: String(override.updatedAt || "").trim(),
  };
}

export function shouldShowFullSetupChecklist(checklist, settings = {}) {
  if (!checklist || checklist.status !== "complete") return true;
  return settings?.setupChecklistShowCompleted === true;
}

export function buildSetupChecklist({
  properties = [],
  units = [],
  leases = [],
  usePeriods = [],
  loans = [],
  assets = [],
  transactions = [],
  documents = [],
  tenantLedgerEntries = [],
  desktopHealth = {},
  propertyFilter = "all",
  taxReadinessSummary = null,
  overrides = {},
  showDismissed = false,
} = {}) {
  const propertyIds = selectedPropertyIds(properties, propertyFilter);
  const selectedProperties = properties.filter((property) => propertyIds.has(property.id));
  const selectedUnits = units.filter((unit) => propertyIds.has(unit.propertyId));
  const selectedLeases = leases.filter((lease) => inSelectedProperty(lease, propertyIds));
  const selectedPeriods = usePeriods.filter((period) => inSelectedProperty(period, propertyIds));
  const selectedLoans = loans.filter((loan) => inSelectedProperty(loan, propertyIds));
  const selectedAssets = assets.filter((asset) => inSelectedProperty(asset, propertyIds));
  const selectedTransactions = transactions.filter((transaction) => inSelectedProperty(transaction, propertyIds));
  const selectedDocuments = documents.filter((document) => inSelectedProperty(document, propertyIds));
  const selectedLeaseIds = new Set(selectedLeases.map((lease) => lease.id));
  const selectedLedgerEntries = tenantLedgerEntries.filter((entry) => selectedLeaseIds.has(entry.leaseId));

  const readinessStatus = taxReadinessSummary?.status || "";
  const readinessComplete = readinessStatus === "ready";
  const readinessNeedsReview = readinessStatus === "needs_review";

  const completions = {
    property: selectedProperties.length > 0,
    units: selectedUnits.length > 0,
    occupancy: selectedPeriods.length > 0,
    lease: selectedLeases.length > 0,
    loan: selectedLoans.length > 0,
    assets: selectedAssets.length > 0,
    recurring: selectedTransactions.some((transaction) => transaction.recurringTemplateId) || selectedTransactions.length >= 3,
    tenantLedger: selectedLedgerEntries.length > 0,
    document: selectedDocuments.length > 0,
    readiness: readinessComplete,
    backup: Boolean(desktopHealth?.lastBackupAt || desktopHealth?.backupCount > 0),
  };

  const items = SETUP_ITEMS
    .map((item) => {
      if (item.key === "readiness") {
        const base = selectedProperties.length === 0
          ? completeItem(item, false)
          : {
              ...item,
              status: readinessNeedsReview ? "needs_review" : readinessComplete ? "complete" : "needs_setup",
              statusLabel: statusLabel(readinessNeedsReview ? "needs_review" : readinessComplete ? "complete" : "needs_setup"),
            };
        return applyOverride(base, overrides);
      }
      return applyOverride(completeItem(item, completions[item.key]), overrides);
    })
    .filter((item) => showDismissed || item.status !== "dismissed");
  const completeCount = items.filter((item) => item.status === "complete").length;
  const needsSetupCount = items.filter((item) => item.status === "needs_setup").length;
  const needsReviewCount = items.filter((item) => item.status === "needs_review").length;
  const optionalCount = items.filter((item) => item.status === "optional").length;
  const notApplicableCount = items.filter((item) => item.status === "not_applicable").length;
  const dismissedCount = SETUP_ITEMS.filter((item) => overrides?.[item.key]?.status === "dismissed").length;
  const blockingCount = needsSetupCount + needsReviewCount;

  return {
    items,
    completeCount,
    needsReviewCount,
    needsSetupCount,
    optionalCount,
    notApplicableCount,
    dismissedCount,
    status: blockingCount > 0 ? "needs_setup" : "complete",
    label: blockingCount > 0 ? "Setup in progress" : "Core setup complete",
  };
}
