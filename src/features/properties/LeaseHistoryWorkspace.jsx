import React, { useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "../../components/ui/dialog";
import { ChevronDown, FileText, House, Play, Plus, Search, Settings2 } from "lucide-react";
import { deriveLeaseList, deriveLeaseRoll } from "./leaseWorkspacePresentation.js";
import { formatUnitLabel } from "../../domain/unitLabels.js";
import { leaseBillingCadenceLabel, leaseRentSummaryLabel, leaseTermSummaryLabel } from "../../domain/leaseTerms.js";
import { RecordPager, useRecordPage } from "../shared/RecordPager.jsx";

const STATUS_TONE = {
  Occupied: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Owner occupied": "border-slate-200 bg-slate-50 text-slate-600",
  Vacant: "border-amber-200 bg-amber-50 text-amber-700",
  Future: "border-blue-200 bg-blue-50 text-blue-700",
  "Out of service": "border-slate-200 bg-slate-100 text-slate-500",
};

function MonthGrid({ item, property, yearFilter, selectedMonthDetail, setSelectedMonthDetail }) {
  const row = item.row;
  return <div>
    <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
      {row.monthlyStatus.map((month) => {
        const chipClass = month.status === "Rented" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : month.status === "Owner-Occupied" ? "border-blue-200 bg-blue-50 text-blue-700" : month.status === "Vacant" ? "border-amber-200 bg-amber-50 text-amber-700" : month.status === "Mixed" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : month.status === "Out of service" || month.status === "Future" ? "border-slate-200 bg-slate-100 text-slate-500" : "border-rose-200 bg-rose-50 text-rose-700";
        const monthName = new Date(Date.UTC(Number(yearFilter), Number(month.month) - 1, 1)).toLocaleString(undefined, { month: "long" });
        const canShowDetail = (month.ranges || []).length > 0;
        const shortStatus = month.status === "Owner-Occupied" ? "Owner" : month.status === "Out of service" ? "N/A" : month.status === "Rented" ? "Rent" : month.status === "Future" ? "Fut." : month.status;
        return <button key={month.month} type="button" className={`min-h-14 min-w-0 overflow-hidden rounded border px-0.5 py-1 text-center text-[9px] transition ${chipClass} ${canShowDetail ? "hover:ring-2 hover:ring-teal-200" : ""}`} onClick={() => canShowDetail && setSelectedMonthDetail({ propertyName: property.name, unitName: row.unit.name, monthName, status: month.status, detail: month.detail, ranges: month.ranges || [] })}>
          <span className="block text-slate-500">{month.month}</span><span className="block truncate font-semibold">{shortStatus}</span><span className="block truncate text-[8px]">{month.detail || (month.totalDays > 0 ? `${month.coveredDays}/${month.totalDays}d` : "-")}</span>
        </button>;
      })}
    </div>
    {selectedMonthDetail?.propertyName === property.name && selectedMonthDetail?.unitName === row.unit.name ? <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50/60 p-2 text-xs text-slate-700">
      <div className="flex items-start justify-between gap-2"><div><div className="font-semibold text-slate-900">{selectedMonthDetail.monthName} {yearFilter}</div><div>{selectedMonthDetail.status}{selectedMonthDetail.detail ? ` | ${selectedMonthDetail.detail}` : ""}</div></div><Button size="sm" variant="ghost" onClick={() => setSelectedMonthDetail(null)}>Close</Button></div>
      <div className="mt-2 grid gap-1 sm:grid-cols-2">{selectedMonthDetail.ranges.map((range) => <div key={`${range.start}-${range.end}-${range.status}`} className="rounded border border-white bg-white px-2 py-1">{range.label}</div>)}</div>
    </div> : null}
  </div>;
}

export function LeaseHistoryWorkspace(props) {
  const {
    LEASE_AUTOMATION_HELPER_TEXT, appSettings, confirmAndDeleteUsePeriod, currency, leaseActualEndLabel,
    leaseAutomationLastRunLabel, leaseCoverageByProperty, leaseReminderToneClass,
    leaseStatusForDate, occupancyReviewInbox, openLease, openNewLeaseForUnit,
    openOccupancyEditor, openReviewCenter, runLeaseAutomationNow, scopedLeaseAutomationReminders,
    tenantLedgerReviewInbox, todayIso, yearFilter, leases, properties, propertyFilter, unitFilter,
  } = props;
  const [selectedMonthDetail, setSelectedMonthDetail] = useState(null);
  const [auditExpanded, setAuditExpanded] = useState({});
  const [workspaceView, setWorkspaceView] = useState("leases");
  const [leaseFilter, setLeaseFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const roll = useMemo(() => deriveLeaseRoll({ leaseCoverageByProperty, occupancyReviewInbox, tenantLedgerReviewInbox, todayIso }), [leaseCoverageByProperty, occupancyReviewInbox, tenantLedgerReviewInbox, todayIso]);
  const agreements = useMemo(() => deriveLeaseList({ leases, properties, propertyFilter, unitFilter, todayIso, tenantLedgerReviewInbox }), [leases, properties, propertyFilter, unitFilter, todayIso, tenantLedgerReviewInbox]);
  const counts = Object.fromEntries(["active", "upcoming", "past", "review"].map((key) => [key, agreements.filter((item) => item.category === key).length]));
  const expiringCount = agreements.filter((item) => item.expirationDays != null && item.expirationDays >= 0 && item.expirationDays <= 60).length;
  const query = search.trim().toLowerCase();
  const visible = agreements.filter((item) => (leaseFilter === "all" || item.category === leaseFilter)
    && (!query || `${item.lease.tenantName || ""} ${item.property?.name || ""} ${item.lease.unit} ${item.lease.startDate} ${item.lease.endDate || ""}`.toLowerCase().includes(query)));
  const pager = useRecordPage(visible, `${propertyFilter}:${unitFilter}:${leaseFilter}:${query}`, 30, "lease-agreements");
  const addLease = () => {
    const selected = roll.find((item) => item.property.id === propertyFilter && item.row.unit.name === unitFilter);
    if (selected) openNewLeaseForUnit(selected.property.id, selected.row.unit.name);
    else setUnitPickerOpen(true);
  };
  const filters = [["active", "Active"], ["upcoming", "Upcoming"], ["past", "Past"], ...(counts.review ? [["review", "Dates need review"]] : []), ["all", "All"]];

  return <div className="rt-leases-workspace space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500" aria-label="Lease summary">
        <span><strong className="text-slate-900">{counts.active}</strong> active</span>
        <span><strong className="text-slate-900">{counts.upcoming}</strong> upcoming</span>
        {expiringCount ? <span className="font-medium text-amber-700">{expiringCount} ending within 60 days</span> : null}
        <span>As of {todayIso}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" aria-pressed={workspaceView === "occupancy"} onClick={() => setWorkspaceView((current) => current === "leases" ? "occupancy" : "leases")}><House className="h-3.5 w-3.5" />{workspaceView === "leases" ? "Occupancy & coverage" : "Back to leases"}</Button>
        <Button size="sm" onClick={addLease} disabled={!roll.length}><Plus className="h-3.5 w-3.5" />Add lease</Button>
      </div>
    </div>

    {workspaceView === "leases" ? <>
      <Card className="overflow-hidden shadow-none">
        <header className="rt-lease-toolbar flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
          <div className="flex flex-wrap gap-1" aria-label="Agreement filters">{filters.map(([key, label]) => <button key={key} type="button" aria-pressed={leaseFilter === key} onClick={() => setLeaseFilter(key)} className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${leaseFilter === key ? "bg-teal-50 text-teal-900" : "text-slate-500 hover:bg-white"}`}>{label}<span className="rounded bg-white px-1.5 text-xs text-slate-500">{key === "all" ? agreements.length : counts[key]}</span></button>)}</div>
          <label className="relative w-full sm:w-64"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" /><Input aria-label="Search leases" placeholder="Search tenant or unit" value={search} onChange={(event) => setSearch(event.target.value)} className="!h-9 !pl-9" /></label>
        </header>
        <div className="rt-lease-list-heading rt-lease-list-row border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-xs font-medium text-slate-500"><span>Tenant / residence</span><span>Agreement</span><span>Rent arrangement</span><span>Next event / review</span><span /></div>
        <div className="divide-y divide-slate-100">{pager.records.map(({ lease, property, category, expirationDays, reviewIssues }) => {
          const reminders = scopedLeaseAutomationReminders.filter((item) => item.leaseId === lease.id);
          const eventLabel = category === "upcoming" ? `Starts ${lease.startDate}` : category === "past" ? `Ended ${leaseActualEndLabel(lease)}` : category === "review" ? "Dates need review" : expirationDays != null ? (expirationDays <= 60 ? `Ends in ${expirationDays} days` : `Ends ${leaseActualEndLabel(lease)}`) : "Ongoing agreement";
          const reviewLabel = reviewIssues[0]?.label || reminders[0]?.title;
          return <article key={lease.id} className="rt-lease-list-row px-4 py-3 transition hover:bg-slate-50/70">
            <div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal-50 text-sm font-semibold text-teal-700" aria-hidden="true">{(lease.tenantName || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><div className="min-w-0"><button type="button" className="block max-w-full truncate text-left text-sm font-semibold text-slate-900 hover:text-teal-700" onClick={() => openLease(lease)}>{lease.tenantName || "Tenant name missing"}</button><div className="truncate text-xs text-slate-500" title={`${property?.name || lease.propertyId} / ${formatUnitLabel(lease.unit)}`}>{property?.name || "Property not found"} / {formatUnitLabel(lease.unit)}</div></div></div>
            <div className="min-w-0 text-xs"><div className="font-medium text-slate-800">{leaseTermSummaryLabel(lease)}</div><div className="mt-0.5 text-slate-500">{lease.startDate || "Start missing"} to {leaseActualEndLabel(lease) || "End missing"}</div></div>
            <div className="min-w-0 text-xs"><div className="font-semibold text-slate-900">{leaseRentSummaryLabel(lease, currency)}</div><div className="mt-0.5 text-slate-500">{leaseBillingCadenceLabel(lease)}</div></div>
            <div className="min-w-0 text-xs"><div className={category === "review" || (expirationDays != null && expirationDays <= 60) ? "font-medium text-amber-700" : "text-slate-600"}>{eventLabel}</div>{reviewLabel ? <button type="button" title={[...reviewIssues.map((issue) => issue.label), ...reminders.map((reminder) => reminder.title)].join("; ")} className="mt-1 block max-w-full truncate text-left font-medium text-amber-700 hover:underline" onClick={() => openLease(lease)}>{reviewLabel}</button> : null}</div>
            <Button size="sm" variant="secondary" aria-label={`Open lease for ${lease.tenantName || formatUnitLabel(lease.unit)}`} onClick={() => openLease(lease)}>Open</Button>
          </article>;
        })}</div>
        {!visible.length ? <CardContent className="!p-6 text-center"><div className="text-sm font-semibold text-slate-800">{query ? "No matching leases" : `No ${leaseFilter === "all" ? "" : leaseFilter} leases in this scope`}</div><p className="mt-1 text-xs text-slate-500">{query ? "Try another tenant, property, or unit." : "Choose another filter, add an agreement, or check occupancy and coverage."}</p></CardContent> : null}
      </Card>
      <RecordPager {...pager} label="Leases" />
      <div className="text-xs text-slate-500">Current agreements are shown as of today. The header year applies to occupancy coverage and record review.</div>
    </> : <Card className="overflow-hidden shadow-none">
      <header className="border-b border-slate-200 bg-slate-50/70 px-4 py-3"><h2 className="text-base font-semibold text-slate-900">Occupancy & coverage</h2><p className="mt-0.5 text-xs text-slate-500">Owner use, vacancy and occupancy records for {yearFilter}. Open a unit to inspect its timeline.</p></header>
      {!roll.length ? <CardContent className="!p-6 text-sm text-slate-500">No units match the current scope.</CardContent> : null}
      <div className="divide-y divide-slate-100">{roll.map((item) => {
        const { property, row } = item;
        const key = `${property.id}:${row.unit.name}`;
        const expanded = Boolean(auditExpanded[key]);
        const occupancyStatus = row.statusAsOfAuditEnd === "Rental" ? "Occupied" : row.statusAsOfAuditEnd === "Owner-Occupied" ? "Owner occupied" : row.statusAsOfAuditEnd || item.status;
        return <div key={key}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3"><House className="h-5 w-5 shrink-0 text-teal-700" /><div><div className="text-sm font-semibold text-slate-900">{property.name} / {formatUnitLabel(row.unit.name)}</div><div className="mt-0.5 text-xs text-slate-500">{item.coveragePct}% of {yearFilter} audit days tracked{row.gaps.length ? ` / ${row.gaps.length} gaps` : ""}{row.overlaps.length ? ` / ${row.overlaps.length} overlaps` : ""}</div></div></div>
            <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" title={`Status as of ${row.auditEnd}`} className={STATUS_TONE[occupancyStatus]}>{occupancyStatus}</Badge><Button size="sm" variant="secondary" onClick={() => openOccupancyEditor(property.id, row.unit.name)}>Manage occupancy</Button><Button size="sm" variant="ghost" aria-label={`Coverage for ${formatUnitLabel(row.unit.name)}`} aria-expanded={expanded} onClick={() => setAuditExpanded((current) => ({ ...current, [key]: !expanded }))}>Timeline<ChevronDown className={`h-4 w-4 ${expanded ? "rotate-180" : ""}`} /></Button></div>
          </div>
          {expanded ? <div className="border-t border-slate-100 bg-slate-50/60 p-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
              <section className="rounded-lg border border-slate-200 bg-white p-3"><div className="mb-2 flex items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-slate-900">Coverage audit - {formatUnitLabel(row.unit.name)}</h3><p className="text-[10px] text-slate-500">Occupancy history for {yearFilter} | {row.auditStart} to {row.auditEnd} | {row.coveredDays}/{row.totalDays} days tracked</p></div>{row.gaps.length || row.overlaps.length ? <Badge className="bg-amber-100 text-amber-800">Needs review</Badge> : <Badge className="bg-emerald-100 text-emerald-700">Complete</Badge>}</div><MonthGrid item={item} property={property} yearFilter={yearFilter} selectedMonthDetail={selectedMonthDetail} setSelectedMonthDetail={setSelectedMonthDetail} />{row.gaps.length > 0 ? <div className="mt-2 text-xs text-rose-700">Gaps: {row.gaps.map((gap) => `${gap.start} to ${gap.end}`).join(", ")}</div> : null}{row.overlaps.length > 0 ? <div className="mt-1 text-xs text-amber-700">Overlaps: {row.overlaps.length}</div> : null}</section>
              <section className="rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><FileText className="h-4 w-4 text-slate-500" />Lease history</h3><Button size="sm" variant="secondary" onClick={() => openNewLeaseForUnit(property.id, row.unit.name)}>Add lease</Button></div>
                  <div className="mt-2 divide-y divide-slate-100">{row.leasesForUnit.length ? row.leasesForUnit.map((lease) => <button key={lease.id} type="button" onClick={() => openLease(lease)} className="flex w-full items-start justify-between gap-2 py-2 text-left"><span><span className="block text-xs font-medium text-slate-800">{lease.tenantName || "No tenant name"}</span><span className="block text-[10px] text-slate-500">{leaseTermSummaryLabel(lease)} | {lease.startDate} to {leaseActualEndLabel(lease)}</span><span className="block text-[10px] text-slate-500">{leaseRentSummaryLabel(lease, currency)}</span></span><Badge variant="secondary">{leaseStatusForDate(lease, row.auditEnd)}</Badge></button>) : <p className="py-2 text-xs text-slate-500">No leases recorded.</p>}</div>
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-900">Owner/vacancy periods</h3><Button size="sm" variant="secondary" onClick={() => openOccupancyEditor(property.id, row.unit.name)}>Manage</Button></div>
                  <div className="mt-2 divide-y divide-slate-100">{row.occupancyForUnit.length ? row.occupancyForUnit.map((period) => <div key={period.id} className="py-2"><div className="text-xs text-slate-700">{period.useType}: {period.startDate} to {period.endDate || "until lease starts"}</div><div className="mt-1 flex gap-1"><Button size="sm" variant="ghost" onClick={() => openOccupancyEditor(property.id, row.unit.name, period)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => confirmAndDeleteUsePeriod(period)}>Delete</Button></div></div>) : <p className="py-2 text-xs text-slate-500">No owner/vacancy periods saved.</p>}</div>
                </div>
              </section>
            </div>
          </div> : null}
        </div>;
      })}</div>
    </Card>}

    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2 text-xs text-slate-600"><span className="inline-flex items-center gap-2"><Settings2 className="h-3.5 w-3.5" />Lease management</span><span>Automation {appSettings.leaseAutomationEnabled ? "enabled" : "paused"}<ChevronDown className="ml-2 inline h-3.5 w-3.5" /></span></summary>
      <div className="space-y-3 border-t border-slate-100 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="max-w-xl"><p className="text-xs text-slate-500">{LEASE_AUTOMATION_HELPER_TEXT}</p><p className="mt-1 text-xs text-slate-500">Last run: {leaseAutomationLastRunLabel || "Not run yet"}</p></div><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={openReviewCenter}>Open Work Queue</Button><Button size="sm" variant="secondary" onClick={runLeaseAutomationNow}><Play className="h-3.5 w-3.5" />Run now</Button></div></div>{scopedLeaseAutomationReminders.length ? <div className="space-y-2">{scopedLeaseAutomationReminders.map((reminder) => <div key={reminder.id} className={`rounded border px-3 py-2 text-xs ${leaseReminderToneClass(reminder.kind)}`}><strong>{reminder.title}</strong><p className="mt-1">{reminder.message}</p></div>)}</div> : <p className="text-xs text-slate-500">No reminders in this scope.</p>}</div>
    </details>
    <Dialog open={unitPickerOpen} onOpenChange={setUnitPickerOpen}>
      <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Choose a unit for the new lease</DialogTitle></DialogHeader><div className="mt-3 space-y-2">{roll.map(({ property, row }) => <button type="button" key={`${property.id}:${row.unit.name}`} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-3 text-left hover:bg-teal-50" onClick={() => { setUnitPickerOpen(false); openNewLeaseForUnit(property.id, row.unit.name); }}><span className="text-sm font-medium">{property.name} / {formatUnitLabel(row.unit.name)}</span><Plus className="h-4 w-4 text-teal-700" /></button>)}</div><DialogClose variant="secondary" className="mt-3">Cancel</DialogClose></DialogContent>
    </Dialog>
  </div>;
}
