import { recommendedTenantLedgerAccountingTreatment } from "../domain/tenantLedgerPosting.ts";
import { toLocalIsoDate } from "../lib/localDate.ts";

export function createBlankForm(propertyId = "", unit = "Shared") {
  return {
    date: toLocalIsoDate(),
    propertyId,
    unit,
    type: "Expense",
    category: "Utilities",
    description: "",
    amount: "",
    ownerUsePct: "0",
    ownerUsePctOverride: false,
    paidFrom: "Duplex bank",
    paymentMethod: "ACH",
    capitalImprovement: "No",
    vendor: "",
    receiptName: "",
    notes: "",
    taxChecked: "No",
    invoiceRef: "",
    invoiceAmount: "",
    mileageMiles: "",
    mileageRate: "",
    mobileCompanionMileageId: "",
    servicePeriodStart: "",
    servicePeriodEnd: "",
    rentPeriod: "",
    rentLeaseId: "",
    workOrderId: "",
    deMinimisTreatment: "auto",
    recurringMonthly: "No",
  };
}

export function createBlankVendorDraft() {
  return {
    name: "",
    aliases: "",
    phone: "",
    email: "",
    defaultCategory: "Repairs",
    notes: "",
  };
}

export function createBlankDocumentImportDraft(propertyId = "", unit = "Shared") {
  return {
    name: "",
    type: "Scanned PDF",
    propertyId,
    unit,
    unitScopeOverride: false,
    linkType: "none",
    linkedId: "",
    tags: "",
    extractedText: "",
    ocrStatus: "pending",
    mimeType: "",
    dataUrl: "",
    sourceRef: null,
  };
}

export function createBlankWorkOrderDraft(propertyId = "", unit = "Shared") {
  return {
    propertyId,
    unit,
    title: "",
    description: "",
    priority: "Medium",
    status: "Open",
    reportedOn: toLocalIsoDate(),
    dueDate: "",
    vendorId: "",
    estimatedCost: "",
    actualCost: "",
    accountingTreatment: "needs_review",
    accountingReviewed: false,
    accountingReviewNotes: "",
    notes: "",
  };
}

export function createBlankTenantLedgerDraft(dateIso = toLocalIsoDate(), defaultAmount = "") {
  const defaultKind = "charge";
  return {
    date: dateIso,
    kind: defaultKind,
    accountingTreatment: recommendedTenantLedgerAccountingTreatment(defaultKind),
    amount: defaultAmount,
    memo: "",
    automationKey: "",
  };
}
