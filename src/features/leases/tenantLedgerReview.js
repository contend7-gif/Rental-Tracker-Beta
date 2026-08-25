import { buildTenantLedgerSummary } from "../../domain/tenantLedger.ts";
import { toLocalIsoDate } from "../../lib/localDate.ts";

const ISSUE_LABELS = {
  security_deposit_missing_liability_entry: "Deposit liability missing",
  security_deposit_liability_without_refund_or_application: "Deposit disposition open",
  security_deposit_applied_without_damage_support: "Damage support missing",
  security_deposit_refund_missing_transaction: "Refund transaction missing",
  tenant_payment_not_linked_to_income_transaction: "Payment missing income link",
  rent_charge_without_payment_or_balance_review: "Rent balance review needed",
  nonrefundable_fee_not_classified: "Nonrefundable fee not classified",
  cleaning_fee_not_classified: "Cleaning fee not classified",
  pet_fee_not_classified: "Pet fee not classified",
  lease_ended_with_open_balance: "Ended lease has open balance",
  lease_ended_with_unapplied_credit: "Ended lease has tenant credit",
  tenant_damage_without_work_order_or_transaction: "Tenant damage support missing",
  refund_or_credit_without_reason: "Refund/credit reason missing",
  prepayment_carryforward_unreviewed: "Prepayment carryforward unreviewed",
};

const ISSUE_HELP = {
  security_deposit_missing_liability_entry: "A lease security deposit should be visible as a tenant ledger liability entry.",
  security_deposit_liability_without_refund_or_application: "Ended leases should show whether the deposit was returned, applied, or intentionally held.",
  security_deposit_applied_without_damage_support: "Deposit applied to damages needs support from notes, a work order, transaction, or document.",
  security_deposit_refund_missing_transaction: "Security deposit returns should link to their non-income accounting transaction.",
  tenant_payment_not_linked_to_income_transaction: "Tenant payments should link to income transactions when posted to accounting.",
  rent_charge_without_payment_or_balance_review: "Past-due rent charges should be paid, credited, or reviewed.",
  nonrefundable_fee_not_classified: "Nonrefundable fees need an income classification.",
  cleaning_fee_not_classified: "Cleaning fees need classification before reporting.",
  pet_fee_not_classified: "Pet fees need classification before reporting.",
  lease_ended_with_open_balance: "Ended leases with balances need collection, write-off, or review notes.",
  lease_ended_with_unapplied_credit: "Ended leases with tenant credits need refund or credit handling.",
  tenant_damage_without_work_order_or_transaction: "Tenant damage entries should link to support or explain the damage.",
  refund_or_credit_without_reason: "Credits and refunds need a short reason.",
  prepayment_carryforward_unreviewed: "Prepayments carried across periods should be reviewed.",
};

function issue(key, field, entryId) {
  return { key, label: ISSUE_LABELS[key] || key, help: ISSUE_HELP[key] || "", field, entryId };
}

