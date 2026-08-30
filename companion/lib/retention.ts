import { env } from "cloudflare:workers";

export const RETENTION_DAY_OPTIONS = [0, 7, 30] as const;
export type RetentionDays = (typeof RETENTION_DAY_OPTIONS)[number];

export type RetentionOverview = {
  retentionDays: RetentionDays;
  waitingCount: number;
  waitingBytes: number;
  retainedImportedCount: number;
  retainedImportedBytes: number;
  stagedUploadCount: number;
  stagedUploadBytes: number;
  auditReceiptCount: number;
};

export type ImportedSubmissionForRetention = {
  id: string;
  ownerFingerprint: string;
  kind: "receipt" | "maintenance";
  sha256: string;
  storageKey: string;
  byteSize: number;
  capturedAt: string;
  importedAt: string;
};

type CleanupResult = {
  removedFiles: number;
  removedBytes: number;
};

const CREATE_PREFERENCES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS companion_retention_preferences (
  owner_fingerprint TEXT PRIMARY KEY NOT NULL,
  retention_days INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
)`;

const CREATE_RECEIPTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS mobile_submission_receipts (
  id TEXT PRIMARY KEY NOT NULL,
  owner_fingerprint TEXT NOT NULL,
  kind TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  cloud_deleted_at TEXT NOT NULL
)`;

