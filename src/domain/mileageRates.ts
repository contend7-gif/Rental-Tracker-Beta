import { isValidIsoDate } from "./isoDate.ts";

// IRS business rates for qualifying rental travel; verified October 15, 2026.
// https://www.irs.gov/tax-professionals/standard-mileage-rates
export const MILEAGE_RATE_SOURCE = "https://www.irs.gov/tax-professionals/standard-mileage-rates";
const periods = [
  ["2020-01-01", "2020-12-31", 0.575],
  ["2021-01-01", "2021-12-31", 0.56],
  ["2022-01-01", "2022-06-30", 0.585],
  ["2022-07-01", "2022-12-31", 0.625],
  ["2023-01-01", "2023-12-31", 0.655],
  ["2024-01-01", "2024-12-31", 0.67],
  ["2025-01-01", "2025-12-31", 0.70],
  ["2026-01-01", "2026-06-30", 0.725],
  ["2026-07-01", "2026-12-31", 0.76],
] as const;

export function standardMileageRate(date: string): number | null {
  if (!isValidIsoDate(date)) return null;
  return periods.find(([start, end]) => date >= start && date <= end)?.[2] ?? null;
}

// Empty means automatic. Explicit saved/custom values must never be overwritten.
export function resolveMileageRate(date: string, override?: string | number): number | null {
  if (override === undefined || override === "") return standardMileageRate(date);
  const rate = Number(override);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function mileageRateHint(date: string): string {
  const rate = standardMileageRate(date);
  return rate === null
    ? "No verified IRS rate for this date. Enter a verified rate manually."
    : `Automatic IRS business rate: $${rate.toFixed(3)}/mile for this date. Enter a rate to override; clear it to use automatic.`;
}
