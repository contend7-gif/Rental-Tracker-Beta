import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { getWorkspaceFilterVisibility } from "./workspaceFilterVisibility.js";

const navIconColors = {
  dashboard: "text-sky-600 group-hover:text-sky-700",
  quickAdd: "text-teal-600 group-hover:text-teal-700",
  ledger: "text-indigo-600 group-hover:text-indigo-700",
  documents: "text-blue-600 group-hover:text-blue-700",
  maintenance: "text-emerald-600 group-hover:text-emerald-700",
  leaseHistory: "text-violet-600 group-hover:text-violet-700",
  tax: "text-orange-600 group-hover:text-orange-700",
  review: "text-cyan-600 group-hover:text-cyan-700",
  operations: "text-teal-600 group-hover:text-teal-700",
  properties: "text-slate-600 group-hover:text-slate-700",
  assets: "text-amber-600 group-hover:text-amber-700",
  loans: "text-blue-700 group-hover:text-blue-800",
  planning: "text-purple-600 group-hover:text-purple-700",
  settings: "text-slate-500 group-hover:text-slate-700",
};

export function AppSidebar({
  currentView,
  mobileCompanionWaitingCount,
  navGroups,
  prefetchWorkspace,
  properties,
  propertyFilter,
  setPropertyFilter,
  setSidebarCollapsed,
  setUnitFilter,
  setView,
  setYearFilter,
  sidebarCollapsed,
  unitFilter,
  unitFilterOptions,
  view,
  yearFilter,
}) {
  const filterVisibility = getWorkspaceFilterVisibility(view);

  return (
    <aside className={`rt-sidebar min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm lg:sticky lg:top-4 lg:self-start ${sidebarCollapsed ? "space-y-3 p-2" : "space-y-4 p-3"}`}>
      <div className={`flex gap-3 ${sidebarCollapsed ? "items-center justify-center lg:flex-col lg:gap-2" : "items-center justify-between"}`}>
        <div className={`flex min-w-0 items-center ${sidebarCollapsed ? "justify-center" : "gap-3"}`}>
          <div className={`rt-brand-mark flex shrink-0 items-center justify-center rounded-lg text-white ${sidebarCollapsed ? "h-9 w-9" : "h-10 w-10"}`}>
            <Building2 className="h-5 w-5" />
          </div>
          <div className={`min-w-0 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
            <h1 className="text-xl font-semibold leading-tight text-slate-950" title="Rental Tracker">Rental</h1>
            <div className="mt-0.5 truncate text-xs font-medium text-slate-500">{currentView.title}</div>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`hidden rounded-md text-slate-500 lg:inline-flex ${sidebarCollapsed ? "h-7 w-7 px-0" : ""}`}
          onClick={() => setSidebarCollapsed((prev) => !prev)}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {filterVisibility ? <div className={`space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/80 p-2 lg:hidden ${sidebarCollapsed ? "lg:hidden" : ""}`}>
        {filterVisibility.year ? <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="h-7 border-slate-200 bg-white text-xs font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2025">2025</SelectItem>
            <SelectItem value="2026">2026</SelectItem>
          </SelectContent>
        </Select> : null}
        {filterVisibility.property ? <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="h-7 border-slate-200 bg-white text-xs font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All properties</SelectItem>
            {properties.map((property) => (
              <SelectItem key={property.id} value={property.id}>
                {property.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select> : null}
        {filterVisibility.unit ? <Select value={unitFilter} onValueChange={setUnitFilter}>
          <SelectTrigger className="h-7 border-slate-200 bg-white text-xs font-medium" disabled={propertyFilter === "all"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {unitFilterOptions.map((unitOpt) => (
              <SelectItem key={unitOpt.value} value={unitOpt.value}>
                {unitOpt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select> : null}
      </div> : null}

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:space-y-3 lg:overflow-visible lg:px-0 lg:pb-0">
        {navGroups.map((group) => (
          <div key={group.key} className="flex gap-2 lg:block lg:space-y-1">
            {group.label ? (
              <div className={`hidden px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 lg:block ${sidebarCollapsed ? "lg:text-center lg:px-0" : ""}`}>
                {sidebarCollapsed ? <span aria-hidden="true">-</span> : group.label}
              </div>
            ) : null}
            {group.items.map(([key, label, Icon]) => {
          const isActive = view === key;
          const iconColor = navIconColors[key] || "text-slate-500 group-hover:text-slate-700";
          return (
          <Button
            key={key}
            variant="ghost"
            className={`group relative flex-none rounded-md text-sm lg:mb-1 lg:w-full ${
              sidebarCollapsed ? "justify-start lg:justify-center" : "justify-start"
            } ${
              isActive
                ? "bg-teal-50 text-teal-900 shadow-none hover:bg-teal-50"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            } ${sidebarCollapsed ? "px-0 lg:px-0" : "px-3"}`}
            onClick={() => setView(key)}
            onMouseEnter={() => prefetchWorkspace(key)}
            onFocus={() => prefetchWorkspace(key)}
            onTouchStart={() => prefetchWorkspace(key)}
            title={label}
          >
            <span className={`absolute left-0 top-1.5 hidden h-5 w-0.5 rounded-full bg-teal-700 lg:block ${isActive ? "opacity-100" : "opacity-0"}`} />
            <Icon className={`h-4 w-4 ${isActive ? "text-teal-700" : iconColor}`} />
            <span className={sidebarCollapsed ? "inline lg:hidden" : "inline"}>{label}</span>
            {key === "documents" && mobileCompanionWaitingCount > 0 ? (
              <span
                className={`inline-flex min-w-5 items-center justify-center rounded-full bg-teal-700 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ${sidebarCollapsed ? "ml-auto lg:absolute lg:-right-1 lg:-top-1" : "ml-auto"}`}
                aria-label={`${mobileCompanionWaitingCount} mobile inbox ${mobileCompanionWaitingCount === 1 ? "item" : "items"} waiting`}
              >
                {mobileCompanionWaitingCount > 99 ? "99+" : mobileCompanionWaitingCount}
              </span>
            ) : null}
          </Button>
          );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}
