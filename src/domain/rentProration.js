function monthBounds(billingDate) {
  const [year, month] = String(billingDate || "").split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return null;

  const calendarDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthText = String(month).padStart(2, "0");
  return {
    monthStart: `${year}-${monthText}-01`,
    monthEnd: `${year}-${monthText}-${String(calendarDays).padStart(2, "0")}`,
  };
}

function isoDayDifference(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

export function isSingleMonthFixedTermLease(lease) {
  if (!lease?.startDate || !lease?.endDate || normalizeLeaseAgreementType(lease) !== "fixed_term") return false;
  if (normalizeLeaseBillingCadence(lease) !== "full_term") return false;
  const termDays = leaseTermDays(lease);
  return termDays != null && termDays >= 27 && termDays <= 31;
}

export function isFullTermBillingLease(lease) {
  return normalizeLeaseBillingCadence(lease) === "full_term";
}

export function rentAmountForLeasePayment(lease, billingDate) {
  if (normalizeLeaseBillingCadence(lease) !== "monthly") {
    return leaseBillingAmount(lease);
  }
  return proratedRentForMonth30Day(lease, billingDate);
}

export function leaseEffectiveEndDateForMonth(lease, monthEnd) {
  if (lease.actualEndDate) return lease.actualEndDate < monthEnd ? lease.actualEndDate : monthEnd;
  if (leaseIsOpenEnded(lease)) return monthEnd;
  return lease.endDate < monthEnd ? lease.endDate : monthEnd;
}

export function proratedRentForMonth30Day(lease, billingDate) {
  const bounds = monthBounds(billingDate);
  if (!bounds || !lease?.startDate || !lease?.endDate) return null;

  if (isFullTermBillingLease(lease)) {
    return lease.startDate.slice(0, 7) === bounds.monthStart.slice(0, 7)
      ? leaseBillingAmount(lease)
      : 0;
  }

  if (normalizeLeaseBillingCadence(lease) !== "monthly") return leaseBillingAmount(lease);

  const activeStart = lease.startDate > bounds.monthStart ? lease.startDate : bounds.monthStart;
  const activeEnd = leaseEffectiveEndDateForMonth(lease, bounds.monthEnd);
  if (activeStart > activeEnd) return null;

  if (lease?.prorationMethod === "none") return leaseBillingAmount(lease);

  const startDay = activeStart === bounds.monthStart ? 1 : Math.min(30, Number(activeStart.slice(8, 10)));
  const endDay = activeEnd === bounds.monthEnd ? 30 : Math.min(30, Number(activeEnd.slice(8, 10)));
  const activeDays = Math.max(0, endDay - startDay + 1);
  const prorated = (leaseBillingAmount(lease) * activeDays) / 30;
  return Math.round(prorated * 100) / 100;
}

import {
  leaseBillingAmount,
  leaseIsOpenEnded,
  leaseTermDays,
  normalizeLeaseAgreementType,
  normalizeLeaseBillingCadence,
} from "./leaseTerms.js";
