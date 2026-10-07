type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type SavedDraft = { version: 2; draft: Record<string, unknown>; savedAt: string };
const prefix = "rental-tracker:draft:v2:";
const maxLength = 100_000;
const excludedKeys = new Set(["dataUrl", "file", "attachment", "__proto__", "constructor", "prototype"]);
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const keyFor = (key: string) => {
  if (!/^(transaction|lease|loan):.+$/.test(key) || key.length > 512) throw new Error("This draft could not be identified. Keep editing and try again.");
  return `${prefix}${key}`;
};
export function serializeDraft(draft: unknown): string {
  if (!isRecord(draft)) throw new Error("This draft could not be retained. Keep editing.");
  const serialized = JSON.stringify(draft, (key, value) => excludedKeys.has(key) || (typeof Blob !== "undefined" && value instanceof Blob) ? undefined : value);
  return serialized;
}
function parseDraft(raw: string | null): SavedDraft | null {
  if (!raw || raw.length > maxLength + 150) return null;
  try {
    const value = JSON.parse(raw);
    if (!isRecord(value) || (value.version !== undefined && value.version !== 2) || !isRecord(value.draft)
      || typeof value.savedAt !== "string" || !Number.isFinite(Date.parse(value.savedAt))) return null;
    const serialized = serializeDraft(value.draft);
    if (serialized.length > maxLength) return null;
    return { version: 2, draft: JSON.parse(serialized), savedAt: value.savedAt };
  } catch { return null; }
}
export function readSavedDraft(storage: DraftStorage, key: string, legacyStorage?: DraftStorage, legacyKey = key): SavedDraft | null {
  try {
    const durableKey = keyFor(key);
    const raw = storage.getItem(durableKey);
    // A corrupt current draft must not revive an older session draft.
    if (raw !== null) return parseDraft(raw);
    if (!legacyStorage) return null;
    const oldKey = `rental-tracker:draft:v1:${legacyKey}`;
    const legacy = parseDraft(legacyStorage.getItem(oldKey));
    if (!legacy) return null;
    storage.setItem(durableKey, JSON.stringify(legacy));
    legacyStorage.removeItem(oldKey);
    return legacy;
  } catch { return null; }
}
export function saveDraft(storage: DraftStorage, key: string, draft: unknown, now = new Date()): SavedDraft {
  const serialized = serializeDraft(draft);
  if (serialized.length > maxLength) throw new Error("This draft is too large to retain. Save the record or keep editing.");
  const saved: SavedDraft = { version: 2, draft: JSON.parse(serialized), savedAt: now.toISOString() };
  try { storage.setItem(keyFor(key), JSON.stringify(saved)); }
  catch { throw new Error("The draft could not be saved on this computer. Keep editing and try again."); }
  return saved;
}
export function discardDraft(storage: DraftStorage, key: string, legacyStorage?: DraftStorage, legacyKey = key): void {
  try {
    storage.removeItem(keyFor(key));
    legacyStorage?.removeItem(`rental-tracker:draft:v1:${legacyKey}`);
  } catch { throw new Error("The saved draft could not be removed. Try again."); }
}
export function leaseDraftKey(draft: { id?: string; propertyId?: string; unit?: string }, existing: boolean): string {
  return existing ? `lease:${draft.id}` : `lease:new:${draft.propertyId}:${draft.unit}`;
}
