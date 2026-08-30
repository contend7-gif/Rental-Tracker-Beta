import { env } from "cloudflare:workers";

export type MobileMileageEntry = {
  id: string;
  status: "pending" | "claimed" | "imported";
  propertyLabel: string;
  unitLabel: string | null;
  tripDate: string;
  businessMiles: number;
  purpose: string;
  startLocation: string | null;
  endLocation: string | null;
  note: string | null;
  capturedAt: string;
  createdAt: string;
  updatedAt: string;
};

type StoredMileageEntry = MobileMileageEntry & {
  ownerFingerprint: string;
  claimedAt: string | null;
  importedAt: string | null;
};

export type ValidatedMileageInput = {
  propertyLabel: string;
  unitLabel: string | null;
  tripDate: string;
  businessMiles: number;
  purpose: string;
  startLocation: string | null;
  endLocation: string | null;
  note: string | null;
  capturedAt: string;
};

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS mobile_mileage_entries (
  id TEXT PRIMARY KEY NOT NULL,
  owner_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  property_label TEXT NOT NULL,
  unit_label TEXT,
  trip_date TEXT NOT NULL,
  business_miles_tenths INTEGER NOT NULL,
  purpose TEXT NOT NULL,
  start_location TEXT,
  end_location TEXT,
  note TEXT,
  captured_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  claimed_at TEXT,
  imported_at TEXT
)`;

const CREATE_OWNER_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS mobile_mileage_owner_status_created_idx
ON mobile_mileage_entries (owner_fingerprint, status, created_at DESC)`;

let schemaPromise: Promise<void> | null = null;

function database(): D1Database {
  const bound = env as unknown as { DB?: D1Database };
  if (!bound.DB) throw new Error("Companion database binding is unavailable.");
  return bound.DB;
}

export function validateMileageInput(value: unknown): { input?: ValidatedMileageInput; error?: string } {
  if (!isRecord(value)) return { error: "Mileage entry must be valid JSON." };
  const propertyLabel = cleanText(value.propertyLabel, 120);
  const purpose = cleanText(value.purpose, 200);
  const tripDate = cleanDate(value.tripDate);
  const businessMiles = Number(value.businessMiles);
  if (!propertyLabel) return { error: "Choose or enter the property for this trip." };
  if (!tripDate) return { error: "Enter a valid trip date." };
  if (!Number.isFinite(businessMiles) || businessMiles <= 0 || businessMiles > 1000) {
    return { error: "Enter business miles between 0.1 and 1,000." };
  }
  if (!purpose) return { error: "Add a short business purpose for this trip." };
  const requestedCaptureTime = cleanText(value.capturedAt, 40);
  const parsedCaptureTime = requestedCaptureTime ? Date.parse(requestedCaptureTime) : Number.NaN;
  return {
    input: {
      propertyLabel,
      unitLabel: cleanNullableText(value.unitLabel, 80),
      tripDate,
      businessMiles: Math.round(businessMiles * 10) / 10,
      purpose,
      startLocation: cleanNullableText(value.startLocation, 160),
      endLocation: cleanNullableText(value.endLocation, 160),
      note: cleanNullableText(value.note, 500),
      capturedAt: Number.isFinite(parsedCaptureTime)
        ? new Date(parsedCaptureTime).toISOString()
        : new Date().toISOString(),
    },
  };
}

