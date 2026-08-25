import {
  ArrowLeftRight,
  Banknote,
  BriefcaseBusiness,
  Car,
  CircleDollarSign,
  HandCoins,
  Landmark,
  Megaphone,
  Package,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";

const MONTHS = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

export function isRentIncomeTransaction(transaction) {
  return transaction?.type === "Income" && /\brents?\b/i.test(String(transaction.category || ""));
}

export function isFutureDatedTransaction(transaction, todayIso = "") {
  const date = String(transaction?.date || "");
  return Boolean(todayIso && /^\d{4}-\d{2}-\d{2}/.test(date) && date.slice(0, 10) > todayIso);
}

export function transactionPostingStatusLabel(transaction, todayIso = "") {
  if (isFutureDatedTransaction(transaction, todayIso)) {
    return transaction?.recurringTemplateId || transaction?.tenantLedgerEntryId ? "Scheduled" : "Future-dated";
  }
  return "Posted";
}

export function transactionReconciliationStatusLabel(transaction, todayIso = "") {
  if (isFutureDatedTransaction(transaction, todayIso) && (transaction?.recurringTemplateId || transaction?.tenantLedgerEntryId) && !transaction?.bankImportId) {
    return "Scheduled";
  }
  if (transaction?.bankImportId && transaction?.reconciled) return "Bank matched";
  if (transaction?.bankImportId) return "Needs bank match";
  if (transaction?.reconciled) return "Accepted";
  return "Manual entry";
}

export function summarizeLedgerTransactions(transactions = [], { todayIso = "", includeFuture = true } = {}) {
  const scoped = includeFuture ? transactions : transactions.filter((transaction) => !isFutureDatedTransaction(transaction, todayIso));
  const income = scoped
    .filter((transaction) => transaction.type === "Income")
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const expenses = scoped
    .filter((transaction) => transaction.type === "Expense")
    .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);

  return {
    expenses,
    income,
    netCashflow: income - expenses,
    transactionCount: scoped.length,
  };
}

export function buildTransactionWorkspaceModes({
  attentionCount = 0,
  bankMatchOpenCount = 0,
  expectedRecurringCount = 0,
  importedCount = 0,
  recurringCount = 0,
  transactionCount = 0,
} = {}) {
  return [
    {
      key: "activity",
      label: "Activity",
      count: transactionCount,
      description: "Browse and edit posted income, expenses, payments, and transfers.",
    },
    {
      key: "attention",
      label: "Needs attention",
      count: attentionCount,
      description: "Inspect flagged transactions here; resolve cleanup in Work Queue.",
    },
    {
      key: "recurring",
      label: "Recurring",
      count: recurringCount,
      description: expectedRecurringCount > 0
        ? `${expectedRecurringCount} expected posting${expectedRecurringCount === 1 ? "" : "s"} due in this scope.`
        : "Recurring schedules are current in this scope.",
    },
    {
      key: "imports",
      label: "Imports & matching",
      count: importedCount,
      description: bankMatchOpenCount > 0
        ? `${bankMatchOpenCount} imported transaction${bankMatchOpenCount === 1 ? "" : "s"} still need a bank match.`
        : "Upload statements and review bank matches.",
    },
  ];
}

export function ledgerViewForTransactionWorkspaceMode(mode = "activity") {
  return {
    activity: "all",
    attention: "review",
    recurring: "recurring",
    imports: "imported",
  }[mode] || "all";
}

export function transactionScheduleLabel(transaction) {
  if (isRentIncomeTransaction(transaction)) return "Schedule E: Rent";
  if (transaction?.type !== "Expense") return "";

  const category = String(transaction?.category || "").trim();
  const labels = {
    Advertising: "Schedule E: Advertising",
    "Auto and travel": "Schedule E: Auto/travel",
    "Cleaning and maintenance": "Schedule E: Cleaning",
    Commissions: "Schedule E: Commissions",
    Insurance: "Schedule E: Insurance",
    "Legal and other professional fees": "Schedule E: Professional",
    "Management fees": "Schedule E: Management",
    "Other interest": "Schedule E: Interest",
    Repairs: "Schedule E: Repairs",
    Supplies: "Schedule E: Supplies",
    Taxes: "Schedule E: Taxes",
    Utilities: "Schedule E: Utilities",
    "Other expenses": "Schedule E: Other",
  };

  return labels[category] || "";
}

export function transactionTaxStatusLabel(transaction, readiness = {}, isTaxRelevant = false) {
  if (readiness?.key === "needs_review") {
    const issues = Array.isArray(readiness.issues) ? readiness.issues : [];
    if (issues.length === 1 && issues[0]?.key === "tax_open") return "Review open";
    return "Needs tax review";
  }
  const scheduleLabel = transactionScheduleLabel(transaction);
  if (scheduleLabel) return transaction?.taxChecked ? "Tax mapped" : scheduleLabel;
  if (isTaxRelevant) return transaction?.taxChecked ? "Tax mapped" : "Review open";
  return "Not tax relevant";
}

