import { assetDepreciationForYear } from "../domain/assetDepreciation.ts";

export const categories = {
  Income: ["Rents received", "Other income"],
  Expense: [
    "Advertising",
    "Auto and travel",
    "Cleaning and maintenance",
    "Commissions",
    "Insurance",
    "Legal and other professional fees",
    "Management fees",
    "Other interest",
    "Repairs",
    "Supplies",
    "Taxes",
    "Utilities",
    "Other expenses",
  ],
  Transfer: ["Transfer"],
  "Owner Contribution": ["Owner Contribution"],
  "Owner Draw": ["Owner Draw"],
};

const deMinimisEligibleExpenseCategories = new Set(["Repairs", "Supplies", "Other expenses"]);
const nonTaxRelevantExpenseCategories = new Set([
  "Escrow",
  "Loan principal",
  "Mortgage principal",
  "Mortgage Principal",
  "Principal",
  "Security Deposit",
  "Security deposit",
]);

export const scheduleELines = [
  { id: "rents", label: "Rents received", source: "transactions" },
  { id: "advertising", label: "Advertising", source: "transactions" },
  { id: "autoTravel", label: "Auto and travel", source: "transactions" },
  { id: "cleaningMaintenance", label: "Cleaning and maintenance", source: "transactions" },
  { id: "commissions", label: "Commissions", source: "transactions" },
  { id: "insurance", label: "Insurance", source: "transactions" },
  { id: "legalProfessional", label: "Legal and other professional fees", source: "transactions" },
  { id: "managementFees", label: "Management fees", source: "transactions" },
  { id: "mortgageInterest", label: "Mortgage interest paid to banks", source: "loans" },
  { id: "otherInterest", label: "Other interest", source: "transactions" },
  { id: "repairs", label: "Repairs", source: "transactions" },
  { id: "supplies", label: "Supplies", source: "transactions" },
  { id: "taxes", label: "Taxes", source: "transactions" },
  { id: "utilities", label: "Utilities", source: "transactions" },
  { id: "depreciation", label: "Depreciation expense or depletion", source: "assets" },
  { id: "otherExpenses", label: "Other expenses", source: "transactions" },
];

export function getScheduleELineIdForTransaction(txn) {
  if (txn.type === "Income") {
    return "rents";
  }
  if (txn.type !== "Expense") return null;

  const expenseMap = {
    Advertising: "advertising",
    "Auto and travel": "autoTravel",
    "Cleaning and maintenance": "cleaningMaintenance",
    Commissions: "commissions",
    Insurance: "insurance",
    "Legal and other professional fees": "legalProfessional",
    "Management fees": "managementFees",
    "Other interest": "otherInterest",
    Repairs: "repairs",
    Supplies: "supplies",
    Taxes: "taxes",
    Utilities: "utilities",
    "Other expenses": "otherExpenses",
    Other: "otherExpenses",
  };

  if (txn.category === "Escrow") return null;
  if (txn.category === "Mortgage Interest" || txn.category === "Mortgage interest paid to banks") return null;

  return expenseMap[txn.category] || "otherExpenses";
}

export function scheduleLineSourceNote(source) {
  if (source === "loans") return "Calculated from Loans";
  if (source === "assets") return "Calculated from Assets";
  return "From Ledger Transactions";
}

export function isDeMinimisCategoryEligible(type, category) {
  return type === "Expense" && deMinimisEligibleExpenseCategories.has(category);
}

export function isTaxReviewRelevantTransaction(txn) {
  if (!txn || txn.type !== "Expense") return false;
  if (nonTaxRelevantExpenseCategories.has(String(txn.category || "").trim())) return false;
  if (getScheduleELineIdForTransaction(txn)) return true;
  return (
    (txn.reimbursable && !txn.reimbursed) ||
    txn.capitalImprovement ||
    txn.unit === "Shared" ||
    !txn.receiptName
  );
}

export function defaultLifeForAssetType(type) {
  if (type === "Residential Building") return 27.5;
  if (type === "Appliance" || type === "Furniture") return 5;
  if (type === "Equipment") return 7;
  return 15;
}

export function normalizeBonusRate(value) {
  const raw = Number(value || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const decimal = raw > 1 ? raw / 100 : raw;
  if (decimal < 0) return 0;
  if (decimal > 1) return 1;
  return decimal;
}

export function assetSchedule(asset, firstYear, numberOfYears = 6) {
  return Array.from({ length: numberOfYears }, (_, idx) => {
    const year = firstYear + idx;
    return { year, depreciation: assetDepreciationForYear(asset, year) };
  });
}

export function buildRentalDayAllocationWeights(rows, unitNames) {
  const fairRentalDaysByUnit = Object.fromEntries(
    unitNames.map((unitName) => [unitName, rows.find((row) => row.unit === unitName)?.fairRentalDays || 0]),
  );
  const totalFairRentalDays = Object.values(fairRentalDaysByUnit).reduce((sum, value) => sum + value, 0);
  const evenWeight = unitNames.length > 0 ? 1 / unitNames.length : 0;

  return Object.fromEntries(
    unitNames.map((unitName) => [
      unitName,
      totalFairRentalDays > 0 ? (fairRentalDaysByUnit[unitName] || 0) / totalFairRentalDays : evenWeight,
    ]),
  );
}