export async function createMileageEntry(ownerFingerprint: string, input: ValidatedMileageInput): Promise<MobileMileageEntry> {
  await ensureSchema();
  const DB = database();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await DB.prepare(`
    INSERT INTO mobile_mileage_entries (
      id, owner_fingerprint, status, property_label, unit_label, trip_date,
      business_miles_tenths, purpose, start_location, end_location, note,
      captured_at, created_at, updated_at
    ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    ownerFingerprint,
    input.propertyLabel,
    input.unitLabel,
    input.tripDate,
    Math.round(input.businessMiles * 10),
    input.purpose,
    input.startLocation,
    input.endLocation,
    input.note,
    input.capturedAt,
    now,
    now,
  ).run();
  return (await findMileageEntry(id))!;
}

export async function listOwnerMileageEntries(ownerFingerprint: string): Promise<MobileMileageEntry[]> {
  await ensureSchema();
  const result = await database().prepare(`
    SELECT * FROM mobile_mileage_entries
    WHERE owner_fingerprint = ? AND status != 'imported'
    ORDER BY created_at DESC LIMIT 100
  `).bind(ownerFingerprint).all<Record<string, unknown>>();
  return result.results.map(mapMileageEntry);
}

export async function deleteOwnerMileageEntry(id: string, ownerFingerprint: string): Promise<boolean> {
  await ensureSchema();
  const result = await database().prepare(`
    DELETE FROM mobile_mileage_entries
    WHERE id = ? AND owner_fingerprint = ? AND status = 'pending'
  `).bind(id, ownerFingerprint).run();
  return Number(result.meta.changes || 0) > 0;
}

export async function listDesktopMileageEntries(): Promise<MobileMileageEntry[]> {
  await ensureSchema();
  const result = await database().prepare(`
    SELECT * FROM mobile_mileage_entries
    WHERE status IN ('pending', 'claimed')
    ORDER BY created_at ASC LIMIT 250
  `).all<Record<string, unknown>>();
  return result.results.map(mapMileageEntry);
}

export async function claimMileageEntry(id: string): Promise<MobileMileageEntry | null> {
  await ensureSchema();
  const now = new Date().toISOString();
  await database().prepare(`
    UPDATE mobile_mileage_entries
    SET status = 'claimed', claimed_at = COALESCE(claimed_at, ?), updated_at = ?
    WHERE id = ? AND status IN ('pending', 'claimed')
  `).bind(now, now, id).run();
  return findMileageEntry(id);
}

export async function completeMileageEntry(id: string): Promise<MobileMileageEntry | null> {
  await ensureSchema();
  const now = new Date().toISOString();
  await database().prepare(`
    UPDATE mobile_mileage_entries
    SET status = 'imported', imported_at = COALESCE(imported_at, ?), updated_at = ?
    WHERE id = ? AND status IN ('pending', 'claimed', 'imported')
  `).bind(now, now, id).run();
  return findMileageEntry(id);
}

async function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    const DB = database();
    schemaPromise = DB.batch([
      DB.prepare(CREATE_TABLE_SQL),
      DB.prepare(CREATE_OWNER_INDEX_SQL),
    ]).then(() => undefined).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function findMileageEntry(id: string): Promise<MobileMileageEntry | null> {
  const row = await database().prepare("SELECT * FROM mobile_mileage_entries WHERE id = ?")
    .bind(id).first<Record<string, unknown>>();
  return row ? publicMileageEntry(mapStoredMileageEntry(row)) : null;
}

function mapMileageEntry(row: Record<string, unknown>): MobileMileageEntry {
  return publicMileageEntry(mapStoredMileageEntry(row));
}

function mapStoredMileageEntry(row: Record<string, unknown>): StoredMileageEntry {
  return {
    id: String(row.id),
    ownerFingerprint: String(row.owner_fingerprint),
    status: String(row.status) as StoredMileageEntry["status"],
    propertyLabel: String(row.property_label),
    unitLabel: nullableString(row.unit_label),
    tripDate: String(row.trip_date),
    businessMiles: Number(row.business_miles_tenths) / 10,
    purpose: String(row.purpose),
    startLocation: nullableString(row.start_location),
    endLocation: nullableString(row.end_location),
    note: nullableString(row.note),
    capturedAt: String(row.captured_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    claimedAt: nullableString(row.claimed_at),
    importedAt: nullableString(row.imported_at),
  };
}

function publicMileageEntry(stored: StoredMileageEntry): MobileMileageEntry {
  return {
    id: stored.id,
    status: stored.status,
    propertyLabel: stored.propertyLabel,
    unitLabel: stored.unitLabel,
    tripDate: stored.tripDate,
    businessMiles: stored.businessMiles,
    purpose: stored.purpose,
    startLocation: stored.startLocation,
    endLocation: stored.endLocation,
    note: stored.note,
    capturedAt: stored.capturedAt,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function cleanNullableText(value: unknown, maxLength: number): string | null {
  return cleanText(value, maxLength) || null;
}

function cleanDate(value: unknown): string {
  const date = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : "";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
