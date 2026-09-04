const DAY_MS = 24 * 60 * 60 * 1000;

function validTimestamp(value: unknown) {
  const parsed = Date.parse(String(value || ""));
  return Number.isNaN(parsed) ? null : parsed;
}

export function buildBackupConfidence(args: {
  now?: string;
  lastBackupAt?: string;
  lastRecoverableBackupAt?: string;
  intervalDays?: number;
  encryptionAvailable?: boolean;
  latestEncrypted?: boolean;
}) {
  const nowMs = validTimestamp(args.now) ?? Date.now();
  const intervalDays = Math.max(1, Math.min(30, Math.round(Number(args.intervalDays || 3))));
  const backupMs = validTimestamp(args.lastBackupAt);
  const recoverableMs = validTimestamp(args.lastRecoverableBackupAt);
  const dueMs = recoverableMs === null ? null : recoverableMs + intervalDays * DAY_MS;
  const overdueDays = dueMs === null || nowMs <= dueMs ? 0 : Math.ceil((nowMs - dueMs) / DAY_MS);
  let status: "ready" | "overdue" | "needs_verification" | "missing" | "needs_encryption" = "ready";
  if (backupMs === null) status = "missing";
  else if (recoverableMs === null) status = "needs_verification";
  else if (overdueDays > 0) status = "overdue";
  else if (args.encryptionAvailable && !args.latestEncrypted) status = "needs_encryption";
  const labels = {
    ready: "Recoverable",
    overdue: "Backup overdue",
    needs_verification: "Needs verification",
    missing: "No restore point",
    needs_encryption: "Create protected backup",
  };
  return {
    status,
    label: labels[status],
    healthy: status === "ready",
    intervalDays,
    overdueDays,
    nextDueAt: dueMs === null ? "" : new Date(dueMs).toISOString(),
  };
}
