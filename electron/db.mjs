import Database from "better-sqlite3";
import fs from "node:fs/promises";
import path from "node:path";
import { backupDocumentArchivePath, buildBackupZipBuffer, inspectBackupZipBuffer, readBackupZipBuffer, ZIP_BACKUP_FORMAT } from "./backupArchive.mjs";
import { ensureRentalTrackerDataDirs, getFileSize, getRentalTrackerDataPaths, hydrateDocumentDataUrl, safeRelativeDocumentPath, writeDocumentBlob } from "./fileStore.mjs";

export const DATABASE_SCHEMA_VERSION = 1;
export const BACKUP_SCHEMA_VERSION = 5;
export const SQLITE_MIGRATION_META_KEY = "legacyLocalStorageImportedAt";
export const DEFAULT_AUTO_BACKUP_RETENTION = 8;

const JSON_ONLY_BACKUP_NOTE = "Document files are stored in the local documents folder and are not embedded in this JSON backup.";

const COLLECTIONS = [
  {
    key: "properties",
    table: "properties",
    columns: {
      property_id: (item) => text(item.id),
      name: (item) => text(item.name),
      address: (item) => text(item.address),
      type: (item) => text(item.type),
    },
  },
  {
    key: "units",
    table: "units",
    columns: {
      unit_id: (item) => text(item.id),
      property_id: (item) => text(item.propertyId),
      name: (item) => text(item.name),
      status: (item) => text(item.status),
    },
  },
  {
    key: "transactions",
    table: "transactions",
    columns: {
      transaction_id: (item) => text(item.id),
      property_id: (item) => text(item.propertyId),
      unit: (item) => text(item.unit),
      txn_date: (item) => text(item.date),
      txn_type: (item) => text(item.type),
      category: (item) => text(item.category),
      amount: (item) => numberOrNull(item.amount),
      status: (item) => text(item.status),
    },
  },
  {
    key: "usePeriods",
    table: "use_periods",
    columns: {
      use_period_id: (item) => text(item.id),
      property_id: (item) => text(item.propertyId),
      unit: (item) => text(item.unit),
      start_date: (item) => text(item.startDate),
      end_date: (item) => text(item.endDate),
      use_type: (item) => text(item.useType),
    },
  },
  {
    key: "recurringTemplates",
    table: "recurring_templates",
    columns: {
      template_id: (item) => text(item.id),
      property_id: (item) => text(item.propertyId),
      unit: (item) => text(item.unit),
      next_due_date: (item) => text(item.nextDueDate),
      txn_type: (item) => text(item.type),
      category: (item) => text(item.category),
      amount: (item) => numberOrNull(item.amount),
      active: (item) => boolInt(item.active !== false),
    },
  },
  {
    key: "recurringDrafts",
    table: "recurring_drafts",
    columns: {
      draft_id: (item) => text(item.id),
      template_id: (item) => text(item.templateId),
      due_date: (item) => text(item.dueDate),
      status: (item) => text(item.status),
    },
  },
  {
    key: "loans",
    table: "loans",
    columns: {
      loan_id: (item) => text(item.id),
      property_id: (item) => text(item.propertyId),
      lender: (item) => text(item.lender),
      loan_type: (item) => text(item.loanType),
      current_balance: (item) => numberOrNull(item.currentBalance),
      next_payment: (item) => text(item.nextPayment),
    },
  },
  {
    key: "loanPayments",
    table: "loan_payments",
    columns: {
      payment_id: (item) => text(item.id),
      loan_id: (item) => text(item.loanId),
      payment_date: (item) => text(item.paymentDate),
      total_payment: (item) => numberOrNull(item.totalPayment),
      interest: (item) => numberOrNull(item.interest),
      principal: (item) => numberOrNull(item.principal),
      escrow: (item) => numberOrNull(item.escrow),
    },
  },
  {
    key: "assets",
    table: "assets",
    columns: {
      asset_id: (item) => text(item.id),
      property_id: (item) => text(item.propertyId),
      unit: (item) => text(item.unit),
      description: (item) => text(item.description),
      asset_type: (item) => text(item.type),
      placed_in_service: (item) => text(item.placedInService),
      cost: (item) => numberOrNull(item.cost),
      basis: (item) => numberOrNull(item.basis),
    },
  },
  {
    key: "leases",
    table: "leases",
    columns: {
      lease_id: (item) => text(item.id),
      property_id: (item) => text(item.propertyId),
      unit: (item) => text(item.unit),
      tenant_name: (item) => text(item.tenantName),
      start_date: (item) => text(item.startDate),
      end_date: (item) => text(item.endDate),
      status: (item) => text(item.status),
      monthly_rent: (item) => numberOrNull(item.monthlyRent),
    },
  },
  {
    key: "tenantLedgerEntries",
    table: "tenant_ledger_entries",
    columns: {
      ledger_entry_id: (item) => text(item.id),
      lease_id: (item) => text(item.leaseId),
      entry_date: (item) => text(item.date),
      kind: (item) => text(item.kind),
      amount: (item) => numberOrNull(item.amount),
      accounting_treatment: (item) => text(item.accountingTreatment),
      transaction_id: (item) => text(item.transactionId),
      created_at: (item) => text(item.createdAt),
    },
  },
  {
    key: "vendors",
    table: "vendors",
    columns: {
      vendor_id: (item) => text(item.id),
      name: (item) => text(item.name),
      phone: (item) => text(item.phone),
      email: (item) => text(item.email),
      active: (item) => boolInt(item.active !== false),
    },
  },
  {
    key: "workOrders",
    table: "work_orders",
    columns: {
      work_order_id: (item) => text(item.id),
      property_id: (item) => text(item.propertyId),
      unit: (item) => text(item.unit),
      title: (item) => text(item.title),
      status: (item) => text(item.status),
      priority: (item) => text(item.priority),
      reported_on: (item) => text(item.reportedOn),
      due_date: (item) => text(item.dueDate),
      vendor_id: (item) => text(item.vendorId),
      transaction_id: (item) => text(item.transactionId),
    },
  },
  {
    key: "documents",
    table: "documents",
    columns: {
      document_id: (item) => text(item.id),
      property_id: (item) => text(item.propertyId),
      name: (item) => text(item.name),
      document_type: (item) => text(item.type),
      lease_id: (item) => text(item.leaseId),
      transaction_id: (item) => text(item.transactionId),
      related_transaction_ids_json: (item) => jsonText(item.relatedTransactionIds),
      work_order_id: (item) => text(item.workOrderId),
      unit: (item) => text(item.unit),
      uploaded_at: (item) => text(item.uploadedAt),
      mime_type: (item) => text(item.mimeType),
      relative_path: (item) => text(item.relativePath || item.filePath),
      file_hash: (item) => text(item.fileHash),
      file_size: (item) => numberOrNull(item.fileSize),
      tags_json: (item) => jsonText(item.tags),
      extracted_text: (item) => text(item.extractedText),
      ocr_status: (item) => text(item.ocrStatus),
      expense_review_dismissed_at: (item) => text(item.expenseReviewDismissedAt),
      work_order_review_dismissed_at: (item) => text(item.workOrderReviewDismissedAt),
      ai_analysis_json: (item) => jsonText(item.aiAnalysis),
    },
    prepare: async (item, paths) => writeDocumentBlob(item, paths.documentsDir),
    hydrate: async (item, paths, errors) => hydrateDocumentDataUrl(item, paths.documentsDir, errors),
  },
  {
    key: "activityLog",
    table: "activity_log",
    columns: {
      activity_id: (item) => text(item.id),
      at: (item) => text(item.at),
      action: (item) => text(item.action),
      category: (item) => text(item.category),
      entity_type: (item) => text(item.entityType),
      entity_id: (item) => text(item.entityId),
      property_id: (item) => text(item.propertyId),
      unit: (item) => text(item.unit),
    },
  },
];

