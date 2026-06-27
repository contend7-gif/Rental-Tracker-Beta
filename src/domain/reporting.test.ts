import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOwnerPeriodReport,
  buildOwnerMonthlyReport,
  ownerMonthlyReportCsv,
  ownerStatementActivitySummary,
  ownerStatementCommunicationTxt,
  ownerStatementCsv,
  ownerStatementEmailBody,
  ownerStatementEmailSubject,
  scheduleEFormFdf,
  scheduleEFriendlyCsv,
  scheduleEWorksheetPageText,
  scheduleEWorksheetPages,
  statementDateRangeFromRows,
  summarizeOwnerMonthlyReport,
  tenantStatementSummary,
  tenantStatementCsv,
} from "./reporting.ts";

test("buildOwnerMonthlyReport computes monthly NOI and cash flow", () => {
  const rows = buildOwnerMonthlyReport({
    year: 2026,
    propertyId: "p1",
    unit: "all",
    transactions: [
      { date: "2026-01-02", type: "Income", amount: 2400, capitalImprovement: false, propertyId: "p1", unit: "A" },
      { date: "2026-01-05", type: "Expense", amount: 300, capitalImprovement: false, propertyId: "p1", unit: "A" },
      { date: "2026-01-10", type: "Expense", amount: 1500, capitalImprovement: true, propertyId: "p1", unit: "Shared" },
      { date: "2026-02-02", type: "Income", amount: 2400, capitalImprovement: false, propertyId: "p1", unit: "A" },
    ],
    loanPayments: [
      { paymentDate: "2026-01-01", loanId: "l1", totalPayment: 1800 },
      { paymentDate: "2026-02-01", loanId: "l1", totalPayment: 1800 },
    ],
    loans: [{ id: "l1", propertyId: "p1" }],
  });

  const jan = rows.find((row) => row.month === "2026-01");
  assert.ok(jan);
  assert.equal(jan?.grossIncome, 2400);
  assert.equal(jan?.operatingExpenses, 300);
  assert.equal(jan?.capex, 1500);
  assert.equal(jan?.debtService, 1800);
  assert.equal(jan?.netOperatingIncome, 2100);
  assert.equal(jan?.cashFlow, -1200);
});

test("buildOwnerPeriodReport honors custom date ranges", () => {
  const rows = buildOwnerPeriodReport({
    startDate: "2026-02-01",
    endDate: "2026-03-31",
    transactions: [
      { date: "2026-01-15", type: "Income", amount: 1200, capitalImprovement: false, propertyId: "p1", unit: "1A" },
      { date: "2026-02-05", type: "Income", amount: 1300, capitalImprovement: false, propertyId: "p1", unit: "1A" },
      { date: "2026-02-10", type: "Expense", amount: 200, capitalImprovement: false, propertyId: "p1", unit: "1A" },
      { date: "2026-03-14", type: "Expense", amount: 500, capitalImprovement: true, propertyId: "p1", unit: "1A" },
    ],
    loanPayments: [
      { paymentDate: "2026-02-20", loanId: "l1", totalPayment: 400 },
      { paymentDate: "2026-04-20", loanId: "l1", totalPayment: 400 },
    ],
    loans: [{ id: "l1", propertyId: "p1" }],
    propertyId: "p1",
    unit: "1A",
  });

  assert.deepEqual(rows, [
    {
      month: "2026-02",
      grossIncome: 1300,
      operatingExpenses: 200,
      capex: 0,
      debtService: 400,
      netOperatingIncome: 1100,
      cashFlow: 700,
    },
    {
      month: "2026-03",
      grossIncome: 0,
      operatingExpenses: 0,
      capex: 500,
      debtService: 0,
      netOperatingIncome: 0,
      cashFlow: -500,
    },
  ]);
});

