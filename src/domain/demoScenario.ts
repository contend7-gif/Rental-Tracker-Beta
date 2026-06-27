import type { Asset, DocumentItem, Lease, Loan, LoanPayment, Property, RecurringDraft, RecurringTemplate, TenantLedgerEntry, Transaction, Unit, UsePeriod, Vendor, WorkOrder } from "../models.ts";

export type DemoScenarioState = {
  transactions: Transaction[];
  assets: Asset[];
  documents: DocumentItem[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  usePeriods: UsePeriod[];
  recurringTemplates: RecurringTemplate[];
  recurringDrafts: RecurringDraft[];
  tenantLedgerEntries: TenantLedgerEntry[];
  activityLog: [];
  leases: Lease[];
  vendors: Vendor[];
  workOrders: WorkOrder[];
  properties: Property[];
  units: Unit[];
};

const YEAR = "2026";

function iso(month: number, day = 1) {
  return `${YEAR}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthlyLoanPayments(): LoanPayment[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const interest = 925 - index * 8;
    const principal = 675 + index * 8;
    return {
      id: `demo-lp-${month}`,
      loanId: "demo-loan-1",
      paymentDate: iso(month),
      scheduledPI: 1600,
      interest,
      principal,
      escrow: 350,
      mortgageInsurance: 0,
      extraPrincipal: month === 6 ? 100 : 0,
      totalPayment: 1950 + (month === 6 ? 100 : 0),
      deductibleInterest: interest,
    };
  });
}

function monthlyRentTransactions(): Transaction[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return {
      id: `demo-rent-${month}`,
      date: iso(month, 5),
      propertyId: "demo-property-1",
      unit: "Unit B",
      type: "Income",
      category: "Rent",
      description: `Sample rent payment ${String(month).padStart(2, "0")}`,
      amount: 1450,
      ownerUsePct: 0,
      rentalUsePct: 100,
      deductibleAmount: 1450,
      paidFrom: "Operating account",
      paymentMethod: "ACH",
      reimbursable: false,
      reimbursed: false,
      capitalImprovement: false,
      vendor: "Tenant Beta",
      receiptName: "",
      notes: "",
      taxChecked: true,
      reconciled: true,
      tenantLedgerEntryId: month === 1 ? "demo-ledger-payment-jan" : undefined,
      status: "active",
    };
  });
}

export function createFullYearDemoScenario(): DemoScenarioState {
  const loanPayments = monthlyLoanPayments();
  const rentTransactions = monthlyRentTransactions();
  const totalInterest = loanPayments.reduce((sum, payment) => sum + payment.interest, 0);

  const properties: Property[] = [{
    id: "demo-property-1",
    name: "Sample Duplex",
    address: "100 Example Street",
    type: "Duplex",
    ownerName: "Example Rental Owner",
    ownerEmail: "owner@example.com",
    ownerPhone: "(555) 010-1200",
    purchasedOn: "2024-01-15",
    purchasePrice: 360000,
    landValue: 70000,
    currentValue: 385000,
  }];

  const units: Unit[] = [
    { id: "demo-unit-a", propertyId: "demo-property-1", name: "Unit A", status: "Owner-Occupied" },
    { id: "demo-unit-b", propertyId: "demo-property-1", name: "Unit B", status: "Rental" },
  ];

  const leases: Lease[] = [{
    id: "demo-lease-b",
    propertyId: "demo-property-1",
    unit: "Unit B",
    tenantName: "Tenant Beta",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    monthlyRent: 1450,
    securityDeposit: 1450,
    rentalType: "Long-term",
    utilitiesIncluded: false,
    monthToMonthAfterTerm: false,
    extensionTermMonths: 0,
    status: "Active",
    notes: "Fictional demo lease.",
    rentDueDay: 5,
  }];

  const usePeriods: UsePeriod[] = [
    { id: "demo-use-a-owner", propertyId: "demo-property-1", unit: "Unit A", startDate: "2026-01-01", endDate: "2026-12-31", useType: "Owner-Occupied", rentalUsePct: 0, reviewed: true, reviewedAt: "2026-12-31T12:00:00.000Z", reviewNotes: "Demo owner-occupied unit." },
    { id: "demo-use-b-rental", propertyId: "demo-property-1", unit: "Unit B", startDate: "2026-01-01", endDate: "2026-12-31", useType: "Rental", rentalUsePct: 100, reviewed: true, reviewedAt: "2026-12-31T12:00:00.000Z", reviewNotes: "Demo rental unit." },
  ];

  const transactions: Transaction[] = [
    ...rentTransactions,
    {
      id: "demo-utility-electric",
      date: "2026-03-20",
      propertyId: "demo-property-1",
      unit: "Shared",
      type: "Expense",
      category: "Utilities",
      description: "Sample Utilities shared electric service",
      amount: 240,
      ownerUsePct: 50,
      rentalUsePct: 50,
      deductibleAmount: 120,
      paidFrom: "Operating account",
      paymentMethod: "ACH",
      reimbursable: false,
      reimbursed: false,
      capitalImprovement: false,
      vendor: "Sample Utilities",
      receiptName: "sample-utilities-receipt.pdf",
      notes: "",
      taxChecked: true,
      reconciled: true,
      servicePeriodStart: "2026-02-15",
      servicePeriodEnd: "2026-03-14",
      status: "active",
    },
    {
      id: "demo-repair-expense",
      date: "2026-04-12",
      propertyId: "demo-property-1",
      unit: "Unit B",
      type: "Expense",
      category: "Repairs",
      description: "Example Plumbing Co. sink repair",
      amount: 385,
      ownerUsePct: 0,
      rentalUsePct: 100,
      deductibleAmount: 385,
      paidFrom: "Operating account",
      paymentMethod: "Card",
      reimbursable: false,
      reimbursed: false,
      capitalImprovement: false,
      vendor: "Example Plumbing Co.",
      receiptName: "example-plumbing-receipt.pdf",
      notes: "",
      taxChecked: true,
      reconciled: true,
      workOrderId: "demo-workorder-repair",
      status: "active",
    },
    {
      id: "demo-capital-roof",
      date: "2026-06-18",
      propertyId: "demo-property-1",
      unit: "Shared",
      type: "Expense",
      category: "Repairs",
      description: "Example Hardware roof upgrade materials",
      amount: 6200,
      ownerUsePct: 50,
      rentalUsePct: 50,
      deductibleAmount: 0,
      paidFrom: "Operating account",
      paymentMethod: "Card",
      reimbursable: false,
      reimbursed: false,
      capitalImprovement: true,
      vendor: "Example Hardware",
      receiptName: "example-hardware-roof.pdf",
      notes: "Capitalized in demo assets.",
      taxChecked: true,
      reconciled: true,
      reviewOverrides: { possible_improvement: "capitalized" },
      status: "active",
    },
  ];

  const assets: Asset[] = [
    {
      id: "demo-building-asset",
      propertyId: "demo-property-1",
      unit: "Shared",
      description: "Sample Duplex building basis",
      type: "Residential Building",
      placedInService: "2024-01-15",
      cost: 360000,
      basis: 290000,
      life: 27.5,
      currentYearDep: 10545.45,
      landValue: 70000,
      bonusEligible: false,
      bonusElected: false,
      bonusRate: 0,
      assetReviewChecked: true,
      assetReviewNotes: "Fictional opening basis for demo validation.",
      createdFrom: "manual",
    },
    {
      id: "demo-roof-asset",
      propertyId: "demo-property-1",
      unit: "Shared",
      description: "Roof upgrade",
      type: "Capital Improvement",
      placedInService: "2026-06-18",
      cost: 6200,
      basis: 6200,
      life: 27.5,
      currentYearDep: 112.73,
      bonusEligible: false,
      bonusElected: false,
      bonusRate: 0,
      sourceTransactionId: "demo-capital-roof",
      sourceDocumentIds: ["demo-doc-roof"],
      assetReviewChecked: true,
      assetReviewNotes: "Reviewed as capital improvement in demo scenario.",
      createdFrom: "transaction",
    },
  ];

  const loans: Loan[] = [{
    id: "demo-loan-1",
    propertyId: "demo-property-1",
    lender: "Example Bank",
    loanType: "Primary Mortgage",
    lienPosition: 1,
    originatedOn: "2024-01-15",
    rate: 5.75,
    originalBalance: 288000,
    currentBalance: 279500,
    scheduledPI: 1600,
    scheduledEscrow: 350,
    scheduledMortgageInsurance: 0,
    defaultExtraPrincipal: 0,
    interestYTD: totalInterest,
    principalYTD: loanPayments.reduce((sum, payment) => sum + payment.principal, 0),
    escrowYTD: loanPayments.reduce((sum, payment) => sum + payment.escrow, 0),
    nextPayment: "2027-01-01",
    yearEndReviews: [{
      year: YEAR,
      form1098Received: true,
      form1098Interest: totalInterest,
      escrowPropertyTaxPaid: 2100,
      escrowInsurancePaid: 1350,
      escrowOtherPaid: 750,
      reviewNotes: "Fictional 1098 and escrow allocation for demo validation.",
      reviewed: true,
      reviewedAt: "2026-12-31T12:00:00.000Z",
    }],
  }];

  const documents: DocumentItem[] = [
    { id: "demo-doc-utility", propertyId: "demo-property-1", unit: "Shared", name: "Sample Utilities receipt", type: "Receipt", transactionId: "demo-utility-electric", uploadedAt: "2026-03-20T12:00:00.000Z", mimeType: "application/pdf", tags: ["utility", "receipt"], extractedText: "Sample Utilities receipt for 100 Example Street. Amount 240.00.", ocrStatus: "completed" },
    { id: "demo-doc-repair", propertyId: "demo-property-1", unit: "Unit B", name: "Example Plumbing receipt", type: "Receipt", transactionId: "demo-repair-expense", workOrderId: "demo-workorder-repair", uploadedAt: "2026-04-12T12:00:00.000Z", mimeType: "application/pdf", tags: ["repair", "receipt"], extractedText: "Example Plumbing Co. sink repair. Amount 385.00.", ocrStatus: "completed" },
    { id: "demo-doc-roof", propertyId: "demo-property-1", unit: "Shared", name: "Example Hardware roof receipt", type: "Receipt", transactionId: "demo-capital-roof", uploadedAt: "2026-06-18T12:00:00.000Z", mimeType: "application/pdf", tags: ["capital-improvement", "receipt"], extractedText: "Example Hardware roof upgrade materials. Amount 6200.00.", ocrStatus: "completed" },
    { id: "demo-doc-loan-1098", propertyId: "demo-property-1", unit: "Shared", name: "Example Bank 1098 statement", type: "Mortgage statement", uploadedAt: "2026-12-31T12:00:00.000Z", mimeType: "application/pdf", tags: ["1098", "loan", "supporting-only"], extractedText: "Example Bank 1098 statement for Sample Duplex. Interest matches demo loan review.", ocrStatus: "completed" },
  ];

  const workOrders: WorkOrder[] = [{
    id: "demo-workorder-repair",
    propertyId: "demo-property-1",
    unit: "Unit B",
    title: "Sink repair",
    description: "Fictional sink repair for demo workflow validation.",
    priority: "Medium",
    status: "Completed",
    reportedOn: "2026-04-10",
    dueDate: "2026-04-12",
    vendorId: "demo-vendor-plumbing",
    estimatedCost: 400,
    actualCost: 385,
    transactionId: "demo-repair-expense",
    accountingTreatment: "repair_maintenance",
    accountingReviewed: true,
    accountingReviewNotes: "Linked repair expense and receipt.",
    sourceDocumentIds: ["demo-doc-repair"],
    createdAt: "2026-04-10T12:00:00.000Z",
    completedAt: "2026-04-12T12:00:00.000Z",
  }];

  const tenantLedgerEntries: TenantLedgerEntry[] = [
    { id: "demo-ledger-deposit", leaseId: "demo-lease-b", date: "2026-01-01", kind: "charge", amount: 1450, memo: "Security deposit liability", accountingTreatment: "security_deposit_liability", reviewed: true, reviewedAt: "2026-01-01T12:00:00.000Z", reviewNotes: "Starting deposit liability.", createdAt: "2026-01-01T12:00:00.000Z" },
    { id: "demo-ledger-rent-jan", leaseId: "demo-lease-b", date: "2026-01-05", kind: "charge", amount: 1450, memo: "January rent charge", accountingTreatment: "rent_income", transactionId: "demo-rent-1", reviewed: true, reviewedAt: "2026-01-05T12:00:00.000Z", createdAt: "2026-01-05T12:00:00.000Z" },
    { id: "demo-ledger-payment-jan", leaseId: "demo-lease-b", date: "2026-01-05", kind: "payment", amount: 1450, memo: "January rent payment", accountingTreatment: "rent_income", transactionId: "demo-rent-1", reviewed: true, reviewedAt: "2026-01-05T12:00:00.000Z", createdAt: "2026-01-05T12:00:00.000Z" },
  ];

  const vendors: Vendor[] = [
    { id: "demo-vendor-plumbing", name: "Example Plumbing Co.", defaultCategory: "Repairs", active: true },
    { id: "demo-vendor-hardware", name: "Example Hardware", defaultCategory: "Repairs", active: true },
  ];

  const recurringTemplates: RecurringTemplate[] = [{
    id: "demo-rec-utility",
    description: "Sample Utilities monthly service",
    propertyId: "demo-property-1",
    unit: "Shared",
    type: "Expense",
    category: "Utilities",
    amount: 240,
    frequency: "Monthly",
    nextDueDate: "2026-04-20",
    reviewRequired: true,
    ownerUsePct: 50,
    active: true,
  }];

  const recurringDrafts: RecurringDraft[] = [];

  return {
    transactions,
    assets,
    documents,
    loans,
    loanPayments,
    usePeriods,
    recurringTemplates,
    recurringDrafts,
    tenantLedgerEntries,
    activityLog: [],
    leases,
    vendors,
    workOrders,
    properties,
    units,
  };
}
