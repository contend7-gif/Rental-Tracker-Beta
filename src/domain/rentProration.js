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

export function leaseEffectiveEndDateForMonth(lease, monthEnd) {
  if (lease.actualEndDate) return lease.actualEndDate < monthEnd ? lease.actualEndDate : monthEnd;
  if (lease.rentalType === "Long-term" && lease.monthToMonthAfterTerm) return monthEnd;
  return lease.endDate < monthEnd ? lease.endDate : monthEnd;
}

export function proratedRentForMonth30Day(lease, billingDate) {
  const bounds = monthBounds(billingDate);
  if (!bounds || !lease?.startDate || !lease?.endDate) return null;

  const activeStart = lease.startDate > bounds.monthStart ? lease.startDate : bounds.monthStart;
  const activeEnd = leaseEffectiveEndDateForMonth(lease, bounds.monthEnd);
  if (activeStart > activeEnd) return null;

  const startDay = activeStart === bounds.monthStart ? 1 : Math.min(30, Number(activeStart.slice(8, 10)));
  const endDay = activeEnd === bounds.monthEnd ? 30 : Math.min(30, Number(activeEnd.slice(8, 10)));
  const activeDays = Math.max(0, endDay - startDay + 1);
  const prorated = (Number(lease.monthlyRent || 0) * activeDays) / 30;
  return Math.round(prorated * 100) / 100;
}
