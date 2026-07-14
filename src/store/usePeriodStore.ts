import type { UsePeriod } from "../models.ts";
import { toLocalIsoDate } from "../lib/localDate.ts";
import type { AppendActivityLog } from "./activityStore.ts";

type StateSetter<T> = (updater: T[] | ((previous: T[]) => T[])) => void;

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

export function createUsePeriodActions({
  getUsePeriods,
  setUsePeriods,
  appendActivityLog,
}: {
  getUsePeriods: () => UsePeriod[];
  setUsePeriods: StateSetter<UsePeriod>;
  appendActivityLog: AppendActivityLog;
}) {
  return {
    upsertUsePeriod(period: { id?: string; propertyId: string; unit: string; startDate: string; endDate?: string; useType: string; reviewed?: boolean; reviewedAt?: string; reviewNotes?: string }) {
      const normalized = normalizeUsePeriod({
        id: period.id || `up-${Date.now()}`,
        propertyId: period.propertyId,
        unit: period.unit,
        startDate: period.startDate,
        endDate: period.endDate || "",
        useType: period.useType,
        rentalUsePct: period.useType === "Owner-Occupied" || period.useType === "Vacant" ? 0 : 1,
        reviewed: period.reviewed,
        reviewedAt: period.reviewedAt,
        reviewNotes: period.reviewNotes,
      });
      const existsBefore = getUsePeriods().some((item) => item.id === normalized.id);
      setUsePeriods((previous) => {
        const exists = previous.some((item) => item.id === normalized.id);
        return exists
          ? previous.map((item) => item.id === normalized.id ? normalized : item)
          : [normalized, ...previous];
      });
      appendActivityLog({
        action: existsBefore ? "update" : "create",
        entityType: "use-period",
        entityId: normalized.id,
        propertyId: normalized.propertyId,
        unit: normalized.unit,
        summary: existsBefore ? "Use period updated." : "Use period created.",
        details: normalized.useType,
      });
    },
    deleteUsePeriod(id: string) {
      const existingPeriod = getUsePeriods().find((item) => item.id === id);
      setUsePeriods((previous) => previous.filter((item) => item.id !== id));
      appendActivityLog({
        action: "delete",
        entityType: "use-period",
        entityId: id,
        propertyId: existingPeriod?.propertyId,
        unit: existingPeriod?.unit,
        summary: "Use period deleted.",
        details: existingPeriod?.useType,
      });
    },
    updateUsePeriodReview(id: string, patch: Partial<Pick<UsePeriod, "reviewed" | "reviewedAt" | "reviewNotes">>) {
      const existingPeriod = getUsePeriods().find((item) => item.id === id);
      const reviewed = patch.reviewed ?? existingPeriod?.reviewed ?? false;
      setUsePeriods((previous) => previous.map((period) => period.id === id
        ? normalizeUsePeriod({
            ...period,
            reviewed,
            reviewedAt: patch.reviewedAt ?? (reviewed ? (period.reviewedAt || new Date().toISOString()) : ""),
            reviewNotes: patch.reviewNotes ?? period.reviewNotes,
          })
        : period));
      if (!existingPeriod) return;
      appendActivityLog({
        action: "review",
        entityType: "use-period",
        entityId: id,
        propertyId: existingPeriod.propertyId,
        unit: existingPeriod.unit,
        summary: reviewed ? "Occupancy period reviewed." : "Occupancy period review reopened.",
        details: existingPeriod.useType,
      });
    },
  };
}
