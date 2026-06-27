import { rentalUsePctForAssetOnDate } from "../../domain/assetDepreciation.ts";

export const IMPROVEMENT_PATTERN = /\b(improvement|renovat|remodel|replace|replacement|roof|hvac|furnace|water heater|flooring|cabinet|addition|upgrade|capital)\b/i;
const APPLIANCE_PATTERN = /\b(appliance|fridge|refrigerator|stove|oven|washer|dryer|dishwasher|range)\b/i;
const EQUIPMENT_PATTERN = /\b(mower|tool|equipment|snowblower)\b/i;

const ISSUE_HELP = {
  asset_missing_placed_in_service: "Add the date the asset was ready and available for rental use.",
  asset_missing_cost: "Add the invoice amount or purchase price before relying on depreciation.",
  asset_missing_basis: "Add a depreciable basis. For buildings this is cost less land value.",
  asset_missing_life: "Choose a recovery life so depreciation can be calculated.",
  building_missing_land_value: "Residential buildings need land value separated from depreciable building basis.",
  bonus_review_needed: "Bonus depreciation needs a valid rate and generally should not be used for buildings or assets over 20 years.",
  source_transaction_missing: "This asset references a source transaction that was not found.",
  source_transaction_amount_mismatch: "The asset basis differs materially from the linked transaction amount.",
  source_transaction_not_capitalized: "The linked expense is not marked as a capital improvement.",
  mixed_use_review_needed: "Rental-use periods suggest less than 100% rental use in the selected year.",
  capital_transaction_without_asset: "This capital-improvement expense does not have an asset record yet.",
  possible_improvement_without_asset: "The transaction wording suggests a possible improvement without an asset record.",
  de_minimis_candidate_needs_decision: "This de minimis candidate needs a repair-versus-capitalize decision.",
};

const ISSUE_LABELS = {
  asset_missing_placed_in_service: "Missing placed-in-service date",
  asset_missing_cost: "Missing cost",
  asset_missing_basis: "Missing basis",
  asset_missing_life: "Missing life",
  building_missing_land_value: "Building missing land value",
  bonus_review_needed: "Review bonus depreciation",
  source_transaction_missing: "Source transaction missing",
  source_transaction_amount_mismatch: "Source amount mismatch",
  source_transaction_not_capitalized: "Source not capitalized",
  mixed_use_review_needed: "Mixed-use review",
  capital_transaction_without_asset: "Capital transaction needs asset",
  possible_improvement_without_asset: "Possible improvement needs asset",
  de_minimis_candidate_needs_decision: "De minimis decision needed",
};

function issue(key, field) {
  return { key, label: ISSUE_LABELS[key] || key, help: ISSUE_HELP[key] || "", field };
}

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function isMissingPositiveNumber(value) {
  const number = numericValue(value);
  return !Number.isFinite(number) || number <= 0;
}

function transactionText(transaction) {
  return [
    transaction?.category,
    transaction?.description,
    transaction?.vendor,
    transaction?.notes,
  ].filter(Boolean).join(" ");
}

