import { useEffect, useMemo } from "react";
import type { AppSettings } from "../store/appSettings.ts";
import type { DocumentItem, Lease, Loan, RecurringTemplate, Transaction, WorkOrder } from "../models.ts";
import { buildOperationsCalendarItems, type PlanningCalendarAction } from "../domain/operationsCalendar.ts";
import { buildOperationsNotificationDigest } from "../domain/operationsNotifications.ts";
import { buildRecurringExpenseChecks } from "../domain/recurringExpenseChecks.ts";
import type { LeaseAutomationReminder } from "../domain/leaseAutomation.ts";
import { OPERATIONS_NOTIFICATION_STORAGE_KEY } from "./appStorageKeys.js";

type Args = {
  appSettings: Pick<AppSettings, "operationsDesktopNotifications" | "recurringExpenseCheckAcknowledgements">;
  isDataHydrated: boolean;
  todayIso: string;
  transactions: Transaction[];
  recurringTemplates: RecurringTemplate[];
  documents: DocumentItem[];
  leaseAutomationReminders: LeaseAutomationReminder[];
  leases: Lease[];
  loans: Loan[];
  planningActionItems: PlanningCalendarAction[];
  workOrders: WorkOrder[];
};

async function sendNotification(title: string, body: string) {
  if (typeof window === "undefined") return false;
  try {
    if (window.desktopNotifications?.notify) {
      const supported = typeof window.desktopNotifications.isSupported === "function"
        ? await window.desktopNotifications.isSupported()
        : true;
      if (supported !== false) {
        const result = await window.desktopNotifications.notify({ title, body, silent: true });
        if (result?.ok !== false) return true;
      }
    }
  } catch {
    // Fall through to the browser notification API.
  }
  if (!("Notification" in window)) return false;
  try {
    let permission = window.Notification.permission;
    if (permission === "default") permission = await window.Notification.requestPermission();
    if (permission !== "granted") return false;
    new window.Notification(title, { body, silent: true });
    return true;
  } catch {
    return false;
  }
}

export function useOperationsDesktopNotifications(args: Args) {
  const recurringExpenseChecks = useMemo(() => buildRecurringExpenseChecks({
    acknowledgements: args.appSettings.recurringExpenseCheckAcknowledgements,
    recurringTemplates: args.recurringTemplates,
    todayIso: args.todayIso,
    transactions: args.transactions,
  }), [args.appSettings.recurringExpenseCheckAcknowledgements, args.recurringTemplates, args.todayIso, args.transactions]);
  const items = useMemo(() => buildOperationsCalendarItems({
    documents: args.documents,
    leaseAutomationReminders: args.leaseAutomationReminders,
    leases: args.leases,
    loans: args.loans,
    planningActionItems: args.planningActionItems,
    recurringTemplates: args.recurringTemplates,
    recurringExpenseChecks,
    workOrders: args.workOrders,
  }), [args.documents, args.leaseAutomationReminders, args.leases, args.loans, args.planningActionItems, args.recurringTemplates, recurringExpenseChecks, args.workOrders]);

  useEffect(() => {
    if (!args.appSettings.operationsDesktopNotifications || !args.isDataHydrated || typeof window === "undefined") return;
    const digest = buildOperationsNotificationDigest(items, args.todayIso);
    if (!digest) return;
    let deliveredRecord = "";
    try {
      deliveredRecord = window.localStorage.getItem(OPERATIONS_NOTIFICATION_STORAGE_KEY) || "";
    } catch {
      // Notification delivery can continue without dedupe storage.
    }
    if (deliveredRecord.startsWith(`${args.todayIso}:`)) return;
    let cancelled = false;
    void sendNotification(digest.title, digest.body).then((delivered) => {
      if (!delivered || cancelled) return;
      try {
        window.localStorage.setItem(OPERATIONS_NOTIFICATION_STORAGE_KEY, `${args.todayIso}:${digest.signature}`);
      } catch {
        // A delivered notification does not need to fail because storage is unavailable.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [args.appSettings.operationsDesktopNotifications, args.isDataHydrated, args.todayIso, items]);
}

