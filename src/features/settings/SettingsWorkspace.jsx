import React, { useState } from "react";
import { Archive, Database, FileText, FolderOpen, HardDrive, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { MobileCompanionSettings } from "./MobileCompanionSettings.jsx";
import {
  AUTO_RECURRING_HELPER_TEXT,
  DASHBOARD_METRIC_OPTIONS,
  DASHBOARD_DENSITY_OPTIONS,
  LEASE_AUTOMATION_HELPER_TEXT,
  LEDGER_SORT_OPTIONS,
  SETTINGS_LABELS,
  SETTINGS_TOOLTIPS,
  SIDEBAR_DEFAULT_OPTIONS,
} from "../../store/appSettings.ts";

const SETTINGS_SECTION_CLASS = "rounded-xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/30";
const SETTINGS_CARD_CLASS = "self-start rounded-lg border border-slate-200 bg-slate-50/60 p-3";
const TEXTAREA_CLASS =
  "mt-1 min-h-[96px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200";
const PERSISTENCE_COUNT_LABELS = [
  ["properties", "properties"],
  ["units", "units"],
  ["transactions", "transactions"],
  ["leases", "leases"],
  ["tenantLedgerEntries", "ledger"],
  ["documents", "documents"],
  ["loans", "loans"],
  ["assets", "assets"],
  ["workOrders", "work orders"],
];
const SETTINGS_TABS = [
  { key: "workspace", label: "Workspace", detail: "Daily preferences", icon: SlidersHorizontal, tone: "teal" },
  { key: "data", label: "Data & Backup", detail: "Restore points", icon: HardDrive, tone: "blue" },
  { key: "admin_tools", label: "Admin & Tools", detail: "Access, AI, updates", icon: ShieldCheck, tone: "violet" },
];

const SETTINGS_ICON_TONES = {
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  slate: "border-slate-200 bg-slate-50 text-slate-600",
  teal: "border-teal-200 bg-teal-50 text-teal-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
};

function settingsIconTone(tone) {
  return SETTINGS_ICON_TONES[tone] || SETTINGS_ICON_TONES.slate;
}

function formatPersistenceRecordCounts(counts) {
  if (!counts || typeof counts !== "object") return "";
  const visibleCounts = PERSISTENCE_COUNT_LABELS
    .map(([key, label]) => [label, Number(counts[key] || 0)])
    .filter(([, count]) => count > 0);
  if (!visibleCounts.length) return "No structured records saved yet.";
  return visibleCounts.map(([label, count]) => `${count} ${label}`).join(" | ");
}

function SettingsSectionShell({ title, description, badge, collapsed, onToggle, children }) {
  return (
    <div className={SETTINGS_SECTION_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-0.5 max-w-3xl text-xs leading-5 text-slate-500">{description}</div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {badge ? badge : null}
          <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={onToggle}>
            {collapsed ? "Expand" : "Collapse"}
          </Button>
        </div>
      </div>
      {collapsed ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-500">
          Hidden for now. Expand when you need to adjust these settings.
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export function SettingsWorkspace({
  activeAccessRoleOption,
  aiDocumentCopilotReady,
  appSettings,
  autoBackupStatusLabel,
  backupImportInputRef,
  backupValidationBusy,
  backupValidationResult,
  canManageAccessProfile,
  canManageDataAdmin,
  checkForDesktopUpdates,
  createAutoBackupNow,
  currency,
  currentAppVersion,
  currentDataStatus,
  currentReleaseHistory,
  currentReleaseNotesEntry,
  desktopDiagnosticEventClass,
  desktopDiagnosticPillClass,
  desktopDiagnosticsApi,
  desktopDiagnosticsBusy,
  desktopDiagnosticsCheckedAtLabel,
  desktopDiagnosticsRecentEvents,
  desktopDiagnosticsReport,
  desktopCompanionApi,
  desktopDocumentAiApi,
  desktopUpdateBadgeClass,
  desktopUpdateBusy,
  desktopUpdateCanRestart,
  desktopUpdateCheckedAtLabel,
  desktopUpdateMessage,
  desktopUpdateProgress,
  desktopUpdateReleaseDateLabel,
  desktopUpdateState,
  desktopUpdateStatusKey,
  desktopUpdateStatusLabel,
  desktopUpdaterAvailable,
  deMinimisThreshold,
  effectiveUpdateReleaseNotes,
  exportDataBackup,
  exportLatestAutoBackup,
  formatDesktopUpdateDate,
  formatUsPhone,
  installDesktopUpdateNow,
  loadDemoData,
  navItems,
  onBackupImportInputChange,
  onStatementLogoInputChange,
  openBackupImportPicker,
  openCurrentReleaseNotesDialog,
  openDesktopDataFolder,
  openUpdateReleaseNotesDialog,
  persistenceHealth,
  persistenceLastError,
  performanceMetrics,
  realDataChecklist,
  reloadDesktopPersistenceData,
  restorePointBusy,
  resetToDefaults,
  restoreLocalAdminAccess,
  roleAccessSummary,
  runDesktopDiagnostics,
  setSetting,
  setSettingsSectionCollapsed,
  setView,
  settingsSectionCollapsed,
  setupChecklist,
  setupChecklistShowDismissed,
  statementLogoInputRef,
  toggleDashboardCardSetting,
  toggleSetupChecklistDismissed,
  toggleSetupChecklistItemOverride,
  toggleSetupChecklistShowDismissed,
  updateReleaseNotesEntry,
  updateTargetVersion,
  validateLatestBackup,
}) {
  const [settingsTab, setSettingsTab] = useState("workspace");
  const [showStoragePaths, setShowStoragePaths] = useState(false);
  const [showRecoveryTools, setShowRecoveryTools] = useState(false);
  const [showRealDataChecklist, setShowRealDataChecklist] = useState(false);
  const persistenceRecordCountSummary = formatPersistenceRecordCounts(persistenceHealth?.collectionCounts);
  const realDataBlockingCount = Number(realDataChecklist?.counts?.needsSetup || 0) + Number(realDataChecklist?.counts?.needsReview || 0);
  const saveStatusLabel = persistenceLastError
    ? "Needs attention"
    : persistenceHealth?.lastSaveAt
      ? "Saved"
      : "Waiting for first save";
  const documentHealthSummary = persistenceHealth?.persistenceAvailable
    ? [
        `${Number(persistenceHealth.documentStorageFileCount || 0)} files`,
        `${Number(persistenceHealth.orphanDocumentFileCount || 0)} orphan`,
        `${Number(persistenceHealth.missingDocumentFileCount || 0)} missing`,
      ].join(" | ")
    : "";
  const lastBackupLabel = formatDesktopUpdateDate(persistenceHealth?.lastBackupAt || currentDataStatus?.lastBackupAt || "") || autoBackupStatusLabel;
  const lastValidationLabel = backupValidationResult?.label || currentDataStatus?.lastValidationStatus || persistenceHealth?.lastBackupValidationLabel || "Not validated";
  const backupCheckpointClass =
    persistenceHealth?.lastBackupAt && (backupValidationResult?.status === "valid" || backupValidationResult?.status === "valid_with_warnings" || persistenceHealth?.lastBackupValidationStatus)
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-amber-200 bg-amber-50 text-amber-900";
  const workspaceSummary = `${appSettings.defaultView || "dashboard"} opens first`;
  const backupTone = persistenceLastError || Number(currentDataStatus?.missingDocumentFileCount || 0) > 0 ? "amber" : persistenceHealth?.lastBackupAt ? "emerald" : "blue";
  const backupSummary = persistenceHealth?.lastBackupAt ? "Restore point available" : "Create first restore point";
  const adminToolsSummary = aiDocumentCopilotReady ? "AI ready" : appSettings.aiDocumentCopilotEnabled ? "AI setup needed" : "Admin tools ready";
  const adminToolsTone = appSettings.aiDocumentCopilotEnabled && !aiDocumentCopilotReady ? "amber" : "slate";

  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="space-y-4 !p-3 text-sm">
        <div className="flex flex-wrap justify-end gap-2">
          <Badge variant="secondary">{activeAccessRoleOption?.label || "Admin"}</Badge>
          <Badge variant="secondary">{saveStatusLabel}</Badge>
        </div>
        <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2 md:grid-cols-3">
          {SETTINGS_TABS.map((tab) => {
            const TabIcon = tab.icon;
            const tabSummary =
              tab.key === "workspace" ? workspaceSummary : tab.key === "data" ? backupSummary : adminToolsSummary;
            const tabDetail =
              tab.key === "workspace"
                ? `${appSettings.dashboardDensity || "comfortable"} dashboard`
                : tab.key === "data"
                  ? lastBackupLabel
                  : desktopUpdaterAvailable
                    ? "Desktop tools available"
                    : "Browser-safe mode";
            const tabTone = tab.key === "data" ? backupTone : tab.key === "admin_tools" ? adminToolsTone : tab.tone;
            return (
              <button
                key={tab.key}
                type="button"
                className={`flex min-h-16 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  settingsTab === tab.key ? "border border-teal-200 bg-white text-teal-900 shadow-sm" : "border border-transparent text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
                onClick={() => setSettingsTab(tab.key)}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${settingsIconTone(tabTone)}`}>
                  <TabIcon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-semibold uppercase tracking-wide opacity-70">{tab.label}</span>
                  <span className="block truncate text-sm font-semibold">{tabSummary}</span>
                  <span className="block truncate text-xs font-normal opacity-70">{tabDetail}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {settingsTab === "workspace" ? (
            <>
              <Badge variant="secondary">Daily controls</Badge>
              <Badge variant="secondary">{appSettings.autoMaterializeRecurring ? "Recurring on" : "Recurring off"}</Badge>
              <Badge variant="secondary">{appSettings.leaseAutomationEnabled ? "Lease automation on" : "Lease automation off"}</Badge>
            </>
          ) : null}
          {settingsTab === "data" ? (
            <>
              <Badge variant="secondary">{currentDataStatus?.label || "Data status unknown"}</Badge>
              <Badge variant="secondary">{lastValidationLabel}</Badge>
            </>
          ) : null}
          {settingsTab === "admin_tools" ? (
            <>
              <Badge variant="secondary">{desktopUpdateStatusLabel}</Badge>
              <Badge variant="secondary">{aiDocumentCopilotReady ? "AI ready" : "AI optional"}</Badge>
            </>
          ) : null}
        </div>

        {settingsTab === "admin_tools" ? (
        <>
        <SettingsSectionShell
          title="Admin tools"
          description="Optional setup review, audit log access, and access-profile testing for delegated workflows."
          badge={<Badge variant="secondary">Admin</Badge>}
          collapsed={settingsSectionCollapsed.access}
          onToggle={() => setSettingsSectionCollapsed((prev) => ({ ...prev, access: !prev.access }))}
        >
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className={`${SETTINGS_CARD_CLASS} md:col-span-2 xl:col-span-4`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-slate-900">Getting Started / Setup checklist</div>
                  <div className="mt-1 text-xs text-slate-500">The Dashboard only shows setup while it needs attention. Review or restore dismissed items here anytime.</div>
                </div>
                <Badge variant="secondary" className={setupChecklist?.status === "complete" ? "!bg-emerald-100 !text-emerald-700" : "!bg-amber-100 !text-amber-800"}>
                  {setupChecklist?.label || "Setup checklist"}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" checked={Boolean(setupChecklistShowDismissed)} onChange={(event) => toggleSetupChecklistShowDismissed?.(event.target.checked)} />
                  <span>Show completed / dismissed items</span>
                </label>
                <Button size="sm" variant="secondary" onClick={() => setView("dashboard")}>Open Dashboard setup</Button>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {(setupChecklist?.items || []).map((item) => (
                  <div key={`settings-setup-${item.key}`} className="rounded-lg border border-slate-200 bg-slate-50/70 p-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-900">{item.label}</div>
                        <div className="mt-1 line-clamp-2 text-slate-500">{item.explanation}</div>
                      </div>
                      <Badge variant="secondary" className={item.status === "complete" || item.status === "not_applicable" ? "!bg-emerald-100 !text-emerald-700" : item.status === "optional" || item.status === "dismissed" ? "" : "!bg-amber-100 !text-amber-800"}>
                        {item.statusLabel}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Button size="sm" variant="secondary" onClick={() => setView(item.targetView)}>Open</Button>
                      {item.status === "not_applicable" ? (
                        <Button size="sm" variant="ghost" onClick={() => toggleSetupChecklistItemOverride?.(item.key, "")}>Undo</Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => toggleSetupChecklistItemOverride?.(item.key, "not_applicable")}>Not applicable</Button>
                      )}
                      {item.status === "dismissed" ? (
                        <Button size="sm" variant="ghost" onClick={() => toggleSetupChecklistItemOverride?.(item.key, "")}>Undo dismiss</Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => toggleSetupChecklistDismissed?.(item.key)}>Dismiss</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={SETTINGS_CARD_CLASS}>
              <div className="text-sm font-medium text-slate-900">Activity Log / Audit Log</div>
              <div className="mt-2 text-xs text-slate-500">Audit entries are preserved but no longer shown in primary navigation.</div>
              <Button variant="secondary" className="mt-3 h-9 w-full" onClick={() => setView("activity")}>
                Open Activity Log
              </Button>
            </div>

            <div className={SETTINGS_CARD_CLASS}>
              <Label>Operator name</Label>
              <Input
                className="mt-1"
                value={appSettings.operatorName}
                onChange={(e) => setSetting("operatorName", e.target.value)}
                disabled={!canManageAccessProfile}
              />
              <div className="mt-2 text-xs text-slate-500">Stamped onto new audit events. Admin-only to keep the trail trustworthy.</div>
            </div>

            <div className={SETTINGS_CARD_CLASS}>
              <Label>Access profile testing</Label>
              <Select value={appSettings.accessRole} onValueChange={(value) => setSetting("accessRole", value)} disabled={!canManageAccessProfile}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="bookkeeper">Bookkeeper</SelectItem>
                  <SelectItem value="read_only">Read-only</SelectItem>
                </SelectContent>
              </Select>
              <div className="mt-2 text-xs text-slate-500">Access profiles are mainly for testing delegated workflows. Most single-user installs should remain in Admin. {activeAccessRoleOption.description}</div>
              {!canManageAccessProfile ? (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-amber-700">
                    Local access profiles are workflow guardrails for this app install, not full account authentication.
                  </div>
                  <Button variant="outline" className="h-9 w-full" onClick={() => restoreLocalAdminAccess()}>
                    Restore local admin access
                  </Button>
                </div>
              ) : (
                <div className="mt-3 text-xs text-slate-500">
                  Access profiles are local to this app install. They do not create separate user accounts yet.
                </div>
              )}
            </div>

            <div className={`${SETTINGS_CARD_CLASS} md:col-span-2 xl:col-span-2`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Role summary</Label>
                {!canManageAccessProfile ? <Badge variant="secondary">Admin required to edit</Badge> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {roleAccessSummary.map((item) => (
                  <Badge key={item} variant="secondary" className="text-[11px]">
                    {item}
                  </Badge>
                ))}
              </div>
              <div className="mt-2 text-xs text-slate-500">Deletes, full backup/restore, demo-data loads, and access-profile changes stay reserved for Admin.</div>
            </div>
          </div>
        </SettingsSectionShell>

        <SettingsSectionShell
          title="Mobile companion"
          description="Optional phone capture integration. Rental Tracker remains complete and local-first when this feature is off."
          badge={<Badge variant="secondary">{appSettings.mobileCompanionEnabled ? "Enabled" : "Optional"}</Badge>}
          collapsed={settingsSectionCollapsed.companion}
          onToggle={() => setSettingsSectionCollapsed((prev) => ({ ...prev, companion: !prev.companion }))}
        >
          <MobileCompanionSettings
            appSettings={appSettings}
            desktopCompanionApi={desktopCompanionApi}
            setSetting={setSetting}
          />
        </SettingsSectionShell>

        <SettingsSectionShell
          title="AI document copilot"
          description="Optional OpenAI-powered document summaries and next-step suggestions. Nothing is sent unless you explicitly click an AI action on a document."
          badge={<Badge variant="secondary">{aiDocumentCopilotReady ? "Ready" : appSettings.aiDocumentCopilotEnabled ? "Setup needed" : "Optional"}</Badge>}
          collapsed={settingsSectionCollapsed.ai}
          onToggle={() => setSettingsSectionCollapsed((prev) => ({ ...prev, ai: !prev.ai }))}
        >
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className={SETTINGS_CARD_CLASS}>
              <Label>{SETTINGS_LABELS.aiDocumentCopilot}</Label>
              <Select value={appSettings.aiDocumentCopilotEnabled ? "on" : "off"} onValueChange={(value) => setSetting("aiDocumentCopilotEnabled", value === "on")}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="on">On</SelectItem>
                </SelectContent>
              </Select>
              <div className="mt-2 text-xs text-slate-500">Keeps AI completely optional. Existing document workflows keep working without it.</div>
            </div>
            <div className={SETTINGS_CARD_CLASS}>
              <Label>OpenAI API key</Label>
              <Input
                type="password"
                className="mt-1"
                value={appSettings.aiOpenAiApiKey}
                onChange={(e) => setSetting("aiOpenAiApiKey", e.target.value)}
                placeholder="OpenAI API key"
              />
              <div className="mt-2 text-xs text-slate-500">Stored with OS-backed desktop secret storage when available, not plain localStorage.</div>
            </div>
            <div className={SETTINGS_CARD_CLASS}>
              <Label>OpenAI model</Label>
              <Input
                className="mt-1"
                value={appSettings.aiOpenAiModel}
                onChange={(e) => setSetting("aiOpenAiModel", e.target.value)}
                placeholder="gpt-4o-mini"
              />
              <div className="mt-2 text-xs text-slate-500">Default is `gpt-4o-mini`. You can point this at another compatible Responses API model later.</div>
            </div>
            <div className={SETTINGS_CARD_CLASS}>
              <Label>Status</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="secondary">{desktopDocumentAiApi?.analyze ? "Desktop bridge ready" : "Desktop app required"}</Badge>
                <Badge variant="secondary">{appSettings.aiDocumentCopilotEnabled ? "Enabled" : "Disabled"}</Badge>
                <Badge variant="secondary">{appSettings.hasAiOpenAiApiKey || String(appSettings.aiOpenAiApiKey || "").trim() ? "API key saved" : "No API key"}</Badge>
              </div>
              <div className="mt-3 text-xs text-slate-500">V1 keeps AI bounded to document review: summarize, pull out useful facts, and suggest the next workflow step.</div>
            </div>
          </div>
        </SettingsSectionShell>
        </>
        ) : null}

        {settingsTab === "workspace" ? (
        <>
        <SettingsSectionShell
          title="Workspace & navigation"
          description="Set how the app opens, what the sidebar looks like, and which dashboard items stay visible."
          badge={<Badge variant="secondary">Daily use</Badge>}
          collapsed={settingsSectionCollapsed.workspace}
          onToggle={() => setSettingsSectionCollapsed((prev) => ({ ...prev, workspace: !prev.workspace }))}
        >
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className={SETTINGS_CARD_CLASS}>
              <Label>Theme</Label>
              <Select value={appSettings.theme} onValueChange={(value) => setSetting("theme", value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
              <div className="mt-2 text-xs text-slate-500">Switches the full app appearance.</div>
            </div>
            <div className={SETTINGS_CARD_CLASS}>
              <Label>Default landing view</Label>
              <Select value={appSettings.defaultView} onValueChange={(value) => setSetting("defaultView", value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {navItems.map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-2 text-xs text-slate-500">Used when the app opens next time.</div>
            </div>
            <div className={SETTINGS_CARD_CLASS}>
              <Label>{SETTINGS_LABELS.sidebarDefault}</Label>
              <Select value={appSettings.sidebarCollapsedByDefault ? "collapsed" : "expanded"} onValueChange={(value) => setSetting("sidebarCollapsedByDefault", value === "collapsed")}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIDEBAR_DEFAULT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-2 text-xs text-slate-500">Controls initial sidebar width on load.</div>
            </div>
            <div className={SETTINGS_CARD_CLASS}>
              <Label>{SETTINGS_LABELS.defaultLedgerSort}</Label>
              <Select value={appSettings.ledgerDefaultSort || "date_desc"} onValueChange={(value) => setSetting("ledgerDefaultSort", value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEDGER_SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-2 text-xs text-slate-500">Sets the default ledger ordering when the app opens.</div>
            </div>
            <div className={SETTINGS_CARD_CLASS}>
              <Label>{SETTINGS_LABELS.dashboardDensity}</Label>
              <Select value={appSettings.dashboardDensity || "comfortable"} onValueChange={(value) => setSetting("dashboardDensity", value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DASHBOARD_DENSITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-2 text-xs text-slate-500">Limits dashboard preview rows so daily cards stay calm.</div>
            </div>
            <div className={`${SETTINGS_CARD_CLASS} md:col-span-2 xl:col-span-4`}>
              <Label title={SETTINGS_TOOLTIPS.dashboardMetrics}>{SETTINGS_LABELS.dashboardMetrics}</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DASHBOARD_METRIC_OPTIONS.map((option) => (
                  <label key={option.id} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1 text-xs leading-none">
                    <input
                      type="checkbox"
                      checked={appSettings.dashboardCards?.[option.id] ?? true}
                      onChange={(e) => toggleDashboardCardSetting(option.id, e.target.checked)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <div className="mt-2 text-xs text-slate-500">Choose which metric cards appear on the dashboard.</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
                <Button className="h-10 px-4 text-sm font-semibold shadow-none" onClick={() => setView(appSettings.defaultView || "dashboard")}>
              Open default view now
            </Button>
          </div>
        </SettingsSectionShell>

        <SettingsSectionShell
          title="Automation & reminders"
          description="Keep recurring entries, lease charges, reminders, and late fees organized from one place."
          badge={<Badge variant="secondary">Daily use</Badge>}
          collapsed={settingsSectionCollapsed.automation}
          onToggle={() => setSettingsSectionCollapsed((prev) => ({ ...prev, automation: !prev.automation }))}
        >
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className={SETTINGS_CARD_CLASS}>
              <Label title={SETTINGS_TOOLTIPS.autoGenerateRecurringEntries}>{SETTINGS_LABELS.autoGenerateRecurringEntries}</Label>
              <Select value={appSettings.autoMaterializeRecurring ? "on" : "off"} onValueChange={(value) => setSetting("autoMaterializeRecurring", value === "on")}>
                <SelectTrigger className="mt-1 max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">On</SelectItem>
                  <SelectItem value="off">Off</SelectItem>
                </SelectContent>
              </Select>
              <div className="mt-2 text-xs text-slate-500">{AUTO_RECURRING_HELPER_TEXT}</div>
            </div>

            <div className={`${SETTINGS_CARD_CLASS} md:col-span-2 xl:col-span-2`}>
              <Label title={SETTINGS_TOOLTIPS.leaseAutomation}>{SETTINGS_LABELS.leaseAutomation}</Label>
              <Select value={appSettings.leaseAutomationEnabled ? "on" : "off"} onValueChange={(value) => setSetting("leaseAutomationEnabled", value === "on")}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">On</SelectItem>
                  <SelectItem value="off">Off</SelectItem>
                </SelectContent>
              </Select>
              <div className="mt-2 text-xs text-slate-500">{LEASE_AUTOMATION_HELPER_TEXT}</div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div>
                  <Label className="text-xs text-slate-600">Default rent due day (1-28)</Label>
                  <Input className="mt-1" type="number" min="1" max="28" value={appSettings.leaseDefaultRentDueDay} onChange={(e) => setSetting("leaseDefaultRentDueDay", Number(e.target.value || 1))} />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Reminder days before due</Label>
                  <Input className="mt-1" type="number" min="0" max="14" value={appSettings.leaseReminderDaysBefore} onChange={(e) => setSetting("leaseReminderDaysBefore", Number(e.target.value || 0))} />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Auto late fees (default)</Label>
                  <Select value={appSettings.leaseAutoLateFeeEnabled ? "on" : "off"} onValueChange={(value) => setSetting("leaseAutoLateFeeEnabled", value === "on")}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">Off</SelectItem>
                      <SelectItem value="on">On</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Late fee grace days</Label>
                  <Input className="mt-1" type="number" min="0" max="30" value={appSettings.leaseLateFeeGraceDays} onChange={(e) => setSetting("leaseLateFeeGraceDays", Number(e.target.value || 0))} />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Late fee type</Label>
                  <Select value={appSettings.leaseLateFeeType} onValueChange={(value) => setSetting("leaseLateFeeType", value === "percent" ? "percent" : "flat")}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat amount</SelectItem>
                      <SelectItem value="percent">Percent of rent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Late fee value</Label>
                  <Input className="mt-1" type="number" min="0" step="0.01" value={appSettings.leaseLateFeeValue} onChange={(e) => setSetting("leaseLateFeeValue", Number(e.target.value || 0))} />
                </div>
              </div>
              <div className="mt-3">
                <Label className="text-xs text-slate-600">Rent desktop/browser reminders</Label>
                <Select value={appSettings.leaseDesktopNotifications ? "on" : "off"} onValueChange={(value) => setSetting("leaseDesktopNotifications", value === "on")}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on">On</SelectItem>
                    <SelectItem value="off">Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-3">
                <Label className="text-xs text-slate-600">Operations Calendar daily summary</Label>
                <Select value={appSettings.operationsDesktopNotifications ? "on" : "off"} onValueChange={(value) => setSetting("operationsDesktopNotifications", value === "on")}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Off</SelectItem>
                    <SelectItem value="on">On</SelectItem>
                  </SelectContent>
                </Select>
                <div className="mt-2 text-xs text-slate-500">Optional. When the app is running, send one quiet Windows summary per day for due or overdue calendar items outside the existing rent reminders.</div>
              </div>
            </div>
          </div>
        </SettingsSectionShell>

        <SettingsSectionShell
          title="Statement branding"
          description="Optional logo, sender details, recipient defaults, and reusable notes for printed owner and tenant statements."
          badge={<Badge variant="secondary">Statements</Badge>}
          collapsed={settingsSectionCollapsed.branding}
          onToggle={() => setSettingsSectionCollapsed((prev) => ({ ...prev, branding: !prev.branding }))}
        >
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            <div className={SETTINGS_CARD_CLASS}>
              <div className="text-sm font-medium text-slate-900">Brand header</div>
              <div className="mt-1 text-xs text-slate-500">Name and logo shown at the top of printed statements.</div>
              <div className="mt-3 grid gap-3 md:grid-cols-[1.4fr,1fr]">
                <div>
                  <Label>{SETTINGS_LABELS.statementBranding}</Label>
                  <Input
                    className="mt-1"
                    placeholder="North Shore Property Management"
                    value={appSettings.statementBusinessName}
                    onChange={(e) => setSetting("statementBusinessName", e.target.value)}
                  />
                  <div className="mt-2 text-xs text-slate-500">Leave blank to keep the standard Rental Tracker statement header.</div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Label>Logo</Label>
                    {appSettings.statementLogoDataUrl ? <Badge variant="secondary">Ready</Badge> : null}
                  </div>
                  <input
                    ref={statementLogoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    className="hidden"
                    onChange={onStatementLogoInputChange}
                  />
                  {appSettings.statementLogoDataUrl ? (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <img src={appSettings.statementLogoDataUrl} alt="Statement logo preview" className="max-h-16 max-w-[180px] object-contain" />
                    </div>
                  ) : (
                    <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                      Upload a small logo to add it to printed statements.
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => statementLogoInputRef.current?.click()}>
                      Upload logo
                    </Button>
                    {appSettings.statementLogoDataUrl ? (
                      <Button size="sm" variant="ghost" onClick={() => setSetting("statementLogoDataUrl", "")}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className={SETTINGS_CARD_CLASS}>
              <div className="text-sm font-medium text-slate-900">Sender details</div>
              <div className="mt-1 text-xs text-slate-500">Contact and preparer details that appear on owner and tenant statements.</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Business address</Label>
                  <textarea
                    className={TEXTAREA_CLASS.replace("min-h-[96px]", "min-h-[92px]")}
                    placeholder={"123 Main St, Suite 400\nMadison, WI 53703"}
                    value={appSettings.statementBusinessAddress}
                    onChange={(e) => setSetting("statementBusinessAddress", e.target.value)}
                  />
                  <div className="mt-2 text-xs text-slate-500">Use one or two lines if you want a mailing address printed on statements.</div>
                </div>
                <div>
                  <Label>Business email</Label>
                  <Input className="mt-1" placeholder="hello@example.com" value={appSettings.statementBusinessEmail} onChange={(e) => setSetting("statementBusinessEmail", e.target.value)} />
                </div>
                <div>
                  <Label>Business phone</Label>
                  <Input className="mt-1" placeholder="(608) 555-0100" value={appSettings.statementBusinessPhone} onChange={(e) => setSetting("statementBusinessPhone", e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Prepared by</Label>
                  <Input className="mt-1" placeholder="Alicia Conte" value={appSettings.statementPreparedBy} onChange={(e) => setSetting("statementPreparedBy", e.target.value)} />
                  <div className="mt-2 text-xs text-slate-500">Printed in statement cover details as the sender/preparer.</div>
                </div>
              </div>
            </div>

            <div className={SETTINGS_CARD_CLASS}>
              <div className="text-sm font-medium text-slate-900">Owner statement defaults</div>
              <div className="mt-1 text-xs text-slate-500">Used when a specific property does not override the owner contact in Properties.</div>
              <div className="mt-3 space-y-3">
                <div>
                  <Label>Default owner recipient</Label>
                  <Input className="mt-1" placeholder="North Shore Ownership Group" value={appSettings.statementOwnerRecipient} onChange={(e) => setSetting("statementOwnerRecipient", e.target.value)} />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Default owner email</Label>
                    <Input className="mt-1" placeholder="owner@example.com" value={appSettings.statementOwnerEmail} onChange={(e) => setSetting("statementOwnerEmail", e.target.value)} />
                  </div>
                  <div>
                    <Label>Default owner phone</Label>
                    <Input className="mt-1" placeholder="(715) 555-0100" value={appSettings.statementOwnerPhone} onChange={(e) => setSetting("statementOwnerPhone", formatUsPhone(e.target.value))} />
                  </div>
                </div>
                <div>
                  <Label>Default owner note</Label>
                  <textarea
                    className={TEXTAREA_CLASS}
                    placeholder="Add an optional note for owners, such as context on repairs, CapEx, or follow-up items."
                    value={appSettings.statementOwnerNote}
                    onChange={(e) => setSetting("statementOwnerNote", e.target.value)}
                  />
                  <div className="mt-2 text-xs text-slate-500">Included only when it has content.</div>
                </div>
              </div>
            </div>

            <div className={SETTINGS_CARD_CLASS}>
              <div className="text-sm font-medium text-slate-900">Tenant statement defaults</div>
              <div className="mt-1 text-xs text-slate-500">Default reminder or payment language for tenant-facing statements.</div>
              <div className="mt-3">
                <Label>Default tenant note</Label>
                <textarea
                  className={TEXTAREA_CLASS}
                  placeholder="Add payment instructions or reminder language for tenant statements."
                  value={appSettings.statementTenantNote}
                  onChange={(e) => setSetting("statementTenantNote", e.target.value)}
                />
                <div className="mt-2 text-xs text-slate-500">Included on tenant statements when it has content.</div>
              </div>
            </div>
          </div>
        </SettingsSectionShell>

        <SettingsSectionShell
          title="Accounting & safeguards"
          description="Tax treatment defaults and app safety prompts that affect how entries are reviewed and saved."
          badge={<Badge variant="secondary">Daily use</Badge>}
          collapsed={settingsSectionCollapsed.accounting}
          onToggle={() => setSettingsSectionCollapsed((prev) => ({ ...prev, accounting: !prev.accounting }))}
        >
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className={`${SETTINGS_CARD_CLASS} md:col-span-2 xl:col-span-2`}>
              <Label>De minimis safe harbor</Label>
              <Select value={appSettings.deMinimisElectionEnabled ? "on" : "off"} onValueChange={(value) => setSetting("deMinimisElectionEnabled", value === "on")}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">Election on</SelectItem>
                  <SelectItem value="off">Election off</SelectItem>
                </SelectContent>
              </Select>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label className="text-xs text-slate-600">Applicable financial statement (AFS)</Label>
                  <Select value={appSettings.deMinimisHasAFS ? "yes" : "no"} onValueChange={(value) => setSetting("deMinimisHasAFS", value === "yes")}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No (threshold $2,500)</SelectItem>
                      <SelectItem value="yes">Yes (threshold $5,000)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-slate-600">Election statement prepared</Label>
                  <Select value={appSettings.deMinimisStatementPrepared ? "yes" : "no"} onValueChange={(value) => setSetting("deMinimisStatementPrepared", value === "yes")}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">Current threshold: {currency(deMinimisThreshold)} per invoice/item.</div>
            </div>
            <div className={SETTINGS_CARD_CLASS}>
              <Label>Delete confirmations</Label>
              <Select value={appSettings.confirmDestructiveActions ? "on" : "off"} onValueChange={(value) => setSetting("confirmDestructiveActions", value === "on")}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">On</SelectItem>
                  <SelectItem value="off">Off</SelectItem>
                </SelectContent>
              </Select>
              <div className="mt-2 text-xs text-slate-500">Show confirmation prompts before deleting transactions and related records.</div>
            </div>
          </div>
        </SettingsSectionShell>
        </>
        ) : null}

        {settingsTab === "admin_tools" ? (
        <SettingsSectionShell
          title="Desktop updates"
          description="Update checks, release notes, and desktop self-checks for the installed app."
          badge={<Badge variant="secondary">Desktop</Badge>}
          collapsed={settingsSectionCollapsed.desktop}
          onToggle={() => setSettingsSectionCollapsed((prev) => ({ ...prev, desktop: !prev.desktop }))}
        >
          <div className="mt-4 grid gap-3 xl:grid-cols-4">
            <div className={`${SETTINGS_CARD_CLASS} xl:col-span-4`}>
              <div className="flex items-center justify-between gap-2">
                <Label>App updates</Label>
                <Badge variant="secondary" className={`rounded-full border ${desktopUpdateBadgeClass(desktopUpdateStatusKey)}`}>
                  {desktopUpdateStatusLabel}
                </Badge>
              </div>
              <div className="mt-2 text-xs text-slate-500">{desktopUpdateMessage}</div>
              <div className="mt-1 text-xs text-slate-500">Current version: {currentAppVersion || "Unknown"}</div>
              {updateTargetVersion && <div className="mt-1 text-xs text-slate-500">Available version: {updateTargetVersion}</div>}
              {desktopUpdateStatusKey === "downloading" && <div className="mt-1 text-xs text-slate-500">Download progress: {Math.round(desktopUpdateProgress)}%</div>}
              {desktopUpdateCheckedAtLabel && <div className="mt-1 text-xs text-slate-500">Last check: {desktopUpdateCheckedAtLabel}</div>}
              {desktopUpdateReleaseDateLabel && <div className="mt-1 text-xs text-slate-500">Release date: {desktopUpdateReleaseDateLabel}</div>}
              {desktopUpdateState.releaseName && <div className="mt-1 text-xs text-slate-500">Release: {desktopUpdateState.releaseName}</div>}
              {currentReleaseNotesEntry && (
                <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                  <div className="text-xs font-medium text-slate-700">Latest installed notes</div>
                  <div className="mt-1 text-sm text-slate-800">{currentReleaseNotesEntry.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{currentReleaseNotesEntry.summary}</div>
                </div>
              )}
              {updateTargetVersion && (effectiveUpdateReleaseNotes.length > 0 || desktopUpdateState.releaseName) && (
                <div className="mt-2 rounded-md border border-blue-200 bg-blue-50/70 p-2">
                  <div className="text-xs font-medium text-blue-800">Update notes ready</div>
                  <div className="mt-1 text-sm text-slate-800">{desktopUpdateState.releaseName || `Version ${updateTargetVersion}`}</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {effectiveUpdateReleaseNotes[0] || "Open the update notes to review everything included in this release."}
                  </div>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="secondary" className="h-9" onClick={checkForDesktopUpdates} disabled={!desktopUpdaterAvailable || desktopUpdateBusy || desktopUpdateStatusKey === "checking"}>
                  {desktopUpdateBusy || desktopUpdateStatusKey === "checking" ? "Checking..." : "Check for updates"}
                </Button>
                {desktopUpdateCanRestart && (
                  <Button className="h-9" onClick={installDesktopUpdateNow}>
                    Restart to update
                  </Button>
                )}
                {currentReleaseNotesEntry && (
                  <Button variant="secondary" className="h-9" onClick={openCurrentReleaseNotesDialog}>
                    What changed
                  </Button>
                )}
                {updateTargetVersion && (effectiveUpdateReleaseNotes.length > 0 || desktopUpdateState.releaseNotesUrl || updateReleaseNotesEntry) && (
                  <Button variant="secondary" className="h-9" onClick={openUpdateReleaseNotesDialog}>
                    View update notes
                  </Button>
                )}
              </div>
              {desktopUpdateState.releaseNotesUrl && (
                <a href={desktopUpdateState.releaseNotesUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-medium text-blue-700 hover:underline">
                  Open GitHub release page
                </a>
              )}
              {currentReleaseHistory.length > 0 && (
                <div className="mt-2 text-xs text-slate-500">In-app notes included for: {currentReleaseHistory.map((entry) => entry.version).join(", ")}</div>
              )}
              {!desktopUpdaterAvailable && <div className="mt-2 text-xs text-slate-500">Open the installed desktop app to use update checks.</div>}
            </div>

            <div className={`${SETTINGS_CARD_CLASS} xl:col-span-3`}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-slate-900">Desktop diagnostics</div>
                <Badge variant="secondary" className={`rounded-full border ${desktopDiagnosticPillClass(Boolean(desktopDiagnosticsReport?.ok !== false && desktopDiagnosticsApi?.run))}`}>
                  {desktopDiagnosticsApi?.run ? "Ready" : "Browser mode"}
                </Badge>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Run a desktop self-check for updater wiring, OCR support, PDF export, and recent desktop health events.
              </div>
              {desktopDiagnosticsReport?.error && (
                <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
                  {desktopDiagnosticsReport.error}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" className="h-9" onClick={() => void runDesktopDiagnostics(true)} disabled={!desktopDiagnosticsApi?.run || desktopDiagnosticsBusy}>
                  {desktopDiagnosticsBusy ? "Running..." : "Run desktop self-check"}
                </Button>
              </div>
              {desktopDiagnosticsCheckedAtLabel && <div className="mt-2 text-xs text-slate-500">Last self-check: {desktopDiagnosticsCheckedAtLabel}</div>}
              {desktopDiagnosticsReport && (
                <div className="mt-3 space-y-2">
                  <div className="grid gap-2 text-xs md:grid-cols-2">
                    <div className={`rounded-md border px-2 py-1.5 ${desktopDiagnosticPillClass(Boolean(desktopDiagnosticsReport.packaged))}`}>
                      Packaged app: {desktopDiagnosticsReport.packaged ? "Yes" : "No"}
                    </div>
                    <div className={`rounded-md border px-2 py-1.5 ${desktopDiagnosticPillClass(Boolean(desktopDiagnosticsReport.updaterConfigured))}`}>
                      Updater config: {desktopDiagnosticsReport.updaterConfigured ? "Ready" : "Missing"}
                    </div>
                    <div className={`rounded-md border px-2 py-1.5 ${desktopDiagnosticPillClass(Boolean(desktopDiagnosticsReport.notificationsSupported))}`}>
                      Notifications: {desktopDiagnosticsReport.notificationsSupported ? "Supported" : "Unavailable"}
                    </div>
                    <div className={`rounded-md border px-2 py-1.5 ${desktopDiagnosticPillClass(Boolean(desktopDiagnosticsReport.ocrSupported))}`}>
                      OCR engine: {desktopDiagnosticsReport.ocrSupported ? "Available" : "Unsupported on this platform"}
                    </div>
                    <div className={`rounded-md border px-2 py-1.5 ${desktopDiagnosticPillClass(Boolean(desktopDiagnosticsReport.pdfExportSupported))}`}>
                      PDF export: {desktopDiagnosticsReport.pdfExportSupported ? "Ready" : "Unavailable"}
                    </div>
                    <div className={`rounded-md border px-2 py-1.5 ${desktopDiagnosticPillClass(Boolean(desktopDiagnosticsReport.persistenceAvailable))}`}>
                      SQLite storage: {desktopDiagnosticsReport.persistenceAvailable ? "Ready" : "Unavailable"}
                    </div>
                    <div className={`rounded-md border px-2 py-1.5 ${desktopDiagnosticPillClass(Boolean(desktopDiagnosticsReport.secretStorageEncryptionAvailable))}`}>
                      Secret storage: {desktopDiagnosticsReport.secretStorageEncryptionAvailable ? "Encrypted" : "Unavailable"}
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-700">
                      Runtime: Node {desktopDiagnosticsReport.nodeVersion || "?"} | Electron {desktopDiagnosticsReport.electronVersion || "?"}
                    </div>
                  </div>
                  {(desktopDiagnosticsReport.updaterConfigSource || desktopDiagnosticsReport.updaterConfigPath) && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                      Updater check source: {desktopDiagnosticsReport.updaterConfigSource || "unknown"}
                      {desktopDiagnosticsReport.updaterConfigPath ? ` | Config path: ${desktopDiagnosticsReport.updaterConfigPath}` : ""}
                    </div>
                  )}
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                    App version: {desktopDiagnosticsReport.appVersion || "Unknown"}
                    {desktopDiagnosticsReport.userDataPath ? ` | Data path: ${desktopDiagnosticsReport.userDataPath}` : ""}
                    {desktopDiagnosticsReport.databasePath ? ` | Database: ${desktopDiagnosticsReport.databasePath}` : ""}
                  </div>
                  {desktopDiagnosticsReport.persistenceAvailable && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                      Schema v{desktopDiagnosticsReport.databaseSchemaVersion || "?"}
                      {desktopDiagnosticsReport.databaseSizeBytes !== undefined ? ` | DB size: ${desktopDiagnosticsReport.databaseSizeBytes} bytes` : ""}
                      {desktopDiagnosticsReport.backupCount !== undefined ? ` | Backups: ${desktopDiagnosticsReport.backupCount}` : ""}
                      {desktopDiagnosticsReport.documentStorageFileCount !== undefined ? ` | Document files: ${desktopDiagnosticsReport.documentStorageFileCount}` : ""}
                    </div>
                  )}
                  {(performanceMetrics?.initialDataLoadMs != null || performanceMetrics?.deferredActivityLoadMs != null) && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                      Initial data load: {performanceMetrics.initialDataLoadMs ?? "…"} ms
                      {performanceMetrics.deferredActivityLoadMs != null ? ` | Background activity history: ${performanceMetrics.deferredActivityLoadMs} ms` : " | Activity history loading in background"}
                      {performanceMetrics.workspaceSwitchMs != null ? ` | Last workspace switch: ${performanceMetrics.workspaceSwitchMs} ms` : ""}
                      {performanceMetrics.documentFileReadMs != null ? ` | Last document file read: ${performanceMetrics.documentFileReadMs} ms` : ""}
                      {performanceMetrics.documentAnalysisMs != null ? ` | Last document analysis: ${performanceMetrics.documentAnalysisMs} ms` : ""}
                    </div>
                  )}
                  {desktopDiagnosticsRecentEvents.length > 0 ? (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-slate-700">Recent desktop events</div>
                      {desktopDiagnosticsRecentEvents.slice(0, 4).map((event, index) => (
                        <div key={`desktop-event-${index}`} className={`rounded-md border px-2 py-1.5 text-xs ${desktopDiagnosticEventClass(event.level)}`}>
                          <div className="font-medium">{event.message}</div>
                          <div className="mt-0.5">{formatDesktopUpdateDate(event.at) || event.at}</div>
                          {event.detail ? <div className="mt-1 whitespace-pre-wrap">{event.detail}</div> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">No recent desktop errors or warnings recorded.</div>
                  )}
                </div>
              )}
              {!desktopDiagnosticsApi?.run && <div className="mt-2 text-xs text-slate-500">Open the installed desktop app to run this self-check.</div>}
            </div>

            <div className={`${SETTINGS_CARD_CLASS} xl:col-span-1`}>
              <div className="text-sm font-medium text-slate-900">App reset</div>
              <div className="mt-2 text-xs text-slate-500">Rarely used global action for clearing custom settings back to the defaults.</div>
              <div className="mt-3 flex flex-col gap-2">
                <Button className="h-10 px-4 text-sm font-semibold shadow-none" onClick={() => resetToDefaults()} disabled={!canManageAccessProfile}>
                  Reset all settings to defaults
                </Button>
              </div>
            </div>
          </div>
        </SettingsSectionShell>
        ) : null}

        {settingsTab === "data" ? (
        <SettingsSectionShell
          title="Data & backup"
          description="Export, import, and create restore points so data changes feel safer."
          badge={<Badge variant="secondary">Admin tools</Badge>}
          collapsed={settingsSectionCollapsed.backup}
          onToggle={() => setSettingsSectionCollapsed((prev) => ({ ...prev, backup: !prev.backup }))}
        >
          <div className="mt-3 space-y-3">
            <input ref={backupImportInputRef} type="file" accept="application/json,application/zip,.json,.zip" className="hidden" onChange={onBackupImportInputChange} />

            <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
              <div className={`${SETTINGS_CARD_CLASS} bg-white`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Archive className="h-4 w-4 text-teal-700" aria-hidden="true" />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Restore point</div>
                      <div className="mt-0.5 text-xs text-slate-500">Last backup {lastBackupLabel}; validation {lastValidationLabel}.</div>
                    </div>
                  </div>
                  <Badge variant="secondary" className={backupCheckpointClass.includes("emerald") ? "!bg-emerald-100 !text-emerald-700" : "!bg-amber-100 !text-amber-800"}>
                    {backupCheckpointClass.includes("emerald") ? "Ready" : "Needs backup"}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">
                    <div className="font-medium text-slate-900">1. Save point</div>
                    <div className="mt-0.5">{lastBackupLabel}</div>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">
                    <div className="font-medium text-slate-900">2. Validate</div>
                    <div className="mt-0.5">{lastValidationLabel}</div>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">
                    <div className="font-medium text-slate-900">3. Folder</div>
                    <div className="mt-0.5">{persistenceHealth?.persistenceAvailable ? "Desktop data anchored" : "Open desktop app"}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={createAutoBackupNow} disabled={!canManageDataAdmin || restorePointBusy}>
                    <Archive className="mr-2 h-4 w-4" />
                    {restorePointBusy ? "Creating..." : "Create restore point"}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={validateLatestBackup} disabled={!canManageDataAdmin || !persistenceHealth?.persistenceAvailable || backupValidationBusy}>
                    {backupValidationBusy ? "Validating..." : "Validate backup"}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={openDesktopDataFolder} disabled={!canManageDataAdmin || !persistenceHealth?.persistenceAvailable}>
                    Open data folder
                  </Button>
                </div>
                {persistenceLastError ? (
                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    Persistence warning: {persistenceLastError}
                  </div>
                ) : null}
                {(backupValidationResult?.warnings || []).length > 0 ? (
                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{backupValidationResult.warnings.slice(0, 3).join(" ")}</div>
                ) : null}
                {(backupValidationResult?.errors || []).length > 0 ? (
                  <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-900">{backupValidationResult.errors.slice(0, 3).join(" ")}</div>
                ) : null}
              </div>

              <div className={`${SETTINGS_CARD_CLASS} bg-white`}>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-700" aria-hidden="true" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Backup files</div>
                    <div className="mt-0.5 text-xs text-slate-500">Zip backups include document files; JSON remains importable.</div>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Button variant="secondary" className="justify-start" onClick={exportDataBackup} disabled={!canManageDataAdmin}>
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Export backup
                  </Button>
                  <Button variant="secondary" className="justify-start" onClick={openBackupImportPicker} disabled={!canManageDataAdmin}>
                    <FileText className="mr-2 h-4 w-4" />
                    Import backup
                  </Button>
                  <Button variant="secondary" className="justify-start" onClick={exportLatestAutoBackup} disabled={!canManageDataAdmin}>
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Export latest restore point
                  </Button>
                </div>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-600">Backups: {persistenceHealth?.backupCount ?? 0}</div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-600">Latest size: {Number(persistenceHealth?.mostRecentBackupSizeBytes || backupValidationResult?.mostRecentBackupSizeBytes || 0)} bytes</div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-600">Last auto: {autoBackupStatusLabel}</div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-600">Validated: {formatDesktopUpdateDate(backupValidationResult?.checkedAt || persistenceHealth?.lastBackupValidationAt || "") || "Not yet"}</div>
                </div>
                <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-2 text-xs text-blue-900">
                  Desktop keeps the newest 8 managed restore-point files. Automatic restore points are throttled to about weekly; manual restore points are created when you click Create restore point.
                </div>
              </div>
            </div>

            <div className={`${SETTINGS_CARD_CLASS} bg-white`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Database className="h-4 w-4 text-slate-700" aria-hidden="true" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Storage health</div>
                    <div className="mt-0.5 text-xs text-slate-500">Desktop persistence, documents, and record counts.</div>
                  </div>
                </div>
                <Badge variant="secondary" className={persistenceHealth?.persistenceAvailable ? "!bg-teal-100 !text-teal-800" : "!bg-amber-100 !text-amber-800"}>
                  {persistenceHealth?.persistenceAvailable ? "Data anchored" : "Browser/local fallback"}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 text-xs md:grid-cols-2 xl:grid-cols-5">
                <div className={`rounded-md border px-2 py-1.5 ${desktopDiagnosticPillClass(Boolean(persistenceHealth?.persistenceAvailable))}`}>
                  Storage: {persistenceHealth?.persistenceAvailable ? "SQLite" : "Local fallback"}
                </div>
                <div className={`rounded-md border px-2 py-1.5 ${persistenceLastError ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                  Save: {saveStatusLabel}
                </div>
                <div className={`rounded-md border px-2 py-1.5 ${persistenceHealth?.databaseIntegrityOk === false ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-100 bg-emerald-50 text-emerald-800"}`}>
                  Integrity: {persistenceHealth?.databaseIntegrityOk === false ? "Needs attention" : persistenceHealth?.persistenceAvailable ? "ok" : "Unavailable"}
                </div>
                <div className={`rounded-md border px-2 py-1.5 ${Number(persistenceHealth?.missingDocumentFileCount || 0) > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-100 bg-emerald-50 text-emerald-800"}`}>
                  Documents: {documentHealthSummary || `${Number(currentDataStatus?.documentFileCount || 0)} files`}
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-600">
                  Last saved: {formatDesktopUpdateDate(persistenceHealth?.lastSaveAt || "") || "Not yet"}
                </div>
              </div>
              {persistenceRecordCountSummary ? (
                <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 p-2 text-xs text-blue-900">
                  SQLite records: {persistenceRecordCountSummary}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setShowStoragePaths((prev) => !prev)}>
                  {showStoragePaths ? "Hide folder paths" : "Show folder paths"}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShowRecoveryTools((prev) => !prev)}>
                  {showRecoveryTools ? "Hide recovery tools" : "Show recovery tools"}
                </Button>
              </div>
              {showStoragePaths ? (
                persistenceHealth?.databasePath || persistenceHealth?.documentStoragePath || persistenceHealth?.backupPath ? (
                  <div className="mt-2 grid gap-2 text-xs xl:grid-cols-3">
                    {persistenceHealth?.databasePath ? <div className="break-all rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-600">Database: {persistenceHealth.databasePath}</div> : null}
                    {persistenceHealth?.documentStoragePath ? <div className="break-all rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-600">Documents: {persistenceHealth.documentStoragePath}</div> : null}
                    {persistenceHealth?.backupPath ? <div className="break-all rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-600">Backups: {persistenceHealth.backupPath}</div> : null}
                  </div>
                ) : (
                  <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                    Open the installed desktop app to see exact database, document, and backup folders.
                  </div>
                )
              ) : null}
              {showRecoveryTools ? (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <div className="text-xs font-semibold text-amber-900">Recovery tools</div>
                  <div className="mt-1 text-xs text-amber-900">
                    Use these only when the visible app state looks out of sync with the local desktop database.
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={reloadDesktopPersistenceData} disabled={!canManageDataAdmin || !persistenceHealth?.persistenceAvailable}>
                      <Database className="mr-2 h-4 w-4" />
                      Reload from SQLite
                    </Button>
                    <Button size="sm" variant="secondary" onClick={openDesktopDataFolder} disabled={!canManageDataAdmin || !persistenceHealth?.persistenceAvailable}>
                      Open data folder
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 xl:grid-cols-[1fr_0.8fr]">
              <div className={`${SETTINGS_CARD_CLASS} bg-white`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Real data readiness</div>
                    <div className="mt-0.5 text-xs text-slate-500">Current data status and first-record checks.</div>
                  </div>
                  <Badge variant="secondary" className={realDataBlockingCount > 0 ? "!bg-amber-100 !text-amber-800" : "!bg-emerald-100 !text-emerald-700"}>
                    {realDataChecklist?.label || currentDataStatus?.label || "Not checked"}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-600">Records: {Number(currentDataStatus?.counts?.total || 0)}</div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-600">Mode: {currentDataStatus?.label || "Unknown"}</div>
                  <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(appSettings.realDataModeEnabled)}
                      onChange={(event) => setSetting("realDataModeEnabled", event.target.checked)}
                    />
                    <span>Real Data Mode</span>
                  </label>
                </div>
                {showRealDataChecklist ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {(realDataChecklist?.items || []).map((item) => (
                      <div key={item.key} className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900">{item.label}</div>
                          <div className="mt-0.5 text-slate-500">{item.helperText}</div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-1">
                          <Badge variant="secondary" className={item.status === "complete" ? "!bg-emerald-100 !text-emerald-700" : item.status === "optional" ? "" : "!bg-amber-100 !text-amber-800"}>
                            {item.status === "complete" ? "Complete" : item.status === "needs_review" ? "Needs review" : item.status === "needs_setup" ? "Needs setup" : "Optional"}
                          </Badge>
                          {item.targetView ? (
                            <Button size="sm" variant="ghost" onClick={() => setView(item.targetView)}>
                              Open
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600">
                    Checklist hidden to keep backup tools compact. Open it when you are moving from sample data to real records.
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setSetting("realDataModeEnabled", true)}>
                    Start real data setup
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setShowRealDataChecklist((prev) => !prev)}>
                    {showRealDataChecklist ? "Hide checklist" : "Show checklist"}
                  </Button>
                </div>
              </div>

              <div className={`${SETTINGS_CARD_CLASS} border-amber-200 bg-amber-50/70`}>
                <div className="flex items-center gap-2">
                  <Archive className="h-4 w-4 text-amber-700" aria-hidden="true" />
                  <div className="text-sm font-semibold text-slate-900">Sample data reset</div>
                </div>
                <div className="mt-2 rounded-md border border-amber-200 bg-white/80 p-2 text-xs text-amber-900">
                  Loading Sample Duplex replaces current local app records. Create and validate a restore point first when this app contains real work.
                </div>
                <Button variant="secondary" className="mt-3 w-full justify-start" onClick={loadDemoData} disabled={!canManageDataAdmin}>
                  <Archive className="mr-2 h-4 w-4" />
                  Load Sample Duplex Dataset
                </Button>
              </div>
            </div>
          </div>
        </SettingsSectionShell>
        ) : null}
      </CardContent>
    </Card>
  );
}
