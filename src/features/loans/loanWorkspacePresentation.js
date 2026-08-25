import { getPropertyPurchaseValueSupport } from "../properties/propertyOperations.js";

export function buildLoanWorkspaceModes({ loanCount = 0, paymentCount = 0, reviewCount = 0 } = {}) {
  return [
    {
      key: "overview",
      label: "Portfolio overview",
      badge: `${loanCount} ${loanCount === 1 ? "loan" : "loans"}`,
      description: "See balances, leverage, and property-level debt.",
    },
    {
      key: "payments",
      label: "Payments",
      badge: `${paymentCount} recorded`,
      description: "Record payments and review each loan's payment history.",
    },
    {
      key: "tax",
      label: "Tax & escrow",
      badge: reviewCount > 0 ? `${reviewCount} open` : "Ready",
      description: "Reconcile interest, 1098s, escrow, PMI, and year-end review.",
    },
    {
      key: "details",
      label: "Loan details",
      badge: `${loanCount} ${loanCount === 1 ? "loan" : "loans"}`,
      description: "Maintain lender, rate, lien, schedule, and amortization.",
    },
  ];
}

export function combinedLtvPresentation(totalBalance, propertySummaries = []) {
  if (!propertySummaries.length) {
    return { value: null, helper: "Valuation missing - update in Properties", basis: "missing" };
  }

  const currentValues = propertySummaries.map((summary) => Number(summary.estimatedCurrentValue || 0));
  if (currentValues.every((value) => value > 0)) {
    const totalValue = currentValues.reduce((total, value) => total + value, 0);
    return {
      value: totalValue > 0 ? (Number(totalBalance || 0) / totalValue) * 100 : null,
      helper: "Based on estimated current value",
      basis: "current",
    };
  }

  const purchaseValues = propertySummaries.map((summary) => Number(getPropertyPurchaseValueSupport(summary.property).value || 0));
  if (purchaseValues.every((value) => value > 0)) {
    const totalValue = purchaseValues.reduce((total, value) => total + value, 0);
    return {
      value: totalValue > 0 ? (Number(totalBalance || 0) / totalValue) * 100 : null,
      helper: "Based on purchase value",
      basis: "purchase",
    };
  }

  return { value: null, helper: "Valuation missing - update in Properties", basis: "missing" };
}

export function loanReviewSummary({ loanCount = 0, needsReviewLoanCount = 0, reviewAreaCount = 0 }) {
  if (needsReviewLoanCount === 0) {
    return { headline: "All loans ready", badge: "Ready" };
  }

  const loanWord = loanCount === 1 ? "loan" : "loans";
  const verb = needsReviewLoanCount === 1 ? "needs" : "need";
  const areaWord = reviewAreaCount === 1 ? "area" : "areas";
  return {
    headline: `${needsReviewLoanCount} of ${loanCount} ${loanWord} ${verb} review`,
    badge: `${reviewAreaCount} review ${areaWord}`,
  };
}

export function loanPaymentTiming(payments = [], asOfDate = "", scheduledDate = "") {
  const normalizedAsOfDate = String(asOfDate || "").slice(0, 10);
  const datedPayments = payments
    .map((payment) => ({ payment, date: String(payment.paymentDate || "").slice(0, 10) }))
    .filter((entry) => entry.date)
    .sort((left, right) => left.date.localeCompare(right.date));
  const recorded = datedPayments.filter((entry) => !normalizedAsOfDate || entry.date <= normalizedAsOfDate);
  const future = datedPayments.filter((entry) => normalizedAsOfDate && entry.date > normalizedAsOfDate);
  const lastRecordedDate = recorded.at(-1)?.date || "";
  const futureRecordedDate = future[0]?.date || "";
  const normalizedScheduledDate = String(scheduledDate || "").slice(0, 10);
  const nextScheduledDate = futureRecordedDate
    || (normalizedScheduledDate && (!normalizedAsOfDate || normalizedScheduledDate > normalizedAsOfDate) ? normalizedScheduledDate : "");
  const missingPayment = Boolean(
    normalizedScheduledDate
    && normalizedAsOfDate
    && normalizedScheduledDate <= normalizedAsOfDate
    && (!lastRecordedDate || lastRecordedDate < normalizedScheduledDate),
  );

  let status = "No payment recorded";
  if (missingPayment) status = "Missing payment";
  else if (lastRecordedDate) status = "Payments current";
  else if (nextScheduledDate) status = "Future scheduled";

  return { lastRecordedDate, nextScheduledDate, status, missingPayment };
}
