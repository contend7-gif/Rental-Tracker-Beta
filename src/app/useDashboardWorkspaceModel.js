import { useMemo } from "react";
import { getRentReportingMonth, isRentIncomeTransaction } from "../features/transactions/transactionPresentation.js";
import { leaseIsActiveByDate } from "./leaseShared.js";

const FAR_FUTURE_DATE = "9999-12-31";

const previousDayIso = (isoDate) => {
  const dt = new Date(`${isoDate}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
};

const nextDayIso = (isoDate) => {
  const dt = new Date(`${isoDate}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
};

const addDaysIso = (isoDate, days) => {
  const dt = new Date(`${isoDate}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

export function useDashboardWorkspaceModel({
  activeTx,
  leases,
  properties,
  propertyFilter,
  todayIso,
  unitFilter,
  units,
  usePeriods,
  yearFilter,
}) {
  const dashboardAsOfDate = useMemo(() => {
    const selectedYear = Number(yearFilter);
    const currentYear = Number(todayIso.slice(0, 4));
    return selectedYear === currentYear ? todayIso : `${yearFilter}-12-31`;
  }, [todayIso, yearFilter]);

  const dashboardScopedTransactions = useMemo(
    () =>
      activeTx
        .filter((t) => t.date.startsWith(yearFilter) && t.date <= dashboardAsOfDate && (propertyFilter === "all" || t.propertyId === propertyFilter) && (unitFilter === "all" || t.unit === unitFilter))
        .sort((a, b) => {
          const dateCompare = b.date.localeCompare(a.date);
          if (dateCompare !== 0) return dateCompare;
          return String(b.id || "").localeCompare(String(a.id || ""));
        }),
    [activeTx, dashboardAsOfDate, propertyFilter, unitFilter, yearFilter],
  );
  const dashboardTransactions = useMemo(() => dashboardScopedTransactions.slice(0, 5), [dashboardScopedTransactions]);
  const dashboardRentTransactions = useMemo(
    () =>
      activeTx.filter((transaction) => {
        if (!isRentIncomeTransaction(transaction)) return false;
        if (!getRentReportingMonth(transaction).startsWith(yearFilter)) return false;
        if (transaction.date > dashboardAsOfDate) return false;
        if (propertyFilter !== "all" && transaction.propertyId !== propertyFilter) return false;
        return unitFilter === "all" || transaction.unit === unitFilter;
      }),
    [activeTx, dashboardAsOfDate, propertyFilter, unitFilter, yearFilter],
  );

  const isHistoricalDashboard = yearFilter !== todayIso.slice(0, 4);

  const getUnitStatusForDate = (unit, date = todayIso) => {
    const hasActiveLease = leases.some((lease) => lease.propertyId === unit.propertyId && lease.unit === unit.name && leaseIsActiveByDate(lease, date));
    if (hasActiveLease) return "Rental";

    const matchingUse = usePeriods
      .filter((period) => period.propertyId === unit.propertyId && period.unit === unit.name && period.startDate <= date && (!period.endDate || period.endDate >= date))
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

    if (matchingUse?.useType === "Owner-Occupied") return "Owner-Occupied";
    return "Vacant";
  };

  const dashboardUnitStatusForDate = (unit) => getUnitStatusForDate(unit, dashboardAsOfDate);

  const dashboardScopedLeases = useMemo(
    () =>
      leases
        .filter((lease) => {
          if (propertyFilter !== "all" && lease.propertyId !== propertyFilter) return false;
          if (unitFilter !== "all" && lease.unit !== unitFilter) return false;
          if (!leaseIsActiveByDate(lease, dashboardAsOfDate)) return false;
          if (!String(lease.tenantName || "").trim()) return false;
          const unitRecord = units.find((unit) => unit.propertyId === lease.propertyId && unit.name === lease.unit);
          if (unitRecord && dashboardUnitStatusForDate(unitRecord) !== "Rental") return false;
          return true;
        })
        .sort((a, b) => a.endDate.localeCompare(b.endDate)),
    [dashboardAsOfDate, leases, propertyFilter, unitFilter, units, usePeriods],
  );
  const dashboardLeases = useMemo(() => dashboardScopedLeases.slice(0, 5), [dashboardScopedLeases]);

  const unitStatusLabel = {
    Rental: "Occupied",
    "Owner-Occupied": "Owner occupied",
    Vacant: "No active lease",
  };

  const getUnitOccupancyPeriods = (propertyId, unitName) =>
    usePeriods
      .filter((period) => period.propertyId === propertyId && period.unit === unitName && (period.useType === "Owner-Occupied" || period.useType === "Vacant"))
      .sort((a, b) => b.startDate.localeCompare(a.startDate));

  const activeLeases = useMemo(
    () => leases.filter((lease) => leaseIsActiveByDate(lease, dashboardAsOfDate)),
    [dashboardAsOfDate, leases],
  );

  const dashboardPropertySnapshot = useMemo(() => {
    const visibleProperties = propertyFilter === "all" ? properties : properties.filter((property) => property.id === propertyFilter);

    return visibleProperties
      .map((property) => {
        const propertyUnits = units.filter((unit) => unit.propertyId === property.id);
        const rentalCount = propertyUnits.filter((unit) => getUnitStatusForDate(unit, dashboardAsOfDate) === "Rental").length;
        const ownerCount = propertyUnits.filter((unit) => getUnitStatusForDate(unit, dashboardAsOfDate) === "Owner-Occupied").length;
        const vacantCount = propertyUnits.filter((unit) => getUnitStatusForDate(unit, dashboardAsOfDate) === "Vacant").length;
        const unitCount = propertyUnits.length;
        const occupancyPct = unitCount ? Math.round((rentalCount / unitCount) * 100) : 0;

        const propertyLeases = activeLeases.filter((lease) => lease.propertyId === property.id);
        const nextScheduledEnd = propertyLeases
          .filter((lease) => !(lease.rentalType === "Long-term" && lease.monthToMonthAfterTerm && !lease.actualEndDate))
          .sort((a, b) => a.endDate.localeCompare(b.endDate))[0];

        return {
          property,
          rentalCount,
          ownerCount,
          vacantCount,
          unitCount,
          occupancyPct,
          activeLeaseCount: propertyLeases.length,
          nextLeaseEndLabel: nextScheduledEnd ? nextScheduledEnd.endDate : "MTM / none scheduled",
        };
      })
      .sort((a, b) => b.vacantCount - a.vacantCount || a.occupancyPct - b.occupancyPct || a.property.name.localeCompare(b.property.name));
  }, [activeLeases, dashboardAsOfDate, properties, propertyFilter, units]);

  const dashboardPropertySnapshotSummary = useMemo(
    () =>
      dashboardPropertySnapshot.reduce(
        (acc, property) => {
          acc.properties += 1;
          acc.units += property.unitCount;
          acc.rental += property.rentalCount;
          acc.vacant += property.vacantCount;
          return acc;
        },
        { properties: 0, units: 0, rental: 0, vacant: 0 },
      ),
    [dashboardPropertySnapshot],
  );

  const leaseCoverageByProperty = useMemo(() => {
    const yearStart = `${yearFilter}-01-01`;
    const yearEnd = `${yearFilter}-12-31`;
    const selectedYear = Number(yearFilter);
    const currentYear = Number(todayIso.slice(0, 4));
    const asOfDate = selectedYear === currentYear ? todayIso : yearEnd;
    const clipRange = (start, end, windowStart, windowEnd) => {
      const clippedStart = start < windowStart ? windowStart : start;
      const clippedEnd = end > windowEnd ? windowEnd : end;
      if (clippedStart > clippedEnd) return null;
      return { start: clippedStart, end: clippedEnd };
    };
    const countDaysInclusive = (startIso, endIso) => {
      const start = new Date(`${startIso}T00:00:00Z`);
      const end = new Date(`${endIso}T00:00:00Z`);
      return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    };
    const coveredDaysForWindow = (segments, windowStart, windowEnd) => {
      const clipped = segments
        .map((segment) => clipRange(segment.start, segment.end, windowStart, windowEnd))
        .filter(Boolean)
        .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
      if (clipped.length === 0) return 0;
      let covered = 0;
      let runStart = clipped[0].start;
      let runEnd = clipped[0].end;
      for (let i = 1; i < clipped.length; i += 1) {
        const segment = clipped[i];
        if (segment.start <= nextDayIso(runEnd)) {
          if (segment.end > runEnd) runEnd = segment.end;
        } else {
          covered += countDaysInclusive(runStart, runEnd);
          runStart = segment.start;
          runEnd = segment.end;
        }
      }
      covered += countDaysInclusive(runStart, runEnd);
      return covered;
    };

    const visibleProperties = propertyFilter === "all" ? properties : properties.filter((property) => property.id === propertyFilter);

    return visibleProperties.map((property) => {
      const auditStart = property.purchasedOn && property.purchasedOn > yearStart ? property.purchasedOn : yearStart;
      const auditEnd = asOfDate < yearStart ? yearStart : asOfDate;
      const inServiceForYear = auditStart <= auditEnd;
      const propertyUnits = units.filter((unit) => unit.propertyId === property.id && (unitFilter === "all" || unit.name === unitFilter));

      const unitRows = propertyUnits.map((unit) => {
        const leaseSegments = leases
          .filter((lease) => lease.propertyId === property.id && lease.unit === unit.name)
          .map((lease) => {
            const leaseEnd = lease.actualEndDate || (lease.rentalType === "Long-term" && lease.monthToMonthAfterTerm ? FAR_FUTURE_DATE : lease.endDate);
            const clipped = clipRange(lease.startDate, leaseEnd, auditStart, auditEnd);
            if (!clipped) return null;
            return {
              ...clipped,
              type: "Lease",
              label: lease.tenantName ? `Lease: ${lease.tenantName}` : "Lease",
            };
          })
          .filter(Boolean);

        const useSegments = usePeriods
          .filter((period) => period.propertyId === property.id && period.unit === unit.name && (period.useType === "Owner-Occupied" || period.useType === "Vacant"))
          .map((period) => {
            const useEnd = period.endDate || FAR_FUTURE_DATE;
            const clipped = clipRange(period.startDate, useEnd, auditStart, auditEnd);
            if (!clipped) return null;
            return {
              ...clipped,
              type: period.useType,
              label: period.useType,
            };
          })
          .filter(Boolean);

        const combined = [...leaseSegments, ...useSegments].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));

        const gaps = [];
        const overlaps = [];

        if (inServiceForYear) {
          let cursor = auditStart;
          combined.forEach((segment, index) => {
            if (segment.start > cursor) {
              gaps.push({ start: cursor, end: previousDayIso(segment.start) });
            }

            if (index > 0) {
              const prev = combined[index - 1];
              if (segment.start <= prev.end) {
                const overlapStart = segment.start > prev.start ? segment.start : prev.start;
                const overlapEnd = segment.end < prev.end ? segment.end : prev.end;
                if (overlapStart <= overlapEnd) {
                  overlaps.push({
                    start: overlapStart,
                    end: overlapEnd,
                    leftLabel: prev.label,
                    rightLabel: segment.label,
                  });
                }
              }
            }

            if (segment.end >= cursor) {
              cursor = nextDayIso(segment.end);
            }
          });

          if (cursor <= auditEnd) {
            gaps.push({ start: cursor, end: auditEnd });
          }
        }

        const statusOnDate = (date) => {
          const hasLease = leases.some((lease) => lease.propertyId === property.id && lease.unit === unit.name && leaseIsActiveByDate(lease, date));
          if (hasLease) return "Rented";
          const period = usePeriods
            .filter((entry) => entry.propertyId === property.id && entry.unit === unit.name && entry.startDate <= date && (!entry.endDate || entry.endDate >= date))
            .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
          if (period?.useType === "Owner-Occupied") return "Owner-Occupied";
          if (period?.useType === "Vacant") return "Vacant";
          return "Untracked";
        };
        const totalDays = inServiceForYear ? countDaysInclusive(auditStart, auditEnd) : 0;
        const coveredDays = inServiceForYear ? coveredDaysForWindow(combined, auditStart, auditEnd) : 0;

        const monthlyStatus = Array.from({ length: 12 }, (_, monthIndex) => {
          const monthNumber = monthIndex + 1;
          const month = String(monthNumber).padStart(2, "0");
          const monthStart = `${yearFilter}-${month}-01`;
          const daysInMonth = new Date(Date.UTC(Number(yearFilter), monthNumber, 0)).getUTCDate();
          const monthEnd = `${yearFilter}-${month}-${String(daysInMonth).padStart(2, "0")}`;
          const serviceStartForMonth = inServiceForYear && auditStart > monthStart ? auditStart : monthStart;
          const isFutureMonthInCurrentYear = selectedYear === currentYear && monthStart > todayIso;
          const serviceEndForMonth = monthEnd > auditEnd ? auditEnd : monthEnd;
          const activeInMonth = inServiceForYear && !isFutureMonthInCurrentYear && serviceStartForMonth <= serviceEndForMonth;
          const monthTotalDays = activeInMonth ? countDaysInclusive(serviceStartForMonth, serviceEndForMonth) : 0;
          const monthCoveredDays = activeInMonth ? coveredDaysForWindow(combined, serviceStartForMonth, serviceEndForMonth) : 0;
          const statusDays = activeInMonth
            ? Array.from({ length: monthTotalDays }, (_, dayOffset) => {
                const date = addDaysIso(serviceStartForMonth, dayOffset);
                return { date, status: statusOnDate(date) };
              })
            : [];
          const statusCounts = statusDays.reduce((acc, day) => {
            acc[day.status] = (acc[day.status] || 0) + 1;
            return acc;
          }, {});
          const statusOrder = ["Rented", "Owner-Occupied", "Vacant", "Untracked"];
          const statusEntries = statusOrder.map((status) => [status, statusCounts[status] || 0]).filter(([, count]) => count > 0);
          const monthlyOccupancyStatus =
            isFutureMonthInCurrentYear || !activeInMonth
              ? isFutureMonthInCurrentYear
                ? "Future"
                : "Out of service"
              : statusEntries.length === 1
                ? statusEntries[0][0]
                : "Mixed";
          const statusDetailLabel = {
            Rented: "rented",
            "Owner-Occupied": "owner",
            Vacant: "vacant",
            Untracked: "untracked",
          };
          const statusRanges = statusDays.reduce((ranges, day) => {
            const last = ranges[ranges.length - 1];
            if (last?.status === day.status && nextDayIso(last.end) === day.date) {
              last.end = day.date;
              last.days += 1;
              return ranges;
            }
            ranges.push({ status: day.status, start: day.date, end: day.date, days: 1 });
            return ranges;
          }, []);
          return {
            month,
            status: monthlyOccupancyStatus,
            coveredDays: monthCoveredDays,
            totalDays: monthTotalDays,
            ranges: statusRanges.map((range) => ({
              ...range,
              label: `${range.start === range.end ? range.start : `${range.start} to ${range.end}`}: ${statusDetailLabel[range.status] || range.status.toLowerCase()} (${range.days}d)`,
            })),
            detail:
              activeInMonth && statusEntries.length > 1
                ? statusEntries.map(([status, count]) => `${count} ${statusDetailLabel[status] || status.toLowerCase()}`).join(" / ")
                : "",
          };
        });

        const leasesForUnit = leases
          .filter((lease) => lease.propertyId === property.id && lease.unit === unit.name)
          .sort((a, b) => b.startDate.localeCompare(a.startDate));

        const occupancyForUnit = getUnitOccupancyPeriods(property.id, unit.name).filter((period) => {
          if (!inServiceForYear) return false;
          const periodEnd = period.endDate || FAR_FUTURE_DATE;
          return period.startDate <= auditEnd && periodEnd >= auditStart;
        });
        const statusAsOfAuditEnd = inServiceForYear ? getUnitStatusForDate(unit, auditEnd) : getUnitStatusForDate(unit, asOfDate);

        return {
          unit,
          auditStart,
          auditEnd,
          inServiceForYear,
          gaps,
          overlaps,
          totalDays,
          coveredDays,
          monthlyStatus,
          leasesForUnit,
          occupancyForUnit,
          statusAsOfAuditEnd,
          isCoverageComplete: inServiceForYear && gaps.length === 0,
        };
      });

      return { property, unitRows };
    });
  }, [yearFilter, propertyFilter, unitFilter, properties, units, leases, usePeriods, todayIso]);

  return {
    dashboardAsOfDate,
    dashboardLeases,
    dashboardScopedLeases,
    dashboardScopedTransactions,
    dashboardPropertySnapshot,
    dashboardPropertySnapshotSummary,
    dashboardRentTransactions,
    dashboardTransactions,
    getUnitOccupancyPeriods,
    getUnitStatusForDate,
    isHistoricalDashboard,
    leaseCoverageByProperty,
    unitStatusLabel,
  };
}