test("buildOwnerMonthlyReport prorates property-level debt service for mixed-use months", () => {
  const rows = buildOwnerMonthlyReport({
    year: 2026,
    propertyId: "p1",
    unit: "all",
    transactions: [],
    loanPayments: [
      { paymentDate: "2026-01-01", loanId: "l1", totalPayment: 2200 },
      { paymentDate: "2026-03-01", loanId: "l1", totalPayment: 2200 },
    ],
    loans: [{ id: "l1", propertyId: "p1" }],
    units: [
      { propertyId: "p1", name: "614" },
      { propertyId: "p1", name: "616" },
    ],
    leases: [
      { id: "lease-614", propertyId: "p1", unit: "614", tenantName: "Tenant 614", startDate: "2025-09-21", endDate: "2026-02-20", rentalType: "Long-term", monthToMonthAfterTerm: false },
      { id: "lease-616", propertyId: "p1", unit: "616", tenantName: "Tenant 616", startDate: "2025-09-21", endDate: "2026-12-31", rentalType: "Long-term", monthToMonthAfterTerm: false },
    ],
    usePeriods: [
      { id: "u1", propertyId: "p1", unit: "614", useType: "Owner-Occupied", startDate: "2026-02-21", endDate: "" },
    ],
  });

  const january = rows.find((row) => row.month === "2026-01");
  const march = rows.find((row) => row.month === "2026-03");
  assert.equal(january?.debtService, 2200);
  assert.equal(march?.debtService, 1100);
});

test("summarizeOwnerMonthlyReport returns annual totals", () => {
  const rows = [
    { month: "2026-01", grossIncome: 1000, operatingExpenses: 250, capex: 0, debtService: 500, netOperatingIncome: 750, cashFlow: 250 },
    { month: "2026-02", grossIncome: 1000, operatingExpenses: 250, capex: 100, debtService: 500, netOperatingIncome: 750, cashFlow: 150 },
  ];

  const totals = summarizeOwnerMonthlyReport(rows);
  assert.equal(totals.grossIncome, 2000);
  assert.equal(totals.operatingExpenses, 500);
  assert.equal(totals.capex, 100);
  assert.equal(totals.debtService, 1000);
  assert.equal(totals.netOperatingIncome, 1500);
  assert.equal(totals.cashFlow, 400);
});

test("ownerMonthlyReportCsv includes header and total row", () => {
  const rows = [
    { month: "2026-01", grossIncome: 1000, operatingExpenses: 250, capex: 0, debtService: 500, netOperatingIncome: 750, cashFlow: 250 },
  ];

  const csv = ownerMonthlyReportCsv(rows);
  assert.ok(csv.startsWith("Month,Gross Income,Operating Expenses"));
  assert.ok(csv.includes("TOTAL,1000.00,250.00,0.00,500.00,750.00,250.00"));
});

test("ownerStatementCsv includes metadata and monthly section", () => {
  const rows = [
    { month: "2026-01", grossIncome: 1200, operatingExpenses: 300, capex: 0, debtService: 400, netOperatingIncome: 900, cashFlow: 500 },
  ];

  const csv = ownerStatementCsv({
    year: 2026,
    propertyLabel: "Maple Duplex",
    unitLabel: "All units",
    rows,
    generatedAt: "2026-03-11T00:00:00.000Z",
  });

  assert.ok(csv.includes("Report,Owner Statement"));
  assert.ok(csv.includes("Property,Maple Duplex"));
  assert.ok(csv.includes("Generated At,2026-03-11T00:00:00.000Z"));
  assert.ok(csv.includes("Active Months,1"));
  assert.ok(csv.includes("Net Cash Flow,500.00"));
  assert.ok(csv.includes("Report Contents,\"Monthly income, operating expenses, NOI, CapEx, debt service, cash flow\""));
  assert.ok(csv.includes("Readiness,Owner-facing summary"));
  assert.ok(csv.includes("Month,Gross Income,Operating Expenses"));
  assert.ok(csv.includes("TOTAL,1200.00,300.00,0.00,400.00,900.00,500.00"));
});

