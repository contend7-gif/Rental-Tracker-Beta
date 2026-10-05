import { useWorkspaceMemory } from "../../app/WorkspaceMemory.jsx";
import React, { useMemo } from "react";
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
  ShieldCheck,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  bucketOperationsCalendarItems,
  buildOperationsCalendarItems,
  applyOperationsFollowUps,
  operationsFollowUpRecord,
  selectOperationsCalendarItems,
} from "../../domain/operationsCalendar.ts";
import { buildRecurringExpenseChecks } from "../../domain/recurringExpenseChecks.ts";
import { daysUntil, formatDaysLeft } from "../../app/dateHelpers.js";
import { MonthlyClosePanel } from "./MonthlyClosePanel.jsx";
import { OperationsMonthView } from "./OperationsMonthView.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

const SOURCE_META = {
  rent: { label: "Rent", icon: ReceiptText, tone: "border-rose-200 bg-rose-50 text-rose-700" },
  lease: { label: "Lease", icon: CalendarDays, tone: "border-violet-200 bg-violet-50 text-violet-700" },
  maintenance: { label: "Maintenance", icon: Hammer, tone: "border-orange-200 bg-orange-50 text-orange-700" },
  document: { label: "Document", icon: FileClock, tone: "border-blue-200 bg-blue-50 text-blue-700" },
  recurring: { label: "Recurring", icon: Repeat2, tone: "border-cyan-200 bg-cyan-50 text-cyan-700" },
  smart_check: { label: "Smart check", icon: BellRing, tone: "border-amber-200 bg-amber-50 text-amber-700" },
  planning: { label: "Planning", icon: ListTodo, tone: "border-purple-200 bg-purple-50 text-purple-700" },
  loan: { label: "Loan", icon: Landmark, tone: "border-sky-200 bg-sky-50 text-sky-700" },
  backup: { label: "Backup", icon: ShieldCheck, tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
};

const BUCKET_META = {
  attention: { title: "Needs attention", helper: "Dates reached; suggested checks need confirmation", tone: "border-rose-200 bg-rose-50/50", icon: AlertTriangle },
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
  if (source === "backup") return "Open backup settings";
  return "Open loans";
}

function FollowUpSelect({ item, onFollowUp }) {
  if (item.role === "milestone") return null;
  return (
    <Select value={item.followUpStatus || "open"} onValueChange={(value) => onFollowUp(item, value)}>
      <SelectTrigger className="h-9 w-36 bg-white text-xs" aria-label={`Follow-up status for ${item.title}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="open">Open</SelectItem>
        <SelectItem value="done">Done</SelectItem>
        <SelectItem value="snoozed">Snooze 7 days</SelectItem>
        <SelectItem value="waiting">Waiting</SelectItem>
        <SelectItem value="intentional">Intentional</SelectItem>
      </SelectContent>
    </Select>
  );
}

function OperationsRow({ item, propertyNameById, todayIso, onOpen, onFollowUp }) {
  const meta = SOURCE_META[item.source] || SOURCE_META.planning;
  const Icon = meta.icon;
  const propertyLabel = propertyNameById[item.propertyId] || (item.propertyId ? "Property" : "Portfolio-wide");
  const days = daysUntil(item.date, todayIso);
  const urgencyTone = item.source === "smart_check"
    ? "!bg-amber-100 !text-amber-800"
    : days < 0
    ? "!bg-rose-100 !text-rose-800"
    : days === 0
      ? "!bg-amber-100 !text-amber-800"
      : "!bg-slate-100 !text-slate-700";

  return (
    <div className={`rt-calendar-item rounded-lg border border-slate-200 bg-white p-3 shadow-none ${item.source === "smart_check" ? "rt-calendar-suggestion" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${meta.tone}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-semibold text-slate-900">{item.title}</div>
              <Badge variant="secondary" className={`text-[11px] ${urgencyTone}`}>{item.source === "smart_check" ? "Suggested check" : formatDaysLeft(days)}</Badge>
              <Badge variant="outline" className="bg-white text-[11px]">{meta.label}</Badge>
              {item.followUpStatus ? <Badge variant="secondary" className="text-[11px] capitalize">{item.followUpStatus}</Badge> : null}
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-600">{item.detail}</div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-slate-500">
              <span>{formatDate(item.date)}</span>
              {item.originalDate && item.originalDate !== item.date ? <span>Originally {formatDate(item.originalDate)}</span> : null}
              <span>{propertyLabel}</span>
              {item.unit ? <span>{item.unit}</span> : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <FollowUpSelect item={item} onFollowUp={onFollowUp} />
          <Button size="sm" variant="secondary" onClick={() => onOpen(item)}>
            {actionLabelForSource(item.source)}
          </Button>
        </div>
      </div>
    </div>
  );
}

function OperationsBucket({ bucketKey, items, propertyNameById, todayIso, onOpen, onFollowUp }) {
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
            <OperationsRow key={item.id} item={item} propertyNameById={propertyNameById} todayIso={todayIso} onOpen={onOpen} onFollowUp={onFollowUp} />
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
  const [horizonDays, setHorizonDays] = useWorkspaceMemory("operations:horizonDays", 90);
  const [sourceFilter, setSourceFilter] = useWorkspaceMemory("operations:sourceFilter", "all");
  const [workspaceMode, setWorkspaceMode] = useWorkspaceMemory("operations:workspaceMode", "agenda");
  const [selectedMonth, setSelectedMonth] = useWorkspaceMemory("operations:selectedMonth", todayIso.slice(0, 7));
  const [showHandled, setShowHandled] = useWorkspaceMemory("operations:showHandled", false);
  const recurringExpenseChecks = useMemo(() => buildRecurringExpenseChecks({
    acknowledgements: appSettings.recurringExpenseCheckAcknowledgements,
    recurringTemplates,
    todayIso,
    transactions,
  }), [appSettings.recurringExpenseCheckAcknowledgements, recurringTemplates, todayIso, transactions]);
  const rawItems = useMemo(() => buildOperationsCalendarItems({
    documents,
    leaseAutomationReminders,
    leases,
    leaseReviewDaysBefore: appSettings.operationsLeaseReviewDaysBefore,
    loans,
    planningActionItems,
    recurringTemplates,
    recurringExpenseChecks,
    workOrders,
    backup: {
      lastRecoverableBackupAt: persistenceHealth?.lastRecoverableBackupAt,
      intervalDays: appSettings.backupIntervalDays,
      todayIso,
    },
  }), [appSettings.backupIntervalDays, appSettings.operationsLeaseReviewDaysBefore, documents, leaseAutomationReminders, leases, loans, persistenceHealth?.lastRecoverableBackupAt, planningActionItems, recurringExpenseChecks, recurringTemplates, todayIso, workOrders]);
  const allItems = useMemo(() => applyOperationsFollowUps(
    rawItems,
    appSettings.operationsFollowUps,
    { showHandled },
  ), [appSettings.operationsFollowUps, rawItems, showHandled]);
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
  const propertyUnitItems = useMemo(() => allItems.filter((item) => {
    if (propertyFilter !== "all" && item.propertyId !== propertyFilter) return false;
    if (unitFilter !== "all" && item.unit && item.unit !== unitFilter) return false;
    return true;
  }), [allItems, propertyFilter, unitFilter]);
  const calendarItems = useMemo(
    () => propertyUnitItems.filter((item) => sourceFilter === "all" || item.source === sourceFilter),
    [propertyUnitItems, sourceFilter],
  );
  const buckets = useMemo(() => bucketOperationsCalendarItems(scopedItems, todayIso), [scopedItems, todayIso]);
  const sourceCountItems = useMemo(
    () => workspaceMode === "month"
      ? propertyUnitItems.filter((item) => item.date.startsWith(selectedMonth))
      : horizonItems,
    [horizonItems, propertyUnitItems, selectedMonth, workspaceMode],
  );
  const sourceCounts = useMemo(() => sourceCountItems.reduce((counts, item) => {
    counts[item.source] = (counts[item.source] || 0) + 1;
    return counts;
  }, {}), [sourceCountItems]);

  const openSourceRecord = (item) => {
    if (item.source === "smart_check") {
      // Review within the current portfolio scope. Shared is an expense allocation,
      // not a rentable unit, and must not silently narrow Home or other workspaces.
      setSearch(item.searchText || "");
      requestWorkspaceFocus("transaction_search", item.searchText || "");
      setView("ledger");
      setNotice(`Reviewing transactions for ${item.searchText || item.title} in the current scope. No transaction was created.`);
      return;
    }
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
    if (item.source === "planning") {
      setPlanningSubtab("actions");
      setView("planning");
      setNotice(`Showing Planning action item ${item.title}.`);
      return;
    }
    if (item.source === "backup") {
      setView("settings");
      setNotice("Open Data & Backup to create or validate a recoverable restore point.");
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

  const updateFollowUp = (item, status) => {
    if (status === "intentional" && item.source === "smart_check") {
      acknowledgeSmartCheck(item);
      return;
    }
    const next = { ...appSettings.operationsFollowUps };
    if (status === "open") {
      delete next[item.id];
      setSetting("operationsFollowUps", next);
      setNotice(`${item.title} reopened.`);
      return;
    }
    next[item.id] = operationsFollowUpRecord(item, status, todayIso, 7);
    setSetting("operationsFollowUps", next);
    const label = status === "snoozed" ? "snoozed for 7 days" : `marked ${status}`;
    setNotice(`${item.title} ${label}. The source record was not changed.`);
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
  const handledCount = rawItems.filter((item) => {
    const status = appSettings.operationsFollowUps?.[item.id]?.status;
    return status === "done" || status === "intentional";
  }).length;

  return (
    <div className="rt-operations-calendar space-y-4">
      <Card className="border-slate-200 bg-white shadow-none">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><CalendarClock className="h-4 w-4 text-teal-700" />Source dates and reminders</div>
              <p className="mt-1 text-xs text-slate-500">Open an item to review its source. Suggested checks need confirmation.</p>
            </div>
            {workspaceMode === "agenda" ? <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800"><strong className="tabular-nums">{buckets.attention.length}</strong> {buckets.attention.length === 1 ? "date" : "dates"} reached</span>
              <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800"><strong className="tabular-nums">{buckets.next7.length}</strong> next 7 days</span>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600"><strong className="tabular-nums">{scopedItems.length}</strong> visible</span>
            </div> : null}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" aria-pressed={workspaceMode === "agenda"} variant={workspaceMode === "agenda" ? "default" : "secondary"} onClick={() => setWorkspaceMode("agenda")}><List className="mr-1.5 h-4 w-4" />Agenda</Button>
              <Button size="sm" aria-pressed={workspaceMode === "month"} variant={workspaceMode === "month" ? "default" : "secondary"} onClick={() => setWorkspaceMode("month")}><CalendarRange className="mr-1.5 h-4 w-4" />Month</Button>
              <Button size="sm" aria-pressed={workspaceMode === "close"} variant={workspaceMode === "close" ? "default" : "secondary"} onClick={() => setWorkspaceMode("close")}><ClipboardCheck className="mr-1.5 h-4 w-4" />Monthly Close</Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setView("review")}>Open Work Queue</Button>
          </div>
          {workspaceMode !== "close" ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <label className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-medium text-slate-500">Source
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger aria-label="Calendar source" className="h-9 w-52 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All sources</SelectItem>{Object.entries(SOURCE_META).map(([source, meta]) => <SelectItem key={source} value={source}>{meta.label} ({sourceCounts[source] || 0})</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <div className="flex flex-wrap items-center gap-2">
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
              {handledCount > 0 ? (
                <Button size="sm" variant={showHandled ? "default" : "ghost"} onClick={() => setShowHandled((value) => !value)}>
                  {showHandled ? "Hide handled" : `Show handled (${handledCount})`}
                </Button>
              ) : null}
              {workspaceMode === "agenda" ? <label className="flex items-center gap-2 text-xs font-medium text-slate-500">Horizon
                <Select value={String(horizonDays)} onValueChange={(value) => setHorizonDays(Number(value))}>
                  <SelectTrigger aria-label="Calendar horizon" className="h-9 w-32 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{[30, 60, 90, 180].map((days) => <SelectItem key={days} value={String(days)}>{days} days</SelectItem>)}</SelectContent>
                </Select>
              </label> : null}
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
          documents={documents}
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
        <OperationsMonthView items={calendarItems} month={selectedMonth} onMonthChange={setSelectedMonth} onOpen={openSourceRecord} onFollowUp={updateFollowUp} propertyNameById={propertyNameById} todayIso={todayIso} />
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
        <div className="rt-calendar-buckets grid gap-4 xl:grid-cols-2">
          {Object.keys(BUCKET_META).filter((bucketKey) => buckets[bucketKey].length > 0).map((bucketKey) => (
            <OperationsBucket key={bucketKey} bucketKey={bucketKey} items={buckets[bucketKey]} propertyNameById={propertyNameById} todayIso={todayIso} onOpen={openSourceRecord} onFollowUp={updateFollowUp} />
          ))}
        </div>
      )}
    </div>
  );
}
