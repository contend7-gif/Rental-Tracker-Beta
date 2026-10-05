import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Building2, ChevronLeft, ChevronRight, Menu } from "lucide-react";

export function AppSidebar({ mobileCompanionWaitingCount, navGroups, prefetchWorkspace, setSidebarCollapsed, setView, sidebarCollapsed, view }) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const navigationTrigger = useRef(null);
  const closeNavigation = (open) => {
    setNavigationOpen(open);
    if (!open) requestAnimationFrame(() => navigationTrigger.current?.focus());
  };
  const navigation = (compact = false) => <nav aria-label="Primary navigation" className="space-y-5">
    {navGroups.map((group) => <div key={group.key} className="space-y-1">
      {group.label && !compact && <div className="px-3 pb-1 text-xs font-semibold text-slate-500">{group.label}</div>}
      {group.items.map(([key, label, Icon]) => <Button key={key} variant="ghost"
        aria-label={label} aria-current={view === key ? "page" : undefined} title={compact ? label : undefined}
        className={`rt-nav-item w-full !h-8 ${compact ? "justify-center !px-0" : "justify-start px-3"} ${view === key ? "rt-nav-active bg-teal-50 text-teal-900" : "text-slate-600"}`}
        onClick={() => { setNavigationOpen(false); setView(key); }}
        onMouseEnter={() => prefetchWorkspace(key)} onFocus={() => prefetchWorkspace(key)} onTouchStart={() => prefetchWorkspace(key)}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!compact && <span>{label}</span>}
        {key === "documents" && mobileCompanionWaitingCount > 0 && <span className="ml-auto rounded bg-teal-700 px-1.5 text-xs text-white" aria-label={`${mobileCompanionWaitingCount} mobile inbox items waiting`}>{mobileCompanionWaitingCount > 99 ? "99+" : mobileCompanionWaitingCount}</span>}
      </Button>)}
    </div>)}
  </nav>;
  return <>
    <aside className={`rt-sidebar min-w-0 rounded-lg border border-slate-200 bg-white lg:sticky lg:top-4 lg:self-start ${sidebarCollapsed ? "p-2" : "p-3"}`}>
      <div className={`flex items-center justify-between gap-3 ${sidebarCollapsed ? "lg:flex-col" : ""}`}>
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="rt-brand-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"><Building2 className="h-5 w-5" aria-hidden="true" /></div>
          <div className={sidebarCollapsed ? "lg:hidden" : ""}><div className="font-semibold text-slate-900">Rental Tracker</div><div className="text-xs text-slate-500">Your property workspace</div></div>
        </div>
        <Button ref={navigationTrigger} variant="secondary" className="lg:hidden" aria-expanded={navigationOpen} onClick={() => setNavigationOpen(true)}><Menu className="h-4 w-4" aria-hidden="true" />Navigation</Button>
        <Button variant="ghost" size="icon" className="rt-sidebar-collapse" onClick={() => setSidebarCollapsed((previous) => !previous)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</Button>
      </div>
      <div className="mt-6 hidden lg:block">{navigation(sidebarCollapsed)}</div>
    </aside>
    <Dialog open={navigationOpen} onOpenChange={closeNavigation} variant="panel">
      <DialogContent className="rt-navigation-content !max-w-sm !p-4">
        <div className="mb-5 flex items-center justify-between gap-3"><DialogTitle>Navigation</DialogTitle><DialogClose variant="secondary">Close</DialogClose></div>
        {navigation()}
      </DialogContent>
    </Dialog>
  </>;
}