test("owner communication helpers build a send-ready subject and body", () => {
  const subject = ownerStatementEmailSubject({
    propertyLabel: "Maple Duplex",
    unitLabel: "All units",
    presetLabel: "Quarter to date",
    statementPeriodLabel: "2026-01-01 to 2026-03-31",
  });
  assert.equal(subject, "Maple Duplex | Quarter to date | 2026-01-01 to 2026-03-31");

  const body = ownerStatementEmailBody({
    recipientName: "North Shore Ownership Group",
    recipientEmail: "owners@example.com",
    recipientPhone: "(608) 555-0100",
    propertyLabel: "Maple Duplex",
    unitLabel: "All units",
    presetLabel: "Quarter to date",
    statementPeriodLabel: "2026-01-01 to 2026-03-31",
    preparedBy: "Alicia Conte",
    reportId: "owner-20260315-maple",
    note: "CapEx was elevated this quarter because of roof repairs.",
    attachmentLabels: ["Owner statement PDF", "Owner statement CSV"],
    totals: {
      grossIncome: 4200,
      operatingExpenses: 900,
      capex: 0,
      debtService: 1200,
      netOperatingIncome: 3300,
      cashFlow: 2100,
    },
  });

  assert.ok(body.includes("Hi North Shore Ownership Group,"));
  assert.ok(body.includes("Statement period: 2026-01-01 to 2026-03-31"));
  assert.ok(body.includes("Gross income: 4200.00"));
  assert.ok(body.includes("Net cash flow: 2100.00"));
  assert.ok(body.includes("CapEx was elevated this quarter because of roof repairs."));
  assert.ok(body.includes("- Owner statement PDF"));
  assert.ok(body.includes("Statement ID: owner-20260315-maple"));

  const bundle = ownerStatementCommunicationTxt({
    recipientName: "North Shore Ownership Group",
    recipientEmail: "owners@example.com",
    recipientPhone: "(608) 555-0100",
    propertyLabel: "Maple Duplex",
    unitLabel: "All units",
    presetLabel: "Quarter to date",
    statementPeriodLabel: "2026-01-01 to 2026-03-31",
    preparedBy: "Alicia Conte",
    note: "Please review the attached files.",
  });
  assert.ok(bundle.includes("Owner Statement Communication"));
  assert.ok(bundle.includes("Email: owners@example.com"));
  assert.ok(bundle.includes("Subject: Maple Duplex | Quarter to date | 2026-01-01 to 2026-03-31"));
});

test("tenantStatementCsv includes metadata and running balance section", () => {
  const csv = tenantStatementCsv({
    tenantName: "Tenant Alpha",
    propertyLabel: "Maple Duplex",
    unitLabel: "616",
    leaseStartDate: "2026-01-01",
    leaseEndDate: "2026-12-31",
    generatedAt: "2026-03-12T00:00:00.000Z",
    totalDue: 0,
    tenantCredit: 0,
    rows: [
      { date: "2026-01-01", kind: "charge", memo: "January rent", delta: 1350, runningBalance: 1350 },
      { date: "2026-01-28", kind: "payment", memo: "Early February rent", delta: -1350, runningBalance: 0 },
    ],
  });

  assert.ok(csv.includes("Report,Tenant Statement"));
  assert.ok(csv.includes("Tenant,Tenant Alpha"));
  assert.ok(csv.includes("Property,Maple Duplex"));
  assert.ok(csv.includes("Entries,2"));
  assert.ok(csv.includes("Total Charges,1350.00"));
  assert.ok(csv.includes("Total Credits,1350.00"));
  assert.ok(csv.includes("Report Contents,\"Tenant ledger charges, payments, credits, refunds, adjustments, running balance\""));
  assert.ok(csv.includes("Readiness,Tenant-facing ledger statement"));
  assert.ok(csv.includes("Date,Type,Memo,Charge,Credit,Balance"));
  assert.ok(csv.includes("2026-01-01,Charge,January rent,1350.00,,1350.00"));
  assert.ok(csv.includes("2026-01-28,Payment,Early February rent,,1350.00,0.00"));
  assert.ok(csv.includes("CURRENT BALANCE,,,,,0.00"));
});

test("statementDateRangeFromRows finds the first and last dated rows", () => {
  const range = statementDateRangeFromRows([
    { date: "2026-02-15" },
    { date: "2026-01-03" },
    { date: "" },
    { date: "2026-03-01" },
  ]);

  assert.deepEqual(range, { start: "2026-01-03", end: "2026-03-01" });
});

