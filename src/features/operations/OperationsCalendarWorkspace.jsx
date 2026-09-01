import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  FileClock,
  Hammer,
  Landmark,
  List,
  ListTodo,
  ReceiptText,
  Repeat2,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  bucketOperationsCalendarItems,
  buildOperationsCalendarItems,
  selectOperationsCalendarItems,
} from "../../domain/operationsCalendar.ts";
import { buildRecurringExpenseChecks } from "../../domain/recurringExpenseChecks.ts";
import { daysUntil, formatDaysLeft } from "../../app/dateHelpers.js";
import { MonthlyClosePanel } from "./MonthlyClosePanel.jsx";
import { OperationsMonthView } from "./OperationsMonthView.jsx";

const SOURCE_META = {
  rent: { label: "Rent", icon: ReceiptText, tone: "border-rose-200 bg-rose-50 text-rose-700" },
  lease: { label: "Lease", icon: CalendarDays, tone: "border-violet-200 bg-violet-50 text-violet-700" },
  maintenance: { label: "Maintenance", icon: Hammer, tone: "border-orange-200 bg-orange-50 text-orange-700" },
  document: { label: "Document", icon: FileClock, tone: "border-blue-200 bg-blue-50 text-blue-700" },
  recurring: { label: "Recurring", icon: Repeat2, tone: "border-cyan-200 bg-cyan-50 text-cyan-700" },
  smart_check: { label: "Smart check", icon: BellRing, tone: "border-amber-200 bg-amber-50 text-amber-700" },
  planning: { label: "Planning", icon: ListTodo, tone: "border-purple-200 bg-purple-50 text-purple-700" },
  loan: { label: "Loan", icon: Landmark, tone: "border-sky-200 bg-sky-50 text-sky-700" },
};

const BUCKET_META = {
  attention: { title: "Needs attention", helper: "Overdue and due today", tone: "border-rose-200 bg-rose-50/50", icon: AlertTriangle },
  next7: { title: "Next 7 days", helper: "Coming up this week", tone: "border-amber-200 bg-amber-50/40", icon: CalendarClock },
  next30: { title: "Next 30 days", helper: "Prepare before it becomes urgent", tone: "border-blue-200 bg-blue-50/40", icon: CalendarDays },
  later: { title: "Later", helper: "Inside the selected horizon", tone: "border-slate-200 bg-slate-50/70", icon: CalendarDays },
};

function formatDate(date) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parsed);
}

function actionLabelForSource(source) {
  if (source === "rent" || source === "lease") return "Open lease";
  if (source === "maintenance") return "Open maintenance";
  if (source === "document") return "Open documents";
  if (source === "recurring") return "Open transactions";
  if (source === "smart_check") return "Review transactions";
  if (source === "planning") return "Open action plan";
  return "Open loans";
}

function OperationsRow({ item, propertyNameById, todayIso, onOpen, onAcknowledge }) {
  const meta = SOURCE_META[item.source] || SOURCE_META.planning;
  const Icon = meta.icon;
  const propertyLabel = propertyNameById[item.propertyId] || (item.propertyId ? "Property" : "Portfolio-wide");
  const days = daysUntil(item.date, todayIso);
  const urgencyTone = days < 0
    ? "!bg-rose-100 !text-rose-800"
    : days === 0
      ? "!bg-amber-100 !text-amber-800"
      : "!bg-slate-100 !text-slate-700";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${meta.tone}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-semibold text-slate-900">{item.title}</div>
              <Badge variant="secondary" className={`text-[11px] ${urgencyTone}`}>{formatDaysLeft(days)}</Badge>
              <Badge variant="outline" className="bg-white text-[11px]">{meta.label}</Badge>
            </div>
            <div className="mt-1 text-xs text-slate-600">{item.detail}</div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-slate-500">
              <span>{formatDate(item.date)}</span>
              <span>{propertyLabel}</span>
              {item.unit ? <span>{item.unit}</span> : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {item.source === "smart_check" ? (
            <Button size="sm" variant="outline" onClick={() => onAcknowledge(item)}>Intentional for now</Button>
          ) : null}
          <Button size="sm" variant="secondary" onClick={() => onOpen(item)}>
            {actionLabelForSource(item.source)}
          </Button>
        </div>
      </div>
    </div>
  );
}

