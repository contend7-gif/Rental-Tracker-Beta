import { getRentReportingMonth, isRentIncomeTransaction } from "../transactions/transactionPresentation.js";
import { proratedRentForMonth30Day } from "../../domain/rentProration.js";

const FAR_FUTURE_DATE = "9999-12-31";

function money(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDashboardUnitLabel(value) {
  const unitName = String(value || "").trim();
  if (!unitName) return "Unit";
  return /^unit\b/i.test(unitName) ? unitName : `Unit ${unitName}`;
}

function matchesScope(item, propertyFilter = "all", unitFilter = "all") {
  if (propertyFilter !== "all" && item?.propertyId !== propertyFilter) return false;
  if (unitFilter !== "all" && (item?.unit ?? item?.name) !== unitFilter) return false;
  return true;
}

function leaseEndDate(lease) {
  if (lease?.actualEndDate) return lease.actualEndDate;
  if (lease?.rentalType === "Long-term" && lease?.monthToMonthAfterTerm) return FAR_FUTURE_DATE;
  return lease?.endDate || FAR_FUTURE_DATE;
}

function leaseActiveOn(lease, isoDate) {
  return Boolean(lease?.startDate) && lease.startDate <= isoDate && leaseEndDate(lease) >= isoDate;
}

function rentTransaction(transaction) {
  return isRentIncomeTransaction(transaction);
}

function dueDatesForYear(lease, yearFilter, asOfDate) {
  const year = Number(yearFilter);
  const finalMonth = Number(String(asOfDate || `${yearFilter}-12-31`).slice(5, 7)) || 12;
  const dueDay = Math.max(1, Math.min(28, Number(lease?.rentDueDay || 1)));
  return Array.from({ length: finalMonth }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    const dueDate = `${year}-${month}-${String(dueDay).padStart(2, "0")}`;
    return dueDate < lease.startDate && dueDate.slice(0, 7) === lease.startDate.slice(0, 7) ? lease.startDate : dueDate;
  }).filter((dueDate) => dueDate <= asOfDate && leaseActiveOn(lease, dueDate));
}

export function deriveCashflowSummary(transactions = [], { useRentPeriod = false } = {}) {
  const monthMap = new Map();
  [...transactions]
    .sort((left, right) => String(left?.date || "").localeCompare(String(right?.date || "")))
    .forEach((transaction) => {
      const month = useRentPeriod && rentTransaction(transaction)
        ? getRentReportingMonth(transaction)
        : String(transaction?.date || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) return;
      if (!monthMap.has(month)) monthMap.set(month, { key: month, income: 0, expenses: 0, cashflow: 0 });
      const row = monthMap.get(month);
      const amount = money(transaction?.amount);
      if (transaction?.type === "Income") {
        row.income += amount;
        row.cashflow += amount;
      } else if (transaction?.type === "Expense") {
        row.expenses += amount;
        row.cashflow -= amount;
      }
    });

  const rows = Array.from(monthMap.values()).slice(-6);
  const totals = rows.reduce(
    (acc, row) => ({
      income: acc.income + row.income,
      expenses: acc.expenses + row.expenses,
      cashflow: acc.cashflow + row.cashflow,
    }),
    { income: 0, expenses: 0, cashflow: 0 },
  );
  const distinctCashflowValues = new Set(rows.map((row) => Math.round(row.cashflow * 100)));
  return {
    rows,
    totals,
    hasData: rows.length > 0,
    hasMeaningfulTrend: rows.length >= 2 && distinctCashflowValues.size > 1,
  };
}

