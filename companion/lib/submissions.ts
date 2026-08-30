import { env } from "cloudflare:workers";

export const MAX_UPLOAD_BYTES = 768 * 1024;
export const PDF_CHUNK_BYTES = 512 * 1024;
export const MAX_CHUNKED_PDF_BYTES = 15 * 1024 * 1024;
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

type ChunkedUploadSession = {
  id: string;
  ownerFingerprint: string;
  kind: MobileSubmission["kind"];
  propertyLabel: string | null;
  unitLabel: string | null;
  note: string | null;
  originalFileName: string;
  contentType: string;
  byteSize: number;
  chunkCount: number;
  sha256: string;
  capturedAt: string;
  createdAt: string;
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

const CREATE_UPLOAD_SESSIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS mobile_upload_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  owner_fingerprint TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'receipt',
  property_label TEXT,
  unit_label TEXT,
  note TEXT,
  original_file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  created_at TEXT NOT NULL
)`;

const CREATE_UPLOAD_SESSIONS_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS mobile_upload_sessions_owner_created_idx
ON mobile_upload_sessions (owner_fingerprint, created_at DESC)`;

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

export async function createChunkedUploadSession(input: {
  ownerFingerprint: string;
  kind: MobileSubmission["kind"];
  propertyLabel: string | null;
  unitLabel: string | null;
  note: string | null;
  originalFileName: string;
  byteSize: number;
  chunkCount: number;
  sha256: string;
  capturedAt: string;
}): Promise<{ uploadId: string; chunkBytes: number }> {
  await ensureSchema();
  if (input.kind !== "receipt") throw new Error("Large PDF upload is available for receipts and bills.");
  if (!/\.pdf$/i.test(input.originalFileName)) throw new Error("Choose a PDF file.");
  if (!Number.isInteger(input.byteSize) || input.byteSize <= MAX_UPLOAD_BYTES || input.byteSize > MAX_CHUNKED_PDF_BYTES) {
    throw new Error("Choose a PDF between 769 KB and 15 MB.");
  }
  const expectedChunkCount = Math.ceil(input.byteSize / PDF_CHUNK_BYTES);
  if (input.chunkCount !== expectedChunkCount) throw new Error("The PDF upload plan is invalid.");
  if (!/^[a-f0-9]{64}$/i.test(input.sha256)) throw new Error("The PDF fingerprint is invalid.");

  await cleanupStaleUploadSessions(input.ownerFingerprint);
  const id = crypto.randomUUID();
  await bindings().DB.prepare(`
    INSERT INTO mobile_upload_sessions (
      id, owner_fingerprint, kind, property_label, unit_label, note,
      original_file_name, content_type, byte_size, chunk_count, sha256,
      captured_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'application/pdf', ?, ?, ?, ?, ?)
  `).bind(
    id, input.ownerFingerprint, input.kind, input.propertyLabel, input.unitLabel, input.note,
    input.originalFileName.slice(-120), input.byteSize, input.chunkCount, input.sha256.toLowerCase(),
    input.capturedAt, new Date().toISOString(),
  ).run();
  return { uploadId: id, chunkBytes: PDF_CHUNK_BYTES };
}

export async function storeChunkedUploadPart(
  id: string,
  owner: string,
  partNumber: number,
  bytes: ArrayBuffer,
): Promise<boolean> {
  await ensureSchema();
  const session = await findChunkedUploadSession(id);
  if (!session || session.ownerFingerprint !== owner) return false;
  if (!Number.isInteger(partNumber) || partNumber < 0 || partNumber >= session.chunkCount) return false;
  const expectedBytes = Math.min(PDF_CHUNK_BYTES, session.byteSize - partNumber * PDF_CHUNK_BYTES);
  if (bytes.byteLength !== expectedBytes) throw new Error("This PDF piece has the wrong size. Try the upload again.");
  await bindings().UPLOADS.put(chunkStorageKey(session, partNumber), bytes, {
    httpMetadata: { contentType: "application/octet-stream" },
    customMetadata: { uploadId: session.id, partNumber: String(partNumber) },
  });
  return true;
}

