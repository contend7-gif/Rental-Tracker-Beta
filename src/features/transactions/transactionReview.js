const IMPROVEMENT_PATTERN = /\b(improvement|renovat|remodel|replace|replacement|roof|hvac|furnace|water heater|flooring|cabinet|addition|upgrade|capital)\b/i;
const SERVICE_PERIOD_CATEGORIES = new Set(["Utilities", "Insurance"]);
const UNCLEAR_CATEGORIES = new Set(["Other expenses", "Other income", "Uncategorized", "Other"]);

const ISSUE_HELP = {
  missing_receipt: "Tax-relevant expenses should have a receipt name or attached document before year-end review.",
  unclear_category: "Generic or missing categories make Schedule E grouping less reliable.",
  missing_service_period: "Shared utility and insurance expenses usually need a service period for owner-use proration.",
  possible_improvement: "This wording may describe a capital improvement rather than an ordinary repair.",
  owner_use_override: "Manual owner-use overrides should be intentional because they bypass occupancy-based suggestions.",
  de_minimis_review: "This transaction appears eligible for de minimis treatment but has not been tax-reviewed.",
  capital_improvement_needs_asset: "This capital-improvement transaction needs a linked asset before depreciation review.",
  unreconciled_import: "Imported bank rows should be matched before accounting cleanup is complete.",
  tax_open: "This transaction still needs final tax sign-off.",
};

function issue(key, label, field) {
  return { key, label, field, help: ISSUE_HELP[key] || "" };
}

function transactionText(transaction) {
  return [
    transaction?.category,
    transaction?.description,
    transaction?.vendor,
    transaction?.notes,
  ].filter(Boolean).join(" ");
}

function hasTransactionDocument(transaction, documents = []) {
  return documents.some(
    (document) =>
      document.transactionId === transaction?.id ||
      (Array.isArray(document.relatedTransactionIds) && document.relatedTransactionIds.includes(transaction?.id)),
  );
}

function transactionHasLinkedAsset(transaction, assets = []) {
  return assets.some((asset) =>
    asset.sourceTransactionId === transaction?.id ||
    (Array.isArray(asset.sourceTransactionIds) && asset.sourceTransactionIds.includes(transaction?.id))
  );
}

export function getTransactionReviewIssues(transaction, context = {}) {
  if (!transaction || transaction.status === "void") return [];
  const documents = context.documents || [];
  const isTaxRelevant = context.isTaxReviewRelevantTransaction?.(transaction) ?? transaction.type === "Expense";
  const issues = [];

  if (
    isTaxRelevant &&
    transaction.type === "Expense" &&
    transaction.reviewOverrides?.missing_receipt !== "not_available" &&
    !transaction.receiptName &&
    !hasTransactionDocument(transaction, documents)
  ) {
    issues.push(issue("missing_receipt", "Missing receipt/document", "receiptName"));
  }

  if (!String(transaction.category || "").trim() || UNCLEAR_CATEGORIES.has(transaction.category)) {
    issues.push(issue("unclear_category", "Review category", "category"));
  }

  if (
    transaction.type === "Expense" &&
    transaction.unit === "Shared" &&
    SERVICE_PERIOD_CATEGORIES.has(transaction.category) &&
    (!transaction.servicePeriodStart || !transaction.servicePeriodEnd)
  ) {
    issues.push(issue("missing_service_period", "Shared expense missing service period", "servicePeriodStart"));
  }

  const possibleImprovementOverride = transaction.reviewOverrides?.possible_improvement;
  if (
    transaction.type === "Expense" &&
    !transaction.capitalImprovement &&
    possibleImprovementOverride !== "repair_confirmed" &&
    possibleImprovementOverride !== "ignore" &&
    IMPROVEMENT_PATTERN.test(transactionText(transaction))
  ) {
    issues.push(issue("possible_improvement", "Repair vs improvement review", "capitalImprovement"));
  }

  if (transaction.type === "Expense" && transaction.capitalImprovement && !transactionHasLinkedAsset(transaction, context.assets || [])) {
    issues.push(issue("capital_improvement_needs_asset", "capitalImprovement"));
  }

  if (transaction.ownerUsePctOverride) {
    issues.push(issue("owner_use_override", "Owner-use override changed", "ownerUsePct"));
  }

  if (transaction.deMinimisCandidate && !transaction.deMinimisApplied && !transaction.taxChecked && transaction.reviewOverrides?.de_minimis_review !== "reviewed") {
    issues.push(issue("de_minimis_review", "De minimis eligible, not reviewed", "deMinimisTreatment"));
  }

  if (transaction.bankImportId && !transaction.reconciled) {
    issues.push(issue("unreconciled_import", "Needs bank match", "reconciled"));
  }

  if (isTaxRelevant && !transaction.taxChecked) {
    issues.push(issue("tax_open", "Review open", "taxChecked"));
  }

  return issues;
}

export function getTransactionTaxReadiness(transaction, context = {}) {
  const issues = getTransactionReviewIssues(transaction, context);
  if (issues.length > 0) return { key: "needs_review", label: "Needs review", issues };
  const isTaxRelevant = context.isTaxReviewRelevantTransaction?.(transaction) ?? transaction?.type === "Expense";
  if (!isTaxRelevant) return { key: "not_tax_relevant", label: "Not tax relevant", issues };
  return { key: "ready", label: "Ready for Tax Center", issues };
}

export function buildTransactionReviewInbox(transactions = [], context = {}) {
  return transactions
    .map((transaction) => ({
      transaction,
      readiness: getTransactionTaxReadiness(transaction, context),
      issues: getTransactionReviewIssues(transaction, context),
    }))
    .filter((record) => record.issues.length > 0)
    .sort((left, right) => {
      const issueDelta = right.issues.length - left.issues.length;
      if (issueDelta !== 0) return issueDelta;
      return String(right.transaction.date || "").localeCompare(String(left.transaction.date || ""));
    });
}