const COLLECTION_KEYS = new Set(COLLECTIONS.map((collection) => collection.key));
const REQUIRED_BACKUP_COLLECTIONS = ["properties", "units", "transactions", "leases", "tenantLedgerEntries", "documents", "assets", "loans", "workOrders"];

function text(value) {
  return value === undefined || value === null ? "" : String(value);
}

function boolInt(value) {
  return value ? 1 : 0;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function jsonText(value) {
  if (value === undefined) return "";
  return JSON.stringify(value);
}

function parseJson(value, fallback) {
  try {
    if (typeof value !== "string" || !value.trim()) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeSettingsForPersistence(settings) {
  const source = isRecord(settings) ? settings : {};
  const { aiOpenAiApiKey: _secret, ...rest } = source;
  return {
    ...rest,
    hasAiOpenAiApiKey: Boolean(source.hasAiOpenAiApiKey || String(source.aiOpenAiApiKey || "").trim()),
  };
}

export function sanitizeBackupForPersistence(backup) {
  const source = isRecord(backup) ? backup : {};
  const data = isRecord(source.data) ? source.data : {};
  return {
    schemaVersion: Number(source.schemaVersion || BACKUP_SCHEMA_VERSION) || BACKUP_SCHEMA_VERSION,
    appVersion: text(source.appVersion),
    exportedAt: text(source.exportedAt) || new Date().toISOString(),
    settings: sanitizeSettingsForPersistence(source.settings),
    data,
  };
}

function createEmptyBackup(appVersion = "") {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion,
    exportedAt: new Date().toISOString(),
    settings: {},
    data: Object.fromEntries(COLLECTIONS.map((collection) => [collection.key, []])),
  };
}

function getWorkspaceData(data) {
  const workspaceData = {};
  for (const [key, value] of Object.entries(isRecord(data) ? data : {})) {
    if (!COLLECTION_KEYS.has(key)) workspaceData[key] = value;
  }
  return workspaceData;
}

function mergeWorkspaceData(coreData, workspaceData) {
  return {
    ...coreData,
    ...(isRecord(workspaceData) ? workspaceData : {}),
  };
}

export function openRentalTrackerDatabase(databasePath) {
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function runDatabaseMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      name TEXT,
      address TEXT,
      type TEXT,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      unit_id TEXT NOT NULL,
      property_id TEXT,
      name TEXT,
      status TEXT,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      property_id TEXT,
      unit TEXT,
      txn_date TEXT,
      txn_type TEXT,
      category TEXT,
      amount REAL,
      status TEXT,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS use_periods (
      id TEXT PRIMARY KEY,
      use_period_id TEXT NOT NULL,
      property_id TEXT,
      unit TEXT,
      start_date TEXT,
      end_date TEXT,
      use_type TEXT,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recurring_templates (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      property_id TEXT,
      unit TEXT,
      next_due_date TEXT,
      txn_type TEXT,
      category TEXT,
      amount REAL,
      active INTEGER,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recurring_drafts (
      id TEXT PRIMARY KEY,
      draft_id TEXT NOT NULL,
      template_id TEXT,
      due_date TEXT,
      status TEXT,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      loan_id TEXT NOT NULL,
      property_id TEXT,
      lender TEXT,
      loan_type TEXT,
      current_balance REAL,
      next_payment TEXT,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS loan_payments (
      id TEXT PRIMARY KEY,
      payment_id TEXT NOT NULL,
      loan_id TEXT,
      payment_date TEXT,
      total_payment REAL,
      interest REAL,
      principal REAL,
      escrow REAL,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      property_id TEXT,
      unit TEXT,
      description TEXT,
      asset_type TEXT,
      placed_in_service TEXT,
      cost REAL,
      basis REAL,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leases (
      id TEXT PRIMARY KEY,
      lease_id TEXT NOT NULL,
      property_id TEXT,
      unit TEXT,
      tenant_name TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT,
      monthly_rent REAL,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tenant_ledger_entries (
      id TEXT PRIMARY KEY,
      ledger_entry_id TEXT NOT NULL,
      lease_id TEXT,
      entry_date TEXT,
      kind TEXT,
      amount REAL,
      accounting_treatment TEXT,
      transaction_id TEXT,
      created_at TEXT,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      name TEXT,
      phone TEXT,
      email TEXT,
      active INTEGER,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS work_orders (
      id TEXT PRIMARY KEY,
      work_order_id TEXT NOT NULL,
      property_id TEXT,
      unit TEXT,
      title TEXT,
      status TEXT,
      priority TEXT,
      reported_on TEXT,
      due_date TEXT,
      vendor_id TEXT,
      transaction_id TEXT,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      property_id TEXT,
      name TEXT,
      document_type TEXT,
      lease_id TEXT,
      transaction_id TEXT,
      related_transaction_ids_json TEXT,
      work_order_id TEXT,
      unit TEXT,
      uploaded_at TEXT,
      mime_type TEXT,
      relative_path TEXT,
      file_hash TEXT,
      file_size INTEGER,
      tags_json TEXT,
      extracted_text TEXT,
      ocr_status TEXT,
      expense_review_dismissed_at TEXT,
      work_order_review_dismissed_at TEXT,
      ai_analysis_json TEXT,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      at TEXT,
      action TEXT,
      category TEXT,
      entity_type TEXT,
      entity_id TEXT,
      property_id TEXT,
      unit TEXT,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_data (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_property_date ON transactions(property_id, txn_date);
    CREATE INDEX IF NOT EXISTS idx_documents_property_uploaded ON documents(property_id, uploaded_at);
    CREATE INDEX IF NOT EXISTS idx_leases_property_status ON leases(property_id, status);
    CREATE INDEX IF NOT EXISTS idx_work_orders_property_status ON work_orders(property_id, status);
  `);

  setMeta(db, "databaseSchemaVersion", String(DATABASE_SCHEMA_VERSION));
  return DATABASE_SCHEMA_VERSION;
}

export function setMeta(db, key, value) {
  db.prepare(`
    INSERT INTO app_meta (key, value, updated_at)
    VALUES (@key, @value, @updatedAt)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run({ key, value: String(value ?? ""), updatedAt: new Date().toISOString() });
}

export function getMeta(db, key, fallback = "") {
  const row = db.prepare("SELECT value FROM app_meta WHERE key = ?").get(key);
  return row ? String(row.value || "") : fallback;
}

export function getAllMeta(db) {
  const rows = db.prepare("SELECT key, value FROM app_meta").all();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

function statementForCollection(db, collection) {
  const specificColumns = Object.keys(collection.columns);
  const allColumns = ["id", ...specificColumns, "json", "updated_at"];
  const placeholders = allColumns.map((column) => `@${column}`).join(", ");
  const updates = allColumns
    .filter((column) => column !== "id")
    .map((column) => `${column} = excluded.${column}`)
    .join(", ");
  return db.prepare(`
    INSERT INTO ${collection.table} (${allColumns.join(", ")})
    VALUES (${placeholders})
    ON CONFLICT(id) DO UPDATE SET ${updates}
  `);
}

function stableItemId(collection, item, index) {
  const id = text(item.id || item.document_id || item[`${collection.key}Id`]).trim();
  return id || `${collection.key}-${index}`;
}

function writeCollection(db, collection, items, now) {
  db.prepare(`DELETE FROM ${collection.table}`).run();
  const statement = statementForCollection(db, collection);
  for (const [index, item] of items.entries()) {
    const id = stableItemId(collection, item, index);
    const row = {
      id,
      json: JSON.stringify({ ...item, id: item.id || id }),
      updated_at: now,
    };
    for (const [column, mapper] of Object.entries(collection.columns)) {
      row[column] = mapper(item);
    }
    statement.run(row);
  }
}

export async function saveAppDataToDatabase({ db, paths, backup, appVersion = "", autoBackup = true, retentionCount = DEFAULT_AUTO_BACKUP_RETENTION }) {
  const now = new Date().toISOString();
  const safeBackup = sanitizeBackupForPersistence({
    ...backup,
    appVersion: backup?.appVersion || appVersion,
    exportedAt: backup?.exportedAt || now,
  });
  const data = safeBackup.data;
  const preparedCollections = {};

  for (const collection of COLLECTIONS) {
    const rawItems = Array.isArray(data[collection.key]) ? data[collection.key] : [];
    preparedCollections[collection.key] = collection.prepare
      ? await Promise.all(rawItems.map((item) => collection.prepare(item, paths)))
      : rawItems;
  }

  const transaction = db.transaction(() => {
    for (const collection of COLLECTIONS) {
      writeCollection(db, collection, preparedCollections[collection.key], now);
    }
    db.prepare(`
      INSERT INTO app_data (key, value, updated_at)
      VALUES ('workspaceData', @value, @updatedAt)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run({ value: JSON.stringify(getWorkspaceData(data)), updatedAt: now });
    db.prepare(`
      INSERT INTO app_data (key, value, updated_at)
      VALUES ('settings', @value, @updatedAt)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run({ value: JSON.stringify(sanitizeSettingsForPersistence(safeBackup.settings)), updatedAt: now });
    setMeta(db, "lastSaveAt", now);
    setMeta(db, "lastAppVersion", safeBackup.appVersion || appVersion || "");
  });

  transaction();

  if (autoBackup) {
    await maybeWriteAutomaticBackup({ db, paths, backup: safeBackup, retentionCount });
  }

  return { ok: true, savedAt: now };
}

export async function createRestorePointInDatabase({ db, paths, backup, appVersion = "", retentionCount = DEFAULT_AUTO_BACKUP_RETENTION }) {
  const saveResult = await saveAppDataToDatabase({
    db,
    paths,
    backup,
    appVersion,
    autoBackup: false,
    retentionCount,
  });
  const backupResult = await maybeWriteAutomaticBackup({
    db,
    paths,
    backup: {
      ...backup,
      appVersion: backup?.appVersion || appVersion,
      exportedAt: backup?.exportedAt || saveResult.savedAt,
    },
    retentionCount,
    force: true,
  });
  return {
    ok: true,
    savedAt: saveResult.savedAt,
    backedUpAt: backupResult.backedUpAt || saveResult.savedAt,
    filePath: backupResult.filePath || "",
  };
}

function readCollection(db, collection) {
  const rows = db.prepare(`SELECT json FROM ${collection.table} ORDER BY rowid ASC`).all();
  return rows.map((row) => parseJson(row.json, {})).filter(isRecord);
}

function getCollectionCounts(db) {
  return Object.fromEntries(
    COLLECTIONS.map((collection) => [
      collection.key,
      db.prepare(`SELECT COUNT(*) AS count FROM ${collection.table}`).get().count,
    ]),
  );
}

export async function loadAppDataFromDatabase({ db, paths, appVersion = "" }) {
  const errors = [];
  const coreData = {};
  for (const collection of COLLECTIONS) {
    const items = readCollection(db, collection);
    coreData[collection.key] = collection.hydrate
      ? await Promise.all(items.map((item) => collection.hydrate(item, paths, errors)))
      : items;
  }
  const workspaceRow = db.prepare("SELECT value FROM app_data WHERE key = 'workspaceData'").get();
  const settingsRow = db.prepare("SELECT value FROM app_data WHERE key = 'settings'").get();
  const data = mergeWorkspaceData(coreData, parseJson(workspaceRow?.value, {}));
  const hasData = COLLECTIONS.some((collection) => Array.isArray(data[collection.key]) && data[collection.key].length > 0);

  return {
    ok: true,
    hasData,
    backup: {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appVersion: getMeta(db, "lastAppVersion", appVersion),
      exportedAt: getMeta(db, "lastSaveAt", new Date().toISOString()),
      settings: sanitizeSettingsForPersistence(parseJson(settingsRow?.value, {})),
      data,
    },
    meta: getAllMeta(db),
    errors,
  };
}

export async function importLegacyLocalStorageData({ db, paths, payload, appVersion = "" }) {
  const source = isRecord(payload) ? payload : {};
  const backup = sanitizeBackupForPersistence({
    schemaVersion: source.schemaVersion || BACKUP_SCHEMA_VERSION,
    appVersion: source.appVersion || appVersion,
    exportedAt: source.exportedAt || new Date().toISOString(),
    settings: source.settings,
    data: isRecord(source.data) ? source.data : source,
  });
  await saveAppDataToDatabase({ db, paths, backup, appVersion, autoBackup: true });
  const importedAt = new Date().toISOString();
  setMeta(db, SQLITE_MIGRATION_META_KEY, importedAt);
  return { ok: true, importedAt };
}

export async function exportBackupFromDatabase({ db, paths, appVersion = "" }) {
  const loaded = await loadAppDataFromDatabase({ db, paths, appVersion });
  return {
    ...loaded.backup,
    exportedAt: new Date().toISOString(),
    backupFormat: "json",
    documentsEmbedded: false,
    documentBackupNote: JSON_ONLY_BACKUP_NOTE,
    settings: sanitizeSettingsForPersistence(loaded.backup.settings),
  };
}

export async function exportBackupArchiveFromDatabase({ db, paths, appVersion = "" }) {
  const backup = await exportBackupFromDatabase({ db, paths, appVersion });
  const archive = await buildBackupZipBuffer({
    backup: {
      ...backup,
      backupFormat: ZIP_BACKUP_FORMAT,
      documentsEmbedded: true,
      documentBackupNote: "Document files are embedded in this zip under documents/.",
    },
    documentsDir: paths.documentsDir,
  });
  return {
    ok: true,
    fileName: `rental-tracker-backup-${String(backup.exportedAt || new Date().toISOString()).slice(0, 10)}.zip`,
    exportedAt: backup.exportedAt,
    buffer: archive.buffer,
    embeddedDocumentFileCount: archive.embeddedDocumentFileCount,
    missingDocumentFiles: archive.missingDocumentFiles,
  };
}

export async function importBackupArchiveToDatabase({ db, paths, archiveBuffer, appVersion = "" }) {
  const imported = await readBackupZipBuffer({ archiveBuffer, documentsDir: paths.documentsDir });
  await saveAppDataToDatabase({
    db,
    paths,
    backup: imported.backup,
    appVersion,
    autoBackup: true,
  });
  return {
    ok: true,
    backup: imported.backup,
    importedAt: new Date().toISOString(),
    restoredDocumentFiles: imported.restoredDocumentFiles,
    missingDocumentFiles: imported.missingDocumentFiles,
  };
}

export async function maybeWriteAutomaticBackup({ db, paths, backup, retentionCount = DEFAULT_AUTO_BACKUP_RETENTION, force = false }) {
  const now = new Date();
  const lastBackupAt = getMeta(db, "lastBackupAt", "");
  const lastBackupMs = Date.parse(lastBackupAt);
  const weeklyMs = 7 * 24 * 60 * 60 * 1000;
  if (!force && !Number.isNaN(lastBackupMs) && now.getTime() - lastBackupMs < weeklyMs) {
    return { ok: true, skipped: true, reason: "recent" };
  }

  await fs.mkdir(paths.backupsDir, { recursive: true });
  const timestamp = now.toISOString();
  const safeTimestamp = timestamp.replace(/[:.]/g, "-");
  const backupFile = path.join(paths.backupsDir, `rental-tracker-auto-backup-${safeTimestamp}.zip`);
  const payload = {
    ...sanitizeBackupForPersistence(backup),
    exportedAt: timestamp,
    backupFormat: ZIP_BACKUP_FORMAT,
    documentsEmbedded: true,
    documentBackupNote: "Document files are embedded in this zip under documents/.",
  };
  const archive = await buildBackupZipBuffer({ backup: payload, documentsDir: paths.documentsDir });
  await fs.writeFile(backupFile, archive.buffer);
  setMeta(db, "lastBackupAt", payload.exportedAt);
  await enforceBackupRetention(paths.backupsDir, retentionCount);
  return { ok: true, filePath: backupFile, backedUpAt: payload.exportedAt };
}

export async function enforceBackupRetention(backupsDir, retentionCount = DEFAULT_AUTO_BACKUP_RETENTION) {
  const entries = await fs.readdir(backupsDir, { withFileTypes: true }).catch(() => []);
  const backupFiles = [];
  for (const entry of entries) {
    if (!entry.isFile() || (!entry.name.endsWith(".json") && !entry.name.endsWith(".zip"))) continue;
    const filePath = path.join(backupsDir, entry.name);
    const stat = await fs.stat(filePath).catch(() => null);
    if (stat) backupFiles.push({ filePath, mtimeMs: stat.mtimeMs });
  }
  backupFiles.sort((left, right) => right.mtimeMs - left.mtimeMs);
  const extras = backupFiles.slice(Math.max(0, retentionCount));
  await Promise.all(extras.map((entry) => fs.unlink(entry.filePath).catch(() => undefined)));
}

function getDatabaseIntegrity(db) {
  try {
    const rows = db.prepare("PRAGMA integrity_check").all();
    const messages = rows.map((row) => String(Object.values(row)[0] || "")).filter(Boolean);
    const result = messages.length ? messages.join("; ") : "ok";
    return {
      databaseIntegrityOk: messages.length === 0 || messages.every((message) => message.toLowerCase() === "ok"),
      databaseIntegrityResult: result,
    };
  } catch (error) {
    return {
      databaseIntegrityOk: false,
      databaseIntegrityResult: error instanceof Error ? error.message : String(error),
    };
  }
}

async function listDocumentStorageFiles(dir, prefix = "") {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listDocumentStorageFiles(absolutePath, relativePath)));
      continue;
    }
    if (!entry.isFile()) continue;
    const stat = await fs.stat(absolutePath).catch(() => null);
    files.push({ relativePath, size: stat?.size || 0 });
  }
  return files;
}

function getReferencedDocumentPaths(db) {
  const rows = db.prepare("SELECT id, json FROM documents").all();
  const referenced = new Map();
  for (const row of rows) {
    const document = parseJson(row.json, {});
    const relativePath = safeRelativeDocumentPath(document.relativePath || document.filePath);
    if (relativePath) referenced.set(relativePath, String(document.id || row.id || "unknown"));
  }
  return referenced;
}

async function getDocumentStorageDiagnostics(db, documentsDir) {
  const files = await listDocumentStorageFiles(documentsDir);
  const referencedPaths = getReferencedDocumentPaths(db);
  const filePaths = new Set(files.map((file) => file.relativePath));
  const orphanFiles = files.filter((file) => !referencedPaths.has(file.relativePath));
  const missingDocumentFiles = [...referencedPaths.keys()].filter((relativePath) => !filePaths.has(relativePath));
  return {
    documentStorageFileCount: files.length,
    referencedDocumentFileCount: referencedPaths.size,
    orphanDocumentFileCount: orphanFiles.length,
    orphanDocumentBytes: orphanFiles.reduce((total, file) => total + Number(file.size || 0), 0),
    missingDocumentFileCount: missingDocumentFiles.length,
  };
}

async function listBackupFiles(backupsDir) {
  const backupEntries = await fs.readdir(backupsDir, { withFileTypes: true }).catch(() => []);
  const backupFiles = [];
  for (const entry of backupEntries) {
    if (!entry.isFile() || (!entry.name.endsWith(".json") && !entry.name.endsWith(".zip"))) continue;
    const filePath = path.join(backupsDir, entry.name);
    const stat = await fs.stat(filePath).catch(() => null);
    if (stat) backupFiles.push({ name: entry.name, filePath, mtimeMs: stat.mtimeMs, size: stat.size });
  }
  backupFiles.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return backupFiles;
}

export function validateBackupEnvelope({ backup, archiveFilePaths = null }) {
  const errors = [];
  const warnings = [];
  if (!isRecord(backup)) {
    return { status: "invalid", label: "Invalid", errors: ["Backup is not a valid object."], warnings: [] };
  }
  if (!isRecord(backup.data)) errors.push("Backup is missing data.");
  const schemaVersion = Number(backup.schemaVersion || 0);
  if (!Number.isFinite(schemaVersion) || schemaVersion <= 0) {
    errors.push("Backup is missing schemaVersion.");
  } else if (schemaVersion > BACKUP_SCHEMA_VERSION) {
    warnings.push(`Backup schema v${schemaVersion} is newer than this app supports.`);
  } else if (schemaVersion < BACKUP_SCHEMA_VERSION) {
    warnings.push(`Backup schema v${schemaVersion} will need migration before restore.`);
  }
  const data = isRecord(backup.data) ? backup.data : {};
  const serializedBackup = JSON.stringify(backup);
  if (/"aiOpenAiApiKey"\s*:/.test(serializedBackup) || /"openAiApiKey"\s*:/.test(serializedBackup) || /"apiKey"\s*:/.test(serializedBackup)) {
    errors.push("Backup appears to contain an API key or secret-shaped field.");
  }
  for (const key of REQUIRED_BACKUP_COLLECTIONS) {
    if (!(key in data)) {
      errors.push(`Missing collection: ${key}.`);
    } else if (!Array.isArray(data[key])) {
      errors.push(`Collection is not an array: ${key}.`);
    }
  }
  const documents = Array.isArray(data.documents) ? data.documents.filter(isRecord) : [];
  for (const document of documents) {
    if (!String(document.id || "").trim()) warnings.push("A document metadata row is missing an id.");
    const relativePath = safeRelativeDocumentPath(document.relativePath || document.filePath);
    if (archiveFilePaths && relativePath) {
      const archivePath = backupDocumentArchivePath(relativePath);
      if (archivePath && !archiveFilePaths.has(archivePath)) {
        warnings.push(`Document file missing from archive for document ${String(document.id || "unknown")}.`);
      }
    }
  }
  const status = errors.length > 0 ? "invalid" : warnings.length > 0 ? "valid_with_warnings" : "valid";
  return {
    status,
    label: status === "valid" ? "Valid" : status === "valid_with_warnings" ? "Valid with warnings" : "Invalid",
    errors,
    warnings,
  };
}

export async function validateLatestBackup({ db, paths }) {
  const backupFiles = await listBackupFiles(paths.backupsDir);
  const latest = backupFiles[0];
  if (!latest) {
    const result = {
      ok: true,
      status: "warning",
      label: "Valid with warnings",
      checkedAt: new Date().toISOString(),
      backupCount: 0,
      warnings: ["No backups found yet."],
      errors: [],
    };
    setMeta(db, "lastBackupValidation", JSON.stringify({ status: result.status, label: result.label, checkedAt: result.checkedAt }));
    return result;
  }
  let backup;
  let archiveFilePaths = null;
  if (latest.name.endsWith(".zip")) {
    const inspected = await inspectBackupZipBuffer(await fs.readFile(latest.filePath));
    backup = inspected.backup;
    archiveFilePaths = inspected.archiveFilePaths;
  } else {
    backup = JSON.parse(await fs.readFile(latest.filePath, "utf8"));
  }
  const validation = validateBackupEnvelope({ backup, archiveFilePaths });
  const result = {
    ok: true,
    ...validation,
    checkedAt: new Date().toISOString(),
    backupName: latest.name,
    backupCount: backupFiles.length,
    mostRecentBackupSizeBytes: latest.size,
    exportedAt: String(backup?.exportedAt || ""),
    schemaVersion: Number(backup?.schemaVersion || 0),
    documentMetadataCount: Array.isArray(backup?.data?.documents) ? backup.data.documents.length : 0,
  };
  setMeta(db, "lastBackupValidation", JSON.stringify({ status: result.status, label: result.label, checkedAt: result.checkedAt }));
  return result;
}

export async function getPersistenceHealth({ db, paths }) {
  const meta = getAllMeta(db);
  const databaseSizeBytes = await getFileSize(paths.databasePath);
  const collectionCounts = getCollectionCounts(db);
  const integrity = getDatabaseIntegrity(db);
  const documentDiagnostics = await getDocumentStorageDiagnostics(db, paths.documentsDir);
  const backupFiles = await listBackupFiles(paths.backupsDir);
  const lastBackupValidation = parseJson(meta.lastBackupValidation, {});

  return {
    persistenceAvailable: true,
    databasePath: paths.databasePath,
    databaseExists: databaseSizeBytes > 0,
    databaseSchemaVersion: Number(meta.databaseSchemaVersion || 0),
    databaseSizeBytes,
    ...integrity,
    collectionCounts,
    structuredDataRecordCount: Object.values(collectionCounts).reduce((total, count) => total + Number(count || 0), 0),
    lastSaveAt: meta.lastSaveAt || "",
    lastBackupAt: meta.lastBackupAt || "",
    migrationStatus: meta[SQLITE_MIGRATION_META_KEY] ? "Migrated from Alpha localStorage data" : "SQLite ready",
    backupPath: paths.backupsDir,
    backupFolderExists: true,
    backupCount: backupFiles.length,
    mostRecentBackupSizeBytes: backupFiles[0]?.size || 0,
    mostRecentBackupName: backupFiles[0]?.name || "",
    lastBackupValidationStatus: lastBackupValidation.status || "",
    lastBackupValidationLabel: lastBackupValidation.label || "",
    lastBackupValidationAt: lastBackupValidation.checkedAt || "",
    documentStoragePath: paths.documentsDir,
    ...documentDiagnostics,
    recentPersistenceErrors: parseJson(meta.recentPersistenceErrors, []),
  };
}

export async function createPersistenceService({ userDataPath, appVersion = "" }) {
  const paths = getRentalTrackerDataPaths(userDataPath);
  await ensureRentalTrackerDataDirs(paths);
  const db = openRentalTrackerDatabase(paths.databasePath);
  runDatabaseMigrations(db);

  return {
    paths,
    db,
    async loadAppData() {
      return loadAppDataFromDatabase({ db, paths, appVersion });
    },
    async saveAppData(payload) {
      return saveAppDataToDatabase({ db, paths, backup: payload, appVersion });
    },
    async createRestorePoint(payload) {
      return createRestorePointInDatabase({ db, paths, backup: payload, appVersion });
    },
    async importLegacyLocalStorageData(payload) {
      return importLegacyLocalStorageData({ db, paths, payload, appVersion });
    },
    async exportBackup() {
      return exportBackupFromDatabase({ db, paths, appVersion });
    },
    async exportBackupArchive() {
      return exportBackupArchiveFromDatabase({ db, paths, appVersion });
    },
    async importBackupArchive(archiveBuffer) {
      return importBackupArchiveToDatabase({ db, paths, archiveBuffer, appVersion });
    },
    async getHealth() {
      return getPersistenceHealth({ db, paths });
    },
    async validateLatestBackup() {
      return validateLatestBackup({ db, paths });
    },
    close() {
      db.close();
    },
  };
}

export function expectedPersistenceTableNames() {
  return [
    "app_meta",
    "app_data",
    ...COLLECTIONS.map((collection) => collection.table),
  ];
}

export function createEmptyBackupForTests(appVersion = "0.0.0") {
  return createEmptyBackup(appVersion);
}