export async function completeChunkedUpload(id: string, owner: string): Promise<MobileSubmission | null> {
  await ensureSchema();
  const existing = await findStoredSubmission(id);
  if (existing?.ownerFingerprint === owner) return publicSubmission(existing);
  const session = await findChunkedUploadSession(id);
  if (!session || session.ownerFingerprint !== owner) return null;
  const { DB, UPLOADS } = bindings();
  const parts: ArrayBuffer[] = [];
  let totalBytes = 0;
  for (let partNumber = 0; partNumber < session.chunkCount; partNumber += 1) {
    const object = await UPLOADS.get(chunkStorageKey(session, partNumber));
    if (!object) throw new Error(`PDF upload is missing piece ${partNumber + 1}. Try sending it again.`);
    const bytes = await object.arrayBuffer();
    const expectedBytes = Math.min(PDF_CHUNK_BYTES, session.byteSize - partNumber * PDF_CHUNK_BYTES);
    if (bytes.byteLength !== expectedBytes) throw new Error(`PDF piece ${partNumber + 1} is incomplete. Try sending it again.`);
    parts.push(bytes);
    totalBytes += bytes.byteLength;
  }
  if (totalBytes !== session.byteSize) throw new Error("The completed PDF size does not match the selected file.");

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const part of parts) {
    merged.set(new Uint8Array(part), offset);
    offset += part.byteLength;
  }
  const sha256 = toHex(await crypto.subtle.digest("SHA-256", merged));
  if (sha256 !== session.sha256) throw new Error("The completed PDF did not pass its integrity check. Try sending it again.");

  const safeName = session.originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "capture.pdf";
  const storageKey = `receipts/${session.ownerFingerprint}/${session.id}/${safeName}`;
  await UPLOADS.put(storageKey, merged, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: { submissionId: session.id, sha256 },
  });

  const now = new Date().toISOString();
  try {
    await DB.prepare(`
      INSERT INTO mobile_submissions (
        id, owner_fingerprint, status, kind, property_label, unit_label, note,
        original_file_name, content_type, byte_size, sha256, storage_key,
        captured_at, created_at, updated_at
      ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, 'application/pdf', ?, ?, ?, ?, ?, ?)
    `).bind(
      session.id, session.ownerFingerprint, session.kind, session.propertyLabel, session.unitLabel, session.note,
      session.originalFileName, session.byteSize, sha256, storageKey, session.capturedAt, now, now,
    ).run();
  } catch (error) {
    await UPLOADS.delete(storageKey);
    throw error;
  }

  try {
    await deleteChunkObjects(session);
    await DB.prepare("DELETE FROM mobile_upload_sessions WHERE id = ?").bind(session.id).run();
  } catch {
    // The capture is already durable; a later upload start will clean stale staging pieces.
  }
  return findSubmission(session.id);
}

export async function cancelChunkedUpload(id: string, owner: string): Promise<boolean> {
  await ensureSchema();
  const session = await findChunkedUploadSession(id);
  if (!session || session.ownerFingerprint !== owner) return false;
  await deleteChunkObjects(session);
  await bindings().DB.prepare("DELETE FROM mobile_upload_sessions WHERE id = ? AND owner_fingerprint = ?")
    .bind(id, owner).run();
  return true;
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

export async function deleteDesktopSubmission(id: string): Promise<boolean> {
  await ensureSchema();
  const stored = await findStoredSubmission(id);
  if (!stored || stored.status === "imported") return false;
  const { DB, UPLOADS } = bindings();
  await UPLOADS.delete(stored.storageKey);
  await DB.prepare("DELETE FROM mobile_submissions WHERE id = ? AND status IN ('pending', 'claimed')")
    .bind(id).run();
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
      DB.prepare(CREATE_UPLOAD_SESSIONS_TABLE_SQL),
      DB.prepare(CREATE_UPLOAD_SESSIONS_INDEX_SQL),
    ]).then(() => undefined).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function findChunkedUploadSession(id: string): Promise<ChunkedUploadSession | null> {
  const row = await bindings().DB.prepare("SELECT * FROM mobile_upload_sessions WHERE id = ?")
    .bind(id).first<Record<string, unknown>>();
  if (!row) return null;
  return {
    id: String(row.id),
    ownerFingerprint: String(row.owner_fingerprint),
    kind: String(row.kind) === "maintenance" ? "maintenance" : "receipt",
    propertyLabel: nullableString(row.property_label),
    unitLabel: nullableString(row.unit_label),
    note: nullableString(row.note),
    originalFileName: String(row.original_file_name),
    contentType: String(row.content_type),
    byteSize: Number(row.byte_size),
    chunkCount: Number(row.chunk_count),
    sha256: String(row.sha256),
    capturedAt: String(row.captured_at),
    createdAt: String(row.created_at),
  };
}

function chunkStorageKey(session: ChunkedUploadSession, partNumber: number): string {
  return `upload-sessions/${session.ownerFingerprint}/${session.id}/${String(partNumber).padStart(3, "0")}`;
}

async function deleteChunkObjects(session: ChunkedUploadSession): Promise<void> {
  const keys = Array.from({ length: session.chunkCount }, (_, partNumber) => chunkStorageKey(session, partNumber));
  if (keys.length > 0) await bindings().UPLOADS.delete(keys);
}

async function cleanupStaleUploadSessions(owner: string): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { DB } = bindings();
  const result = await DB.prepare(`
    SELECT * FROM mobile_upload_sessions
    WHERE owner_fingerprint = ? AND created_at < ?
    ORDER BY created_at ASC LIMIT 10
  `).bind(owner, cutoff).all<Record<string, unknown>>();
  for (const row of result.results) {
    const session = {
      id: String(row.id),
      ownerFingerprint: String(row.owner_fingerprint),
      kind: String(row.kind) === "maintenance" ? "maintenance" as const : "receipt" as const,
      propertyLabel: nullableString(row.property_label),
      unitLabel: nullableString(row.unit_label),
      note: nullableString(row.note),
      originalFileName: String(row.original_file_name),
      contentType: String(row.content_type),
      byteSize: Number(row.byte_size),
      chunkCount: Number(row.chunk_count),
      sha256: String(row.sha256),
      capturedAt: String(row.captured_at),
      createdAt: String(row.created_at),
    } satisfies ChunkedUploadSession;
    await deleteChunkObjects(session);
    await DB.prepare("DELETE FROM mobile_upload_sessions WHERE id = ?").bind(session.id).run();
  }
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
