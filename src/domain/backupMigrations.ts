import { normalizeTenantLedgerAccountingTreatment } from "./tenantLedgerPosting.ts";

type BackupRecord = Record<string, unknown>;

export const BACKUP_SCHEMA_VERSION = 5;

export type BackupEnvelope = {
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  settings?: unknown;
  data: BackupRecord;
};

export type BackupMigrationResult = {
  backup: BackupEnvelope;
  migratedFromSchemaVersion: number;
  migrationsApplied: number[];
};

function isRecord(value: unknown): value is BackupRecord {
  return Boolean(value) && typeof value === "object";
}

function toSchemaVersion(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toTrimmedString(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeActivityLogItem(entry: BackupRecord): BackupRecord {
  return {
    ...entry,
    id: toTrimmedString(entry.id, "ale-legacy-" + Date.now()),
    at: toTrimmedString(entry.at, new Date().toISOString()),
    actor: toTrimmedString(entry.actor, "local-user"),
    action: toTrimmedString(entry.action, "update"),
    entityType: toTrimmedString(entry.entityType, "record"),
    entityId: toTrimmedString(entry.entityId, "unknown"),
    propertyId: toTrimmedString(entry.propertyId),
    unit: toTrimmedString(entry.unit),
    summary: toTrimmedString(entry.summary, "Activity recorded."),
    details: toTrimmedString(entry.details),
    immutable: true,
  };
}
function mapRecordArray(
  value: unknown,
  mapper: (item: BackupRecord) => BackupRecord,
) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is BackupRecord => isRecord(item))
    .map((item) => mapper(item));
}

function migrateV1ToV2(data: BackupRecord): BackupRecord {
  return {
    ...data,
    transactions: mapRecordArray(data.transactions, (txn) => ({
      ...txn,
      status: txn.status === "voided" ? "voided" : "active",
      reconciled: txn.reconciled === true,
    })),
    recurringTemplates: mapRecordArray(data.recurringTemplates, (template) => ({
      ...template,
      active: template.active !== false,
      reviewRequired: template.reviewRequired !== false,
    })),
    recurringDrafts: mapRecordArray(data.recurringDrafts, (draft) => ({
      ...draft,
      status: draft.status === "approved" ? "approved" : "draft",
    })),
    loans: mapRecordArray(data.loans, (loan) => ({
      ...loan,
      scheduledMortgageInsurance: toFiniteNumber(
        loan.scheduledMortgageInsurance,
        0,
      ),
      defaultExtraPrincipal: toFiniteNumber(loan.defaultExtraPrincipal, 0),
    })),
    loanPayments: mapRecordArray(data.loanPayments, (payment) => ({
      ...payment,
      mortgageInsurance: toFiniteNumber(payment.mortgageInsurance, 0),
      extraPrincipal: toFiniteNumber(payment.extraPrincipal, 0),
    })),
    assets: mapRecordArray(data.assets, (asset) => ({
      ...asset,
      bonusEligible: asset.bonusEligible === true,
      bonusElected: asset.bonusElected === true,
      bonusRate: toFiniteNumber(asset.bonusRate, 0),
    })),
  };
}


function migrateV2ToV3(data: BackupRecord): BackupRecord {
  return {
    ...data,
    tenantLedgerEntries: mapRecordArray(data.tenantLedgerEntries, (entry) => ({
      ...entry,
      kind:
        entry.kind === "payment" ||
        entry.kind === "credit" ||
        entry.kind === "refund" ||
        entry.kind === "adjustment"
          ? entry.kind
          : "charge",
      amount: toFiniteNumber(entry.amount, 0),
      memo: typeof entry.memo === "string" ? entry.memo : "",
      createdAt:
        typeof entry.createdAt === "string" && entry.createdAt
          ? entry.createdAt
          : new Date().toISOString(),
    })),
  };
}

function migrateV3ToV4(data: BackupRecord): BackupRecord {
  return {
    ...data,
    transactions: mapRecordArray(data.transactions, (txn) => ({
      ...txn,
      tenantLedgerEntryId:
        typeof txn.tenantLedgerEntryId === "string" && txn.tenantLedgerEntryId.trim()
          ? txn.tenantLedgerEntryId.trim()
          : undefined,
    })),
    tenantLedgerEntries: mapRecordArray(data.tenantLedgerEntries, (entry) => ({
      ...entry,
      accountingTreatment: normalizeTenantLedgerAccountingTreatment(entry.accountingTreatment),
      transactionId:
        typeof entry.transactionId === "string" && entry.transactionId.trim()
          ? entry.transactionId.trim()
          : undefined,
    })),
  };
}

function migrateV4ToV5(data: BackupRecord): BackupRecord {
  return {
    ...data,
    activityLog: mapRecordArray(data.activityLog, (entry) => normalizeActivityLogItem(entry)),
  };
}

const BACKUP_MIGRATORS: Record<number, (data: BackupRecord) => BackupRecord> = {
  2: migrateV1ToV2,
  3: migrateV2ToV3,
  4: migrateV3ToV4,
  5: migrateV4ToV5,
};

export function normalizeImportedBackup(rawBackup: unknown): BackupEnvelope | null {
  if (!isRecord(rawBackup)) return null;

  if (isRecord(rawBackup.data)) {
    return {
      schemaVersion: toSchemaVersion(rawBackup.schemaVersion),
      appVersion:
        typeof rawBackup.appVersion === "string" ? rawBackup.appVersion : "",
      exportedAt:
        typeof rawBackup.exportedAt === "string" ? rawBackup.exportedAt : "",
      settings: rawBackup.settings,
      data: rawBackup.data,
    };
  }

  return {
    schemaVersion: 1,
    appVersion: "",
    exportedAt:
      typeof rawBackup.exportedAt === "string" ? rawBackup.exportedAt : "",
    settings: rawBackup.settings,
    data: rawBackup,
  };
}

export function migrateBackupEnvelope(
  backup: BackupEnvelope,
  targetSchemaVersion = BACKUP_SCHEMA_VERSION,
): BackupEnvelope {
  let workingVersion = toSchemaVersion(backup.schemaVersion);
  if (workingVersion > targetSchemaVersion) {
    throw new Error(
      `Backup schema version ${workingVersion} is newer than supported version ${targetSchemaVersion}.`,
    );
  }

  let workingData = isRecord(backup.data) ? backup.data : {};

  while (workingVersion < targetSchemaVersion) {
    const nextVersion = workingVersion + 1;
    const migrator = BACKUP_MIGRATORS[nextVersion];
    if (!migrator) {
      throw new Error(
        `No backup migrator found for schema version ${workingVersion} -> ${nextVersion}.`,
      );
    }
    workingData = migrator(workingData);
    workingVersion = nextVersion;
  }

  return {
    ...backup,
    schemaVersion: workingVersion,
    data: workingData,
  };
}

export function normalizeAndMigrateBackup(
  rawBackup: unknown,
  targetSchemaVersion = BACKUP_SCHEMA_VERSION,
): BackupMigrationResult {
  const normalized = normalizeImportedBackup(rawBackup);
  if (!normalized) {
    throw new Error("Invalid backup file.");
  }

  const migrated = migrateBackupEnvelope(normalized, targetSchemaVersion);
  const migrationsApplied: number[] = [];
  for (
    let version = normalized.schemaVersion + 1;
    version <= migrated.schemaVersion;
    version += 1
  ) {
    migrationsApplied.push(version);
  }

  return {
    backup: migrated,
    migratedFromSchemaVersion: normalized.schemaVersion,
    migrationsApplied,
  };
}







