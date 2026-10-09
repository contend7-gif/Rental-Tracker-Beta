export type CaptureKind = "receipt" | "maintenance" | "mileage";
export type CaptureDraft = {
  selectedPropertyId: string; selectedUnitId: string; propertyLabel: string; unitLabel: string;
  maintenanceTitle?: string; maintenanceLocation?: string; maintenanceUrgency?: string;
  note: string; tripDate: string; businessMiles: string; purpose: string; startLocation: string; endLocation: string;
};
export type CaptureMemory = { version: 1; drafts: Partial<Record<CaptureKind, CaptureDraft>>; recentPurposes: string[]; scope: Pick<CaptureDraft, "selectedPropertyId" | "selectedUnitId" | "propertyLabel" | "unitLabel"> | null };
const kinds: CaptureKind[] = ["receipt", "maintenance", "mileage"];
const fields = ["selectedPropertyId", "selectedUnitId", "propertyLabel", "unitLabel", "note", "tripDate", "businessMiles", "purpose", "startLocation", "endLocation"] as const;
export const emptyMemory = (): CaptureMemory => ({ version: 1, drafts: {}, recentPurposes: [], scope: null });
export function hasDraftContent(draft: CaptureDraft) { return Boolean(draft.maintenanceTitle?.trim() || draft.maintenanceLocation?.trim() || draft.note.trim() || draft.businessMiles.trim() || draft.purpose.trim() || draft.startLocation.trim() || draft.endLocation.trim()); }
export function parseCaptureMemory(raw: string | null): CaptureMemory {
  const result = emptyMemory();
  if (!raw || raw.length > 20_000) return result;
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1) return result;
    for (const kind of kinds) {
      const draft = value.drafts?.[kind];
      if (draft && fields.every((field) => typeof draft[field] === "string" && draft[field].length <= 500)) {
        result.drafts[kind] = Object.fromEntries(fields.map((field) => [field, draft[field]])) as CaptureDraft;
        for (const field of ["maintenanceTitle", "maintenanceLocation", "maintenanceUrgency"] as const) {
          if (typeof draft[field] === "string" && draft[field].length <= 80) result.drafts[kind]![field] = draft[field];
        }
      }
    }
    const scope = value.scope;
    if (scope && fields.slice(0, 4).every((field) => typeof scope[field] === "string" && scope[field].length <= 500)) {
      result.scope = { selectedPropertyId: scope.selectedPropertyId, selectedUnitId: scope.selectedUnitId, propertyLabel: scope.propertyLabel, unitLabel: scope.unitLabel };
    }
    result.recentPurposes = Array.isArray(value.recentPurposes) ? [...new Set<string>(value.recentPurposes.filter((purpose: unknown) => typeof purpose === "string" && purpose.length > 0 && purpose.length <= 200))].slice(0, 5) : [];
    return result;
  } catch { return result; }
}
export function rememberPurpose(recent: string[], purpose: string) { return [purpose.trim(), ...recent.filter((item) => item !== purpose.trim())].filter(Boolean).slice(0, 5); }