test("owner and tenant statement summaries compute send-ready totals", () => {
  const ownerSummary = ownerStatementActivitySummary([
    { month: "2026-01", grossIncome: 1000, operatingExpenses: 250, capex: 0, debtService: 500, netOperatingIncome: 750, cashFlow: 250 },
    { month: "2026-02", grossIncome: 0, operatingExpenses: 0, capex: 0, debtService: 0, netOperatingIncome: 0, cashFlow: 0 },
  ]);
  assert.equal(ownerSummary.activeMonthCount, 1);
  assert.equal(ownerSummary.averageMonthlyIncome, 500);
  assert.equal(ownerSummary.averageMonthlyCashFlow, 125);

  const tenantSummary = tenantStatementSummary([
    { date: "2026-01-01", kind: "charge", memo: "Rent", delta: 1000, runningBalance: 1000 },
    { date: "2026-01-02", kind: "payment", memo: "Paid", delta: -400, runningBalance: 600 },
    { date: "2026-01-03", kind: "credit", memo: "Credit", delta: -100, runningBalance: 500 },
  ]);
  assert.equal(tenantSummary.entryCount, 3);
  assert.equal(tenantSummary.totalCharges, 1000);
  assert.equal(tenantSummary.totalCredits, 500);
});

test("scheduleEFriendlyCsv includes signed line amounts and tie-out rows", () => {
  const csv = scheduleEFriendlyCsv({
    year: 2026,
    propertyLabel: "All properties",
    unitLabel: "All units",
    generatedAt: "2026-03-11T00:00:00.000Z",
    rows: [
      { id: "rents", label: "Rents received", total: 10000, sourceNote: "From Ledger Transactions" },
      { id: "repairs", label: "Repairs", total: 1500, sourceNote: "From Ledger Transactions" },
    ],
    metrics: {
      grossRent: 10000,
      opExp: 2000,
      deductibleLoanInterest: 1200,
      depreciation: 800,
      scheduleE: 6000,
      carryoverLoss: 500,
      adjustedScheduleE: 5500,
    },
    readiness: {
      label: "Ready to hand off",
      blockingCount: 1,
      warningCount: 2,
      supportWarningCount: 3,
      sourceRowCount: 12,
      documentCount: 5,
      notes: ["Review Center has one open item."],
    },
  });

  assert.ok(csv.includes("Report,Schedule E Friendly Export"));
  assert.ok(csv.includes("Readiness,Ready to hand off"));
  assert.ok(csv.includes("Open Checks,1"));
  assert.ok(csv.includes("Source Warnings,2"));
  assert.ok(csv.includes("Support Warnings,3"));
  assert.ok(csv.includes("Source Rows,12"));
  assert.ok(csv.includes("Linked Documents,5"));
  assert.ok(csv.includes("Export Note 1,Review Center has one open item."));
  assert.ok(csv.includes("Line ID,Schedule E line,Amount,Source"));
  assert.ok(csv.includes("rents,Rents received,10000.00,From Ledger Transactions"));
  assert.ok(csv.includes("repairs,Repairs,-1500.00,From Ledger Transactions"));
  assert.ok(csv.includes("Tie-Out Item,Amount"));
  assert.ok(csv.includes("Prior-year passive loss carryover,-500.00"));
  assert.ok(csv.includes("Schedule E estimate (after carryover),5500.00"));
});

test("scheduleEFriendlyCsv includes Schedule E property worksheet columns", () => {
  const csv = scheduleEFriendlyCsv({
    year: 2026,
    propertyLabel: "All properties",
    unitLabel: "All units",
    generatedAt: "2026-03-11T00:00:00.000Z",
    rows: [{ id: "rents", label: "Rents received", total: 3000 }],
    metrics: {
      grossRent: 3000,
      opExp: 500,
      deductibleLoanInterest: 0,
      depreciation: 0,
      scheduleE: 2500,
    },
    propertyWorksheet: {
      columns: [
        { label: "A", propertyName: "Sample Duplex", address: "1 Main St", fairRentalDays: 365, personalUseDays: 0 },
        { label: "B", propertyName: "Lake House", address: "2 Lake Rd", fairRentalDays: 200, personalUseDays: 30 },
      ],
      rows: [
        { line: "3", label: "Rents received", values: [1200, 1800], total: 3000 },
        { line: "20", label: "Total expenses. Add lines 5 through 19", values: [200, 300], total: 500 },
        { line: "21", label: "Income or (loss). Subtract line 20 from lines 3 and 4", values: [1000, 1500], total: 2500 },
      ],
    },
  });

  assert.ok(csv.includes("Schedule E Form Worksheet"));
  assert.ok(csv.includes("Form column,Property A,Property B,Page total"));
  assert.ok(csv.includes("Property,Sample Duplex,Lake House,"));
  assert.ok(csv.includes("Fair rental days,365,200,"));
  assert.ok(csv.includes("3,Rents received,1200.00,1800.00,3000.00"));
  assert.ok(csv.includes("21,Income or (loss). Subtract line 20 from lines 3 and 4,1000.00,1500.00,2500.00"));
});

