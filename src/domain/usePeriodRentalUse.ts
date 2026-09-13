import type { UsePeriod } from "../models.ts";

// Vacancy describes occupancy, not whether the property is held for rental.
// Older app versions automatically saved all vacancies with rentalUsePct: 0.
export function rentalUsePctFromUsePeriod(period?: UsePeriod): number | null {
  if (!period) return null;
  const useType = String(period.useType || "").toLowerCase();
  if (useType === "vacant") return period.vacancyTreatment === "nonrental" ? 0 : 1;
  const value = period.rentalUsePct;
  if (value != null && Number.isFinite(Number(value))) return Math.max(0, Math.min(1, Number(value)));
  return useType.includes("owner") ? 0 : 1;
}
