export type TxType = "Income" | "Expense" | "Transfer" | "Owner Contribution" | "Owner Draw";
export type UnitScope = "Shared" | string;
export type Frequency = "Weekly" | "Monthly" | "Quarterly" | "Yearly";

export type Property = {
  id: string;
  name: string;
  address: string;
  type: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  purchasedOn?: string;
  purchasePrice?: number;
  landValue?: number;
  currentValue?: number;
  propertyValuations?: PropertyValuation[];
  operationNotes?: PropertyOperationNote[];
  photos?: PropertyPhoto[];
  archivedAt?: string;
};

export type PropertyPhoto = {
  id: string;
  name: string;
  dataUrl: string;
  uploadedAt: string;
  isCover?: boolean;
  caption?: string;
  category?: string;
  capturedOn?: string;
  unit?: UnitScope;
};

export type PropertyWithPurchaseMeta = Property & {
  purchasedOn: string;
  purchasePrice: number;
};

export type PropertyWithCostBasis = PropertyWithPurchaseMeta & {
  landValue: number;
};

export type PropertyCostBasisResult =
  | {
      ok: true;
      property: PropertyWithCostBasis;
      purchasePrice: number;
      landValue: number;
      buildingBasis: number;
    }
  | {
      ok: false;
      missing: Array<"purchasedOn" | "purchasePrice" | "landValue" | "buildingBasis">;
    };

function hasPositiveFiniteNumber(value: unknown) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

export function hasPurchaseMeta(property: Property): property is PropertyWithPurchaseMeta {
  return Boolean(String(property.purchasedOn || "").trim()) && hasPositiveFiniteNumber(property.purchasePrice);
}

export function hasCostBasis(property: Property): property is PropertyWithCostBasis {
  return hasPurchaseMeta(property) && Number.isFinite(Number(property.landValue)) && Number(property.landValue) >= 0 && Number(property.purchasePrice) > Number(property.landValue);
}

export function getPropertyCostBasis(property: Property): PropertyCostBasisResult {
  const missing: Array<"purchasedOn" | "purchasePrice" | "landValue" | "buildingBasis"> = [];
  const purchasePrice = Number(property.purchasePrice);
  const landValue = Number(property.landValue);

  if (!String(property.purchasedOn || "").trim()) missing.push("purchasedOn");
  if (!hasPositiveFiniteNumber(purchasePrice)) missing.push("purchasePrice");
  if (!Number.isFinite(landValue) || landValue < 0) missing.push("landValue");
  if (Number.isFinite(purchasePrice) && Number.isFinite(landValue) && purchasePrice <= landValue) missing.push("buildingBasis");

  if (missing.length > 0 || !hasCostBasis(property)) {
    return { ok: false, missing: Array.from(new Set(missing)) };
  }

  return {
    ok: true,
    property,
    purchasePrice,
    landValue,
    buildingBasis: purchasePrice - landValue,
  };
}

export function assertHasCostBasis(property: Property): asserts property is PropertyWithCostBasis {
  const result = getPropertyCostBasis(property);
  if (!result.ok) {
    throw new Error(`Property is missing cost-basis fields: ${result.missing.join(", ")}`);
  }
}