function money(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isLeaseEnded(lease, todayIso) {
  if (!lease) return false;
  if (lease.status === "Ended") return true;
  const actualEnd = String(lease.actualEndDate || "").trim();
  if (actualEnd) return actualEnd < todayIso;
  if (leaseIsOpenEnded(lease)) return false;
  return String(lease.endDate || "") < todayIso;
}

import { leaseIsOpenEnded } from "../../domain/leaseTerms.js";

function entryText(entry) {
  return String(entry?.memo || "").toLowerCase();
}

function hasReason(entry) {
  const text = entryText(entry).trim();
  return text.length >= 6 && !["refund", "credit", "adjustment", "fee"].includes(text);
}

function hasEntrySupport(entry, context = {}) {
  if (!entry) return false;
  if (String(entry.reviewNotes || "").trim()) return true;
  if (String(entry.linkedWorkOrderId || "").trim()) return true;
  if (Array.isArray(entry.linkedDocumentIds) && entry.linkedDocumentIds.length > 0) return true;
  if (String(entry.transactionId || "").trim()) return true;
  const documents = context.documents || [];
  const workOrders = context.workOrders || [];
  return documents.some((document) => document.tenantLedgerEntryId === entry.id) ||
    workOrders.some((workOrder) => workOrder.tenantLedgerEntryId === entry.id);
}

function isGenericTreatment(entry) {
  return !entry?.accountingTreatment || entry.accountingTreatment === "none";
}

function isRelevantLease(lease, yearFilter) {
  if (!lease) return false;
  if (!yearFilter || yearFilter === "all") return true;
  const start = `${yearFilter}-01-01`;
  const end = `${yearFilter}-12-31`;
  const leaseEnd = lease.actualEndDate || lease.endDate || "9999-12-31";
  return lease.startDate <= end && leaseEnd >= start;
}

export function getTenantLedgerReviewIssues(lease, entries = [], context = {}) {
  if (!lease) return [];
  const todayIso = context.todayIso || toLocalIsoDate();
  const leaseEntries = entries.filter((entry) => entry.leaseId === lease.id);
  const summary = buildTenantLedgerSummary(leaseEntries);
  const summaryRowById = Object.fromEntries(summary.rows.map((row) => [row.id, row]));
  const ended = isLeaseEnded(lease, todayIso);
  const issues = [];
  const depositAmount = money(lease.securityDeposit);
  const hasDepositLiability = leaseEntries.some((entry) => entry.accountingTreatment === "security_deposit_liability");
  const hasDepositDisposition = leaseEntries.some((entry) =>
    entry.accountingTreatment === "security_deposit_return" ||
    entry.accountingTreatment === "security_deposit_applied_damages"
  );

  if (depositAmount > 0 && !hasDepositLiability) {
    issues.push(issue("security_deposit_missing_liability_entry", "securityDeposit"));
  }

  if (ended && hasDepositLiability && !hasDepositDisposition && !String(lease.notes || "").toLowerCase().includes("deposit")) {
    issues.push(issue("security_deposit_liability_without_refund_or_application", "accountingTreatment"));
  }

  if (ended && summary.totalDue > 0 && !leaseEntries.some((entry) => entry.reviewed && String(entry.reviewNotes || "").trim())) {
    issues.push(issue("lease_ended_with_open_balance", "balance"));
  }

  if (ended && summary.tenantCredit > 0 && !leaseEntries.some((entry) => entry.accountingTreatment === "security_deposit_return" || String(entry.reviewNotes || "").trim())) {
    issues.push(issue("lease_ended_with_unapplied_credit", "tenantCredit"));
  }

  leaseEntries.forEach((entry) => {
    const text = entryText(entry);

    if (entry.accountingTreatment === "security_deposit_applied_damages" && !hasEntrySupport(entry, context)) {
      issues.push(issue("security_deposit_applied_without_damage_support", "linkedWorkOrderId", entry.id));
    }

    if (entry.accountingTreatment === "security_deposit_return" && !entry.transactionId) {
      issues.push(issue("security_deposit_refund_missing_transaction", "transactionId", entry.id));
    }

    if (entry.kind === "payment" && entry.accountingTreatment === "rent_income" && !entry.transactionId) {
      issues.push(issue("tenant_payment_not_linked_to_income_transaction", "transactionId", entry.id));
    }

    if (entry.kind === "charge" && summary.chargeBalanceById[entry.id] > 0 && entry.date < todayIso && !entry.reviewed) {
      issues.push(issue("rent_charge_without_payment_or_balance_review", "reviewed", entry.id));
    }

    if (text.includes("nonrefundable") && isGenericTreatment(entry)) {
      issues.push(issue("nonrefundable_fee_not_classified", "accountingTreatment", entry.id));
    }
    if (text.includes("cleaning") && isGenericTreatment(entry)) {
      issues.push(issue("cleaning_fee_not_classified", "accountingTreatment", entry.id));
    }
    if (text.includes("pet") && isGenericTreatment(entry)) {
      issues.push(issue("pet_fee_not_classified", "accountingTreatment", entry.id));
    }

    if ((text.includes("damage") || entry.accountingTreatment === "security_deposit_applied_damages") && !hasEntrySupport(entry, context)) {
      issues.push(issue("tenant_damage_without_work_order_or_transaction", "linkedWorkOrderId", entry.id));
    }

    if ((entry.kind === "credit" || entry.kind === "refund") && !hasReason(entry)) {
      issues.push(issue("refund_or_credit_without_reason", "memo", entry.id));
    }

    if (Number(summaryRowById[entry.id]?.unappliedAmount || 0) > 0 && !entry.reviewed) {
      issues.push(issue("prepayment_carryforward_unreviewed", "reviewed", entry.id));
    }
  });

  return issues.filter((item, index, list) => list.findIndex((candidate) => candidate.key === item.key && candidate.entryId === item.entryId) === index);
}

export function getTenantLedgerReadiness(lease, entries = [], context = {}) {
  const leaseEntries = entries.filter((entry) => entry.leaseId === lease?.id);
  if (!leaseEntries.length && !isRelevantLease(lease, context.yearFilter)) {
    return { key: "not_applicable", label: "Not applicable", issues: [] };
  }
  const issues = getTenantLedgerReviewIssues(lease, leaseEntries, context);
  if (issues.length > 0) return { key: "needs_review", label: "Needs tenant ledger review", issues };
  return { key: "ready", label: "Ready for Tax Center", issues };
}

function primaryActionForIssues(issues) {
  const keys = new Set(issues.map((item) => item.key));
  if (keys.has("security_deposit_missing_liability_entry")) return "add_deposit_liability";
  if (keys.has("security_deposit_liability_without_refund_or_application")) return "add_deposit_disposition";
  if (keys.has("tenant_payment_not_linked_to_income_transaction") || keys.has("security_deposit_refund_missing_transaction")) return "link_transaction";
  return "open_tenant_ledger";
}

export function buildTenantLedgerReviewInbox({ leases = [], tenantLedgerEntries = [], transactions = [], documents = [], workOrders = [], yearFilter, propertyFilter = "all", todayIso } = {}) {
  const scopedLeases = leases.filter((lease) => {
    if (propertyFilter !== "all" && lease.propertyId !== propertyFilter) return false;
    return isRelevantLease(lease, yearFilter) || tenantLedgerEntries.some((entry) => entry.leaseId === lease.id);
  });

  const records = scopedLeases
    .map((lease) => {
      const entries = tenantLedgerEntries.filter((entry) => entry.leaseId === lease.id);
      const issues = getTenantLedgerReviewIssues(lease, entries, { transactions, documents, workOrders, yearFilter, todayIso });
      const summary = buildTenantLedgerSummary(entries);
      return {
        lease,
        entries,
        issues,
        readiness: getTenantLedgerReadiness(lease, entries, { transactions, documents, workOrders, yearFilter, todayIso }),
        summary,
        primaryAction: primaryActionForIssues(issues),
      };
    })
    .filter((record) => record.issues.length > 0)
    .sort((left, right) => right.issues.length - left.issues.length || String(left.lease.tenantName || "").localeCompare(String(right.lease.tenantName || "")));

  const countIssue = (key) => records.filter((record) => record.issues.some((issue) => issue.key === key)).length;
  const feeKeys = new Set(["nonrefundable_fee_not_classified", "cleaning_fee_not_classified", "pet_fee_not_classified"]);

  return {
    records,
    counts: {
      total: records.length,
      depositIssues: records.filter((record) => record.issues.some((issue) => issue.key.startsWith("security_deposit"))).length,
      openBalances: countIssue("lease_ended_with_open_balance"),
      unappliedCredits: countIssue("lease_ended_with_unapplied_credit"),
      feeClassificationIssues: records.filter((record) => record.issues.some((issue) => feeKeys.has(issue.key))).length,
    },
  };
}

export function summarizeTenantLedgerReadiness(args = {}) {
  const inbox = buildTenantLedgerReviewInbox(args);
  const scopedLeases = (args.leases || []).filter((lease) => args.propertyFilter === "all" || !args.propertyFilter || lease.propertyId === args.propertyFilter);
  const ready = scopedLeases.filter((lease) =>
    getTenantLedgerReadiness(lease, args.tenantLedgerEntries || [], args).key === "ready"
  ).length;
  return {
    ready,
    needsReview: inbox.records.length,
    depositIssues: inbox.counts.depositIssues,
    openBalances: inbox.counts.openBalances,
    unappliedCredits: inbox.counts.unappliedCredits,
    feeClassificationIssues: inbox.counts.feeClassificationIssues,
  };
}
