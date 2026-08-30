import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  FileClock,
  Hammer,
  Landmark,
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
import { daysUntil, formatDaysLeft } from "../../app/dateHelpers.js";

const SOURCE_META = {
  rent: { label: "Rent", icon: ReceiptText, tone: "border-rose-200 bg-rose-50 text-rose-700" },
  lease: { label: "Lease", icon: CalendarDays, tone: "border-violet-200 bg-violet-50 text-violet-700" },
  maintenance: { label: "Maintenance", icon: Hammer, tone: "border-orange-200 bg-orange-50 text-orange-700" },
  document: { label: "Document", icon: FileClock, tone: "border-blue-200 bg-blue-50 text-blue-700" },
  recurring: { label: "Recurring", icon: Repeat2, tone: "border-cyan-200 bg-cyan-50 text-cyan-700" },
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
  if (source === "planning") return "Open action plan";
  return "Open loans";
}

function OperationsRow({ item, propertyNameById, todayIso, onOpen }) {
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
        <Button size="sm" variant="secondary" className="shrink-0" onClick={() => onOpen(item)}>
          {actionLabelForSource(item.source)}
        </Button>
      </div>
    </div>
  );
}

function OperationsBucket({ bucketKey, items, propertyNameById, todayIso, onOpen }) {
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
            <OperationsRow key={item.id} item={item} propertyNameById={propertyNameById} todayIso={todayIso} onOpen={onOpen} />
          )) : (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Nothing due in this window.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function OperationsCalendarWorkspace({
  documents,
  leaseAutomationReminders,
  leases,
  loans,
  planningActionItems,
  propertyFilter,
  propertyNameById,
  recurringTemplates,
  setMaintenanceStatusFilter,
  setNotice,
  setPlanningSubtab,
  setPropertyFilter,
  setUnitFilter,
  setView,
  todayIso,
  unitFilter,
  workOrders,
  openLease,
}) {
  const [horizonDays, setHorizonDays] = useState(90);
  const [sourceFilter, setSourceFilter] = useState("all");
  const allItems = useMemo(() => buildOperationsCalendarItems({
    documents,
    leaseAutomationReminders,
    leases,
    loans,
    planningActionItems,
    recurringTemplates,
    workOrders,
  }), [documents, leaseAutomationReminders, leases, loans, planningActionItems, recurringTemplates, workOrders]);
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
      setMaintenanceStatusFilter("all");
      setView("maintenance");
      setNotice(`Showing maintenance for ${item.title}.`);
      return;
    }
    if (item.source === "document") {
      setView("documents");
      setNotice(`Showing documents for ${item.title.replace(/^Renew or replace: /, "")}.`);
      return;
    }
    if (item.source === "recurring") {
      setView("ledger");
      setNotice(`Showing transactions for recurring item ${item.title}.`);
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
                Dates stay attached to their lease, work order, document, recurring rule, loan, or Planning action. Open an item to update its source record.
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
              <Button size="sm" variant={sourceFilter === "all" ? "default" : "secondary"} onClick={() => setSourceFilter("all")}>All</Button>
              {Object.entries(SOURCE_META).map(([source, meta]) => (
                <Button key={source} size="sm" variant={sourceFilter === source ? "default" : "secondary"} onClick={() => setSourceFilter(source)}>
                  {meta.label} {sourceCounts[source] || 0}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-slate-500">Horizon</span>
              {[30, 60, 90].map((days) => (
                <Button key={days} size="sm" variant={horizonDays === days ? "default" : "outline"} onClick={() => setHorizonDays(days)}>{days} days</Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {scopedItems.length === 0 ? (
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
            <OperationsBucket key={bucketKey} bucketKey={bucketKey} items={buckets[bucketKey]} propertyNameById={propertyNameById} todayIso={todayIso} onOpen={openSourceRecord} />
          ))}
        </div>
      )}
    </div>
  );
}