export type PropertyOperationNote = {
  id: string;
  title: string;
  category: string;
  unit: UnitScope;
  body: string;
  sensitive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PropertyValuation = {
  id: string;
  date: string;
  value: number;
  source: string;
  documentId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type Unit = {
  id: string;
  propertyId: string;
  name: string;
  status: "Rental" | "Owner-Occupied" | "Vacant";
};

export type Transaction = {
  id: string;
  date: string;
  propertyId: string;
  unit: UnitScope;
  type: TxType;
  category: string;
  description: string;
  amount: number;
  ownerUsePct: number;
  ownerUsePctOverride?: boolean;
  rentalUsePct: number;
  deductibleAmount: number;
  paidFrom: string;
  paymentMethod: string;
  reimbursable: boolean;
  reimbursed: boolean;
  capitalImprovement: boolean;
  vendor: string;
  receiptName: string;
  notes: string;
  taxChecked: boolean;
  reconciled?: boolean;
  invoiceRef?: string;
  invoiceAmount?: number;
  mileageMiles?: number;
  mileageRate?: number;
  servicePeriodStart?: string;
  servicePeriodEnd?: string;
  rentPeriod?: string;
  rentLeaseId?: string;
  deMinimisTreatment?: "auto" | "yes" | "no";
  deMinimisCandidate?: boolean;
  deMinimisApplied?: boolean;
  deMinimisReason?: string;
  reviewOverrides?: {
    possible_improvement?: "repair_confirmed" | "capitalized" | "ignore";
    de_minimis_review?: "reviewed";
    missing_receipt?: "not_available";
  };
  recurringTemplateId?: string;
  bankImportId?: string;
  workOrderId?: string;
  tenantLedgerEntryId?: string;
  status: "active" | "voided";
};

export type UsePeriod = {
  id: string;
  propertyId: string;
  unit: UnitScope;
  startDate: string;
  endDate?: string;
  useType: string;
  rentalUsePct: number;
  reviewed?: boolean;
  reviewedAt?: string;
  reviewNotes?: string;
};

export type RecurringTemplate = {
  id: string;
  description: string;
  propertyId: string;
  unit: UnitScope;
  type: TxType;
  category: string;
  amount: number;
  frequency: Frequency;
  nextDueDate: string;
  reviewRequired: boolean;
  ownerUsePct: number;
  ownerUsePctOverride?: boolean;
  active: boolean;
};

export type RecurringDraft = {
  id: string;
  templateId: string;
  dueDate: string;
  status: "draft" | "approved";
  transactionSeed: Omit<Transaction, "id" | "status">;
};

export type LoanType = "Primary Mortgage" | "Second Mortgage" | "HELOC" | "Down Payment Loan" | "Other";

export type LoanYearEndReview = {
  year: string;
  form1098Received?: boolean;
  form1098Interest?: number;
  form1098MortgageInsurance?: number;
  form1098Points?: number;
  form1098PropertyTaxPaid?: number;
  form1098InsurancePaid?: number;
  escrowPropertyTaxPaid?: number;
  escrowInsurancePaid?: number;
  escrowOtherPaid?: number;
  deductibleInterestOverride?: number;
  pmiOverride?: number;
  reviewNotes?: string;
  reviewed?: boolean;
  reviewedAt?: string;
};

export type Loan = {
  id: string;
  propertyId: string;
  lender: string;
  loanType: LoanType;
  lienPosition: number;
  originatedOn: string;
  rate: number;
  originalBalance: number;
  currentBalance: number;
  scheduledPI: number;
  scheduledEscrow: number;
  scheduledMortgageInsurance: number;
  defaultExtraPrincipal: number;
  interestYTD: number;
  principalYTD: number;
  escrowYTD: number;
  nextPayment: string;
  yearEndReviews?: LoanYearEndReview[];
};

export type LoanPayment = {
  id: string;
  loanId: string;
  paymentDate: string;
  scheduledPI: number;
  interest: number;
  principal: number;
  escrow: number;
  mortgageInsurance: number;
  extraPrincipal: number;
  totalPayment: number;
  deductibleInterest: number;
};

export type Asset = {
  id: string;
  propertyId: string;
  unit: UnitScope;
  description: string;
  type: string;
  placedInService: string;
  cost: number;
  basis: number;
  life: number;
  currentYearDep: number;
  landValue?: number;
  bonusEligible?: boolean;
  bonusElected?: boolean;
  bonusRate?: number;
  sourceTransactionId?: string;
  sourceTransactionIds?: string[];
  sourceWorkOrderId?: string;
  sourceDocumentIds?: string[];
  assetReviewChecked?: boolean;
  assetReviewNotes?: string;
  createdFrom?: "manual" | "transaction" | "document" | "maintenance";
};

export type Lease = {
  id: string;
  propertyId: string;
  unit: UnitScope;
  tenantName: string;
  startDate: string;
  endDate: string;
  actualEndDate?: string;
  monthlyRent: number;
  securityDeposit?: number;
  rentalType: "Long-term" | "Mid-term" | "Short-term";
  utilitiesIncluded: boolean;
  monthToMonthAfterTerm: boolean;
  extensionTermMonths: number;
  status: "Active" | "Pending Renewal" | "Ended";
  notes: string;
  rentDueDay?: number;
  reminderDaysBefore?: number;
  lateFeeGraceDays?: number;
  lateFeeType?: "flat" | "percent";
  lateFeeValue?: number;
  autoLateFeeEnabled?: boolean;
};
export type TenantLedgerEntryKind = "charge" | "payment" | "credit" | "refund" | "adjustment";
export type TenantLedgerAccountingTreatment =
  | "none"
  | "rent_income"
  | "other_income"
  | "security_deposit_liability"
  | "security_deposit_applied_damages"
  | "security_deposit_return"
  | "repairs_expense";

export type TenantLedgerEntry = {
  id: string;
  leaseId: string;
  date: string;
  kind: TenantLedgerEntryKind;
  amount: number;
  memo: string;
  accountingTreatment?: TenantLedgerAccountingTreatment;
  transactionId?: string;
  reviewed?: boolean;
  reviewedAt?: string;
  reviewNotes?: string;
  linkedWorkOrderId?: string;
  linkedDocumentIds?: string[];
  automationKey?: string;
  createdAt: string;
};
export type WorkOrderPriority = "Low" | "Medium" | "High" | "Urgent";
export type WorkOrderStatus = "Open" | "In Progress" | "Waiting on Parts" | "Completed" | "Closed" | "Canceled";
export type MaintenanceAccountingTreatment =
  | "needs_review"
  | "repair_maintenance"
  | "cleaning_turnover"
  | "supplies"
  | "capital_improvement"
  | "tenant_damage"
  | "owner_only"
  | "non_deductible"
  | "warranty_repair"
  | "reimbursed";

export type Vendor = {
  id: string;
  name: string;
  aliases?: string[];
  phone?: string;
  email?: string;
  defaultCategory?: string;
  notes?: string;
  active: boolean;
};

export type WorkOrder = {
  id: string;
  propertyId: string;
  unit: UnitScope;
  title: string;
  description: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  reportedOn: string;
  dueDate?: string;
  vendorId?: string;
  estimatedCost?: number;
  actualCost?: number;
  transactionId?: string;
  accountingTreatment?: MaintenanceAccountingTreatment;
  accountingReviewed?: boolean;
  accountingReviewNotes?: string;
  sourceDocumentIds?: string[];
  assetId?: string;
  tenantLedgerEntryId?: string;
  reimbursementTransactionId?: string;
  createdAt: string;
  completedAt?: string;
  notes?: string;
};
export type DocumentOcrStatus = "not_needed" | "pending" | "completed";
export type ActivityCategory =
  | "record"
  | "workflow"
  | "document"
  | "maintenance"
  | "reporting"
  | "data"
  | "settings"
  | "security";
export type ActivityLogEntry = {
  id: string;
  at: string;
  actor: string;
  actorRole?: string;
  action: string;
  category?: ActivityCategory;
  entityType: string;
  entityId: string;
  propertyId?: string;
  unit?: UnitScope;
  summary: string;
  details?: string;
  immutable: true;
};
export type DocumentAiSuggestedAction =
  | "create_expense_draft"
  | "create_work_order_draft"
  | "attach_to_lease"
  | "supporting_doc"
  | "review_only";
export type DocumentAiAnalysis = {
  summary: string;
  actionItems?: string[];
  suggestedAction?: DocumentAiSuggestedAction;
  suggestedActionReason?: string;
  documentType?: string;
  vendorName?: string;
  invoiceRef?: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount?: number;
  propertyAddress?: string;
  unit?: UnitScope;
  serviceSummary?: string;
  model?: string;
  analyzedAt?: string;
};
export type DocumentItem = {
  id: string;
  propertyId: string;
  name: string;
  type: string;
  leaseId?: string;
  transactionId?: string;
  relatedTransactionIds?: string[];
  workOrderId?: string;
  unit?: UnitScope;
  unitScopeOverride?: boolean;
  uploadedAt?: string;
  expiresOn?: string;
  mimeType?: string;
  dataUrl?: string;
  tags?: string[];
  extractedText?: string;
  ocrFieldOverrides?: {
    vendorName?: string;
    totalAmount?: number;
    servicePeriodStart?: string;
    servicePeriodEnd?: string;
  };
  ocrStatus?: DocumentOcrStatus;
  reviewedWarningKeys?: string[];
  reviewedWarningsAt?: string;
  expenseReviewDismissedAt?: string;
  workOrderReviewDismissedAt?: string;
  aiAnalysis?: DocumentAiAnalysis;
  sourceRef?: {
    provider: "rental-tracker-companion";
    submissionId: string;
    sha256?: string;
    capturedAt?: string;
    propertyLabel?: string;
    unitLabel?: string;
    note?: string;
  };
};
