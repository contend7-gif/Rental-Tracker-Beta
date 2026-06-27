import type { ActivityCategory, ActivityLogEntry } from "../models.ts";

export const ACTIVITY_LOG_MAX = 2000;

type StateSetter<T> = (updater: T[] | ((prev: T[]) => T[])) => void;

export type AppendActivityLog = (input: {
  action: string;
  entityType: string;
  entityId: string;
  propertyId?: string;
  unit?: string;
  summary: string;
  details?: string;
  category?: ActivityCategory;
}) => void;

export function normalizeActivityLogEntry(value: unknown): ActivityLogEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  const id = String(entry.id || "").trim() || `ale-${Date.now()}`;
  const at = String(entry.at || "").trim() || new Date().toISOString();
  const action = String(entry.action || "").trim();
  const entityType = String(entry.entityType || "").trim();
  const entityId = String(entry.entityId || "").trim();
  const summary = String(entry.summary || "").trim();
  if (!action || !entityType || !entityId || !summary) return null;

  const propertyId = String(entry.propertyId || "").trim();
  const unit = String(entry.unit || "").trim();
  const details = String(entry.details || "").trim();
  const actorRole = String(entry.actorRole || "").trim();
  const category = String(entry.category || "").trim() as ActivityCategory;

  return {
    id,
    at,
    actor: String(entry.actor || "local-user").trim() || "local-user",
    actorRole: actorRole || undefined,
    action,
    category: category || undefined,
    entityType,
    entityId,
    propertyId: propertyId || undefined,
    unit: unit || undefined,
    summary,
    details: details || undefined,
    immutable: true,
  };
}

export function createActivityLogEntry(input: {
  action: string;
  entityType: string;
  entityId: string;
  propertyId?: string;
  unit?: string;
  summary: string;
  details?: string;
  actor?: string;
  actorRole?: string;
  category?: ActivityCategory;
}): ActivityLogEntry {
  return {
    id: `ale-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
    at: new Date().toISOString(),
    actor: String(input.actor || "local-user").trim() || "local-user",
    actorRole: String(input.actorRole || "").trim() || undefined,
    action: String(input.action || "update").trim() || "update",
    category: input.category,
    entityType: String(input.entityType || "record").trim() || "record",
    entityId: String(input.entityId || "unknown").trim() || "unknown",
    propertyId: String(input.propertyId || "").trim() || undefined,
    unit: String(input.unit || "").trim() || undefined,
    summary: String(input.summary || "Activity recorded.").trim() || "Activity recorded.",
    details: String(input.details || "").trim() || undefined,
    immutable: true,
  };
}

export function inferActivityCategory(action: string, entityType: string): ActivityCategory {
  const normalizedAction = String(action || "").trim().toLowerCase();
  const normalizedEntityType = String(entityType || "").trim().toLowerCase();

  if (normalizedEntityType.includes("document")) return "document";
  if (normalizedEntityType.includes("work-order") || normalizedEntityType.includes("vendor")) return "maintenance";
  if (normalizedEntityType.includes("setting") || normalizedEntityType.includes("permission") || normalizedEntityType.includes("security")) return "security";
  if (normalizedEntityType.includes("report") || normalizedEntityType.includes("statement")) return "reporting";
  if (normalizedAction === "import" || normalizedAction === "export" || normalizedAction === "restore" || normalizedAction === "backup" || normalizedAction === "demo-data") return "data";
  if (normalizedAction === "reconcile" || normalizedAction === "unreconcile" || normalizedAction === "assign" || normalizedAction === "link" || normalizedAction === "status") return "workflow";
  return "record";
}

export function createActivityActions(args: {
  setActivityLog: StateSetter<ActivityLogEntry>;
  actorName?: string;
  actorRole?: string;
}) {
  const auditActorName = String(args.actorName || "local-user").trim() || "local-user";
  const auditActorRole = String(args.actorRole || "").trim();

  const appendActivityLog: AppendActivityLog = (input) => {
    const entry = createActivityLogEntry({
      ...input,
      actor: auditActorName,
      actorRole: auditActorRole,
      category: input.category || inferActivityCategory(input.action, input.entityType),
    });
    args.setActivityLog((prev) => [entry, ...prev].slice(0, ACTIVITY_LOG_MAX));
  };

  return {
    appendActivityLog,
    addActivityLogEntry: appendActivityLog,
  };
}
