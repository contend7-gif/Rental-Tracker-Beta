import type {
  DocumentItem,
  Lease,
  Loan,
  RecurringTemplate,
  WorkOrder,
} from "../models.ts";
import type { LeaseAutomationReminder } from "./leaseAutomation.ts";
import type { RecurringExpenseCheck } from "./recurringExpenseChecks.ts";
import { normalizeLeaseAgreementType } from "./leaseTerms.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export type OperationsCalendarSource =
  | "rent"
  | "lease"
  | "maintenance"
  | "document"
  | "recurring"
  | "smart_check"
  | "planning"
  | "loan";

export type OperationsCalendarItem = {
  id: string;
  source: OperationsCalendarSource;
  sourceRecordId: string;
  date: string;
  title: string;
  detail: string;
  propertyId: string;
  unit?: string;
  priority?: string;
  searchText?: string;
  expectedDate?: string;
  role?: "action" | "milestone";
  eventKind?: "lease_start" | "lease_review" | "lease_end" | "lease_move_out";
};

export type PlanningCalendarAction = {
  id: string;
  title: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  notes?: string;
  propertyId?: string;
  unit?: string;
};

export type OperationsCalendarBucket = "attention" | "next7" | "next30" | "later";

function validIsoDate(value: unknown): value is string {
  const date = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function diffDays(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00.000Z`);
  const end = new Date(`${endIso}T00:00:00.000Z`);
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

function shiftIsoDate(date: string, offsetDays: number) {
  if (!validIsoDate(date)) return "";
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offsetDays);
  return shifted.toISOString().slice(0, 10);
}

function leaseReviewLeadDays(lease: Lease, configuredDays: number) {
  if (!validIsoDate(lease.startDate) || !validIsoDate(lease.endDate)) return 0;
  const termDays = diffDays(lease.startDate, lease.endDate);
  if (termDays <= 1 || configuredDays <= 0) return 0;
  return Math.min(configuredDays, Math.max(1, Math.floor(termDays / 3)));
}

function sourcePriority(source: OperationsCalendarSource) {
  if (source === "rent") return 0;
  if (source === "maintenance") return 1;
  if (source === "lease") return 2;
  if (source === "document") return 3;
  if (source === "loan") return 4;
  if (source === "smart_check") return 5;
  if (source === "recurring") return 6;
  return 7;
}

function sortItems(items: OperationsCalendarItem[]) {
  return items.sort((left, right) => {
    const dateDiff = left.date.localeCompare(right.date);
    if (dateDiff !== 0) return dateDiff;
    const sourceDiff = sourcePriority(left.source) - sourcePriority(right.source);
    if (sourceDiff !== 0) return sourceDiff;
    return left.title.localeCompare(right.title);
  });
}

export function buildOperationsCalendarItems(args: {
  leaseAutomationReminders?: LeaseAutomationReminder[];
  leases?: Lease[];
  workOrders?: WorkOrder[];
  documents?: DocumentItem[];
  recurringTemplates?: RecurringTemplate[];
  recurringExpenseChecks?: RecurringExpenseCheck[];
  planningActionItems?: PlanningCalendarAction[];
  loans?: Loan[];
  leaseReviewDaysBefore?: number;
}): OperationsCalendarItem[] {
  const items: OperationsCalendarItem[] = [];

  (args.leaseAutomationReminders || []).forEach((reminder) => {
    if (!validIsoDate(reminder.dueDate)) return;
    items.push({
      id: `rent:${reminder.id}`,
      source: "rent",
      sourceRecordId: reminder.leaseId,
      date: reminder.dueDate,
      title: reminder.title,
      detail: reminder.message,
      propertyId: reminder.propertyId,
      unit: reminder.unit,
      priority: reminder.kind === "late" ? "urgent" : reminder.kind === "due_today" ? "high" : "normal",
    });
  });

  const configuredLeaseReviewDays = Math.max(0, Math.min(180, Math.round(Number(args.leaseReviewDaysBefore ?? 60))));
  (args.leases || []).forEach((lease) => {
    if (!lease?.id) return;
    const tenantLabel = lease.tenantName || lease.unit || "Tenant";
    const unitLabel = lease.unit || "Shared";
    if (validIsoDate(lease.startDate)) {
      items.push({
        id: `lease-start:${lease.id}:${lease.startDate}`,
        source: "lease",
        sourceRecordId: lease.id,
        date: lease.startDate,
        title: `Lease starts: ${tenantLabel}`,
        detail: `${unitLabel} occupancy begins.`,
        propertyId: lease.propertyId,
        unit: lease.unit,
        priority: "normal",
        role: "milestone",
        eventKind: "lease_start",
      });
    }

    if (validIsoDate(lease.actualEndDate)) {
      items.push({
        id: `lease-move-out:${lease.id}:${lease.actualEndDate}`,
        source: "lease",
        sourceRecordId: lease.id,
        date: lease.actualEndDate,
        title: `Move-out recorded: ${tenantLabel}`,
        detail: `${unitLabel} actual move-out date.`,
        propertyId: lease.propertyId,
        unit: lease.unit,
        priority: "normal",
        role: "milestone",
        eventKind: "lease_move_out",
      });
      return;
    }

    const agreementType = normalizeLeaseAgreementType(lease);
    if (agreementType === "month_to_month" || !validIsoDate(lease.endDate)) return;
    if (lease.status === "Ended") {
      items.push({
        id: `lease-ended:${lease.id}:${lease.endDate}`,
        source: "lease",
        sourceRecordId: lease.id,
        date: lease.endDate,
        title: `Lease ended: ${tenantLabel}`,
        detail: `${unitLabel} recorded term end.`,
        propertyId: lease.propertyId,
        unit: lease.unit,
        priority: "normal",
        role: "milestone",
        eventKind: "lease_end",
      });
      return;
    }

    const reviewLeadDays = leaseReviewLeadDays(lease, configuredLeaseReviewDays);
    const reviewDate = reviewLeadDays > 0 ? shiftIsoDate(lease.endDate, -reviewLeadDays) : "";
    if (validIsoDate(reviewDate) && reviewDate > lease.startDate) {
      items.push({
        id: `lease-review:${lease.id}:${reviewDate}`,
        source: "lease",
        sourceRecordId: lease.id,
        date: reviewDate,
        title: agreementType === "fixed_then_month_to_month" ? `Review lease transition: ${tenantLabel}` : `Review renewal or move-out: ${tenantLabel}`,
        detail: agreementType === "fixed_then_month_to_month"
          ? `${unitLabel} fixed term ends in ${reviewLeadDays} days. Confirm the renewal or month-to-month plan.`
          : `${unitLabel} term ends in ${reviewLeadDays} days. Confirm renewal, notice, or turnover plans; this is a planning reminder, not a legal deadline.`,
        propertyId: lease.propertyId,
        unit: lease.unit,
        priority: lease.status === "Pending Renewal" ? "high" : "normal",
        role: "action",
        eventKind: "lease_review",
      });
    }
    items.push({
      id: `lease-end:${lease.id}:${lease.endDate}`,
      source: "lease",
      sourceRecordId: lease.id,
      date: lease.endDate,
      title: agreementType === "fixed_then_month_to_month" ? `Fixed term ends: ${tenantLabel}` : `Lease term ends: ${tenantLabel}`,
      detail: agreementType === "fixed_then_month_to_month"
        ? `${unitLabel} reaches its scheduled transition to month-to-month.`
        : `${unitLabel} lease reaches its scheduled end date.`,
      propertyId: lease.propertyId,
      unit: lease.unit,
      priority: lease.status === "Pending Renewal" ? "high" : "normal",
      role: "action",
      eventKind: "lease_end",
    });
  });

  const inactiveWorkOrderStatuses = new Set(["Completed", "Closed", "Canceled"]);
  (args.workOrders || []).forEach((workOrder) => {
    if (!workOrder?.id || inactiveWorkOrderStatuses.has(workOrder.status) || !validIsoDate(workOrder.dueDate)) return;
    items.push({
      id: `maintenance:${workOrder.id}:${workOrder.dueDate}`,
      source: "maintenance",
      sourceRecordId: workOrder.id,
      date: workOrder.dueDate,
      title: workOrder.title,
      detail: `${workOrder.status} maintenance | ${workOrder.priority} priority`,
      propertyId: workOrder.propertyId,
      unit: workOrder.unit,
      priority: workOrder.priority.toLowerCase(),
    });
  });

  (args.documents || []).forEach((document) => {
    if (!document?.id || !validIsoDate(document.expiresOn)) return;
    items.push({
      id: `document:${document.id}:${document.expiresOn}`,
      source: "document",
      sourceRecordId: document.id,
      date: document.expiresOn,
      title: `Renew or replace: ${document.name}`,
      detail: "Tracked document expiration date.",
      propertyId: document.propertyId,
      unit: document.unit,
      priority: "normal",
    });
  });

  (args.recurringTemplates || []).forEach((template) => {
    if (!template?.id || !template.active || !validIsoDate(template.nextDueDate)) return;
    items.push({
      id: `recurring:${template.id}:${template.nextDueDate}`,
      source: "recurring",
      sourceRecordId: template.id,
      date: template.nextDueDate,
      title: template.description,
      detail: `${template.frequency} recurring ${template.type.toLowerCase()} | ${template.category}`,
      propertyId: template.propertyId,
      unit: template.unit,
      priority: template.reviewRequired ? "high" : "normal",
    });
  });

  (args.recurringExpenseChecks || []).forEach((check) => {
    if (!check?.patternKey || !validIsoDate(check.reviewDate) || !validIsoDate(check.expectedDate)) return;
    items.push({
      id: `smart-check:${check.patternKey}:${check.expectedDate}`,
      source: "smart_check",
      sourceRecordId: check.patternKey,
      date: check.reviewDate,
      expectedDate: check.expectedDate,
      title: `Check missing payment: ${check.vendor}`,
      detail: `${check.vendor} usually appears monthly. Last recorded ${check.lastRecordedDate}; expected around ${check.expectedDate}. Confirm the gap was intentional.`,
      propertyId: check.propertyId,
      unit: check.unit,
      priority: "high",
      searchText: check.vendor,
    });
  });

  (args.planningActionItems || []).forEach((action) => {
    if (!action?.id || action.status === "done" || !validIsoDate(action.dueDate)) return;
    items.push({
      id: `planning:${action.id}:${action.dueDate}`,
      source: "planning",
      sourceRecordId: action.id,
      date: action.dueDate,
      title: action.title,
      detail: action.notes || "Open Planning action item.",
      propertyId: action.propertyId || "",
      unit: action.unit,
      priority: action.priority || "normal",
    });
  });

  (args.loans || []).forEach((loan) => {
    if (!loan?.id || !validIsoDate(loan.nextPayment)) return;
    items.push({
      id: `loan:${loan.id}:${loan.nextPayment}`,
      source: "loan",
      sourceRecordId: loan.id,
      date: loan.nextPayment,
      title: `${loan.lender} payment`,
      detail: `${loan.loanType} next payment date.`,
      propertyId: loan.propertyId,
      priority: "normal",
    });
  });

  return sortItems(items);
}

export function selectOperationsCalendarItems(
  items: OperationsCalendarItem[],
  args: {
    todayIso: string;
    horizonDays?: number;
    propertyFilter?: string;
    unitFilter?: string;
    sourceFilter?: OperationsCalendarSource | "all";
  },
) {
  const horizonDays = Math.max(7, Math.min(365, Number(args.horizonDays || 90)));
  return items.filter((item) => {
    if (!validIsoDate(item.date) || !validIsoDate(args.todayIso)) return false;
    if (args.propertyFilter && args.propertyFilter !== "all" && item.propertyId !== args.propertyFilter) return false;
    if (args.unitFilter && args.unitFilter !== "all" && item.unit && item.unit !== args.unitFilter) return false;
    if (args.sourceFilter && args.sourceFilter !== "all" && item.source !== args.sourceFilter) return false;
    if (item.role === "milestone" && item.date < args.todayIso) return false;
    return diffDays(args.todayIso, item.date) <= horizonDays;
  });
}

export function bucketOperationsCalendarItems(items: OperationsCalendarItem[], todayIso: string) {
  const buckets: Record<OperationsCalendarBucket, OperationsCalendarItem[]> = {
    attention: [],
    next7: [],
    next30: [],
    later: [],
  };
  items.forEach((item) => {
    const days = diffDays(todayIso, item.date);
    if (days <= 0) buckets.attention.push(item);
    else if (days <= 7) buckets.next7.push(item);
    else if (days <= 30) buckets.next30.push(item);
    else buckets.later.push(item);
  });
  return buckets;
}