export function deriveRentCollectionSummary({
  transactions = [],
  leases = [],
  tenantLedgerEntries = [],
  properties = [],
  units = [],
  yearFilter,
  propertyFilter = "all",
  unitFilter = "all",
  asOfDate,
} = {}) {
  const year = String(yearFilter || new Date().getFullYear());
  const effectiveAsOfDate = String(asOfDate || `${year}-12-31`);
  const scopedTransactions = transactions.filter((transaction) => {
    const reportingMonth = rentTransaction(transaction) ? getRentReportingMonth(transaction) : String(transaction?.date || "").slice(0, 7);
    return reportingMonth.startsWith(year) && String(transaction?.date || "") <= effectiveAsOfDate && matchesScope(transaction, propertyFilter, unitFilter);
  });
  const scopedRentTransactions = scopedTransactions.filter(rentTransaction);
  const scopedLeases = leases.filter(
    (lease) => matchesScope(lease, propertyFilter, unitFilter) && lease.startDate <= effectiveAsOfDate && leaseEndDate(lease) >= `${year}-01-01`,
  );
  const scopedLeaseIds = new Set(scopedLeases.map((lease) => lease.id));
  const rentChargesByLease = tenantLedgerEntries.reduce((charges, entry) => {
    if (!scopedLeaseIds.has(entry?.leaseId)) return charges;
    const isAutomatedRent = String(entry?.automationKey || "").startsWith("auto-rent:")
      || String(entry?.memo || "").toLowerCase().startsWith("auto rent charge (");
    if (entry?.kind !== "charge" || (entry?.accountingTreatment !== "rent_income" && !isAutomatedRent)) return charges;
    if (!String(entry?.date || "").startsWith(year) || entry.date > effectiveAsOfDate) return charges;
    charges.set(entry.leaseId, (charges.get(entry.leaseId) || 0) + money(entry.amount));
    return charges;
  }, new Map());
  const expectedForLease = (lease) => rentChargesByLease.has(lease.id)
    ? rentChargesByLease.get(lease.id)
    : dueDatesForYear(lease, year, effectiveAsOfDate)
      .reduce((sum, dueDate) => sum + money(proratedRentForMonth30Day(lease, dueDate) ?? lease.monthlyRent), 0);
  const expectedYtd = scopedLeases.reduce(
    (sum, lease) => sum + expectedForLease(lease),
    0,
  );
  const collectedYtd = scopedRentTransactions.reduce((sum, transaction) => sum + money(transaction.amount), 0);
  const scheduledMonthly = scopedLeases
    .filter((lease) => leaseActiveOn(lease, effectiveAsOfDate))
    .reduce((sum, lease) => sum + money(lease.monthlyRent), 0);
  const outstanding = Math.max(0, expectedYtd - collectedYtd);
  const collectionRatePct = expectedYtd > 0 ? Math.max(0, Math.round((collectedYtd / expectedYtd) * 100)) : 0;
  const progressPct = Math.min(100, collectionRatePct);
  const scheduleCoveragePartial = expectedYtd <= 0 || collectedYtd > expectedYtd;
  const showCollectionRate = !scheduleCoveragePartial && expectedYtd > 0;
  const visibleProperties = properties.filter((property) => propertyFilter === "all" || property.id === propertyFilter);
  const mode = visibleProperties.length <= 1 ? "units" : "properties";

  const rows = mode === "units"
    ? units
        .filter((unit) => matchesScope(unit, propertyFilter, unitFilter))
        .map((unit) => {
          const activeLease = scopedLeases
            .filter((lease) => lease.propertyId === unit.propertyId && lease.unit === unit.name && leaseActiveOn(lease, effectiveAsOfDate))
            .sort((left, right) => String(right.startDate || "").localeCompare(String(left.startDate || "")))[0];
          const unitTransactions = scopedRentTransactions.filter((transaction) => transaction.propertyId === unit.propertyId && transaction.unit === unit.name);
          const unitExpected = scopedLeases
            .filter((lease) => lease.propertyId === unit.propertyId && lease.unit === unit.name)
            .reduce((sum, lease) => sum + expectedForLease(lease), 0);
          const unitCollected = unitTransactions.reduce((sum, transaction) => sum + money(transaction.amount), 0);
          return {
            id: unit.id,
            propertyId: unit.propertyId,
            unitName: unit.name,
            label: formatDashboardUnitLabel(unit.name),
            status: activeLease ? "Occupied" : unit.status === "Owner-Occupied" ? "Owner" : "Vacant",
            monthlyRent: money(activeLease?.monthlyRent),
            expectedYtd: unitExpected,
            collectedYtd: unitCollected,
            outstanding: Math.max(0, unitExpected - unitCollected),
            leaseEndDate: activeLease ? leaseEndDate(activeLease) : "",
            lastPaymentDate: unitTransactions.sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")))[0]?.date || "",
          };
        })
    : visibleProperties.map((property) => {
        const propertyUnits = units.filter((unit) => unit.propertyId === property.id);
        const propertyLeases = scopedLeases.filter((lease) => lease.propertyId === property.id);
        const propertyTransactions = scopedRentTransactions.filter((transaction) => transaction.propertyId === property.id);
        const propertyExpected = propertyLeases.reduce(
          (sum, lease) => sum + expectedForLease(lease),
          0,
        );
        const propertyCollected = propertyTransactions.reduce((sum, transaction) => sum + money(transaction.amount), 0);
        const occupiedUnits = new Set(
          propertyLeases.filter((lease) => leaseActiveOn(lease, effectiveAsOfDate)).map((lease) => lease.unit),
        ).size;
        return {
          id: property.id,
          propertyId: property.id,
          label: property.name,
          units: propertyUnits.length,
          occupiedUnits,
          occupancyPct: propertyUnits.length ? Math.round((occupiedUnits / propertyUnits.length) * 100) : 0,
          expectedYtd: propertyExpected,
          collectedYtd: propertyCollected,
          outstanding: Math.max(0, propertyExpected - propertyCollected),
        };
      });

  return {
    mode,
    hasLeaseSchedule: scopedLeases.some((lease) => money(lease.monthlyRent) > 0),
    expectedYtd,
    collectedYtd,
    scheduledMonthly,
    outstanding,
    collectionRatePct,
    scheduleCoveragePartial,
    showCollectionRate,
    progressPct,
    rows,
  };
}

