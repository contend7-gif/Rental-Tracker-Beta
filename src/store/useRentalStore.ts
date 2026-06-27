import { useMemo, useState } from "react";
import { createRecurringTemplateFromTxn, deductibleAmountForTransaction, generateRecurringDrafts, generateRecurringTransactions, getRentalUsePctForDate, getRentalUsePctForRange } from "../domain/accounting.ts";
import { toLocalIsoDate } from "../lib/localDate.ts";
import type { ActivityLogEntry, Asset, DocumentItem, Lease, Loan, LoanPayment, LoanYearEndReview, Property, RecurringDraft, RecurringTemplate, TenantLedgerEntry, Transaction, Unit, UsePeriod, Vendor, WorkOrder } from "../models.ts";
import { createActivityActions } from "./activityStore.ts";
import { normalizeAsset } from "./assetStore.ts";
import { normalizeDocument } from "./documentStore.ts";
import { leaseIsEndedByDate, normalizeLease } from "./leaseStore.ts";
import { loanIdsNeedRepair, normalizeLoan, normalizeLoansWithUniqueIds, normalizeLoanYearEndReview } from "./loanStore.ts";
import { normalizeWorkOrder, normalizeWorkOrderStatus } from "./maintenanceStore.ts";
import { createPropertyActions, normalizeProperty, formatUsPhone } from "./propertyStore.ts";
import { createDemoDataState, normalizeBackupData, type RentalStoreData } from "./rentalStoreData.ts";
import { normalizeStringArray } from "./storeUtils.ts";
import { normalizeTenantLedgerEntry } from "./tenantLedgerStore.ts";
import { normalizeUsePeriod } from "./usePeriodStore.ts";

function addMonths(dateStr: string, monthsToAdd: number) {
  const parts = String(dateStr || "").split("-").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return dateStr;
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  date.setUTCMonth(date.getUTCMonth() + monthsToAdd);
  return date.toISOString().slice(0, 10);
}

function loanPaymentPrincipalImpact(payment: LoanPayment) {
  return Number(payment.principal || 0) + Number(payment.extraPrincipal || 0);
}

function loanPaymentYearAmount(payment: LoanPayment, field: "interest" | "principal" | "escrow", year: string) {
  if (!String(payment.paymentDate || "").startsWith(year)) return 0;
  if (field === "principal") return loanPaymentPrincipalImpact(payment);
  return Number(payment[field] || 0);
}

function nextLoanPaymentDate(payments: LoanPayment[], loanId: string, fallback: string) {
  const latestPayment = payments
    .filter((payment) => payment.loanId === loanId)
    .sort((left, right) => right.paymentDate.localeCompare(left.paymentDate))[0];
  return latestPayment ? addMonths(latestPayment.paymentDate, 1) : fallback;
}

