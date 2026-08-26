import { env } from "cloudflare:workers";

export const MAX_UPLOAD_BYTES = 768 * 1024;
export const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

export type MobileSubmission = {
  id: string;
  status: "pending" | "claimed" | "imported";
  kind: "receipt" | "maintenance";
  propertyLabel: string | null;
  unitLabel: string | null;
  note: string | null;
  originalFileName: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  capturedAt: string;
  createdAt: string;
  updatedAt: string;
};

type StoredSubmission = MobileSubmission & {
  ownerFingerprint: string;
  storageKey: string;
  claimedAt: string | null;
  importedAt: string | null;
};

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS mobile_submissions (
  id TEXT PRIMARY KEY NOT NULL,
  owner_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  kind TEXT NOT NULL DEFAULT 'receipt',
  property_label TEXT,
  unit_label TEXT,
  note TEXT,
  original_file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  claimed_at TEXT,
  imported_at TEXT
)`;

const CREATE_OWNER_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS mobile_submissions_owner_status_created_idx
ON mobile_submissions (owner_fingerprint, status, created_at DESC)`;

let schemaPromise: Promise<void> | null = null;

function bindings(): { DB: D1Database; UPLOADS: R2Bucket } {
  const bound = env as unknown as { DB?: D1Database; UPLOADS?: R2Bucket };
  if (!bound.DB || !bound.UPLOADS) throw new Error("Companion storage bindings are unavailable.");
  return { DB: bound.DB, UPLOADS: bound.UPLOADS };
}