function OperationsBucket({ bucketKey, items, propertyNameById, todayIso, onOpen, onAcknowledge }) {
  const meta = BUCKET_META[bucketKey];
  const Icon = meta.icon;
  return (
    <Card className={`shadow-none ${meta.tone}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Icon className="mt-0.5 h-4 w-4 text-slate-600" aria-hidden="true" />
            <div>
              <div className="text-sm font-semibold text-slate-900">{meta.title}</div>
              <div className="mt-0.5 text-xs text-slate-500">{meta.helper}</div>
            </div>
          </div>
          <Badge variant="secondary">{items.length}</Badge>
        </div>
        <div className="mt-3 space-y-2">
          {items.length > 0 ? items.map((item) => (
            <OperationsRow key={item.id} item={item} propertyNameById={propertyNameById} todayIso={todayIso} onOpen={onOpen} onAcknowledge={onAcknowledge} />
          )) : (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Nothing due in this window.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function OperationsCalendarWorkspace({
  appSettings,
  backupValidationResult,
  bankImportUnmatchedRows,
  currency,
  documents,
  leaseAutomationReminders,
  leases,
  loanPayments,
  loans,
  planningActionItems,
  propertyFilter,
  propertyNameById,
  recurringTemplates,
  requestWorkspaceFocus,
  setMaintenanceStatusFilter,
  setLedgerReconciliationFilter,
  setNotice,
  setPlanningSubtab,
  setPropertyFilter,
  setSearch,
  setSetting,
  setUnitFilter,
  setView,
  todayIso,
  tenantLedgerEntries,
  transactions,
  unitFilter,
  workOrders,
  openLease,
  persistenceHealth,
}) {
  const [horizonDays, setHorizonDays] = useState(90);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [workspaceMode, setWorkspaceMode] = useState("agenda");
  const [selectedMonth, setSelectedMonth] = useState(todayIso.slice(0, 7));
  const recurringExpenseChecks = useMemo(() => buildRecurringExpenseChecks({
    acknowledgements: appSettings.recurringExpenseCheckAcknowledgements,
    recurringTemplates,
    todayIso,
    transactions,
  }), [appSettings.recurringExpenseCheckAcknowledgements, recurringTemplates, todayIso, transactions]);
  const allItems = useMemo(() => buildOperationsCalendarItems({
    documents,
    leaseAutomationReminders,
    leases,
    loans,
    planningActionItems,
    recurringTemplates,
    recurringExpenseChecks,
    workOrders,
  }), [documents, leaseAutomationReminders, leases, loans, planningActionItems, recurringExpenseChecks, recurringTemplates, workOrders]);
  const horizonItems = useMemo(() => selectOperationsCalendarItems(allItems, {
    horizonDays,
    propertyFilter,
    sourceFilter: "all",
    todayIso,
    unitFilter,
  }), [allItems, horizonDays, propertyFilter, todayIso, unitFilter]);
  const scopedItems = useMemo(
    () => sourceFilter === "all" ? horizonItems : horizonItems.filter((item) => item.source === sourceFilter),
    [horizonItems, sourceFilter],
  );
  const calendarItems = useMemo(() => allItems.filter((item) => {
    if (propertyFilter !== "all" && item.propertyId !== propertyFilter) return false;
    if (unitFilter !== "all" && item.unit && item.unit !== unitFilter) return false;
    return sourceFilter === "all" || item.source === sourceFilter;
  }), [allItems, propertyFilter, sourceFilter, unitFilter]);
  const buckets = useMemo(() => bucketOperationsCalendarItems(scopedItems, todayIso), [scopedItems, todayIso]);
  const sourceCounts = useMemo(() => horizonItems.reduce((counts, item) => {
    counts[item.source] = (counts[item.source] || 0) + 1;
    return counts;
  }, {}), [horizonItems]);

  const openSourceRecord = (item) => {
    if (item.propertyId) setPropertyFilter(item.propertyId);
    setUnitFilter(item.propertyId ? (item.unit || "all") : "all");
    if (item.source === "rent" || item.source === "lease") {
      const lease = leases.find((candidate) => candidate.id === item.sourceRecordId);
      if (lease) {
        openLease(lease);
        return;
      }
      setView("leaseHistory");
      return;
    }
    if (item.source === "maintenance") {
      requestWorkspaceFocus("maintenance", item.sourceRecordId);
      setMaintenanceStatusFilter("all");
      setView("maintenance");
      setNotice(`Focused maintenance work order ${item.title}.`);
      return;
    }
    if (item.source === "document") {
      requestWorkspaceFocus("document", item.sourceRecordId);
      setView("documents");
      setNotice(`Opening ${item.title.replace(/^Renew or replace: /, "")} for review.`);
      return;
    }
    if (item.source === "recurring") {
      requestWorkspaceFocus("recurring", item.sourceRecordId);
      setView("ledger");
      setNotice(`Focused recurring rule ${item.title}.`);
      return;
    }
    if (item.source === "smart_check") {
      setSearch(item.searchText || "");
      setView("ledger");
      setNotice(`Reviewing transactions for ${item.searchText || item.title}. No transaction was created.`);
      return;
    }
    if (item.source === "planning") {
      setPlanningSubtab("actions");
      setView("planning");
      setNotice(`Showing Planning action item ${item.title}.`);
      return;
    }
    setView("loans");
    setNotice(`Showing loans for ${item.title}.`);
  };

  const acknowledgeSmartCheck = (item) => {
    setSetting("recurringExpenseCheckAcknowledgements", {
      ...appSettings.recurringExpenseCheckAcknowledgements,
      [item.sourceRecordId]: todayIso,
    });
    setNotice(`${item.searchText || item.title} marked intentional through today. The check will resume for the next expected cycle.`);
  };

  const openMonthlyCloseIssue = (kind) => {
    if (kind === "bank_match") {
      setLedgerReconciliationFilter("unreconciled");
      setView("ledger");
      setNotice("Showing imported transactions that still need a bank match.");
      return;
    }
    if (kind === "missing_support") {
      setView("review");
      setNotice("Showing Review Center items, including expenses missing receipt support.");
      return;
    }
    if (kind === "rent_balance") {
      setView("leaseHistory");
      setNotice("Showing leases and tenant ledgers for outstanding rent review.");
      return;
    }
    if (kind === "smart_check") {
      setWorkspaceMode("agenda");
      setSourceFilter("smart_check");
      setNotice("Showing unresolved recurring expense Smart Checks.");
      return;
    }
    if (kind === "loan_payment") {
      setView("loans");
      setNotice("Showing loans for monthly payment review.");
      return;
    }
    if (kind === "maintenance_handoff") {
      setMaintenanceStatusFilter("all");
      setView("maintenance");
      setNotice("Showing maintenance records that may need an accounting handoff.");
      return;
    }
    setView("settings");
    setNotice("Open Data & Backup to validate the latest backup.");
  };

  const acknowledgedCheckCount = Object.keys(appSettings.recurringExpenseCheckAcknowledgements || {}).length;

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 bg-white shadow-none">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CalendarClock className="h-4 w-4 text-teal-700" />
                One schedule, authoritative records
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Dates stay attached to their source records. Smart checks notice stable monthly expenses that appear to be missing, but never create transactions or assume the gap was a mistake.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2">
                <div className="text-lg font-semibold text-rose-800">{buckets.attention.length}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-rose-600">Attention</div>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                <div className="text-lg font-semibold text-amber-800">{buckets.next7.length}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Next 7</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-lg font-semibold text-slate-800">{scopedItems.length}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Visible</div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant={workspaceMode === "agenda" ? "default" : "outline"} onClick={() => setWorkspaceMode("agenda")}><List className="mr-1.5 h-4 w-4" />Agenda</Button>
              <Button size="sm" variant={workspaceMode === "month" ? "default" : "outline"} onClick={() => setWorkspaceMode("month")}><CalendarRange className="mr-1.5 h-4 w-4" />Month</Button>
              <Button size="sm" variant={workspaceMode === "close" ? "default" : "outline"} onClick={() => setWorkspaceMode("close")}><ClipboardCheck className="mr-1.5 h-4 w-4" />Monthly Close</Button>
            </div>
            {workspaceMode !== "close" ? <div className="text-xs text-slate-500">{workspaceMode === "month" ? "Full calendar view" : "Prioritized review queue"}</div> : <div className="text-xs text-slate-500">Reversible month-end review</div>}
          </div>
          {workspaceMode !== "close" ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant={sourceFilter === "all" ? "default" : "secondary"} onClick={() => setSourceFilter("all")}>All</Button>
              {Object.entries(SOURCE_META).map(([source, meta]) => (
                <Button key={source} size="sm" variant={sourceFilter === source ? "default" : "secondary"} onClick={() => setSourceFilter(source)}>
                  {meta.label} {sourceCounts[source] || 0}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {acknowledgedCheckCount > 0 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSetting("recurringExpenseCheckAcknowledgements", {});
                    setNotice("Intentional smart-check choices reset.");
                  }}
                >
                  Reset intentional checks ({acknowledgedCheckCount})
                </Button>
              ) : null}
              {workspaceMode === "agenda" ? <>
                <span className="mr-1 text-xs font-medium text-slate-500">Horizon</span>
                {[30, 60, 90].map((days) => (
                  <Button key={days} size="sm" variant={horizonDays === days ? "default" : "outline"} onClick={() => setHorizonDays(days)}>{days} days</Button>
                ))}
              </> : null}
            </div>
          </div> : null}
        </CardContent>
      </Card>

      {workspaceMode === "close" ? (
        <MonthlyClosePanel
          appSettings={appSettings}
          backupValidationResult={backupValidationResult}
          bankImportUnmatchedRows={bankImportUnmatchedRows}
          currency={currency}
          leases={leases}
          loanPayments={loanPayments}
          loans={loans}
          month={selectedMonth}
          onMonthChange={setSelectedMonth}
          onOpenIssue={openMonthlyCloseIssue}
          persistenceHealth={persistenceHealth}
          propertyFilter={propertyFilter}
          propertyNameById={propertyNameById}
          recurringTemplates={recurringTemplates}
          setNotice={setNotice}
          setSetting={setSetting}
          tenantLedgerEntries={tenantLedgerEntries}
          todayIso={todayIso}
          transactions={transactions}
          workOrders={workOrders}
        />
      ) : workspaceMode === "month" ? (
        <OperationsMonthView items={calendarItems} month={selectedMonth} onMonthChange={setSelectedMonth} onOpen={openSourceRecord} todayIso={todayIso} />
      ) : scopedItems.length === 0 ? (
        <Card className="border-emerald-200 bg-emerald-50 shadow-none">
          <CardContent className="flex items-start gap-3 p-5">
            <CalendarDays className="mt-0.5 h-5 w-5 text-emerald-700" />
            <div>
              <div className="font-semibold text-emerald-900">No dated items in this view</div>
              <div className="mt-1 text-sm text-emerald-800">Try a longer horizon, another source, or a broader property filter.</div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {Object.keys(BUCKET_META).map((bucketKey) => (
            <OperationsBucket key={bucketKey} bucketKey={bucketKey} items={buckets[bucketKey]} propertyNameById={propertyNameById} todayIso={todayIso} onOpen={openSourceRecord} onAcknowledge={acknowledgeSmartCheck} />
          ))}
        </div>
      )}
    </div>
  );
}
