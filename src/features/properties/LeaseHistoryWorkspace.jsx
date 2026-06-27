import React, { useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  CalendarClock, ChevronDown, CircleAlert, ClipboardCheck, FileText, House,
  Play, Settings2, Users,
} from "lucide-react";
import { AuditReadinessBadge } from "../shared/AuditReadinessBadge.jsx";
import { deriveLeaseRoll, groupLeaseCleanup, leaseRollCleanupLabel, leaseRollOccupantLabel, summarizeLeaseRoll } from "./leaseWorkspacePresentation.js";
import { formatUnitLabel } from "../../domain/unitLabels.js";

const STATUS_TONE = {
  Occupied: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Owner occupied": "border-slate-200 bg-slate-50 text-slate-600",
  Vacant: "border-amber-200 bg-amber-50 text-amber-700",
  Future: "border-slate-200 bg-slate-50 text-slate-600",
  "Out of service": "border-slate-200 bg-slate-100 text-slate-500",
};

const SUMMARY_ICONS = [Users, House, CalendarClock, CircleAlert, Settings2];

function SummaryTile({ icon: Icon, label, value, detail, tone = "teal" }) {
  const iconTone = tone === "amber" ? "bg-amber-50 text-amber-600" : tone === "blue" ? "bg-blue-50 text-blue-600" : tone === "rose" ? "bg-rose-50 text-rose-600" : "bg-teal-50 text-teal-700";
  return <div className="flex min-h-20 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${iconTone}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
    <span className="min-w-0"><span className="block text-[10px] font-medium uppercase text-slate-500">{label}</span><span className="block text-base font-semibold text-slate-950">{value}</span><span className="block truncate text-[10px] text-slate-500">{detail}</span></span>
  </div>;
}

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
    tenantLedgerReviewInbox, todayIso, yearFilter,
  } = props;
  const [selectedMonthDetail, setSelectedMonthDetail] = useState(null);
  const [auditExpanded, setAuditExpanded] = useState({});
  const roll = useMemo(() => deriveLeaseRoll({ leaseCoverageByProperty, occupancyReviewInbox, tenantLedgerReviewInbox, todayIso }), [leaseCoverageByProperty, occupancyReviewInbox, tenantLedgerReviewInbox, todayIso]);
  const cleanupCount = (occupancyReviewInbox?.records?.length || 0) + (tenantLedgerReviewInbox?.records?.length || 0);
  const summary = summarizeLeaseRoll(roll, cleanupCount, appSettings.leaseAutomationEnabled);
  const cleanupGroups = groupLeaseCleanup({ occupancyReviewInbox, tenantLedgerReviewInbox });
  const summaryItems = [
    ["Currently occupied", summary.occupied, `${summary.ownerOccupied} currently owner occupied | ${roll.length} total`, "teal"],
    ["Currently vacant", summary.vacant, `of ${roll.length} units`, "amber"], ["Leases expiring", summary.upcomingExpirations, "in next 60 days", "blue"],
    ["Cleanup items", summary.cleanupItems, summary.cleanupItems ? "need review" : "all clear", "rose"], ["Automation", summary.automationLabel, `Last run ${leaseAutomationLastRunLabel || "not yet"}`, "teal"],
  ];

  return <div className="space-y-4">
    {roll.length === 0 ? <Card><CardContent className="py-6 text-sm text-slate-500">No units match the current property and unit filters.</CardContent></Card> : null}

    <section aria-label="Lease summary" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {summaryItems.map(([label, value, detail, tone], index) => <SummaryTile key={label} icon={SUMMARY_ICONS[index]} label={label} value={value} detail={detail} tone={tone} />)}
    </section>

    <div className="grid gap-3 lg:grid-cols-[1fr_1.35fr]">
      <Card className="shadow-none"><CardContent className="p-4 !pt-4">
        <div className="flex items-center justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><CalendarClock className="h-4 w-4 text-slate-500" />Lease automation <Badge variant="secondary" className={appSettings.leaseAutomationEnabled ? "!bg-emerald-50 !text-emerald-700" : "!bg-slate-100 !text-slate-600"}>{summary.automationLabel}</Badge></div><p className="mt-1 text-xs text-slate-500">{LEASE_AUTOMATION_HELPER_TEXT}</p></div><Button size="sm" variant="secondary" className="shrink-0 whitespace-nowrap" onClick={runLeaseAutomationNow}><Play className="mr-1 h-3.5 w-3.5" />Run now</Button></div>
        <div className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">Last run: {leaseAutomationLastRunLabel || "Not run yet"}</div>
        {scopedLeaseAutomationReminders.length === 0 ? <div className="mt-2 text-xs text-slate-500">No reminders in the current filter scope.</div> : <div className="mt-2 space-y-1.5">{scopedLeaseAutomationReminders.map((reminder) => <div key={reminder.id} className={`rounded border px-2 py-1.5 text-xs ${leaseReminderToneClass(reminder.kind)}`}><span className="font-medium">{reminder.title}</span><span className="block">{reminder.message}</span></div>)}</div>}
      </CardContent></Card>

      <Card className="shadow-none"><CardContent className="p-4 !pt-4">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-semibold text-slate-950"><ClipboardCheck className="h-4 w-4 text-slate-500" />Cleanup & coverage status</div></div><Button size="sm" className="shrink-0 whitespace-nowrap" onClick={openReviewCenter}>Open Review Center</Button></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">{cleanupGroups.map((group) => <button key={group.key} type="button" onClick={openReviewCenter} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left"><span className="block text-xs font-medium text-slate-700">{group.label}</span><span className={`mt-1 block text-xs ${group.count ? "text-amber-700" : "text-emerald-700"}`}>{group.count ? `${group.count} need review` : "Ready"}</span></button>)}</div>
      </CardContent></Card>
    </div>

    <Card className="min-w-0 max-w-full overflow-x-auto shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3"><div><h2 className="text-base font-semibold text-slate-950">Current Lease Roll</h2></div><div className="flex flex-wrap gap-1.5 text-[10px]">{["Occupied", "Owner occupied", "Vacant", "Future"].map((status) => <Badge key={status} variant="outline" className={STATUS_TONE[status]}>{status}</Badge>)}</div></div>
      <div className="hidden grid-cols-[minmax(180px,1.25fr)_110px_minmax(120px,1fr)_100px_160px_115px_100px_170px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-medium uppercase text-slate-500 2xl:grid"><span>Property / unit</span><span>Status</span><span>Tenant / occupant</span><span>Monthly rent</span><span>Lease term</span><span>Occupancy coverage</span><span>Record cleanup</span><span>Actions</span></div>
      <div className="divide-y divide-slate-200">{roll.map((item) => {
        const { property, row, activeLease, futureLease, currentPeriod } = item;
        const key = `${property.id}:${row.unit.name}`;
        const expanded = auditExpanded[key] ?? item.hasCoverageIssues;
        const displayedLease = activeLease || futureLease;
        const tenantOrOccupant = leaseRollOccupantLabel(item);
        const cleanupLabel = leaseRollCleanupLabel(item);
        const primaryAction = activeLease ? () => openLease(activeLease) : item.status === "Owner occupied" ? () => openOccupancyEditor(property.id, row.unit.name) : () => openNewLeaseForUnit(property.id, row.unit.name);
        const primaryLabel = activeLease ? "View lease" : item.status === "Owner occupied" ? "Manage occupancy" : "Add lease";
        return <div key={key}>
          <div className={`grid gap-3 px-4 py-2.5 2xl:grid-cols-[minmax(180px,1.25fr)_110px_minmax(120px,1fr)_100px_160px_115px_100px_170px] 2xl:items-center ${item.status === "Owner occupied" ? "bg-slate-50/40" : ""}`}>
            <div className="min-w-0"><div className="font-medium text-slate-900">{property.name}</div><div className="text-xs text-slate-500">{formatUnitLabel(row.unit.name)}{property.address ? ` | ${property.address}` : ""}</div></div>
            <div><Badge variant="outline" className={STATUS_TONE[item.status]}>{item.status}</Badge><span className="mt-1 block text-[10px] text-slate-500">{activeLease ? "Active lease" : item.status === "Future" ? "Upcoming lease" : "No active lease"}</span></div>
            <div className="text-sm text-slate-800">{tenantOrOccupant}{currentPeriod ? <span className="block text-[10px] text-slate-500">Since {currentPeriod.startDate}</span> : null}</div>
            <div className="text-sm font-medium text-slate-900">{displayedLease && Number(displayedLease.monthlyRent || 0) > 0 ? currency(Number(displayedLease.monthlyRent)) : "No rent scheduled"}{displayedLease && Number(displayedLease.monthlyRent || 0) > 0 ? <span className="block text-[10px] font-normal text-slate-500">per month</span> : null}</div>
            <div className="text-xs text-slate-700">{displayedLease ? <>{displayedLease.startDate || "Start date not entered"} to {leaseActualEndLabel(displayedLease) || "No lease end date"}{item.expirationDays != null && item.expirationDays <= 60 ? <span className="mt-1 block font-medium text-amber-700">{item.expirationDays >= 0 ? `Ends in ${item.expirationDays} days` : "Lease ended"}</span> : null}</> : currentPeriod ? `${currentPeriod.startDate} to ${currentPeriod.endDate || "present"}` : "No active lease"}</div>
            <div><AuditReadinessBadge status={row.isCoverageComplete ? { key: "ready", label: "Complete" } : { key: "needs_review", label: "Review" }} /><span className="mt-1 block text-[10px] text-slate-500">Occupancy timeline | {item.coveragePct}% tracked</span></div>
            <div className={item.cleanupCount ? "text-xs font-medium text-amber-700" : "text-xs text-slate-500"}>{cleanupLabel}</div>
            <div className="flex flex-nowrap items-center gap-1"><Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={primaryAction}>{primaryLabel}</Button><Button size="sm" variant="ghost" className="shrink-0" aria-expanded={expanded} onClick={() => setAuditExpanded((current) => ({ ...current, [key]: !expanded }))}><ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} /><span className="sr-only">Toggle coverage audit</span></Button></div>
          </div>

          {expanded ? <div className="border-t border-slate-100 bg-slate-50/60 p-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
              <section className="rounded-lg border border-slate-200 bg-white p-3"><div className="mb-2 flex items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-slate-900">Coverage audit - {formatUnitLabel(row.unit.name)}</h3><p className="text-[10px] text-slate-500">Occupancy history for {yearFilter} | {row.auditStart} to {row.auditEnd} | {row.coveredDays}/{row.totalDays} days tracked</p></div>{row.gaps.length || row.overlaps.length ? <Badge className="bg-amber-100 text-amber-800">Needs review</Badge> : <Badge className="bg-emerald-100 text-emerald-700">Complete</Badge>}</div><MonthGrid item={item} property={property} yearFilter={yearFilter} selectedMonthDetail={selectedMonthDetail} setSelectedMonthDetail={setSelectedMonthDetail} />{row.gaps.length > 0 ? <div className="mt-2 text-xs text-rose-700">Gaps: {row.gaps.map((gap) => `${gap.start} to ${gap.end}`).join(", ")}</div> : null}{row.overlaps.length > 0 ? <div className="mt-1 text-xs text-amber-700">Overlaps: {row.overlaps.length}</div> : null}</section>
              <section className="rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><FileText className="h-4 w-4 text-slate-500" />Lease history</h3><Button size="sm" variant="secondary" onClick={() => openNewLeaseForUnit(property.id, row.unit.name)}>Add lease</Button></div>
                  <div className="mt-2 divide-y divide-slate-100">{row.leasesForUnit.length ? row.leasesForUnit.map((lease) => <button key={lease.id} type="button" onClick={() => openLease(lease)} className="flex w-full items-start justify-between gap-2 py-2 text-left"><span><span className="block text-xs font-medium text-slate-800">{lease.tenantName || "No tenant name"}</span><span className="block text-[10px] text-slate-500">{lease.startDate} to {leaseActualEndLabel(lease)} | {currency(Number(lease.monthlyRent || 0))}/mo</span></span><Badge variant="secondary">{leaseStatusForDate(lease, row.auditEnd)}</Badge></button>) : <p className="py-2 text-xs text-slate-500">No leases recorded.</p>}</div>
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
    </Card>
  </div>;
}
