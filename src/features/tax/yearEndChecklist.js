// This checklist organizes existing review work; it never signs off a record.
export function buildYearEndChecklist({ taxReportingSummary = {}, taxReadinessSummary = {}, loanReviewInbox = {}, yearFilter, todayIso = "" } = {}) {
  const resolveNow = [];
  const awaitingDocuments = [];
  const add = (key, label, count, helper, target = "review", kind = "view") => {
    if (count > 0) resolveNow.push({ key, label, count, helper, action: { kind, target } });
  };
  const sectionCount = (key) => Number(taxReadinessSummary.sections?.find((section) => section.key === key)?.reviewCount || 0);
  const details = Object.values(taxReportingSummary.details || {}).flat();
  const expenses = [...new Map(details.filter((row) => row.sourceType === "transaction" && row.source?.type === "Expense")
    .map((row) => [row.source.id, row])).values()];
  const isMileage = (row) => row.source.category === "Auto and travel" && Number(row.source.mileageMiles) > 0;
  const cashExpenses = expenses.filter((row) => !isMileage(row));
  const paymentPending = cashExpenses.filter((row) => !row.source.reconciled);
  const receiptPending = cashExpenses.filter((row) => !row.documentCount && !row.source.receiptName && row.source.reviewOverrides?.missing_receipt !== "not_available");
  add("payments", "Payment verification", paymentPending.length,
    "Not bank matched. Check payment evidence and the paid date; a receipt and a bank match are separate checks.", "ledger");
  add("receipts", "Receipt support", receiptPending.length,
    "Attach the missing receipt or document the available evidence. Payment verification alone does not supply an itemized receipt.", "documents");
  add("transactions", "Transaction tax review", sectionCount("transactions"),
    "Review categories, business-use allocations, service periods, and final tax sign-off. Counts can overlap payment and receipt checks.");
  add("assets", "Depreciation and asset support", sectionCount("assets"),
    "Confirm basis, land allocation, in-service dates, and source documents.", "depreciation", "tab");
  add("occupancy", "Occupancy and tenant ledger", sectionCount("occupancy") + sectionCount("tenantLedger"),
    "Resolve occupancy gaps, deposit treatment, and unposted tenant activity.", "leaseHistory");
  add("maintenance", "Maintenance accounting", sectionCount("maintenance"),
    "Confirm repair or improvement treatment and linked expenses.", "maintenance");
  add("documents", "Document review", sectionCount("documents"),
    "Finish pending document processing and source links.", "documents");
  const year = String(yearFilter || "");
  const beforeYearEnd = /^\d{4}$/.test(year) && /^\d{4}-\d{2}-\d{2}$/.test(todayIso) && todayIso <= `${year}-12-31`;
  for (const record of loanReviewInbox.records || []) {
    const deferred = (record.issues || []).filter((issue) => beforeYearEnd && !record.review?.form1098Received &&
      ["missing_1098_review", "year_end_review_open"].includes(issue.key));
    const immediate = (record.issues || []).filter((issue) => !deferred.includes(issue));
    const label = record.loan?.lender || "Loan";
    if (deferred.length) awaitingDocuments.push({
      key: `annual-${record.loan.id}`, label: `${label} — ${record.loan.loanType || "Loan"}`,
      count: 1,
      helper: deferred.some((issue) => issue.key === "missing_1098_review")
        ? `${year} Form 1098 and final annual reconciliation. Keep open until received and reviewed; use monthly statements for current bookkeeping.`
        : `${year} final loan statement and annual reconciliation. Keep open until the year is complete and supporting records are reviewed.`,
      action: { kind: "tab", target: "loans" },
    });
    if (immediate.length) resolveNow.push({
      key: `loan-${record.loan.id}`, label: `${label} — loan bookkeeping`, count: immediate.length,
      helper: immediate.map((issue) => issue.label).join("; "), action: { kind: "tab", target: "loans" },
    });
  }
  return { resolveNow, awaitingDocuments, beforeYearEnd, paymentCount: paymentPending.length, receiptCount: receiptPending.length };
}