export function useRentalStore(auditContext: { actorName?: string; actorRole?: string } = {}) {
  // TODO: Actions still live in this adapter while cross-domain writes share local React state.
  // Move them into slice builders once transaction/document/maintenance linking has explicit boundaries.
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>([]);
  const [usePeriods, setUsePeriods] = useState<UsePeriod[]>([]);
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplate[]>([]);
  const [recurringDrafts, setRecurringDrafts] = useState<RecurringDraft[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [tenantLedgerEntries, setTenantLedgerEntries] = useState<TenantLedgerEntry[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const activityActions = useMemo(
    () => createActivityActions({
      setActivityLog,
      actorName: auditContext.actorName,
      actorRole: auditContext.actorRole,
    }),
    [auditContext.actorName, auditContext.actorRole],
  );
  const { appendActivityLog } = activityActions;

  const applyStoreData = (data: RentalStoreData) => {
    setTransactions(data.transactions);
    setAssets(data.assets);
    setDocuments(data.documents);
    setLoans(data.loans);
    setLoanPayments(data.loanPayments);
    setUsePeriods(data.usePeriods);
    setRecurringTemplates(data.recurringTemplates);
    setRecurringDrafts(data.recurringDrafts);
    setTenantLedgerEntries(data.tenantLedgerEntries);
    setActivityLog(data.activityLog);
    setLeases(data.leases);
    setVendors(data.vendors);
    setWorkOrders(data.workOrders);
    setProperties(data.properties);
    setUnits(data.units);
  };

  const propertyActions = useMemo(
    () => createPropertyActions({
      properties,
      setProperties,
      setUnits,
      setAssets,
      appendActivityLog,
    }),
    [appendActivityLog, properties],
  );

  const actions = useMemo(
    () => ({
      async loadDemoData() {
        const demo = await createDemoDataState();
        applyStoreData(demo);
      },
      restoreBackupData(rawData: unknown) {
        const backup = normalizeBackupData(rawData);
        applyStoreData(backup);
      },
      ...activityActions,
      addOrUpdateTransaction(txn: Transaction, assetPayload?: Omit<Asset, "id" | "currentYearDep" | "basis"> & { basis: number; life: number }) {
        const normalizedTxn: Transaction = {
          ...txn,
          reconciled: txn.reconciled === true,
          servicePeriodStart: String(txn.servicePeriodStart || "").trim() || undefined,
          servicePeriodEnd: String(txn.servicePeriodEnd || "").trim() || undefined,
          rentPeriod: /^\d{4}-\d{2}$/.test(String(txn.rentPeriod || "").trim()) ? String(txn.rentPeriod).trim() : undefined,
        };
        const existsBefore = transactions.some((existingTxn) => existingTxn.id === normalizedTxn.id);
        const normalizedAmount = Number(normalizedTxn.amount);
        const linkedWorkOrderId = String(normalizedTxn.workOrderId || "").trim();
        const linkedTenantLedgerEntryId = String(normalizedTxn.tenantLedgerEntryId || "").trim();
        setTransactions((prev) => {
          const exists = prev.some((p) => p.id === normalizedTxn.id);
          if (exists) return prev.map((p) => (p.id === normalizedTxn.id ? normalizedTxn : p));
          return [normalizedTxn, ...prev];
        });

        setWorkOrders((prev) =>
          prev.map((workOrder) => {
            const hasTxnLink = workOrder.transactionId === normalizedTxn.id;
            const isDirectLink = linkedWorkOrderId !== "" && workOrder.id === linkedWorkOrderId;
            if (!hasTxnLink && !isDirectLink) return workOrder;

            if (isDirectLink) {
              return {
                ...workOrder,
                transactionId: normalizedTxn.id,
                actualCost: Number.isFinite(normalizedAmount) ? normalizedAmount : workOrder.actualCost,
              };
            }

            if (linkedWorkOrderId) {
              return {
                ...workOrder,
                transactionId: "",
              };
            }

            return {
              ...workOrder,
              actualCost: Number.isFinite(normalizedAmount) ? normalizedAmount : workOrder.actualCost,
            };
          }),
        );

        setTenantLedgerEntries((prev) =>
          prev.map((entry) => {
            const hasTxnLink = entry.transactionId === normalizedTxn.id;
            const isDirectLink = linkedTenantLedgerEntryId !== "" && entry.id === linkedTenantLedgerEntryId;
            if (!hasTxnLink && !isDirectLink) return entry;

            if (isDirectLink) {
              return {
                ...entry,
                transactionId: normalizedTxn.id,
              };
            }

            if (linkedTenantLedgerEntryId) {
              return {
                ...entry,
                transactionId: undefined,
              };
            }

            return entry;
          }),
        );

        appendActivityLog({
          action: existsBefore ? "update" : "create",
          entityType: "transaction",
          entityId: normalizedTxn.id,
          propertyId: normalizedTxn.propertyId,
          unit: normalizedTxn.unit,
          summary: existsBefore ? "Transaction updated." : "Transaction created.",
          details: normalizedTxn.description,
        });

        if (assetPayload) {
          setAssets((prev) => [
            {
              id: `a${Date.now()}`,
              ...assetPayload,
              currentYearDep: assetPayload.basis / assetPayload.life,
              bonusEligible: false,
              bonusElected: false,
              bonusRate: 0,
            },
            ...prev,
          ]);
        }
      },
      setTransactionTaxChecked(id: string, checked: boolean) {
        setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, taxChecked: checked } : t)));
      },
      setTransactionReconciled(id: string, reconciled: boolean) {
        const existingTxn = transactions.find((txn) => txn.id === id);
        if (!existingTxn || Boolean(existingTxn.reconciled) === reconciled) {
          setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, reconciled } : t)));
          return;
        }

        setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, reconciled } : t)));
        appendActivityLog({
          action: reconciled ? "reconcile" : "unreconcile",
          entityType: "transaction",
          entityId: id,
          propertyId: existingTxn.propertyId,
          unit: existingTxn.unit,
          summary: reconciled ? "Transaction marked reconciled." : "Transaction marked unreconciled.",
          details: existingTxn.description,
        });
      },
      deleteTransaction(id: string) {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        setDocuments((prev) =>
          prev.map((document) => {
            const nextRelatedTransactionIds = Array.isArray(document.relatedTransactionIds)
              ? document.relatedTransactionIds.filter((txnId) => txnId !== id)
              : [];
            if (document.transactionId !== id) {
              return normalizeDocument({
                ...document,
                relatedTransactionIds: nextRelatedTransactionIds,
              });
            }

            const promotedTransactionId = nextRelatedTransactionIds[0] || "";
            return normalizeDocument({
              ...document,
              transactionId: promotedTransactionId || undefined,
              relatedTransactionIds: promotedTransactionId ? nextRelatedTransactionIds.slice(1) : nextRelatedTransactionIds,
            });
          }),
        );
        setWorkOrders((prev) => prev.map((workOrder) => (workOrder.transactionId === id ? { ...workOrder, transactionId: "" } : workOrder)));
        setTenantLedgerEntries((prev) =>
          prev.map((entry) => (entry.transactionId === id ? { ...entry, transactionId: undefined } : entry)),
        );
        appendActivityLog({
          action: "delete",
          entityType: "transaction",
          entityId: id,
          propertyId: existingTxn?.propertyId,
          unit: existingTxn?.unit,
          summary: "Transaction deleted.",
          details: existingTxn?.description,
        });
      },
      voidTransaction(id: string) {
        const existingTxn = transactions.find((txn) => txn.id === id);
        setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, status: "voided" } : t)));
        if (existingTxn) {
          appendActivityLog({
            action: "void",
            entityType: "transaction",
            entityId: id,
            propertyId: existingTxn.propertyId,
            unit: existingTxn.unit,
            summary: "Transaction voided.",
            details: existingTxn.description,
          });
        }
      },
      duplicateTransaction(txn: Transaction) {
        const clone: Transaction = {
          ...txn,
          id: `t${Date.now()}`,
          description: `${txn.description} (copy)`,
          taxChecked: false,
          reconciled: false,
          recurringTemplateId: undefined,
          tenantLedgerEntryId: undefined,
          status: "active",
        };
        setTransactions((prev) => [clone, ...prev]);
        appendActivityLog({
          action: "create",
          entityType: "transaction",
          entityId: clone.id,
          propertyId: clone.propertyId,
          unit: clone.unit,
          summary: "Transaction duplicated.",
          details: clone.description,
        });
      },
      createRecurringTemplate(txn: Transaction, options?: { frequency?: RecurringTemplate["frequency"]; nextDueDate?: string; reviewRequired?: boolean }) {
        const template = createRecurringTemplateFromTxn(txn);
        const configured: RecurringTemplate = {
          ...template,
          frequency: options?.frequency ?? template.frequency,
          nextDueDate: options?.nextDueDate ?? template.nextDueDate,
          reviewRequired: options?.reviewRequired ?? template.reviewRequired,
        };
        setRecurringTemplates((prev) => [configured, ...prev]);
        return configured;
      },
      updateRecurringTemplate(template: RecurringTemplate) {
        setRecurringTemplates((prev) => prev.map((t) => (t.id === template.id ? template : t)));
      },
      setRecurringTemplateActive(id: string, active: boolean) {
        setRecurringTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, active } : t)));
      },
      deleteRecurringTemplate(id: string) {
        setRecurringTemplates((prev) => prev.filter((t) => t.id !== id));
      },
      materializeRecurringTransactions(throughDate: string) {
        const existingTransactionKeys = new Set(transactions.filter((t) => t.recurringTemplateId).map((t) => `${t.recurringTemplateId}:${t.date}`));
        const generatedTransactions: Transaction[] = [];
        const updatedTemplates = recurringTemplates.map((template) => {
          const result = generateRecurringTransactions({ template, throughDate, usePeriods, existingTransactionKeys });
          generatedTransactions.push(...result.transactions);
          return { ...template, nextDueDate: result.nextDueDate };
        });
        const templatesChanged = updatedTemplates.some((template, idx) => template.nextDueDate !== recurringTemplates[idx]?.nextDueDate);
        if (templatesChanged) {
          setRecurringTemplates(updatedTemplates);
        }
        if (generatedTransactions.length > 0) {
          setTransactions((prev) => {
            const existingIds = new Set(prev.map((txn) => txn.id));
            const uniqueGeneratedTransactions = generatedTransactions.filter((txn) => !existingIds.has(txn.id));
            if (uniqueGeneratedTransactions.length === 0) return prev;
            return [...uniqueGeneratedTransactions, ...prev];
          });
        }
        return generatedTransactions.length;
      },

      generateDrafts(template: RecurringTemplate, throughDate: string) {
        const drafts = generateRecurringDrafts({ template, throughDate, usePeriods });
        const existingIds = new Set(recurringDrafts.map((draft) => draft.id));
        const uniqueDrafts = drafts.filter((draft) => !existingIds.has(draft.id));
        if (uniqueDrafts.length > 0) {
          setRecurringDrafts((prev) => [...uniqueDrafts, ...prev]);
        }
        return uniqueDrafts.length;
      },
      addOrUpdateLoan(loan: Loan) {
        const normalizedLoan = normalizeLoan(loan);
        const existsBefore = loans.some((item) => item.id === normalizedLoan.id);
        setLoans((prev) => {
          const exists = prev.some((l) => l.id === normalizedLoan.id);
          if (exists) return prev.map((l) => (l.id === normalizedLoan.id ? normalizedLoan : l));
          return [normalizedLoan, ...prev];
        });
        appendActivityLog({
          action: existsBefore ? "update" : "create",
          entityType: "loan",
          entityId: normalizedLoan.id,
          propertyId: normalizedLoan.propertyId,
          unit: "Shared",
          summary: existsBefore ? "Loan updated." : "Loan created.",
          details: normalizedLoan.lender,
        });
      },
      repairLoanIdentityCollisions() {
        if (!loanIdsNeedRepair(loans)) return false;
        const repairedLoans = normalizeLoansWithUniqueIds(loans);
        setLoans(repairedLoans);
        appendActivityLog({
          action: "update",
          entityType: "loan",
          entityId: "loan-id-repair",
          unit: "Shared",
          summary: "Loan identities repaired.",
          details: "Duplicate or blank loan ids were made unique so payments can attach to the selected loan.",
        });
        return true;
      },
      updateLoanYearEndReview(loanId: string, review: LoanYearEndReview) {
        const normalizedReview = normalizeLoanYearEndReview(review);
        if (!normalizedReview) return;
        const loanRecord = loans.find((loan) => loan.id === loanId);
        setLoans((prev) =>
          prev.map((loan) => {
            if (loan.id !== loanId) return loan;
            const existingReviews = Array.isArray(loan.yearEndReviews) ? loan.yearEndReviews : [];
            const withoutYear = existingReviews.filter((item) => item.year !== normalizedReview.year);
            return normalizeLoan({
              ...loan,
              yearEndReviews: [normalizedReview, ...withoutYear].sort((left, right) => String(right.year).localeCompare(String(left.year))),
            });
          }),
        );
        appendActivityLog({
          action: "update",
          entityType: "loan",
          entityId: loanId,
          propertyId: loanRecord?.propertyId,
          unit: "Shared",
          summary: "Loan year-end review updated.",
          details: normalizedReview.year,
        });
      },
      markLoanYearReviewed(loanId: string, year: string) {
        const loanRecord = loans.find((loan) => loan.id === loanId);
        const existingReview = loanRecord?.yearEndReviews?.find((review) => review.year === year) || { year };
        const normalizedReview = normalizeLoanYearEndReview({ ...existingReview, year, reviewed: true, reviewedAt: new Date().toISOString() });
        if (!normalizedReview) return;
        setLoans((prev) =>
          prev.map((loan) => {
            if (loan.id !== loanId) return loan;
            const existingReviews = Array.isArray(loan.yearEndReviews) ? loan.yearEndReviews : [];
            const withoutYear = existingReviews.filter((item) => item.year !== year);
            return normalizeLoan({
              ...loan,
              yearEndReviews: [normalizedReview, ...withoutYear].sort((left, right) => String(right.year).localeCompare(String(left.year))),
            });
          }),
        );
        appendActivityLog({
          action: "update",
          entityType: "loan",
          entityId: loanId,
          propertyId: loanRecord?.propertyId,
          unit: "Shared",
          summary: "Loan year-end review marked complete.",
          details: year,
        });
      },
      saveLoanPayment(p: LoanPayment) {
        setLoanPayments((prev) => [p, ...prev]);
        setLoans((prev) =>
          prev.map((loan) => {
            if (loan.id !== p.loanId) return loan;
            const nextBalance = Math.max(0, loan.currentBalance - p.principal - p.extraPrincipal);
            const isSameYear = p.paymentDate.startsWith(new Date().toISOString().slice(0, 4));
            return {
              ...loan,
              currentBalance: nextBalance,
              interestYTD: isSameYear ? loan.interestYTD + p.interest : loan.interestYTD,
              principalYTD: isSameYear ? loan.principalYTD + p.principal + p.extraPrincipal : loan.principalYTD,
              escrowYTD: isSameYear ? loan.escrowYTD + p.escrow : loan.escrowYTD,
              nextPayment: addMonths(p.paymentDate, 1),
            };
          }),
        );
        const loanRecord = loans.find((loan) => loan.id === p.loanId);
        appendActivityLog({
          action: "create",
          entityType: "loan-payment",
          entityId: p.id,
          propertyId: loanRecord?.propertyId,
          unit: "Shared",
          summary: "Loan payment recorded.",
          details: "Payment date " + p.paymentDate,
        });
      },
      updateLoanPayment(updatedPayment: LoanPayment) {
        const existingPayment = loanPayments.find((payment) => payment.id === updatedPayment.id);
        if (!existingPayment) return;
        const updatedPayments = loanPayments.map((payment) => (payment.id === updatedPayment.id ? updatedPayment : payment));
        const currentYear = new Date().toISOString().slice(0, 4);
        setLoanPayments(updatedPayments);
        setLoans((prev) =>
          prev.map((loan) => {
            const touchesExistingLoan = loan.id === existingPayment.loanId;
            const touchesUpdatedLoan = loan.id === updatedPayment.loanId;
            if (!touchesExistingLoan && !touchesUpdatedLoan) return loan;

            let currentBalance = loan.currentBalance;
            let interestYTD = loan.interestYTD;
            let principalYTD = loan.principalYTD;
            let escrowYTD = loan.escrowYTD;

            if (touchesExistingLoan) {
              currentBalance += loanPaymentPrincipalImpact(existingPayment);
              interestYTD = Math.max(0, interestYTD - loanPaymentYearAmount(existingPayment, "interest", currentYear));
              principalYTD = Math.max(0, principalYTD - loanPaymentYearAmount(existingPayment, "principal", currentYear));
              escrowYTD = Math.max(0, escrowYTD - loanPaymentYearAmount(existingPayment, "escrow", currentYear));
            }

            if (touchesUpdatedLoan) {
              currentBalance = Math.max(0, currentBalance - loanPaymentPrincipalImpact(updatedPayment));
              interestYTD += loanPaymentYearAmount(updatedPayment, "interest", currentYear);
              principalYTD += loanPaymentYearAmount(updatedPayment, "principal", currentYear);
              escrowYTD += loanPaymentYearAmount(updatedPayment, "escrow", currentYear);
            }

            return {
              ...loan,
              currentBalance,
              interestYTD,
              principalYTD,
              escrowYTD,
              nextPayment: nextLoanPaymentDate(updatedPayments, loan.id, loan.nextPayment),
            };
          }),
        );
        const loanRecord = loans.find((loan) => loan.id === updatedPayment.loanId) || loans.find((loan) => loan.id === existingPayment.loanId);
        appendActivityLog({
          action: "update",
          entityType: "loan-payment",
          entityId: updatedPayment.id,
          propertyId: loanRecord?.propertyId,
          unit: "Shared",
          summary: "Loan payment updated.",
          details: "Payment date " + updatedPayment.paymentDate,
        });
      },
      deleteLoanPayment(id: string) {
        let removedPayment: LoanPayment | undefined;
        setLoanPayments((prev) => {
          removedPayment = prev.find((p) => p.id === id);
          return prev.filter((p) => p.id !== id);
        });
        if (!removedPayment) return;
        setLoans((prev) =>
          prev.map((loan) => {
            if (loan.id !== removedPayment?.loanId) return loan;
            const revertedBalance = loan.currentBalance + removedPayment.principal + removedPayment.extraPrincipal;
            const isSameYear = removedPayment.paymentDate.startsWith(new Date().toISOString().slice(0, 4));
            const latestRemainingPayment = loanPayments
              .filter((payment) => payment.loanId === removedPayment.loanId && payment.id !== removedPayment.id)
              .sort((left, right) => right.paymentDate.localeCompare(left.paymentDate))[0];
            return {
              ...loan,
              currentBalance: revertedBalance,
              interestYTD: isSameYear ? Math.max(0, loan.interestYTD - removedPayment.interest) : loan.interestYTD,
              principalYTD: isSameYear ? Math.max(0, loan.principalYTD - removedPayment.principal - removedPayment.extraPrincipal) : loan.principalYTD,
              escrowYTD: isSameYear ? Math.max(0, loan.escrowYTD - removedPayment.escrow) : loan.escrowYTD,
              nextPayment: latestRemainingPayment ? addMonths(latestRemainingPayment.paymentDate, 1) : removedPayment.paymentDate,
            };
          }),
        );
        const loanRecord = loans.find((loan) => loan.id === removedPayment.loanId);
        appendActivityLog({
          action: "delete",
          entityType: "loan-payment",
          entityId: id,
          propertyId: loanRecord?.propertyId,
          unit: "Shared",
          summary: "Loan payment deleted.",
          details: "Payment date " + removedPayment.paymentDate,
        });
      },
      updateLease(lease: Lease) {
        const normalizedLease = normalizeLease(lease);
        const existsBefore = leases.some((existing) => existing.id === normalizedLease.id);
        setLeases((prev) => {
          const exists = prev.some((existing) => existing.id === normalizedLease.id);
          if (exists) {
            return prev.map((existing) => (existing.id === normalizedLease.id ? normalizedLease : existing));
          }
          return [normalizedLease, ...prev];
        });
        appendActivityLog({
          action: existsBefore ? "update" : "create",
          entityType: "lease",
          entityId: normalizedLease.id,
          propertyId: normalizedLease.propertyId,
          unit: normalizedLease.unit,
          summary: existsBefore ? "Lease updated." : "Lease created.",
          details: normalizedLease.tenantName,
        });
      },
      deleteLease(id: string) {
        const existingLease = leases.find((lease) => lease.id === id);
        setLeases((prev) => prev.filter((lease) => lease.id !== id));
        setDocuments((prev) => prev.filter((document) => document.leaseId !== id));
        setTenantLedgerEntries((prev) => prev.filter((entry) => entry.leaseId !== id));
        appendActivityLog({
          action: "delete",
          entityType: "lease",
          entityId: id,
          propertyId: existingLease?.propertyId,
          unit: existingLease?.unit,
          summary: "Lease deleted.",
          details: existingLease?.tenantName,
        });
      },
      addOrUpdateVendor(vendor: Vendor) {
        const normalized: Vendor = {
          ...vendor,
          name: String(vendor.name || "").trim(),
          phone: formatUsPhone(vendor.phone),
          email: String(vendor.email || "").trim(),
          defaultCategory: String(vendor.defaultCategory || "").trim(),
          notes: String(vendor.notes || "").trim(),
          active: vendor.active !== false,
        };
        const existsBefore = vendors.some((item) => item.id === normalized.id);
        setVendors((prev) => {
          const exists = prev.some((item) => item.id === normalized.id);
          if (exists) return prev.map((item) => (item.id === normalized.id ? normalized : item));
          return [normalized, ...prev];
        });
        appendActivityLog({
          action: existsBefore ? "update" : "create",
          entityType: "vendor",
          entityId: normalized.id,
          summary: existsBefore ? "Vendor updated." : "Vendor created.",
          details: normalized.name,
        });
      },
      deleteVendor(id: string) {
        const existingVendor = vendors.find((vendor) => vendor.id === id);
        setVendors((prev) => prev.filter((vendor) => vendor.id !== id));
        setWorkOrders((prev) => prev.map((workOrder) => (workOrder.vendorId === id ? { ...workOrder, vendorId: "" } : workOrder)));
        appendActivityLog({
          action: "delete",
          entityType: "vendor",
          entityId: id,
          summary: "Vendor deleted.",
          details: existingVendor?.name,
        });
      },
      addOrUpdateWorkOrder(workOrder: WorkOrder) {
        const normalized: WorkOrder = normalizeWorkOrder(workOrder);

        const existsBefore = workOrders.some((item) => item.id === normalized.id);
        setWorkOrders((prev) => {
          const exists = prev.some((item) => item.id === normalized.id);
          if (exists) return prev.map((item) => (item.id === normalized.id ? normalized : item));
          return [normalized, ...prev];
        });
        appendActivityLog({
          action: existsBefore ? "update" : "create",
          entityType: "work-order",
          entityId: normalized.id,
          propertyId: normalized.propertyId,
          unit: normalized.unit,
          summary: existsBefore ? "Work order updated." : "Work order created.",
          details: normalized.title,
        });
      },
      deleteWorkOrder(id: string) {
        const existingWorkOrder = workOrders.find((workOrder) => workOrder.id === id);
        setWorkOrders((prev) => prev.filter((workOrder) => workOrder.id !== id));
        setDocuments((prev) => prev.filter((document) => document.workOrderId !== id));
        appendActivityLog({
          action: "delete",
          entityType: "work-order",
          entityId: id,
          propertyId: existingWorkOrder?.propertyId,
          unit: existingWorkOrder?.unit,
          summary: "Work order deleted.",
          details: existingWorkOrder?.title,
        });
      },
      setWorkOrderStatus(id: string, status: WorkOrderStatus) {
        const normalizedStatus = normalizeWorkOrderStatus(status);
        const existingWorkOrder = workOrders.find((workOrder) => workOrder.id === id);
        const completedToday = toLocalIsoDate();
        setWorkOrders((prev) =>
          prev.map((workOrder) => {
            if (workOrder.id !== id) return workOrder;
            return {
              ...workOrder,
              status: normalizedStatus,
              completedAt:
                normalizedStatus === "Completed"
                  ? workOrder.completedAt || completedToday
                  : normalizedStatus === "Canceled"
                    ? ""
                    : workOrder.completedAt,
            };
          }),
        );
        if (existingWorkOrder && existingWorkOrder.status !== normalizedStatus) {
          appendActivityLog({
            action: "status",
            entityType: "work-order",
            entityId: id,
            propertyId: existingWorkOrder.propertyId,
            unit: existingWorkOrder.unit,
            summary: "Work order status changed to " + normalizedStatus + ".",
            details: existingWorkOrder.title,
          });
        }
      },
      assignWorkOrderVendor(id: string, vendorId: string) {
        const existingWorkOrder = workOrders.find((workOrder) => workOrder.id === id);
        setWorkOrders((prev) => prev.map((workOrder) => (workOrder.id === id ? { ...workOrder, vendorId } : workOrder)));
        if (existingWorkOrder && String(existingWorkOrder.vendorId || "") !== String(vendorId || "")) {
          const vendorLabel = vendors.find((vendor) => vendor.id === vendorId)?.name || "Unassigned";
          appendActivityLog({
            action: "assign",
            entityType: "work-order",
            entityId: id,
            propertyId: existingWorkOrder.propertyId,
            unit: existingWorkOrder.unit,
            summary: "Work order vendor assigned.",
            details: vendorLabel,
          });
        }
      },
      updateWorkOrderAccounting(id: string, patch: Partial<Pick<WorkOrder, "accountingTreatment" | "accountingReviewed" | "accountingReviewNotes" | "tenantLedgerEntryId" | "reimbursementTransactionId">>) {
        const existingWorkOrder = workOrders.find((workOrder) => workOrder.id === id);
        setWorkOrders((prev) =>
          prev.map((workOrder) =>
            workOrder.id === id
              ? normalizeWorkOrder({
                  ...workOrder,
                  ...patch,
                })
              : workOrder,
          ),
        );
        if (existingWorkOrder) {
          appendActivityLog({
            action: "review",
            entityType: "work-order",
            entityId: id,
            propertyId: existingWorkOrder.propertyId,
            unit: existingWorkOrder.unit,
            summary: "Work order accounting review updated.",
            details: existingWorkOrder.title,
          });
        }
      },
      linkWorkOrderTransaction(id: string, transactionId: string) {
        const existingWorkOrder = workOrders.find((workOrder) => workOrder.id === id);
        setWorkOrders((prev) => prev.map((workOrder) => (workOrder.id === id ? normalizeWorkOrder({ ...workOrder, transactionId }) : workOrder)));
        if (existingWorkOrder && String(existingWorkOrder.transactionId || "") !== String(transactionId || "")) {
          appendActivityLog({
            action: "link",
            entityType: "work-order",
            entityId: id,
            propertyId: existingWorkOrder.propertyId,
            unit: existingWorkOrder.unit,
            summary: transactionId ? "Work order linked to transaction." : "Work order transaction link removed.",
            details: transactionId || existingWorkOrder.title,
          });
        }
      },
      linkWorkOrderAsset(id: string, assetId: string) {
        const existingWorkOrder = workOrders.find((workOrder) => workOrder.id === id);
        setWorkOrders((prev) => prev.map((workOrder) => (workOrder.id === id ? normalizeWorkOrder({ ...workOrder, assetId }) : workOrder)));
        if (existingWorkOrder && String(existingWorkOrder.assetId || "") !== String(assetId || "")) {
          appendActivityLog({
            action: "link",
            entityType: "work-order",
            entityId: id,
            propertyId: existingWorkOrder.propertyId,
            unit: existingWorkOrder.unit,
            summary: assetId ? "Work order linked to asset." : "Work order asset link removed.",
            details: assetId || existingWorkOrder.title,
          });
        }
      },
      markTransactionCapitalImprovement(id: string, isCapitalImprovement: boolean) {
        const existingTxn = transactions.find((txn) => txn.id === id);
        setTransactions((prev) => prev.map((txn) => (txn.id === id ? {
          ...txn,
          capitalImprovement: isCapitalImprovement,
          taxChecked: false,
          reviewOverrides: {
            ...(txn.reviewOverrides || {}),
            possible_improvement: isCapitalImprovement ? "capitalized" : "repair_confirmed",
          },
        } : txn)));
        if (existingTxn && Boolean(existingTxn.capitalImprovement) !== isCapitalImprovement) {
          appendActivityLog({
            action: "update",
            entityType: "transaction",
            entityId: id,
            propertyId: existingTxn.propertyId,
            unit: existingTxn.unit,
            summary: isCapitalImprovement ? "Transaction marked as capital improvement." : "Transaction marked as repair.",
            details: existingTxn.description,
          });
        }
      },
      addOrUpdateAsset(asset: Asset) {
        const normalized = normalizeAsset(asset);
        const existsBefore = assets.some((item) => item.id === normalized.id);
        setAssets((prev) => {
          const exists = prev.some((a) => a.id === normalized.id);
          if (exists) return prev.map((a) => (a.id === normalized.id ? normalized : a));
          return [normalized, ...prev];
        });
        if (normalized.sourceWorkOrderId) {
          setWorkOrders((prev) =>
            prev.map((workOrder) =>
              workOrder.id === normalized.sourceWorkOrderId
                ? normalizeWorkOrder({ ...workOrder, assetId: normalized.id })
                : workOrder,
            ),
          );
        }
        const sourceTransaction = normalized.sourceTransactionId
          ? transactions.find((transaction) => transaction.id === normalized.sourceTransactionId)
          : null;
        appendActivityLog({
          action: existsBefore ? "update" : "create",
          entityType: "asset",
          entityId: normalized.id,
          propertyId: normalized.propertyId,
          unit: normalized.unit,
          summary: !existsBefore && normalized.createdFrom === "transaction"
            ? "Asset created from transaction."
            : !existsBefore && normalized.createdFrom === "maintenance"
              ? "Asset created from work order."
              : existsBefore
                ? "Asset updated."
                : "Asset created.",
          details: sourceTransaction
            ? `${sourceTransaction.date} | ${sourceTransaction.description || sourceTransaction.vendor || sourceTransaction.category} | ${sourceTransaction.amount}`
            : normalized.sourceTransactionId
              ? `${normalized.description} | Source transaction ${normalized.sourceTransactionId}`
            : normalized.description,
        });
      },
      linkAssetToTransaction(assetId: string, transactionId: string) {
        const existingAsset = assets.find((asset) => asset.id === assetId);
        const sourceId = String(transactionId || "").trim();
        if (!existingAsset || !sourceId) return;
        const sourceIds = normalizeStringArray([existingAsset.sourceTransactionId, ...(existingAsset.sourceTransactionIds || []), sourceId]);
        const normalized = normalizeAsset({
          ...existingAsset,
          sourceTransactionId: existingAsset.sourceTransactionId || sourceId,
          sourceTransactionIds: sourceIds,
        });
        setAssets((prev) => prev.map((asset) => (asset.id === assetId ? normalized : asset)));
        appendActivityLog({
          action: "link",
          entityType: "asset",
          entityId: assetId,
          propertyId: existingAsset.propertyId,
          unit: existingAsset.unit,
          summary: "Asset linked to transaction.",
          details: sourceId,
        });
      },
      updateAssetReview(assetId: string, patch: Partial<Pick<Asset, "assetReviewChecked" | "assetReviewNotes">>) {
        const existingAsset = assets.find((asset) => asset.id === assetId);
        setAssets((prev) =>
          prev.map((asset) =>
            asset.id === assetId
              ? normalizeAsset({
                  ...asset,
                  assetReviewChecked: patch.assetReviewChecked ?? asset.assetReviewChecked,
                  assetReviewNotes: patch.assetReviewNotes ?? asset.assetReviewNotes,
                })
              : asset,
          ),
        );
        if (existingAsset) {
          appendActivityLog({
            action: "review",
            entityType: "asset",
            entityId: assetId,
            propertyId: existingAsset.propertyId,
            unit: existingAsset.unit,
            summary: "Asset review updated.",
            details: existingAsset.description,
          });
        }
      },
      deleteAsset(id: string) {
        const existingAsset = assets.find((asset) => asset.id === id);
        setAssets((prev) => prev.filter((asset) => asset.id !== id));
        appendActivityLog({
          action: "delete",
          entityType: "asset",
          entityId: id,
          propertyId: existingAsset?.propertyId,
          unit: existingAsset?.unit,
          summary: "Asset deleted.",
          details: existingAsset?.description,
        });
      },
      addDocument(document: DocumentItem) {
        const normalized = normalizeDocument(document);
        const existsBefore = documents.some((item) => item.id === normalized.id);
        setDocuments((prev) => [normalized, ...prev.filter((item) => item.id !== normalized.id)]);
        appendActivityLog({
          action: existsBefore ? "update" : "create",
          entityType: "document",
          entityId: normalized.id,
          propertyId: normalized.propertyId,
          unit: normalized.unit,
          summary: existsBefore ? "Document updated." : "Document added.",
          details: normalized.name,
        });
      },
      updateDocument(id: string, updates: Partial<DocumentItem>) {
        const existingDocument = documents.find((document) => document.id === id);
        setDocuments((prev) =>
          prev.map((document) => {
            if (document.id !== id) return document;
            return normalizeDocument({ ...document, ...updates, id: document.id });
          }),
        );
        const propertyId = String(updates.propertyId || existingDocument?.propertyId || "").trim() || undefined;
        const unit = String(updates.unit || existingDocument?.unit || "").trim() || undefined;
        appendActivityLog({
          action: "update",
          entityType: "document",
          entityId: id,
          propertyId,
          unit,
          summary: "Document metadata updated.",
          details: String(updates.name || existingDocument?.name || "").trim() || undefined,
        });
      },
      deleteDocument(id: string) {
        const existingDocument = documents.find((document) => document.id === id);
        setDocuments((prev) => prev.filter((document) => document.id !== id));
        appendActivityLog({
          action: "delete",
          entityType: "document",
          entityId: id,
          propertyId: existingDocument?.propertyId,
          unit: existingDocument?.unit,
          summary: "Document deleted.",
          details: existingDocument?.name,
        });
      },
      ...propertyActions,
      getUnitLinkSummary(propertyId: string, unitName: string) {
        const matches = (item: { propertyId?: string; unit?: string }) => item.propertyId === propertyId && item.unit === unitName;
        const counts = {
          transactions: transactions.filter(matches).length,
          leases: leases.filter(matches).length,
          documents: documents.filter(matches).length,
          maintenance: workOrders.filter(matches).length,
          assets: assets.filter(matches).length,
          occupancy: usePeriods.filter(matches).length,
          recurring: recurringTemplates.filter(matches).length + recurringDrafts.filter((draft) => matches(draft.transactionSeed)).length,
        };
        return { counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0) };
      },
      addUnit(propertyId: string, name: string, status: Unit["status"] = "Vacant") {
        const normalizedName = String(name || "").trim();
        if (!normalizedName || !properties.some((property) => property.id === propertyId)) return null;
        if (units.some((unit) => unit.propertyId === propertyId && unit.name.toLowerCase() === normalizedName.toLowerCase())) return null;
        const unit: Unit = { id: `u-${Date.now()}`, propertyId, name: normalizedName, status };
        setUnits((prev) => [...prev, unit]);
        appendActivityLog({
          action: "create",
          entityType: "unit",
          entityId: unit.id,
          propertyId,
          unit: unit.name,
          summary: "Unit created.",
          details: status,
        });
        return unit;
      },
      renameUnit(unitId: string, name: string) {
        const existingUnit = units.find((unit) => unit.id === unitId);
        const normalizedName = String(name || "").trim();
        if (!existingUnit || !normalizedName) return null;
        if (units.some((unit) => unit.id !== unitId && unit.propertyId === existingUnit.propertyId && unit.name.toLowerCase() === normalizedName.toLowerCase())) return null;
        const matches = (item: { propertyId?: string; unit?: string }) => item.propertyId === existingUnit.propertyId && item.unit === existingUnit.name;
        const linkedCount = transactions.filter(matches).length + leases.filter(matches).length + documents.filter(matches).length +
          workOrders.filter(matches).length + assets.filter(matches).length + usePeriods.filter(matches).length +
          recurringTemplates.filter(matches).length + recurringDrafts.filter((draft) => matches(draft.transactionSeed)).length;
        if (linkedCount > 0) return null;
        setUnits((prev) => prev.map((unit) => (unit.id === unitId ? { ...unit, name: normalizedName } : unit)));
        appendActivityLog({
          action: "update",
          entityType: "unit",
          entityId: unitId,
          propertyId: existingUnit.propertyId,
          unit: normalizedName,
          summary: "Unit renamed.",
          details: `${existingUnit.name} to ${normalizedName}`,
        });
        return { ...existingUnit, name: normalizedName };
      },
      deleteUnit(unitId: string) {
        const existingUnit = units.find((unit) => unit.id === unitId);
        if (!existingUnit) return false;
        const matches = (item: { propertyId?: string; unit?: string }) => item.propertyId === existingUnit.propertyId && item.unit === existingUnit.name;
        const linkedCount = transactions.filter(matches).length + leases.filter(matches).length + documents.filter(matches).length +
          workOrders.filter(matches).length + assets.filter(matches).length + usePeriods.filter(matches).length +
          recurringTemplates.filter(matches).length + recurringDrafts.filter((draft) => matches(draft.transactionSeed)).length;
        if (linkedCount > 0) return false;
        setUnits((prev) => prev.filter((unit) => unit.id !== unitId));
        appendActivityLog({
          action: "delete",
          entityType: "unit",
          entityId: unitId,
          propertyId: existingUnit.propertyId,
          unit: existingUnit.name,
          summary: "Unit deleted.",
        });
        return true;
      },
      updateUnitStatus(unitId: string, status: Unit["status"]) {
        const existingUnit = units.find((unit) => unit.id === unitId);
        setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, status } : u)));
        if (existingUnit && existingUnit.status !== status) {
          appendActivityLog({
            action: "status",
            entityType: "unit",
            entityId: unitId,
            propertyId: existingUnit.propertyId,
            unit: existingUnit.name,
            summary: "Unit status changed to " + status + ".",
          });
        }

        setLeases((prev) => {
          const unit = units.find((u) => u.id === unitId);
          if (!unit) return prev;

          const today = toLocalIsoDate();
          const nextYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
          const sameUnit = prev.filter((lease) => lease.propertyId === unit.propertyId && lease.unit === unit.name);
          const hasActive = sameUnit.some((lease) => lease.status === "Active");

          if (status === "Rental") {
            if (hasActive) return prev;

            const existing = sameUnit.find((lease) => lease.status !== "Ended");
            if (existing) {
              return prev.map((lease) => (lease.id === existing.id ? { ...lease, status: "Active" } : lease));
            }

            return [
              {
                id: `lease-${Date.now()}`,
                propertyId: unit.propertyId,
                unit: unit.name,
                tenantName: "New Tenant",
                startDate: today,
                endDate: nextYear,
                actualEndDate: "",
                monthlyRent: 0,
                rentalType: "Long-term",
                utilitiesIncluded: false,
                monthToMonthAfterTerm: true,
                extensionTermMonths: 0,
                status: "Active",
                notes: "Created from unit status change. Update lease details.",
              },
              ...prev,
            ];
          }

          return prev.map((lease) => {
            if (lease.propertyId === unit.propertyId && lease.unit === unit.name && lease.status === "Active") {
              return { ...lease, status: "Ended" };
            }
            return lease;
          });
        });
      },
      upsertUsePeriod(period: { id?: string; propertyId: string; unit: string; startDate: string; endDate?: string; useType: string; reviewed?: boolean; reviewedAt?: string; reviewNotes?: string }) {
        const normalized = normalizeUsePeriod({
          id: period.id || `up-${Date.now()}`,
          propertyId: period.propertyId,
          unit: period.unit,
          startDate: period.startDate,
          endDate: period.endDate || "",
          useType: period.useType,
          rentalUsePct: period.useType === "Owner-Occupied" || period.useType === "Vacant" ? 0 : 1,
          reviewed: period.reviewed,
          reviewedAt: period.reviewedAt,
          reviewNotes: period.reviewNotes,
        });
        const existsBefore = usePeriods.some((item) => item.id === normalized.id);
        setUsePeriods((prev) => {
          const exists = prev.some((item) => item.id === normalized.id);
          if (exists) {
            return prev.map((item) => (item.id === normalized.id ? normalized : item));
          }
          return [normalized, ...prev];
        });
        appendActivityLog({
          action: existsBefore ? "update" : "create",
          entityType: "use-period",
          entityId: normalized.id,
          propertyId: normalized.propertyId,
          unit: normalized.unit,
          summary: existsBefore ? "Use period updated." : "Use period created.",
          details: normalized.useType,
        });
      },
      deleteUsePeriod(id: string) {
        const existingPeriod = usePeriods.find((item) => item.id === id);
        setUsePeriods((prev) => prev.filter((item) => item.id !== id));
        appendActivityLog({
          action: "delete",
          entityType: "use-period",
          entityId: id,
          propertyId: existingPeriod?.propertyId,
          unit: existingPeriod?.unit,
          summary: "Use period deleted.",
          details: existingPeriod?.useType,
        });
      },
      updateUsePeriodReview(id: string, patch: Partial<Pick<UsePeriod, "reviewed" | "reviewedAt" | "reviewNotes">>) {
        const existingPeriod = usePeriods.find((item) => item.id === id);
        const reviewed = patch.reviewed ?? existingPeriod?.reviewed ?? false;
        setUsePeriods((prev) =>
          prev.map((period) =>
            period.id === id
              ? normalizeUsePeriod({
                  ...period,
                  reviewed,
                  reviewedAt: patch.reviewedAt ?? (reviewed ? (period.reviewedAt || new Date().toISOString()) : ""),
                  reviewNotes: patch.reviewNotes ?? period.reviewNotes,
                })
              : period,
          ),
        );
        if (existingPeriod) {
          appendActivityLog({
            action: "review",
            entityType: "use-period",
            entityId: id,
            propertyId: existingPeriod.propertyId,
            unit: existingPeriod.unit,
            summary: reviewed ? "Occupancy period reviewed." : "Occupancy period review reopened.",
            details: existingPeriod.useType,
          });
        }
      },
      addOrUpdateTenantLedgerEntry(entry: TenantLedgerEntry) {
        const normalized = normalizeTenantLedgerEntry(entry);
        if (!normalized.leaseId) return;
        const existsBefore = tenantLedgerEntries.some((item) => item.id === normalized.id);
        const linkedLease = leases.find((lease) => lease.id === normalized.leaseId);
        setTenantLedgerEntries((prev) => {
          const exists = prev.some((item) => item.id === normalized.id);
          if (exists) return prev.map((item) => (item.id === normalized.id ? normalized : item));
          return [normalized, ...prev];
        });
        appendActivityLog({
          action: existsBefore ? "update" : "create",
          entityType: "tenant-ledger",
          entityId: normalized.id,
          propertyId: linkedLease?.propertyId,
          unit: linkedLease?.unit,
          summary: existsBefore ? "Tenant ledger entry updated." : "Tenant ledger entry created.",
          details: normalized.memo,
        });
      },
      deleteTenantLedgerEntry(id: string) {
        const existingEntry = tenantLedgerEntries.find((entry) => entry.id === id);
        const linkedLease = leases.find((lease) => lease.id === existingEntry?.leaseId);
        setTenantLedgerEntries((prev) => prev.filter((entry) => entry.id !== id));
        appendActivityLog({
          action: "delete",
          entityType: "tenant-ledger",
          entityId: id,
          propertyId: linkedLease?.propertyId,
          unit: linkedLease?.unit,
          summary: "Tenant ledger entry deleted.",
          details: existingEntry?.memo,
        });
      },
      syncLeaseStatuses(asOfDate: string) {
        setLeases((prev) => {
          let changed = false;
          const next = prev.map((lease) => {
            const shouldEnd = leaseIsEndedByDate(lease, asOfDate);
            if (shouldEnd && lease.status !== "Ended") {
              changed = true;
              return { ...lease, status: "Ended" };
            }
            if (!shouldEnd && lease.status === "Ended" && lease.startDate <= asOfDate) {
              changed = true;
              return { ...lease, status: "Active" };
            }
            return lease;
          });
          return changed ? next : prev;
        });

        setUnits((prevUnits) => {
          const activeLeaseKeys = new Set(
            leases
              .filter((lease) => !leaseIsEndedByDate(lease, asOfDate) && lease.startDate <= asOfDate)
              .map((lease) => `${lease.propertyId}:${lease.unit}`),
          );
          const ownerOccupiedKeys = new Set(
            usePeriods
              .filter(
                (period) =>
                  period.useType === "Owner-Occupied" &&
                  period.startDate <= asOfDate &&
                  (!period.endDate || period.endDate >= asOfDate),
              )
              .map((period) => `${period.propertyId}:${period.unit}`),
          );

          let changed = false;
          const nextUnits = prevUnits.map((unit) => {
            const unitKey = `${unit.propertyId}:${unit.name}`;
            const hasActiveLease = activeLeaseKeys.has(unitKey);
            const isOwnerOccupied = ownerOccupiedKeys.has(unitKey);
            if (hasActiveLease && unit.status !== "Rental") {
              changed = true;
              return { ...unit, status: "Rental" };
            }
            if (!hasActiveLease && isOwnerOccupied && unit.status !== "Owner-Occupied") {
              changed = true;
              return { ...unit, status: "Owner-Occupied" };
            }
            if (!hasActiveLease && !isOwnerOccupied && unit.status !== "Vacant") {
              changed = true;
              return { ...unit, status: "Vacant" };
            }
            return unit;
          });
          return changed ? nextUnits : prevUnits;
        });
      },
      computeTransactionPreview(args: { amount: number; type: Transaction["type"]; capitalImprovement: boolean; propertyId: string; unit: string; date: string; ownerUsePct: number; ownerUsePctOverride?: boolean; servicePeriodStart?: string; servicePeriodEnd?: string }) {
        const hasServiceRange =
          String(args.servicePeriodStart || "").trim() &&
          String(args.servicePeriodEnd || "").trim() &&
          String(args.servicePeriodEnd || "") >= String(args.servicePeriodStart || "");
        const rentalUsePct = hasServiceRange
          ? getRentalUsePctForRange({
              propertyId: args.propertyId,
              unit: args.unit,
              startDate: String(args.servicePeriodStart || ""),
              endDate: String(args.servicePeriodEnd || ""),
              usePeriods,
              leases,
              units,
              fallbackOwnerUsePct: args.ownerUsePct,
              ownerUsePctOverride: Boolean(args.ownerUsePctOverride),
            })
          : getRentalUsePctForDate({
              propertyId: args.propertyId,
              unit: args.unit,
              date: args.date,
              usePeriods,
              leases,
              units,
              fallbackOwnerUsePct: args.ownerUsePct,
              ownerUsePctOverride: Boolean(args.ownerUsePctOverride),
            });
        return {
          rentalUsePct,
          deductibleAmount: deductibleAmountForTransaction({ amount: args.amount, type: args.type, capitalImprovement: args.capitalImprovement, rentalUsePct }),
        };
      },
      updateTenantLedgerEntryReview(id: string, patch: Partial<Pick<TenantLedgerEntry, "reviewed" | "reviewedAt" | "reviewNotes" | "linkedWorkOrderId" | "linkedDocumentIds">>) {
        const existingEntry = tenantLedgerEntries.find((entry) => entry.id === id);
        const linkedLease = leases.find((lease) => lease.id === existingEntry?.leaseId);
        const reviewed = patch.reviewed ?? existingEntry?.reviewed ?? false;
        setTenantLedgerEntries((prev) =>
          prev.map((entry) =>
            entry.id === id
              ? normalizeTenantLedgerEntry({
                  ...entry,
                  reviewed,
                  reviewedAt: patch.reviewedAt ?? (reviewed ? (entry.reviewedAt || new Date().toISOString()) : ""),
                  reviewNotes: patch.reviewNotes ?? entry.reviewNotes,
                  linkedWorkOrderId: patch.linkedWorkOrderId ?? entry.linkedWorkOrderId,
                  linkedDocumentIds: patch.linkedDocumentIds ?? entry.linkedDocumentIds,
                })
              : entry,
          ),
        );
        if (existingEntry) {
          appendActivityLog({
            action: "review",
            entityType: "tenant-ledger",
            entityId: id,
            propertyId: linkedLease?.propertyId,
            unit: linkedLease?.unit,
            summary: reviewed ? "Tenant ledger entry reviewed." : "Tenant ledger entry review reopened.",
            details: existingEntry.memo,
          });
        }
      },
    }),
    [activityActions, assets, documents, leases, propertyActions, recurringDrafts, recurringTemplates, tenantLedgerEntries, transactions, usePeriods, units, loans, properties, vendors, workOrders],
  );

  return { transactions, assets, documents, leases, tenantLedgerEntries, vendors, workOrders, loans, loanPayments, usePeriods, recurringTemplates, recurringDrafts, properties, units, activityLog, actions };
}
