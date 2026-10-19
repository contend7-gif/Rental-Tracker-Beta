import type { LeaseTurnover } from "../models.ts";

export const TURNOVER_TEMPLATE = [
  "Inspect condition and take before photos",
  "Clean kitchen, bathroom and living spaces",
  "Wash and replace linens and towels",
  "Check inventory and restock supplies",
  "Complete repairs and check appliances",
  "Check keys and access",
  "Take after photos and confirm arrival readiness",
];

export function createLeaseTurnover(): LeaseTurnover {
  return {
    status: "departing",
    tasks: TURNOVER_TEMPLATE.map((title, index) => ({
      id: `turnover-task-${index + 1}`, title, dueDate: "", completedAt: "", notes: "", photoIds: [],
    })),
  };
}

function dateOnly(value: unknown) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : "";
}

export function normalizeLeaseTurnover(value: unknown): LeaseTurnover | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Partial<LeaseTurnover>;
  const seen = new Set<string>();
  const tasks = (Array.isArray(input.tasks) ? input.tasks : []).flatMap((task) => {
    if (!task || typeof task !== "object") return [];
    const id = String(task.id || "").trim();
    const title = String(task.title || "").trim();
    if (!id || !title || seen.has(id)) return [];
    seen.add(id);
    return [{ id, title, dueDate: dateOnly(task.dueDate),
      completedAt: typeof task.completedAt === "string" && Number.isFinite(Date.parse(task.completedAt)) ? task.completedAt : "",
      notes: String(task.notes || ""),
      photoIds: [...new Set((Array.isArray(task.photoIds) ? task.photoIds : []).filter((id): id is string => typeof id === "string" && Boolean(id.trim())))],
    }];
  });
  return { status: input.status === "preparing" || input.status === "ready" ? input.status : "departing", tasks };
}
