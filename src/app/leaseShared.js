export const TENANT_LEDGER_KIND_OPTIONS = [
  { value: "charge", label: "Charge" },
  { value: "payment", label: "Payment" },
  { value: "credit", label: "Credit" },
  { value: "refund", label: "Refund" },
  { value: "adjustment", label: "Adjustment" },
];

export const TENANT_LEDGER_ACCOUNTING_OPTIONS = [
  { value: "none", label: "Do not post" },
  { value: "rent_income", label: "Rent income" },
  { value: "other_income", label: "Other income" },
  { value: "security_deposit_liability", label: "Security deposit (liability)" },
  { value: "security_deposit_applied_damages", label: "Deposit applied to damages" },
  { value: "security_deposit_return", label: "Security deposit returned" },
  { value: "repairs_expense", label: "Repairs expense" },
];

export function proratedRentForMonth(lease, billingDate) {
  return proratedRentForMonth30Day(lease, billingDate);
}

export { leaseEffectiveEndDateForMonth };

export function leaseIsActiveByDate(lease, dateStr) {
  if (!dateStr) return false;
  if (lease.startDate > dateStr) return false;

  if (lease.actualEndDate) {
    return lease.actualEndDate >= dateStr;
  }

  if (leaseIsOpenEnded(lease)) {
    return true;
  }

  return lease.endDate >= dateStr;
}

export function leaseStatusForDate(lease, dateStr) {
  if (!dateStr) return lease.status || "Active";
  if (lease.startDate > dateStr) return "Upcoming";
  return leaseIsActiveByDate(lease, dateStr) ? "Active" : "Ended";
}

export function leaseActualEndLabel(lease) {
  if (lease.actualEndDate) return lease.actualEndDate;
  if (leaseIsOpenEnded(lease)) return "Open (MTM)";
  return lease.endDate;
}

export function isRentIncomeTransaction(txn) {
  if (!txn || txn.status !== "active") return false;
  if (txn.type !== "Income") return false;
  const category = String(txn.category || "").trim().toLowerCase();
  return category === "rents received" || category === "rent";
}

export function rentTxnAutomationKey(txnId) {
  return `txn-rent:${txnId}`;
}

export function rentTxnIdFromAutomationKey(automationKey) {
  const key = String(automationKey || "");
  if (!key.startsWith("txn-rent:")) return "";
  return key.slice("txn-rent:".length);
}

export function leaseTypeLabel(lease) {
  return leaseTermSummaryLabel(lease);
}
import { leaseEffectiveEndDateForMonth, proratedRentForMonth30Day } from "../domain/rentProration.js";
import { leaseIsOpenEnded, leaseTermSummaryLabel } from "../domain/leaseTerms.js";