function transactionAmount(transaction) {
  const invoiceAmount = numericValue(transaction?.invoiceAmount);
  if (Number.isFinite(invoiceAmount) && invoiceAmount > 0) return Math.abs(invoiceAmount);
  const amount = numericValue(transaction?.amount);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

function yearMatchesTransaction(transaction, yearFilter) {
  if (!yearFilter || yearFilter === "all") return true;
  const year = String(yearFilter);
  return [transaction?.date, transaction?.servicePeriodStart, transaction?.servicePeriodEnd]
    .filter(Boolean)
    .some((date) => String(date).startsWith(year));
}

function overlapsYear(period, year) {
  if (!year || year === "all") return true;
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const periodEnd = period?.endDate || "9999-12-31";
  return String(period?.startDate || "") <= end && periodEnd >= start;
}

function assetSourceTransactionIds(asset) {
  return Array.from(new Set([
    asset?.sourceTransactionId,
    ...(Array.isArray(asset?.sourceTransactionIds) ? asset.sourceTransactionIds : []),
  ].filter(Boolean).map(String)));
}

function transactionIsLinkedToAsset(transaction, assets = []) {
  return assets.some((asset) => assetSourceTransactionIds(asset).includes(String(transaction?.id || "")));
}

function isVoidTransaction(transaction) {
  const status = String(transaction?.status || "").toLowerCase();
  return status === "void" || status === "voided";
}

export function isCapitalImprovementTransactionCandidate(transaction) {
  if (!transaction || isVoidTransaction(transaction) || transaction.type !== "Expense") return false;
  if (transaction.capitalImprovement === true || transaction.capitalImprovement === "Yes") return true;
  return IMPROVEMENT_PATTERN.test(transactionText(transaction));
}

export function buildAssetDraftFromTransaction(transaction, context = {}) {
  const text = transactionText(transaction);
  const type = APPLIANCE_PATTERN.test(text)
    ? "Appliance"
    : EQUIPMENT_PATTERN.test(text)
      ? "Equipment"
      : "Capital Improvement";
  const amount = transactionAmount(transaction);
  const linkedDocumentIds = (context.documents || [])
    .filter((document) =>
      document.transactionId === transaction?.id ||
      (Array.isArray(document.relatedTransactionIds) && document.relatedTransactionIds.includes(transaction?.id)))
    .map((document) => document.id);

  return {
    propertyId: transaction?.propertyId || "",
    unit: transaction?.unit || "Shared",
    type,
    description: transaction?.description || transaction?.vendor || transaction?.category || "Capital improvement",
    placedInService: transaction?.servicePeriodEnd || transaction?.date || "",
    cost: String(amount || ""),
    landValue: "",
    basis: String(amount || ""),
    life: String(context.defaultLifeForAssetType?.(type) || (type === "Appliance" || type === "Equipment" ? 5 : 27.5)),
    bonusElected: "No",
    bonusRate: "",
    sourceTransactionId: transaction?.id || "",
    sourceDocumentIds: linkedDocumentIds,
    assetReviewChecked: false,
    assetReviewNotes: "",
    createdFrom: "transaction",
  };
}

export function getAssetReviewIssues(asset, context = {}) {
  if (!asset) return [];
  const issues = [];
  const selectedYear = context.yearFilter && context.yearFilter !== "all" ? Number(context.yearFilter) : null;
  const isBuilding = asset.type === "Residential Building";

  if (!String(asset.placedInService || "").trim()) issues.push(issue("asset_missing_placed_in_service", "placedInService"));
  if (isMissingPositiveNumber(asset.cost)) issues.push(issue("asset_missing_cost", "cost"));
  if (isMissingPositiveNumber(asset.basis)) issues.push(issue("asset_missing_basis", "basis"));
  if (isMissingPositiveNumber(asset.life)) issues.push(issue("asset_missing_life", "life"));
  if (isBuilding && isMissingPositiveNumber(asset.landValue)) issues.push(issue("building_missing_land_value", "landValue"));

  const bonusElected = asset.bonusElected === true || asset.bonusElected === "Yes";
  const life = numericValue(asset.life);
  if (bonusElected && (isMissingPositiveNumber(asset.bonusRate) || isBuilding || life > 20)) {
    issues.push(issue("bonus_review_needed", "bonusRate"));
  }

  const sourceIds = assetSourceTransactionIds(asset);
  if (sourceIds.length > 0) {
    const transactions = context.transactions || [];
    sourceIds.forEach((sourceId) => {
      const source = transactions.find((transaction) => String(transaction.id) === sourceId);
      if (!source) {
        issues.push(issue("source_transaction_missing", "sourceTransactionId"));
        return;
      }
      const basis = Math.abs(numericValue(asset.basis));
      const amount = transactionAmount(source);
      const tolerance = Math.max(1, amount * 0.01);
      if (Number.isFinite(basis) && amount > 0 && Math.abs(basis - amount) > tolerance) {
        issues.push(issue("source_transaction_amount_mismatch", "basis"));
      }
      if (!(source.capitalImprovement === true || source.capitalImprovement === "Yes")) {
        issues.push(issue("source_transaction_not_capitalized", "sourceTransactionId"));
      }
    });
  }

  if (selectedYear && !asset.assetReviewChecked && String(asset.placedInService || "") <= `${selectedYear}-12-31`) {
    const relevantUsePeriods = (context.usePeriods || []).filter((period) =>
      period.propertyId === asset.propertyId &&
      (period.unit === asset.unit || asset.unit === "Shared") &&
      overlapsYear(period, selectedYear) &&
      Number(period.rentalUsePct) < 1
    );
    if (relevantUsePeriods.length > 0) {
      const checkDate = String(asset.placedInService || `${selectedYear}-01-01`) > `${selectedYear}-01-01`
        ? String(asset.placedInService)
        : `${selectedYear}-07-01`;
      const rentalUsePct = rentalUsePctForAssetOnDate({
        asset,
        date: checkDate,
        usePeriods: context.usePeriods || [],
        leases: context.leases || [],
        units: context.units || [],
      });
      if (rentalUsePct < 1) issues.push(issue("mixed_use_review_needed", "assetReviewChecked"));
    }
  }

  return issues.filter((item, index, list) => list.findIndex((candidate) => candidate.key === item.key) === index);
}

export function getAssetReadiness(asset, context = {}) {
  const issues = getAssetReviewIssues(asset, context);
  const selectedYear = context.yearFilter && context.yearFilter !== "all" ? Number(context.yearFilter) : null;
  if (selectedYear && asset?.placedInService && String(asset.placedInService) > `${selectedYear}-12-31`) {
    return { key: "not_current_year", label: "Not in current year", issues };
  }
  if (issues.length > 0) return { key: "needs_review", label: "Needs asset review", issues };
  return { key: "ready", label: "Ready for Tax Center", issues };
}

export function buildCapitalImprovementTransactionCandidates({ transactions = [], assets = [], documents = [], yearFilter, isTaxReviewRelevantTransaction } = {}) {
  return transactions
    .filter((transaction) => {
      if (!isCapitalImprovementTransactionCandidate(transaction)) return false;
      if (!yearMatchesTransaction(transaction, yearFilter)) return false;
      if (isTaxReviewRelevantTransaction && !isTaxReviewRelevantTransaction(transaction)) return false;
      return !transactionIsLinkedToAsset(transaction, assets);
    })
    .map((transaction) => {
      const issues = [];
      if (transaction.capitalImprovement === true || transaction.capitalImprovement === "Yes") {
        issues.push(issue("capital_transaction_without_asset", "capitalImprovement"));
      } else if (IMPROVEMENT_PATTERN.test(transactionText(transaction))) {
        issues.push(issue("possible_improvement_without_asset", "capitalImprovement"));
      }
      if (transaction.deMinimisCandidate && !transaction.deMinimisApplied && !transaction.taxChecked) {
        issues.push(issue("de_minimis_candidate_needs_decision", "deMinimisTreatment"));
      }
      return {
        transaction,
        issues,
        draft: buildAssetDraftFromTransaction(transaction, { documents }),
      };
    })
    .filter((record) => record.issues.length > 0)
    .sort((left, right) => String(right.transaction.date || "").localeCompare(String(left.transaction.date || "")));
}

export function buildAssetReviewInbox({ assets = [], transactions = [], documents = [], properties = [], units = [], leases = [], usePeriods = [], yearFilter, isTaxReviewRelevantTransaction } = {}) {
  const context = { transactions, documents, properties, units, leases, usePeriods, yearFilter };
  const assetRecords = assets
    .map((asset) => ({
      asset,
      issues: getAssetReviewIssues(asset, context),
      readiness: getAssetReadiness(asset, context),
    }))
    .filter((record) => record.issues.length > 0)
    .sort((left, right) => right.issues.length - left.issues.length || String(left.asset.description || "").localeCompare(String(right.asset.description || "")));

  const readyAssets = assets.filter((asset) => getAssetReadiness(asset, context).key === "ready");
  const transactionCandidates = buildCapitalImprovementTransactionCandidates({
    transactions,
    assets,
    documents,
    yearFilter,
    isTaxReviewRelevantTransaction,
  });

  return {
    transactionCandidates,
    assetRecords,
    readyAssets,
    counts: {
      transactionCandidates: transactionCandidates.length,
      assetWarnings: assetRecords.reduce((sum, record) => sum + record.issues.length, 0),
      readyAssets: readyAssets.length,
    },
  };
}