export function countUpcomingLeaseExpirations(leases = [], asOfDate, withinDays = 120) {
  const start = new Date(`${asOfDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(start)) return 0;
  const end = start + withinDays * 86400000;
  return leases.filter((lease) => {
    if (lease?.rentalType === "Long-term" && lease?.monthToMonthAfterTerm && !lease?.actualEndDate) return false;
    const leaseEnd = new Date(`${leaseEndDate(lease)}T00:00:00Z`).getTime();
    return Number.isFinite(leaseEnd) && leaseEnd >= start && leaseEnd <= end;
  }).length;
}

export function formatDashboardPlanningConcern(concern = "") {
  const text = String(concern || "").trim();
  const match = text.match(/projected cash flow is (?:materially|slightly) negative at about (-?[\d,.]+) per month/i);
  if (!match) return text;
  const amount = Math.abs(Number(match[1].replaceAll(",", "")) || 0);
  return `Projected cashflow is negative by about $${Math.round(amount).toLocaleString("en-US")}/month.`;
}

export function deriveDashboardActionStatus({
  openReviewCount = 0,
  upcomingLeaseCount = 0,
  openMaintenanceCount = 0,
  setupChecklist = null,
  planningHealth = null,
  taxReadinessSummary = null,
  taxPacketSummary = null,
} = {}) {
  const setupOpenCount = Number(setupChecklist?.needsSetupCount || 0) + Number(setupChecklist?.needsReviewCount || 0);
  const actionableReviewCount = Number(openReviewCount || 0);
  const reviewCount = actionableReviewCount > 0 ? actionableReviewCount : Number(taxReadinessSummary?.reviewCount || 0);
  const packetOpenCount = Array.isArray(taxPacketSummary?.openItems) ? taxPacketSummary.openItems.length : 0;
  const planningStatus = String(planningHealth?.status || "").toLowerCase();
  const planningAtRisk = planningStatus === "fragile" || planningStatus === "at_risk" || planningStatus === "at risk";
  const planningWatch = planningAtRisk || planningStatus === "watch";

  const severeUnresolvedWork = reviewCount >= 5 || (setupOpenCount > 0 && upcomingLeaseCount > 0);
  if (planningAtRisk && severeUnresolvedWork) {
    return { key: "at_risk", label: "At Risk", tone: "destructive", explanation: "Planning pressure and unresolved records need attention before relying on the current plan." };
  }
  if (reviewCount > 0 || packetOpenCount > 0) {
    const count = reviewCount || packetOpenCount;
    return { key: "needs_review", label: "Needs Review", tone: "warning", explanation: `${count} source-record item${count === 1 ? "" : "s"} still ${count === 1 ? "needs" : "need"} review.` };
  }
  if (planningAtRisk) {
    return { key: "at_risk", label: "At Risk", tone: "destructive", explanation: planningHealth?.primaryConcern || "The working plan needs attention before relying on current projections." };
  }
  if (setupOpenCount > 0 || upcomingLeaseCount > 0 || openMaintenanceCount > 0 || planningWatch) {
    return { key: "watch", label: "Watch", tone: "watch", explanation: planningWatch && planningHealth?.primaryConcern ? planningHealth.primaryConcern : "Core records are usable, with upcoming operational work to keep on the radar." };
  }
  return { key: "healthy", label: "Healthy", tone: "healthy", explanation: "No major setup, review, lease, or planning blockers are open for this scope." };
}

export function derivePropertySnapshotMode(properties = []) {
  if (properties.length === 0) return "empty";
  return properties.length === 1 ? "units" : "properties";
}

export function deriveTransactionBadges(transaction, reviewRecord, documents = []) {
  const badges = [];
  if (transaction?.type === "Expense" && money(transaction?.deductibleAmount) > 0) badges.push({ key: "deductible", label: "Deductible", tone: "teal" });
  if (Array.isArray(reviewRecord?.issues) && reviewRecord.issues.length > 0) badges.push({ key: "review", label: "Needs review", tone: "amber" });
  if (transaction?.taxChecked) badges.push({ key: "tax_checked", label: "Tax checked", tone: "slate" });
  const hasDocument = Boolean(transaction?.receiptName) || documents.some(
    (document) => document?.transactionId === transaction?.id || (Array.isArray(document?.relatedTransactionIds) && document.relatedTransactionIds.includes(transaction?.id)),
  );
  if (hasDocument) badges.push({ key: "support", label: "Receipt", tone: "blue" });
  return badges;
}