const CREATE_RECEIPTS_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS mobile_submission_receipts_owner_deleted_idx
ON mobile_submission_receipts (owner_fingerprint, cloud_deleted_at DESC)`;

let retentionSchemaPromise: Promise<void> | null = null;

function bindings(): { DB: D1Database; UPLOADS: R2Bucket } {
  const bound = env as unknown as { DB?: D1Database; UPLOADS?: R2Bucket };
  if (!bound.DB || !bound.UPLOADS) throw new Error("Companion storage bindings are unavailable.");
  return { DB: bound.DB, UPLOADS: bound.UPLOADS };
}

export function normalizeRetentionDays(value: unknown): RetentionDays {
  const parsed = Number(value);
  return RETENTION_DAY_OPTIONS.includes(parsed as RetentionDays) ? parsed as RetentionDays : 0;
}

export async function getRetentionOverview(ownerFingerprint: string): Promise<RetentionOverview> {
  await ensureRetentionSchema();
  await cleanupExpiredImportedSubmissions(ownerFingerprint);
  const { DB, UPLOADS } = bindings();
  const [preference, waiting, retained, staged, stagedObjects, receipts] = await Promise.all([
    DB.prepare("SELECT retention_days FROM companion_retention_preferences WHERE owner_fingerprint = ?")
      .bind(ownerFingerprint).first<Record<string, unknown>>(),
    DB.prepare(`
      SELECT COUNT(*) AS item_count, COALESCE(SUM(byte_size), 0) AS byte_count
      FROM mobile_submissions
      WHERE owner_fingerprint = ? AND status IN ('pending', 'claimed')
    `).bind(ownerFingerprint).first<Record<string, unknown>>(),
    DB.prepare(`
      SELECT COUNT(*) AS item_count, COALESCE(SUM(byte_size), 0) AS byte_count
      FROM mobile_submissions
      WHERE owner_fingerprint = ? AND status = 'imported'
    `).bind(ownerFingerprint).first<Record<string, unknown>>(),
    DB.prepare(`
      SELECT COUNT(*) AS item_count
      FROM mobile_upload_sessions
      WHERE owner_fingerprint = ?
    `).bind(ownerFingerprint).first<Record<string, unknown>>(),
    UPLOADS.list({ prefix: `upload-sessions/${ownerFingerprint}/`, limit: 1000 }),
    DB.prepare(`
      SELECT COUNT(*) AS item_count
      FROM mobile_submission_receipts
      WHERE owner_fingerprint = ?
    `).bind(ownerFingerprint).first<Record<string, unknown>>(),
  ]);
  return {
    retentionDays: normalizeRetentionDays(preference?.retention_days),
    waitingCount: rowNumber(waiting, "item_count"),
    waitingBytes: rowNumber(waiting, "byte_count"),
    retainedImportedCount: rowNumber(retained, "item_count"),
    retainedImportedBytes: rowNumber(retained, "byte_count"),
    stagedUploadCount: rowNumber(staged, "item_count"),
    stagedUploadBytes: stagedObjects.objects.reduce((total, object) => total + object.size, 0),
    auditReceiptCount: rowNumber(receipts, "item_count"),
  };
}

export async function updateRetentionDays(
  ownerFingerprint: string,
  retentionDays: RetentionDays,
): Promise<RetentionOverview & CleanupResult> {
  await ensureRetentionSchema();
  const now = new Date().toISOString();
  await bindings().DB.prepare(`
    INSERT INTO companion_retention_preferences (owner_fingerprint, retention_days, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(owner_fingerprint) DO UPDATE SET
      retention_days = excluded.retention_days,
      updated_at = excluded.updated_at
  `).bind(ownerFingerprint, retentionDays, now).run();
  const cleaned = await cleanupExpiredImportedSubmissions(ownerFingerprint);
  return { ...(await getRetentionOverview(ownerFingerprint)), ...cleaned };
}

export async function clearImportedCloudFiles(ownerFingerprint: string): Promise<RetentionOverview & CleanupResult> {
  await ensureRetentionSchema();
  const cleaned = await cleanupImportedRows(ownerFingerprint, null);
  return { ...(await getRetentionOverview(ownerFingerprint)), ...cleaned };
}

export async function applyRetentionAfterImport(submission: ImportedSubmissionForRetention): Promise<void> {
  await ensureRetentionSchema();
  const retentionDays = await readRetentionDays(submission.ownerFingerprint);
  if (retentionDays !== 0) return;
  await archiveAndDeleteSubmission(submission);
}

export async function hasImportReceipt(id: string): Promise<boolean> {
  await ensureRetentionSchema();
  const row = await bindings().DB.prepare("SELECT id FROM mobile_submission_receipts WHERE id = ?")
    .bind(id).first<Record<string, unknown>>();
  return Boolean(row?.id);
}

export async function cleanupExpiredImportedSubmissions(ownerFingerprint: string): Promise<CleanupResult> {
  await ensureRetentionSchema();
  const retentionDays = await readRetentionDays(ownerFingerprint);
  const cutoff = retentionDays === 0
    ? new Date().toISOString()
    : new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  return cleanupImportedRows(ownerFingerprint, cutoff);
}

async function cleanupImportedRows(ownerFingerprint: string, importedBefore: string | null): Promise<CleanupResult> {
  let removedFiles = 0;
  let removedBytes = 0;
  for (let page = 0; page < 5; page += 1) {
    const condition = importedBefore ? "AND imported_at <= ?" : "";
    const statement = bindings().DB.prepare(`
      SELECT id, owner_fingerprint, kind, sha256, storage_key, byte_size, captured_at, imported_at
      FROM mobile_submissions
      WHERE owner_fingerprint = ? AND status = 'imported' ${condition}
      ORDER BY imported_at ASC LIMIT 100
    `);
    const result = importedBefore
      ? await statement.bind(ownerFingerprint, importedBefore).all<Record<string, unknown>>()
      : await statement.bind(ownerFingerprint).all<Record<string, unknown>>();
    if (result.results.length === 0) break;
    for (const row of result.results) {
      const submission = mapImportedSubmission(row);
      await archiveAndDeleteSubmission(submission);
      removedFiles += 1;
      removedBytes += submission.byteSize;
    }
  }
  return { removedFiles, removedBytes };
}

async function archiveAndDeleteSubmission(submission: ImportedSubmissionForRetention): Promise<void> {
  const { DB, UPLOADS } = bindings();
  await UPLOADS.delete(submission.storageKey);
  const deletedAt = new Date().toISOString();
  await DB.batch([
    DB.prepare(`
      INSERT INTO mobile_submission_receipts (
        id, owner_fingerprint, kind, sha256, captured_at, imported_at, cloud_deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        imported_at = excluded.imported_at,
        cloud_deleted_at = excluded.cloud_deleted_at
    `).bind(
      submission.id,
      submission.ownerFingerprint,
      submission.kind,
      submission.sha256,
      submission.capturedAt,
      submission.importedAt,
      deletedAt,
    ),
    DB.prepare("DELETE FROM mobile_submissions WHERE id = ? AND status = 'imported'").bind(submission.id),
  ]);
  await DB.prepare(`
    DELETE FROM mobile_submission_receipts
    WHERE owner_fingerprint = ? AND id NOT IN (
      SELECT id FROM mobile_submission_receipts
      WHERE owner_fingerprint = ?
      ORDER BY cloud_deleted_at DESC LIMIT 500
    )
  `).bind(submission.ownerFingerprint, submission.ownerFingerprint).run();
}

async function readRetentionDays(ownerFingerprint: string): Promise<RetentionDays> {
  const row = await bindings().DB.prepare(
    "SELECT retention_days FROM companion_retention_preferences WHERE owner_fingerprint = ?",
  ).bind(ownerFingerprint).first<Record<string, unknown>>();
  return normalizeRetentionDays(row?.retention_days);
}

async function ensureRetentionSchema(): Promise<void> {
  if (!retentionSchemaPromise) {
    const { DB } = bindings();
    retentionSchemaPromise = DB.batch([
      DB.prepare(CREATE_PREFERENCES_TABLE_SQL),
      DB.prepare(CREATE_RECEIPTS_TABLE_SQL),
      DB.prepare(CREATE_RECEIPTS_INDEX_SQL),
    ]).then(() => undefined).catch((error) => {
      retentionSchemaPromise = null;
      throw error;
    });
  }
  return retentionSchemaPromise;
}

function mapImportedSubmission(row: Record<string, unknown>): ImportedSubmissionForRetention {
  return {
    id: String(row.id),
    ownerFingerprint: String(row.owner_fingerprint),
    kind: String(row.kind) === "maintenance" ? "maintenance" : "receipt",
    sha256: String(row.sha256),
    storageKey: String(row.storage_key),
    byteSize: Number(row.byte_size) || 0,
    capturedAt: String(row.captured_at),
    importedAt: String(row.imported_at || new Date().toISOString()),
  };
}

function rowNumber(row: Record<string, unknown> | null, key: string): number {
  const value = Number(row?.[key]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}
