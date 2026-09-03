import type { OperationsCalendarItem } from "./operationsCalendar.ts";

export type OperationsNotificationDigest = {
  title: string;
  body: string;
  itemCount: number;
  signature: string;
};

const SOURCE_LABELS: Record<string, string> = {
  lease: "lease",
  maintenance: "maintenance",
  document: "document",
  recurring: "recurring entry",
  smart_check: "Smart Check",
  planning: "planning item",
  loan: "loan payment",
};

export function buildOperationsNotificationDigest(items: OperationsCalendarItem[], todayIso: string): OperationsNotificationDigest | null {
  const dueItems = items.filter((item) => item.source !== "rent" && item.date <= todayIso && (item.role !== "milestone" || item.date === todayIso));
  if (dueItems.length === 0) return null;
  const overdueCount = dueItems.filter((item) => item.date < todayIso).length;
  const todayCount = dueItems.length - overdueCount;
  const sourceCounts = new Map<string, number>();
  dueItems.forEach((item) => sourceCounts.set(item.source, (sourceCounts.get(item.source) || 0) + 1));
  const sourceSummary = [...sourceCounts.entries()]
    .slice(0, 3)
    .map(([source, count]) => `${count} ${SOURCE_LABELS[source] || "calendar item"}${count === 1 ? "" : "s"}`)
    .join(", ");
  const statusParts = [
    overdueCount > 0 ? `${overdueCount} overdue` : "",
    todayCount > 0 ? `${todayCount} due today` : "",
  ].filter(Boolean).join(" · ");
  return {
    title: `Rental Tracker · ${dueItems.length} ${dueItems.length === 1 ? "item needs" : "items need"} attention`,
    body: `${statusParts}. ${sourceSummary}. Open Operations Calendar to review.`,
    itemCount: dueItems.length,
    signature: dueItems.map((item) => item.id).sort().join("|"),
  };
}