test("scheduleEFriendlyCsv groups more than three Schedule E properties into continuation pages", () => {
  const columns = [
    { label: "A", propertyName: "Property One" },
    { label: "B", propertyName: "Property Two" },
    { label: "C", propertyName: "Property Three" },
    { label: "D", propertyName: "Property Four" },
  ];
  const worksheet = {
    columns,
    rows: [
      { line: "3", label: "Rents received", values: [100, 200, 300, 400], total: 1000 },
      { line: "21", label: "Income or (loss). Subtract line 20 from lines 3 and 4", values: [90, 180, 270, 360], total: 900 },
    ],
  };
  const pages = scheduleEWorksheetPages(worksheet, 3);
  const csv = scheduleEFriendlyCsv({
    year: 2026,
    propertyLabel: "All properties",
    unitLabel: "All units",
    rows: [{ id: "rents", label: "Rents received", total: 1000 }],
    metrics: {
      grossRent: 1000,
      opExp: 100,
      deductibleLoanInterest: 0,
      depreciation: 0,
      scheduleE: 900,
    },
    propertyWorksheet: worksheet,
  });

  assert.equal(pages.length, 2);
  assert.equal(pages[1].columns[0].formLabel, "A");
  assert.equal(pages[1].columns[0].originalLabel, "D");
  assert.ok(csv.includes("Schedule E Continuation Worksheet 2"));
  assert.ok(csv.includes("App property,Property D,"));
  assert.ok(csv.includes("3,Rents received,400.00,400.00"));
});

test("scheduleEWorksheetPageText copies visible continuation page totals", () => {
  const pages = scheduleEWorksheetPages({
    columns: [
      { label: "A", propertyName: "Property One" },
      { label: "B", propertyName: "Property Two" },
      { label: "C", propertyName: "Property Three" },
      { label: "D", propertyName: "Property Four" },
    ],
    rows: [
      { line: "3", label: "Rents received", values: [100, 200, 300, 400], total: 1000 },
      { line: "21", label: "Income or (loss)", values: [90, 180, 270, 360], total: 900 },
    ],
  }, 3);
  const text = scheduleEWorksheetPageText(pages[1]);

  assert.ok(text.includes("Schedule E continuation page 2"));
  assert.ok(text.includes("Line\tLabel\tProperty A\tPage total"));
  assert.ok(text.includes("Property\t\tProperty Four\t"));
  assert.ok(text.includes("3\tRents received\t400.00\t400.00"));
});

test("scheduleEFormFdf maps Schedule E worksheet values to IRS fillable fields", () => {
  const fdf = scheduleEFormFdf({
    pdfFileName: "f1040se.pdf",
    propertyWorksheet: {
      columns: [
        { label: "A", propertyName: "Sample Duplex", address: "1 Main St", fairRentalDays: 365, personalUseDays: 0 },
        { label: "B", propertyName: "Lake House", address: "2 Lake Rd", fairRentalDays: 200, personalUseDays: 30 },
      ],
      rows: [
        { line: "3", label: "Rents received", values: [1200, 1800], total: 3000 },
        { line: "5", label: "Advertising", values: [100, 200], total: 300 },
        { line: "20", label: "Total expenses. Add lines 5 through 19", values: [100, 200], total: 300 },
        { line: "21", label: "Income or (loss). Subtract line 20 from lines 3 and 4", values: [1100, 1600], total: 2700 },
      ],
    },
  });

  assert.ok(fdf.includes("/F (f1040se.pdf)"));
  assert.ok(fdf.includes("Table_Line1a[0].RowA[0].f1_3[0]"));
  assert.ok(fdf.includes("/V (Sample Duplex)"));
  assert.ok(fdf.includes("Table_Income[0].Line3[0].f1_16[0]"));
  assert.ok(fdf.includes("/V (1200)"));
  assert.ok(fdf.includes("Table_Expenses[0].Line5[0].f1_22[0]"));
  assert.ok(fdf.includes("Table_Expenses[0].Line21[0].f1_72[0]"));
});
