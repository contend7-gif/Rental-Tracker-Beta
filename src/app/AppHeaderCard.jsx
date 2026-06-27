import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, CalendarDays, ChevronDown, Home, PlusCircle } from "lucide-react";
import { getWorkspaceFilterVisibility } from "./workspaceFilterVisibility.js";

export function AppHeaderCard({
  currentView,
  dashboardAsOfDate,
  dashboardFiltersSummary,
  filterControls,
  notice,
  prefetchDialog,
  primaryAction,
  settingsSavedText,
  settingsSavedVisible,
  view,
}) {
  const filterVisibility = getWorkspaceFilterVisibility(view);
  const showFilterControls = Boolean(filterControls && filterVisibility);
  const ViewIcon = currentView.icon;
  const viewIconTone = currentView.tone || "border-teal-100 bg-teal-50 text-teal-700";
  const dashboardAsOfLabel = /^\d{4}-\d{2}-\d{2}$/.test(String(dashboardAsOfDate || ""))
    ? new Date(`${dashboardAsOfDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : dashboardAsOfDate;

  const primaryActionButton = primaryAction ? (
    <Button
      size="sm"
      className="!h-12 shrink-0 self-center rounded-md font-semibold"
      onClick={primaryAction.onClick}
      onMouseEnter={() => prefetchDialog(primaryAction.prefetchKey)}
      onFocus={() => prefetchDialog(primaryAction.prefetchKey)}
      onTouchStart={() => prefetchDialog(primaryAction.prefetchKey)}
    >
      <PlusCircle className="h-4 w-4" />
      {primaryAction.label}
    </Button>
  ) : null;

  const dashboardFilterControls = showFilterControls ? (
    <div className="hidden min-w-0 flex-1 items-center gap-2 lg:flex xl:flex-none">
      {filterVisibility.year ? <label className="relative grid h-12 w-20 min-w-0 grid-rows-[12px_22px] content-center overflow-hidden rounded-md border border-slate-200 bg-white px-2 pb-1.5 pt-2">
        <span className="flex items-center gap-1 self-end text-[9px] font-semibold uppercase leading-[11px] text-slate-500"><CalendarDays className="h-2.5 w-2.5 text-teal-700" />Year</span>
        <Select value={filterControls.yearFilter} onValueChange={filterControls.setYearFilter}>
          <SelectTrigger className="!h-[22px] !min-h-0 appearance-none overflow-hidden !border-0 !bg-transparent !px-0 !py-0 !pr-4 !text-xs font-semibold !leading-5 !shadow-none focus:!ring-0"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent>
        </Select>
        <ChevronDown className="pointer-events-none absolute bottom-2.5 right-1.5 h-3 w-3 text-slate-500" />
      </label> : null}
      {filterVisibility.property ? <label className="relative grid h-12 w-44 min-w-0 grid-rows-[12px_22px] content-center overflow-hidden rounded-md border border-slate-200 bg-white px-2 pb-1.5 pt-2">
        <span className="flex items-center gap-1 self-end text-[9px] font-semibold uppercase leading-[11px] text-slate-500"><Building2 className="h-2.5 w-2.5 text-teal-700" />Property</span>
        <Select value={filterControls.propertyFilter} onValueChange={filterControls.setPropertyFilter}>
          <SelectTrigger className="!h-[22px] !min-h-0 appearance-none overflow-hidden !border-0 !bg-transparent !px-0 !py-0 !pr-4 !text-xs font-semibold !leading-5 !shadow-none focus:!ring-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All properties</SelectItem>
            {filterControls.properties.map((property) => <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <ChevronDown className="pointer-events-none absolute bottom-2.5 right-1.5 h-3 w-3 text-slate-500" />
      </label> : null}
      {filterVisibility.unit ? <label className="relative grid h-12 w-28 min-w-0 grid-rows-[12px_22px] content-center overflow-hidden rounded-md border border-slate-200 bg-white px-2 pb-1.5 pt-2">
        <span className="flex items-center gap-1 self-end text-[9px] font-semibold uppercase leading-[11px] text-slate-500"><Home className="h-2.5 w-2.5 text-teal-700" />Unit</span>
        <Select value={filterControls.unitFilter} onValueChange={filterControls.setUnitFilter}>
          <SelectTrigger className="!h-[22px] !min-h-0 appearance-none overflow-hidden !border-0 !bg-transparent !px-0 !py-0 !pr-4 !text-xs font-semibold !leading-5 !shadow-none focus:!ring-0" disabled={filterControls.propertyFilter === "all"}><SelectValue /></SelectTrigger>
          <SelectContent>{filterControls.unitFilterOptions.map((unitOpt) => <SelectItem key={unitOpt.value} value={unitOpt.value}>{unitOpt.label}</SelectItem>)}</SelectContent>
        </Select>
        <ChevronDown className="pointer-events-none absolute bottom-2.5 right-1.5 h-3 w-3 text-slate-500" />
      </label> : null}
    </div>
  ) : null;

  return (
    <>
    <Card className="rt-header-card overflow-visible border-slate-200 bg-white">
      <CardContent className="flex flex-col justify-center px-4 py-2.5">
        <div className="flex flex-col gap-3 xl:min-h-14 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3 xl:min-h-12">
          {ViewIcon ? (
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${viewIconTone}`}>
              <ViewIcon className="h-5 w-5" aria-hidden="true" />
            </div>
          ) : null}
          <div className="min-w-0">
            <h2 className="rt-page-title truncate">{currentView.title}</h2>
            {currentView.description ? <div className="rt-page-subtitle mt-0.5 truncate">{currentView.description}</div> : null}
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
            {view === "dashboard" && dashboardFiltersSummary ? (
              <span className="lg:hidden">{dashboardFiltersSummary}</span>
            ) : null}
            {view === "dashboard" && dashboardAsOfLabel ? (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Data as of {dashboardAsOfLabel}
              </span>
            ) : null}
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-2 self-center sm:flex-row sm:items-center">{dashboardFilterControls}{primaryActionButton}</div>
        </div>
      </CardContent>
    </Card>
    {(notice || settingsSavedVisible) && (
      <div className="w-full rounded-md border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs font-medium text-emerald-800">
        {notice || settingsSavedText}
      </div>
    )}
    </>
  );
}
