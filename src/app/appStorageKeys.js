export const DEFAULT_DASHBOARD_YEAR = String(new Date().getFullYear());

export const AUTO_BACKUP_STORAGE_KEY = "rental-tracker:auto-backups:v1";
export const AUTO_BACKUP_META_STORAGE_KEY = "rental-tracker:auto-backup-meta:v1";
export const APP_DATA_STORAGE_KEY = "rental-tracker:app-data:v1";
export const LEASE_REMINDER_NOTIFICATION_STORAGE_KEY = "rental-tracker:lease-reminder-notifications:v1";
export const RELEASE_NOTES_SEEN_STORAGE_KEY = "rental-tracker:release-notes-seen:v1";
export const AUTO_BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const AUTO_BACKUP_MAX_ENTRIES = 8;
