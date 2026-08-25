import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, CalendarDays, ChevronDown, FilePlus2, Home, Landmark, PlusCircle, Receipt, Wallet, Wrench } from "lucide-react";
import { getWorkspaceFilterVisibility } from "./workspaceFilterVisibility.js";

const newActionIcons = {
  transaction: Receipt,
  lease: CalendarDays,
  workOrder: Wrench,
  document: FilePlus2,
  property: Building2,
  asset: Wallet,
  loan: Landmark,
};

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
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef(null);

  useEffect(() => {
    if (!newMenuOpen) return undefined;
    const closeFromOutside = (event) => {
      if (!newMenuRef.current?.contains(event.target)) setNewMenuOpen(false);
    };
    const closeFromKeyboard = (event) => {
      if (event.key === "Escape") setNewMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [newMenuOpen]);

  const primaryActionButton = primaryAction?.items?.length ? (
    <div ref={newMenuRef} className="relative shrink-0 self-center">
      <Button
        size="sm"
        className="!h-12 min-w-24 rounded-md font-semibold"
        onClick={() => setNewMenuOpen((open) => !open)}
        aria-expanded={newMenuOpen}
        aria-haspopup="menu"
      >
        <PlusCircle className="h-4 w-4" />
        {primaryAction.label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${newMenuOpen ? "rotate-180" : ""}`} />
      </Button>
      {newMenuOpen ? (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-3 py-2.5">
            <div className="text-sm font-semibold text-slate-950">Create new</div>
            <div className="mt-0.5 text-xs text-slate-500">Choose the record you want to add.</div>
          </div>
          <div className="grid gap-1 p-2">
            {primaryAction.items.map((action) => {
              const ActionIcon = newActionIcons[action.key] || PlusCircle;
              return (
                <button
                  key={action.key}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  onClick={() => {
                    setNewMenuOpen(false);
                    action.onClick();
                  }}
                  onMouseEnter={() => action.prefetchKey && prefetchDialog(action.prefetchKey)}
                  onFocus={() => action.prefetchKey && prefetchDialog(action.prefetchKey)}
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-teal-700">
                    <ActionIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">{action.label}</span>
                    <span className="mt-0.5 block text-xs leading-4 text-slate-500">{action.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  ) : primaryAction ? (
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
