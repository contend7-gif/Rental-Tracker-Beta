const FAR_FUTURE_DATE = "9999-12-31";

function effectiveLeaseEnd(lease) {
  if (lease?.actualEndDate) return lease.actualEndDate;
  if (lease?.rentalType === "Long-term" && lease?.monthToMonthAfterTerm) return FAR_FUTURE_DATE;
  return lease?.endDate || "";
}

function activeOn(lease, date) {
  return Boolean(lease?.startDate && lease.startDate <= date && effectiveLeaseEnd(lease) >= date);
}

function dayDifference(start, end) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86400000);
}

function matchesUnit(record, propertyId, unitName) {
  const recordPropertyId = record?.property?.id || record?.lease?.propertyId || record?.unit?.propertyId;
  const recordUnit = record?.unit?.name || record?.lease?.unit;
  return recordPropertyId === propertyId && recordUnit === unitName;
}

export function deriveLeaseRoll({ leaseCoverageByProperty = [], occupancyReviewInbox, tenantLedgerReviewInbox, todayIso }) {
  return leaseCoverageByProperty.flatMap(({ property, unitRows = [] }) => unitRows.map((row) => {
    const leases = row.leasesForUnit || [];
    const activeLease = leases.find((lease) => activeOn(lease, todayIso)) || null;
    const futureLease = leases
      .filter((lease) => lease.startDate > todayIso)
      .sort((left, right) => left.startDate.localeCompare(right.startDate))[0] || null;
    const currentPeriod = (row.occupancyForUnit || [])
      .filter((period) => period.startDate <= todayIso && (!period.endDate || period.endDate >= todayIso))
      .sort((left, right) => right.startDate.localeCompare(left.startDate))[0] || null;
    const rawStatus = activeLease
      ? "Occupied"
      : currentPeriod?.useType === "Owner-Occupied"
        ? "Owner occupied"
        : currentPeriod?.useType === "Vacant"
          ? "Vacant"
          : futureLease
            ? "Future"
            : row.inServiceForYear
              ? "Vacant"
              : "Out of service";
    const occupancyIssues = (occupancyReviewInbox?.records || []).some((record) => matchesUnit(record, property.id, row.unit.name)) ? 1 : 0;
    const ledgerIssues = (tenantLedgerReviewInbox?.records || []).filter((record) => matchesUnit(record, property.id, row.unit.name)).length;
    const leaseEnd = activeLease ? effectiveLeaseEnd(activeLease) : futureLease ? effectiveLeaseEnd(futureLease) : "";
    const expirationDays = activeLease && leaseEnd && leaseEnd !== FAR_FUTURE_DATE ? dayDifference(todayIso, leaseEnd) : null;

    return {
      property,
      row,
      activeLease,
      futureLease,
      currentPeriod,
      status: rawStatus,
      leaseEnd,
      expirationDays,
      cleanupCount: occupancyIssues + ledgerIssues,
      occupancyCleanupCount: occupancyIssues,
      ledgerCleanupCount: ledgerIssues,
      coveragePct: row.totalDays > 0 ? Math.round((row.coveredDays / row.totalDays) * 100) : 0,
      hasCoverageIssues: !row.isCoverageComplete || row.gaps.length > 0 || row.overlaps.length > 0 || occupancyIssues > 0 || ledgerIssues > 0,
    };
  }));
}

export function summarizeLeaseRoll(roll = [], cleanupCount = 0, automationEnabled = false) {
  return {
    occupied: roll.filter((item) => item.status === "Occupied").length,
    ownerOccupied: roll.filter((item) => item.status === "Owner occupied").length,
    vacant: roll.filter((item) => item.status === "Vacant").length,
    upcomingExpirations: roll.filter((item) => item.expirationDays != null && item.expirationDays >= 0 && item.expirationDays <= 60).length,
    cleanupItems: cleanupCount,
    automationLabel: automationEnabled ? "Enabled" : "Paused",
  };
}

export function groupLeaseCleanup({ occupancyReviewInbox, tenantLedgerReviewInbox }) {
  const occupancyCount = occupancyReviewInbox?.records?.length || 0;
  const ledgerCount = tenantLedgerReviewInbox?.records?.length || 0;
  const financialCount = (tenantLedgerReviewInbox?.counts?.depositIssues || 0)
    + (tenantLedgerReviewInbox?.counts?.openBalances || 0)
    + (tenantLedgerReviewInbox?.counts?.unappliedCredits || 0)
    + (tenantLedgerReviewInbox?.counts?.feeClassificationIssues || 0);
  return [
    { key: "occupancy", label: "Occupancy coverage", count: occupancyCount },
    { key: "ledger", label: "Tenant ledger", count: ledgerCount },
    { key: "financial", label: "Fees, deposits & balances", count: financialCount },
  ];
}

export function leaseRollOccupantLabel(item) {
  const lease = item?.activeLease || item?.futureLease;
  if (lease) return String(lease.tenantName || "").trim() || "No tenant name on file";
  if (item?.status === "Owner occupied") return "Owner occupied";
  if (item?.status === "Vacant") return "No current occupant";
  return "No active lease";
}

export function leaseRollCleanupLabel(item) {
  const ledger = Number(item?.ledgerCleanupCount || 0);
  const occupancy = Number(item?.occupancyCleanupCount || 0);
  if (ledger > 0 && occupancy > 0) return `${ledger} ledger, ${occupancy} occupancy`;
  if (ledger > 0) return `${ledger} ledger item${ledger === 1 ? "" : "s"}`;
  if (occupancy > 0) return `${occupancy} occupancy item${occupancy === 1 ? "" : "s"}`;
  return "No cleanup items";
}
