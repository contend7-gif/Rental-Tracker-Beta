import type { UsePeriod } from "../models.ts";
import { toLocalIsoDate } from "../lib/localDate.ts";

export function normalizeUsePeriod(period: UsePeriod): UsePeriod {
  const rentalUsePct = Number(period.rentalUsePct);

  return {
    ...period,
    id: String(period.id || `up-${Date.now()}`),
    propertyId: String(period.propertyId || "").trim(),
    unit: String(period.unit || "Shared").trim() || "Shared",
    startDate: String(period.startDate || toLocalIsoDate()).slice(0, 10),
    endDate: String(period.endDate || "").trim(),
    useType: String(period.useType || "Vacant").trim() || "Vacant",
    rentalUsePct: Number.isFinite(rentalUsePct) ? Math.max(0, Math.min(1, rentalUsePct)) : 0,
    reviewed: Boolean(period.reviewed),
    reviewedAt: String(period.reviewedAt || "").trim(),
    reviewNotes: String(period.reviewNotes || "").trim(),
  };
}