export function cleanOptionalText(value: FormDataEntryValue | null, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

export function validateUpload(file: File): string | null {
  if (!ALLOWED_CONTENT_TYPES.has(file.type)) return "Use a JPEG, PNG, or PDF file.";
  if (file.size <= 0) return "The selected file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "The prepared upload must be 768 KB or smaller.";
  return null;
}

export async function createSubmission(input: {
  ownerFingerprint: string;
  kind: MobileSubmission["kind"];
  file: File;
  propertyLabel: string | null;
  unitLabel: string | null;
  note: string | null;
  capturedAt: string;
}): Promise<MobileSubmission> {
  await ensureSchema();
  const { DB, UPLOADS } = bindings();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const originalFileName = input.kind === "maintenance" && !/^maintenance-/i.test(input.file.name)
    ? `maintenance-${input.file.name}`
    : input.file.name;
  const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "capture";
  const storageKey = `${input.kind === "maintenance" ? "maintenance" : "receipts"}/${input.ownerFingerprint}/${id}/${safeName}`;
  const bytes = await input.file.arrayBuffer();
  const sha256 = toHex(await crypto.subtle.digest("SHA-256", bytes));

  await UPLOADS.put(storageKey, bytes, {
    httpMetadata: { contentType: input.file.type },
    customMetadata: { submissionId: id, sha256 },
  });

  try {
    await DB.prepare(`
      INSERT INTO mobile_submissions (
        id, owner_fingerprint, status, kind, property_label, unit_label, note,
        original_file_name, content_type, byte_size, sha256, storage_key,
        captured_at, created_at, updated_at
      ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, input.ownerFingerprint, input.kind, input.propertyLabel, input.unitLabel, input.note,
      originalFileName, input.file.type, input.file.size, sha256, storageKey,
      input.capturedAt, now, now,
    ).run();
  } catch (error) {
    await UPLOADS.delete(storageKey);
    throw error;
  }

  return (await findSubmission(id))!;
}

export async function listOwnerSubmissions(owner: string): Promise<MobileSubmission[]> {
  await ensureSchema();
  const { DB } = bindings();
  const result = await DB.prepare(`
    SELECT * FROM mobile_submissions
    WHERE owner_fingerprint = ? AND status != 'imported'
    ORDER BY created_at DESC LIMIT 100
  `).bind(owner).all<Record<string, unknown>>();
  return result.results.map(mapSubmission);
}

export async function deleteOwnerSubmission(id: string, owner: string): Promise<boolean> {
  await ensureSchema();
  const stored = await findStoredSubmission(id);
  if (!stored || stored.ownerFingerprint !== owner || stored.status !== "pending") return false;
  const { DB, UPLOADS } = bindings();
  await UPLOADS.delete(stored.storageKey);
  await DB.prepare("DELETE FROM mobile_submissions WHERE id = ? AND owner_fingerprint = ? AND status = 'pending'")
    .bind(id, owner).run();
  return true;
}

export async function listDesktopSubmissions(): Promise<MobileSubmission[]> {
  await ensureSchema();
  const { DB } = bindings();
  const result = await DB.prepare(`
    SELECT * FROM mobile_submissions WHERE status IN ('pending', 'claimed')
    ORDER BY created_at ASC LIMIT 250
  `).all<Record<string, unknown>>();
  return result.results.map(mapSubmission);
}

export async function claimSubmission(id: string): Promise<MobileSubmission | null> {
  await ensureSchema();
  const { DB } = bindings();
  const now = new Date().toISOString();
  await DB.prepare(`
    UPDATE mobile_submissions SET status = 'claimed', claimed_at = COALESCE(claimed_at, ?), updated_at = ?
    WHERE id = ? AND status IN ('pending', 'claimed')
  `).bind(now, now, id).run();
  return findSubmission(id);
}

export async function completeSubmission(id: string): Promise<MobileSubmission | null> {
  await ensureSchema();
  const { DB } = bindings();
  const now = new Date().toISOString();
  await DB.prepare(`
    UPDATE mobile_submissions SET status = 'imported', imported_at = COALESCE(imported_at, ?), updated_at = ?
    WHERE id = ? AND status IN ('pending', 'claimed', 'imported')
  `).bind(now, now, id).run();
  return findSubmission(id);
}

export async function getSubmissionFile(id: string): Promise<{ submission: MobileSubmission; object: R2ObjectBody } | null> {
  await ensureSchema();
  const stored = await findStoredSubmission(id);
  if (!stored || stored.status === "imported") return null;
  const object = await bindings().UPLOADS.get(stored.storageKey);
  if (!object) return null;
  return { submission: publicSubmission(stored), object };
}

async function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    const { DB } = bindings();
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

async function findSubmission(id: string): Promise<MobileSubmission | null> {
  const stored = await findStoredSubmission(id);
  return stored ? publicSubmission(stored) : null;
}

async function findStoredSubmission(id: string): Promise<StoredSubmission | null> {
  const { DB } = bindings();
  const row = await DB.prepare("SELECT * FROM mobile_submissions WHERE id = ?")
    .bind(id).first<Record<string, unknown>>();
  return row ? mapStoredSubmission(row) : null;
}

function mapSubmission(row: Record<string, unknown>): MobileSubmission {
  return publicSubmission(mapStoredSubmission(row));
}

function mapStoredSubmission(row: Record<string, unknown>): StoredSubmission {
  return {
    id: String(row.id),
    ownerFingerprint: String(row.owner_fingerprint),
    status: String(row.status) as StoredSubmission["status"],
    kind: String(row.kind) === "maintenance" ? "maintenance" : "receipt",
    propertyLabel: nullableString(row.property_label),
    unitLabel: nullableString(row.unit_label),
    note: nullableString(row.note),
    originalFileName: String(row.original_file_name),
    contentType: String(row.content_type),
    byteSize: Number(row.byte_size),
    sha256: String(row.sha256),
    storageKey: String(row.storage_key),
    capturedAt: String(row.captured_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    claimedAt: nullableString(row.claimed_at),
    importedAt: nullableString(row.imported_at),
  };
}

function publicSubmission(stored: StoredSubmission): MobileSubmission {
  return {
    id: stored.id,
    status: stored.status,
    kind: stored.kind,
    propertyLabel: stored.propertyLabel,
    unitLabel: stored.unitLabel,
    note: stored.note,
    originalFileName: stored.originalFileName,
    contentType: stored.contentType,
    byteSize: stored.byteSize,
    sha256: stored.sha256,
    capturedAt: stored.capturedAt,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
