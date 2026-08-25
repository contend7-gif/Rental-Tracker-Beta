import type { Asset, Lease, Unit, UsePeriod } from "../models.ts";

function clampRentalUsePct(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function assetIsBonusEligible(asset: Asset) {
  return Boolean(asset.bonusEligible) || (Number(asset.life || 0) <= 20 && asset.type !== "Residential Building");
}

function normalizeBonusRate(value: unknown) {
  const raw = Number(value || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const decimal = raw > 1 ? raw / 100 : raw;
  if (decimal < 0) return 0;
  if (decimal > 1) return 1;
  return decimal;
}

function leaseIsActiveByDate(lease: Lease, dateStr: string) {
  if (!dateStr) return false;
  if (lease.startDate > dateStr) return false;

  if (lease.actualEndDate) {
    return lease.actualEndDate >= dateStr;
  }

  if (leaseIsOpenEnded(lease)) {
    return true;
  }

  return lease.endDate >= dateStr;
}

import { leaseIsOpenEnded } from "./leaseTerms.js";

function findMatchingUsePeriod(usePeriods: UsePeriod[], propertyId: string, unit: string, date: string) {
  return usePeriods
    .filter((period) => period.propertyId === propertyId && period.unit === unit && period.startDate <= date && (!period.endDate || period.endDate >= date))
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

function rentalUsePctFromUsePeriod(period?: UsePeriod) {
  if (!period) return null;
  if (Number.isFinite(Number(period.rentalUsePct))) return clampRentalUsePct(Number(period.rentalUsePct));

  const useType = String(period.useType || "").toLowerCase();
  if (useType.includes("owner") || useType.includes("vacant")) return 0;
  return 1;
}

function rentalUsePctForPropertyUnitOnDate(args: {
  propertyId: string;
  unitName: string;
  date: string;
  usePeriods: UsePeriod[];
  leases: Lease[];
}) {
  const { propertyId, unitName, date, usePeriods, leases } = args;
  const leaseActive = leases.some((lease) => lease.propertyId === propertyId && lease.unit === unitName && leaseIsActiveByDate(lease, date));
  if (leaseActive) return 1;

  const matchedUsePct = rentalUsePctFromUsePeriod(findMatchingUsePeriod(usePeriods, propertyId, unitName, date));
  if (matchedUsePct != null) return matchedUsePct;

  return 1;
}

function propertyHasTrackedUnitLevelUse(args: {
  propertyId: string;
  units: Unit[];
  usePeriods: UsePeriod[];
  leases: Lease[];
}) {
  const { propertyId, units, usePeriods, leases } = args;
  const propertyUnits = units.filter((unit) => unit.propertyId === propertyId && unit.name !== "Shared");
  if (propertyUnits.length === 0) return false;

  return propertyUnits.some((unit) =>
    usePeriods.some((period) => period.propertyId === propertyId && period.unit === unit.name) ||
    leases.some((lease) => lease.propertyId === propertyId && lease.unit === unit.name)
  );
}

export function assetDepreciationForYear(asset: Asset, year: number) {
  const basis = Number(asset.basis || 0);
  const life = Number(asset.life || 0);
  if (!basis || !life || !asset.placedInService) return 0;

  const [serviceYear, serviceMonth] = asset.placedInService.split("-").map(Number);
  if (!serviceYear || !serviceMonth || year < serviceYear) return 0;

  const totalMonths = Math.max(1, Math.round(life * 12));
  const assetType = String(asset.type || "").toLowerCase();
  const usesMidMonthConvention =
    assetType.includes("residential building") ||
    assetType.includes("nonresidential") ||
    life === 27.5 ||
    life === 39;

  let monthsInYear = 0;
  if (usesMidMonthConvention) {
    const firstYearMonths = Math.max(0, Math.min(totalMonths, 12 - serviceMonth + 0.5));
    if (year === serviceYear) {
      monthsInYear = firstYearMonths;
    } else {
      const fullYearsAfterServiceYear = Math.max(0, year - serviceYear - 1);
      const monthsConsumedBeforeYear = firstYearMonths + (fullYearsAfterServiceYear * 12);
      const remainingMonths = totalMonths - monthsConsumedBeforeYear;
      monthsInYear = Math.max(0, Math.min(12, remainingMonths));
    }
  } else {
    const startOffset = (year - serviceYear) * 12;
    for (let month = 1; month <= 12; month += 1) {
      const offset = startOffset + (month - serviceMonth);
      if (offset >= 0 && offset < totalMonths) monthsInYear += 1;
    }
  }

  const bonusRate = assetIsBonusEligible(asset) && asset.bonusElected ? normalizeBonusRate(asset.bonusRate) : 0;
  const bonusAmountOnServiceYear = basis * bonusRate;
  const bonusAmount = year === serviceYear ? bonusAmountOnServiceYear : 0;
  const remainingBasis = Math.max(0, basis - bonusAmountOnServiceYear);
  const annualRegularDep = monthsInYear * (remainingBasis / totalMonths);
  const amount = annualRegularDep + bonusAmount;

  return Math.round(amount * 100) / 100;
}

export function rentalUsePctForAssetOnDate(args: {
  asset: Asset;
  date: string;
  usePeriods: UsePeriod[];
  leases?: Lease[];
  units?: Unit[];
}) {
  const { asset, date, usePeriods, leases = [], units = [] } = args;
  const directUsePct = rentalUsePctFromUsePeriod(findMatchingUsePeriod(usePeriods, asset.propertyId, asset.unit, date));

  if (asset.unit !== "Shared") {
    if (directUsePct != null) return directUsePct;
    return 1;
  }

  const propertyUnits = units.filter((unit) => unit.propertyId === asset.propertyId && unit.name !== "Shared");
  const hasTrackedUnitLevelUse = propertyHasTrackedUnitLevelUse({ propertyId: asset.propertyId, units, usePeriods, leases });
  if (propertyUnits.length > 0 && hasTrackedUnitLevelUse) {
    const combinedRentalUsePct = propertyUnits.reduce(
      (sum, unit) => sum + rentalUsePctForPropertyUnitOnDate({ propertyId: asset.propertyId, unitName: unit.name, date, usePeriods, leases }),
      0,
    ) / propertyUnits.length;

    return clampRentalUsePct(combinedRentalUsePct);
  }

  if (directUsePct != null) return directUsePct;
  return 1;
}

export function adjustedAssetDepreciationForYear(args: {
  asset: Asset;
  year: number;
  usePeriods: UsePeriod[];
  leases?: Lease[];
  units?: Unit[];
}) {
  const { asset, year, usePeriods, leases = [], units = [] } = args;
  const fullYearDepreciation = assetDepreciationForYear(asset, year);
  if (!fullYearDepreciation || !asset.placedInService) return 0;

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const serviceStart = asset.placedInService > yearStart ? asset.placedInService : yearStart;
  if (serviceStart > yearEnd) return 0;

  let daysInService = 0;
  let weightedRentalDays = 0;
  const cursor = new Date(`${serviceStart}T00:00:00Z`);
  const end = new Date(`${yearEnd}T00:00:00Z`);

  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    weightedRentalDays += rentalUsePctForAssetOnDate({ asset, date, usePeriods, leases, units });
    daysInService += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (!daysInService) return 0;
  return Math.round(fullYearDepreciation * (weightedRentalDays / daysInService) * 100) / 100;
}
