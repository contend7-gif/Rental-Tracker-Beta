const DAY_MS = 24 * 60 * 60 * 1000;

export const LEASE_DURATION_TYPES = ["Short-term", "Mid-term", "Long-term"];

export const LEASE_AGREEMENT_TYPES = [
  "fixed_term",
  "month_to_month",
  "fixed_then_month_to_month",
];

export const LEASE_BILLING_CADENCES = [
  "full_term",
  "weekly",
  "biweekly",
  "monthly",
  "custom",
];

function validIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

export function leaseTermDays(lease) {
  const startDate = String(lease?.startDate || "");
  const endDate = String(lease?.actualEndDate || lease?.endDate || "");
  if (!validIsoDate(startDate) || !validIsoDate(endDate) || endDate < startDate) return 0;
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

export function normalizeLeaseAgreementType(lease) {
  if (LEASE_AGREEMENT_TYPES.includes(lease?.agreementType)) return lease.agreementType;
  if (lease?.rentalType === "Long-term" && lease?.monthToMonthAfterTerm) {
    return lease?.endDate && lease.endDate > lease.startDate
      ? "fixed_then_month_to_month"
      : "month_to_month";
  }
  return "fixed_term";
}

export function normalizeLeaseDurationType(lease) {
  if (LEASE_DURATION_TYPES.includes(lease?.rentalType)) return lease.rentalType;
  const agreementType = normalizeLeaseAgreementType(lease);
  if (agreementType === "month_to_month") return "Long-term";
  const days = leaseTermDays(lease);
  if (days > 0 && days <= 28) return "Short-term";
  if (days > 0 && days < 365) return "Mid-term";
  return "Long-term";
}

export function normalizeLeaseBillingCadence(lease) {
  if (LEASE_BILLING_CADENCES.includes(lease?.billingCadence)) return lease.billingCadence;
  const days = leaseTermDays(lease);
  if (normalizeLeaseAgreementType(lease) === "fixed_term"
    && lease?.rentalType !== "Long-term"
    && Number(lease?.extensionTermMonths || 0) <= 0
    && days >= 28
    && days <= 31) {
    return "full_term";
  }
  return "monthly";
}

export function leaseBillingIntervalDays(lease) {
  const cadence = normalizeLeaseBillingCadence(lease);
  if (cadence === "weekly") return 7;
  if (cadence === "biweekly") return 14;
  if (cadence === "custom") {
    const value = Math.round(Number(lease?.billingIntervalDays || 30));
    return Math.max(1, Math.min(366, Number.isFinite(value) ? value : 30));
  }
  return 0;
}

export function leaseBillingAmount(lease) {
  const explicit = Number(lease?.rentAmount);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit * 100) / 100;
  const legacyMonthly = Number(lease?.monthlyRent || 0);
  return Math.round(Math.max(0, legacyMonthly) * 100) / 100;
}

export function leaseMonthlyEquivalent(lease) {
  const amount = leaseBillingAmount(lease);
  const cadence = normalizeLeaseBillingCadence(lease);
  if (cadence === "monthly") return amount;
  if (cadence === "weekly") return Math.round((amount * 52 / 12) * 100) / 100;
  if (cadence === "biweekly") return Math.round((amount * 26 / 12) * 100) / 100;
  if (cadence === "custom") {
    return Math.round((amount * 365.25 / leaseBillingIntervalDays(lease) / 12) * 100) / 100;
  }
  const days = leaseTermDays(lease);
  if (days >= 28 && days <= 31) return amount;
  return days > 0 ? Math.round((amount * 30.4375 / days) * 100) / 100 : amount;
}

export function leaseIsOpenEnded(lease) {
  const agreementType = normalizeLeaseAgreementType(lease);
  return (agreementType === "month_to_month" || agreementType === "fixed_then_month_to_month")
    && !String(lease?.actualEndDate || "").trim();
}

export function leaseAgreementTypeLabel(lease) {
  const agreementType = normalizeLeaseAgreementType(lease);
  if (agreementType === "month_to_month") return "Month-to-month";
  if (agreementType === "fixed_then_month_to_month") return "Fixed, then month-to-month";
  return "Fixed term";
}

export function leaseBillingCadenceLabel(lease) {
  const cadence = normalizeLeaseBillingCadence(lease);
  if (cadence === "full_term") return "Full term, paid upfront";
  if (cadence === "weekly") return "Weekly";
  if (cadence === "biweekly") return "Every two weeks";
  if (cadence === "custom") return `Every ${leaseBillingIntervalDays(lease)} days`;
  return "Monthly";
}

export function leaseRentSummaryLabel(lease, currency = (value) => `$${Number(value || 0).toFixed(2)}`) {
  const amount = currency(leaseBillingAmount(lease));
  const cadence = normalizeLeaseBillingCadence(lease);
  if (cadence === "full_term") return `${amount} full term`;
  if (cadence === "weekly") return `${amount} / week`;
  if (cadence === "biweekly") return `${amount} / 2 weeks`;
  if (cadence === "custom") return `${amount} / ${leaseBillingIntervalDays(lease)} days`;
  return `${amount} / month`;
}

export function leaseTermSummaryLabel(lease) {
  const duration = normalizeLeaseDurationType(lease);
  const agreement = leaseAgreementTypeLabel(lease);
  return `${duration} | ${agreement}`;
}