export function transactionSupportStatusLabel(transaction, { missingReceipt = false, documentCount = 0 } = {}) {
  if (missingReceipt) return "Receipt missing";
  if (transaction?.receiptName || documentCount > 0) return "Receipt attached";
  if (isRentIncomeTransaction(transaction)) return "Receipt not required";
  return "No document required";
}

export function transactionCategoryStatusLabel(transaction) {
  if (isRentIncomeTransaction(transaction)) return "Rent";
  return String(transaction?.category || "Uncategorized").trim() || "Uncategorized";
}

export function getRentReportingMonth(transaction) {
  const explicitPeriod = String(transaction?.rentPeriod || "").trim();
  if (/^\d{4}-\d{2}$/.test(explicitPeriod)) return explicitPeriod;
  if (!isRentIncomeTransaction(transaction)) return String(transaction?.date || "").slice(0, 7);

  const transactionDate = String(transaction?.date || "");
  const transactionYear = Number(transactionDate.slice(0, 4));
  const transactionMonth = Number(transactionDate.slice(5, 7));
  const text = [transaction?.description, transaction?.notes].filter(Boolean).join(" ");
  const monthMatch = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b(?:\s+(20\d{2}))?/i);
  if (!monthMatch || !Number.isFinite(transactionYear)) return transactionDate.slice(0, 7);

  const month = MONTHS[monthMatch[1].toLowerCase()];
  let year = Number(monthMatch[2] || transactionYear);
  if (!monthMatch[2] && Number.isFinite(transactionMonth)) {
    if (transactionMonth - month > 6) year += 1;
    if (month - transactionMonth > 6) year -= 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function formatRentReportingMonth(transaction) {
  if (!isRentIncomeTransaction(transaction)) return "";
  const period = getRentReportingMonth(transaction);
  if (!/^\d{4}-\d{2}$/.test(period)) return "";
  const date = new Date(`${period}-01T00:00:00Z`);
  return `${date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${period.slice(0, 4)} rent`;
}

export function formatTransactionUnitLabel(value) {
  const unit = String(value || "").trim();
  if (!unit) return "Unit";
  return /^unit\b/i.test(unit) ? unit : `Unit ${unit}`;
}

export function getTransactionVisual(transaction) {
  const category = String(transaction?.category || "").toLowerCase();
  const type = String(transaction?.type || "");
  const base = type === "Income"
    ? { amountClass: "text-emerald-700", iconClass: "border-emerald-200 bg-emerald-50 text-emerald-700" }
    : { amountClass: type === "Expense" ? "text-rose-700" : "text-slate-900", iconClass: "border-slate-200 bg-slate-50 text-slate-600" };

  if (isRentIncomeTransaction(transaction)) return { ...base, Icon: CircleDollarSign };
  if (type === "Income") return { ...base, Icon: HandCoins };
  if (type === "Transfer" || type === "Owner Contribution" || type === "Owner Draw") return { ...base, Icon: ArrowLeftRight, iconClass: "border-violet-200 bg-violet-50 text-violet-700" };
  if (category.includes("utilit")) return { ...base, Icon: Zap, iconClass: "border-cyan-200 bg-cyan-50 text-cyan-700" };
  if (category.includes("repair") || category.includes("maintenance")) return { ...base, Icon: Wrench, iconClass: "border-amber-200 bg-amber-50 text-amber-700" };
  if (category.includes("cleaning")) return { ...base, Icon: Sparkles, iconClass: "border-sky-200 bg-sky-50 text-sky-700" };
  if (category.includes("suppl")) return { ...base, Icon: Package, iconClass: "border-indigo-200 bg-indigo-50 text-indigo-700" };
  if (category.includes("insurance")) return { ...base, Icon: ShieldCheck, iconClass: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  if (category.includes("tax") || category.includes("mortgage") || category.includes("interest")) return { ...base, Icon: Landmark, iconClass: "border-blue-200 bg-blue-50 text-blue-700" };
  if (category.includes("auto") || category.includes("travel")) return { ...base, Icon: Car, iconClass: "border-orange-200 bg-orange-50 text-orange-700" };
  if (category.includes("advert")) return { ...base, Icon: Megaphone, iconClass: "border-pink-200 bg-pink-50 text-pink-700" };
  if (category.includes("management") || category.includes("professional") || category.includes("commission")) return { ...base, Icon: BriefcaseBusiness, iconClass: "border-slate-300 bg-slate-100 text-slate-700" };
  if (category.includes("fee")) return { ...base, Icon: Banknote };
  return { ...base, Icon: ReceiptText };
}
