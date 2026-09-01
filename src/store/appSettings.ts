import { useEffect, useMemo, useRef, useState } from "react";

export const APP_SETTINGS_STORAGE_KEY = "rental-tracker:settings:v1";
export const AUTO_RECURRING_HELPER_TEXT = "Automatically create recurring transactions when dates or filters change.";
export const LEASE_AUTOMATION_HELPER_TEXT = "Auto-create rent charges, optional late fees, and due reminders.";
export const SETTINGS_SAVED_TEXT = "Settings saved.";

export const SETTINGS_LABELS = {
  defaultLedgerSort: "Default ledger sort",
  sidebarDefault: "Sidebar default",
  dashboardDensity: "Dashboard density",
  dashboardMetrics: "Dashboard metrics",
  autoGenerateRecurringEntries: "Auto-generate recurring entries",
  leaseAutomation: "Lease automation",
  statementBranding: "Statement branding",
  accessProfile: "Access profile",
  aiDocumentCopilot: "AI document copilot",
} as const;

export const SETTINGS_TOOLTIPS = {
  dashboardMetrics: "Select which dashboard metric cards are visible.",
  autoGenerateRecurringEntries: AUTO_RECURRING_HELPER_TEXT,
  leaseAutomation: LEASE_AUTOMATION_HELPER_TEXT,
} as const;

export const DASHBOARD_METRIC_OPTIONS = [
  { id: "grossRent", label: "Gross Rent YTD" },
  { id: "deductibleExpenses", label: "Deductible Expenses" },
  { id: "mortgageInterest", label: "Mortgage Interest" },
  { id: "mortgagePaid", label: "Mortgage Paid" },
  { id: "depreciation", label: "Depreciation" },
  { id: "scheduleE", label: "Estimated Schedule E" },
] as const;

export const LEDGER_SORT_OPTIONS = [
  { value: "date_desc", label: "Date desc" },
  { value: "date_asc", label: "Date asc" },
] as const;

export const SIDEBAR_DEFAULT_OPTIONS = [
  { value: "expanded", label: "Expanded (wide)" },
  { value: "collapsed", label: "Collapsed (icons only)" },
] as const;

export const DASHBOARD_DENSITY_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "detailed", label: "Detailed" },
] as const;

export const ACCESS_ROLE_OPTIONS = [
  { value: "admin", label: "Admin", description: "Full access to settings, imports, deletes, and restore actions." },
  { value: "manager", label: "Manager", description: "Can run operations and exports, but not destructive data/admin controls." },
  { value: "bookkeeper", label: "Bookkeeper", description: "Can handle day-to-day accounting workflows without admin-level controls." },
  { value: "read_only", label: "Read only", description: "View and export only. No create, edit, import, or delete actions." },
] as const;

export type DashboardCardId = (typeof DASHBOARD_METRIC_OPTIONS)[number]["id"];
export type DashboardDensity = (typeof DASHBOARD_DENSITY_OPTIONS)[number]["value"];
export type LedgerSortValue = (typeof LEDGER_SORT_OPTIONS)[number]["value"];
export type AccessRole = (typeof ACCESS_ROLE_OPTIONS)[number]["value"];

export type MonthlyCloseRecord = {
  closedAt: string;
  signature: string;
  issueCount: number;
};

export type AppSettings = {
  theme: "light" | "dark";
  defaultView: string;
  sidebarCollapsedByDefault: boolean;
  confirmDestructiveActions: boolean;
  autoMaterializeRecurring: boolean;
  deMinimisElectionEnabled: boolean;
  deMinimisHasAFS: boolean;
  deMinimisStatementPrepared: boolean;
  ledgerDefaultSort: LedgerSortValue;
  dashboardDensity: DashboardDensity;
  dashboardCards: Record<DashboardCardId, boolean>;
  leaseAutomationEnabled: boolean;
  leaseDefaultRentDueDay: number;
  leaseReminderDaysBefore: number;
  leaseAutoLateFeeEnabled: boolean;
  leaseLateFeeGraceDays: number;
  leaseLateFeeType: "flat" | "percent";
  leaseLateFeeValue: number;
  leaseDesktopNotifications: boolean;
  operationsDesktopNotifications: boolean;
  statementBusinessName: string;
  statementBusinessAddress: string;
  statementBusinessEmail: string;
  statementBusinessPhone: string;
  statementLogoDataUrl: string;
  statementPreparedBy: string;
  statementOwnerRecipient: string;
  statementOwnerEmail: string;
  statementOwnerPhone: string;
  statementOwnerNote: string;
  statementTenantNote: string;
  accessRole: AccessRole;
  operatorName: string;
  aiDocumentCopilotEnabled: boolean;
  mobileCompanionEnabled: boolean;
  aiOpenAiApiKey: string;
  hasAiOpenAiApiKey: boolean;
  aiOpenAiModel: string;
  setupChecklistShowCompleted: boolean;
  setupChecklistShowDismissed: boolean;
  setupChecklistOverrides: Record<string, { status?: "not_applicable" | "dismissed"; note?: string; updatedAt?: string }>;
  recurringExpenseCheckAcknowledgements: Record<string, string>;
  monthlyCloseRecords: Record<string, MonthlyCloseRecord>;
  realDataModeEnabled: boolean;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: "light",
  defaultView: "dashboard",
  sidebarCollapsedByDefault: false,
  confirmDestructiveActions: true,
  autoMaterializeRecurring: true,
  deMinimisElectionEnabled: false,
  deMinimisHasAFS: false,
  deMinimisStatementPrepared: false,
  ledgerDefaultSort: "date_desc",
  dashboardDensity: "comfortable",
  dashboardCards: {
    grossRent: true,
    deductibleExpenses: true,
    mortgageInterest: true,
    mortgagePaid: true,
    depreciation: true,
    scheduleE: true,
  },
  leaseAutomationEnabled: true,
  leaseDefaultRentDueDay: 1,
  leaseReminderDaysBefore: 3,
  leaseAutoLateFeeEnabled: false,
  leaseLateFeeGraceDays: 5,
  leaseLateFeeType: "flat",
  leaseLateFeeValue: 50,
  leaseDesktopNotifications: true,
  operationsDesktopNotifications: false,
  statementBusinessName: "",
  statementBusinessAddress: "",
  statementBusinessEmail: "",
  statementBusinessPhone: "",
  statementLogoDataUrl: "",
  statementPreparedBy: "",
  statementOwnerRecipient: "",
  statementOwnerEmail: "",
  statementOwnerPhone: "",
  statementOwnerNote: "",
  statementTenantNote: "",
  accessRole: "admin",
  operatorName: "Local admin",
  aiDocumentCopilotEnabled: false,
  mobileCompanionEnabled: false,
  aiOpenAiApiKey: "",
  hasAiOpenAiApiKey: false,
  aiOpenAiModel: "gpt-4o-mini",
  setupChecklistShowCompleted: false,
  setupChecklistShowDismissed: false,
  setupChecklistOverrides: {},
  recurringExpenseCheckAcknowledgements: {},
  monthlyCloseRecords: {},
  realDataModeEnabled: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function sanitizeShortText(value: unknown, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

function sanitizeLongText(value: unknown, maxLength = 1200) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, maxLength);
}

function sanitizeLogoDataUrl(value: unknown, maxLength = 500_000) {
  const asText = String(value || "").trim();
  if (!asText) return "";
  if (!/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(asText)) return "";
  return asText.slice(0, maxLength);
}

function sanitizeSetupChecklistOverrides(value: unknown): AppSettings["setupChecklistOverrides"] {
  if (!isRecord(value)) return {};
  const overrides: AppSettings["setupChecklistOverrides"] = {};
  for (const [key, rawOverride] of Object.entries(value)) {
    if (!isRecord(rawOverride)) continue;
    const status = rawOverride.status === "not_applicable" || rawOverride.status === "dismissed" ? rawOverride.status : undefined;
    if (!status) continue;
    overrides[sanitizeShortText(key, 80)] = {
      status,
      note: sanitizeLongText(rawOverride.note, 300),
      updatedAt: sanitizeShortText(rawOverride.updatedAt, 40),
    };
  }
  return overrides;
}

function sanitizeRecurringExpenseCheckAcknowledgements(value: unknown): AppSettings["recurringExpenseCheckAcknowledgements"] {
  if (!isRecord(value)) return {};
  const acknowledgements: AppSettings["recurringExpenseCheckAcknowledgements"] = {};
  for (const [key, rawDate] of Object.entries(value).slice(0, 250)) {
    const date = sanitizeShortText(rawDate, 10);
    if (!/^repeat-[0-9a-f]{8}$/.test(key) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    acknowledgements[key] = date;
  }
  return acknowledgements;
}

function sanitizeMonthlyCloseRecords(value: unknown): AppSettings["monthlyCloseRecords"] {
  if (!isRecord(value)) return {};
  const records: AppSettings["monthlyCloseRecords"] = {};
  for (const [rawKey, rawRecord] of Object.entries(value).slice(0, 240)) {
    if (!isRecord(rawRecord)) continue;
    const key = sanitizeShortText(rawKey, 160);
    const closedAt = sanitizeShortText(rawRecord.closedAt, 40);
    const signature = sanitizeShortText(rawRecord.signature, 24);
    if (!/^\d{4}-(0[1-9]|1[0-2])::[A-Za-z0-9._:-]{1,140}$/.test(key)) continue;
    if (!/^\d{4}-\d{2}-\d{2}T/.test(closedAt) || !/^close-[0-9a-f]{8}$/.test(signature)) continue;
    records[key] = {
      closedAt,
      signature,
      issueCount: clampInt(rawRecord.issueCount, 0, 100000, 0),
    };
  }
  return records;
}

export function sanitizeAppSettings(raw: unknown): AppSettings {
  if (!isRecord(raw)) return DEFAULT_APP_SETTINGS;
  const dashboardCardsRaw = isRecord(raw.dashboardCards) ? raw.dashboardCards : {};
  const aiOpenAiApiKey = sanitizeShortText(raw.aiOpenAiApiKey, 240);
  const hasSavedSettings = Object.keys(raw).length > 0;
  return {
    theme: raw.theme === "dark" ? "dark" : "light",
    defaultView: typeof raw.defaultView === "string" && raw.defaultView ? raw.defaultView : DEFAULT_APP_SETTINGS.defaultView,
    sidebarCollapsedByDefault: Boolean(raw.sidebarCollapsedByDefault),
    confirmDestructiveActions: raw.confirmDestructiveActions !== false,
    autoMaterializeRecurring: raw.autoMaterializeRecurring !== false,
    deMinimisElectionEnabled: raw.deMinimisElectionEnabled === true,
    deMinimisHasAFS: raw.deMinimisHasAFS === true,
    deMinimisStatementPrepared: raw.deMinimisStatementPrepared === true,
    ledgerDefaultSort: raw.ledgerDefaultSort === "date_asc" ? "date_asc" : "date_desc",
    dashboardDensity:
      raw.dashboardDensity === "compact" || raw.dashboardDensity === "detailed"
        ? raw.dashboardDensity
        : "comfortable",
    dashboardCards: {
      grossRent: dashboardCardsRaw.grossRent !== false,
      deductibleExpenses: dashboardCardsRaw.deductibleExpenses !== false,
      mortgageInterest: dashboardCardsRaw.mortgageInterest !== false,
      mortgagePaid: dashboardCardsRaw.mortgagePaid !== false,
      depreciation: dashboardCardsRaw.depreciation !== false,
      scheduleE: dashboardCardsRaw.scheduleE !== false,
    },
    leaseAutomationEnabled: raw.leaseAutomationEnabled !== false,
    leaseDefaultRentDueDay: clampInt(raw.leaseDefaultRentDueDay, 1, 28, DEFAULT_APP_SETTINGS.leaseDefaultRentDueDay),
    leaseReminderDaysBefore: clampInt(raw.leaseReminderDaysBefore, 0, 14, DEFAULT_APP_SETTINGS.leaseReminderDaysBefore),
    leaseAutoLateFeeEnabled: raw.leaseAutoLateFeeEnabled === true,
    leaseLateFeeGraceDays: clampInt(raw.leaseLateFeeGraceDays, 0, 30, DEFAULT_APP_SETTINGS.leaseLateFeeGraceDays),
    leaseLateFeeType: raw.leaseLateFeeType === "percent" ? "percent" : "flat",
    leaseLateFeeValue: clampNumber(raw.leaseLateFeeValue, 0, 100000, DEFAULT_APP_SETTINGS.leaseLateFeeValue),
    leaseDesktopNotifications: raw.leaseDesktopNotifications !== false,
    operationsDesktopNotifications: raw.operationsDesktopNotifications === true,
    statementBusinessName: sanitizeShortText(raw.statementBusinessName, 120),
    statementBusinessAddress: sanitizeLongText(raw.statementBusinessAddress, 240),
    statementBusinessEmail: sanitizeShortText(raw.statementBusinessEmail, 120),
    statementBusinessPhone: sanitizeShortText(raw.statementBusinessPhone, 40),
    statementLogoDataUrl: sanitizeLogoDataUrl(raw.statementLogoDataUrl),
    statementPreparedBy: sanitizeShortText(raw.statementPreparedBy, 120),
    statementOwnerRecipient: sanitizeShortText(raw.statementOwnerRecipient, 120),
    statementOwnerEmail: sanitizeShortText(raw.statementOwnerEmail, 120),
    statementOwnerPhone: sanitizeShortText(raw.statementOwnerPhone, 40),
    statementOwnerNote: sanitizeLongText(raw.statementOwnerNote, 800),
    statementTenantNote: sanitizeLongText(raw.statementTenantNote, 800),
    accessRole:
      raw.accessRole === "manager" || raw.accessRole === "bookkeeper" || raw.accessRole === "read_only"
        ? raw.accessRole
        : "admin",
    operatorName: sanitizeShortText(raw.operatorName, 80) || DEFAULT_APP_SETTINGS.operatorName,
    aiDocumentCopilotEnabled: raw.aiDocumentCopilotEnabled === true,
    // Older installs already exposed Mobile Inbox. Preserve that behavior when
    // migrating their saved settings, while keeping fresh installs opt-in.
    mobileCompanionEnabled: Object.prototype.hasOwnProperty.call(raw, "mobileCompanionEnabled")
      ? raw.mobileCompanionEnabled === true
      : hasSavedSettings,
    aiOpenAiApiKey,
    hasAiOpenAiApiKey: raw.hasAiOpenAiApiKey === true || Boolean(aiOpenAiApiKey),
    aiOpenAiModel: sanitizeShortText(raw.aiOpenAiModel, 80) || DEFAULT_APP_SETTINGS.aiOpenAiModel,
    setupChecklistShowCompleted: raw.setupChecklistShowCompleted === true,
    setupChecklistShowDismissed: raw.setupChecklistShowDismissed === true,
    setupChecklistOverrides: sanitizeSetupChecklistOverrides(raw.setupChecklistOverrides),
    recurringExpenseCheckAcknowledgements: sanitizeRecurringExpenseCheckAcknowledgements(raw.recurringExpenseCheckAcknowledgements),
    monthlyCloseRecords: sanitizeMonthlyCloseRecords(raw.monthlyCloseRecords),
    realDataModeEnabled: raw.realDataModeEnabled === true,
  };
}

export function sanitizeAppSettingsForStorage(raw: unknown): AppSettings {
  const settings = sanitizeAppSettings(raw);
  const { aiOpenAiApiKey: _secret, ...safeSettings } = settings;
  return {
    ...safeSettings,
    // API keys are runtime-only in the renderer and live in Electron safeStorage on desktop.
    hasAiOpenAiApiKey: Boolean(settings.hasAiOpenAiApiKey || settings.aiOpenAiApiKey),
  } as AppSettings;
}

export function sanitizeAppSettingsForExport(raw: unknown): AppSettings {
  return sanitizeAppSettingsForStorage(raw);
}

export function loadAppSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_APP_SETTINGS;
  try {
    const raw = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    return sanitizeAppSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function updateAppSetting<K extends keyof AppSettings>(settings: AppSettings, key: K, value: AppSettings[K]): AppSettings {
  return sanitizeAppSettings({ ...settings, [key]: value });
}

export function updateDashboardCardSetting(settings: AppSettings, cardId: DashboardCardId, checked: boolean): AppSettings {
  return sanitizeAppSettings({
    ...settings,
    dashboardCards: {
      ...settings.dashboardCards,
      [cardId]: checked,
    },
  });
}

export function resetAppSettings(): AppSettings {
  return DEFAULT_APP_SETTINGS;
}

export function createSettingsSavedNotifier(onVisibleChange: (isVisible: boolean) => void, durationMs = 2400) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return {
    notify() {
      onVisibleChange(true);
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        onVisibleChange(false);
        timeoutId = null;
      }, durationMs);
    },
    dispose() {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
    },
  };
}

export function useAppSettings() {
  const [appSettings, setAppSettings] = useState<AppSettings>(loadAppSettings);
  const [settingsSavedVisible, setSettingsSavedVisible] = useState(false);
  const hasMountedRef = useRef(false);
  const notifier = useMemo(() => createSettingsSavedNotifier(setSettingsSavedVisible), []);

  useEffect(() => {
    return () => notifier.dispose();
  }, [notifier]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(sanitizeAppSettingsForStorage(appSettings)));
    }
    if (hasMountedRef.current) {
      notifier.notify();
    } else {
      hasMountedRef.current = true;
    }
  }, [appSettings, notifier]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.desktopSecrets) return;
    const desktopSecrets = window.desktopSecrets;
    let cancelled = false;

    async function hydrateSecret() {
      try {
        const legacyKey = String(appSettings.aiOpenAiApiKey || "").trim();
        if (legacyKey) {
          const saved = await desktopSecrets.setSecret("aiOpenAiApiKey", legacyKey);
          if (!cancelled && saved?.ok !== false) {
            setAppSettings((prev) => sanitizeAppSettings({ ...prev, aiOpenAiApiKey: legacyKey, hasAiOpenAiApiKey: true }));
          }
          return;
        }

        const result = await desktopSecrets.getSecret("aiOpenAiApiKey");
        if (!cancelled && result?.ok !== false) {
          setAppSettings((prev) => sanitizeAppSettings({
            ...prev,
            aiOpenAiApiKey: result?.value || "",
            hasAiOpenAiApiKey: Boolean(result?.hasValue),
          }));
        }
      } catch {
        if (!cancelled) {
          setAppSettings((prev) => sanitizeAppSettings({ ...prev, aiOpenAiApiKey: "", hasAiOpenAiApiKey: Boolean(prev.hasAiOpenAiApiKey) }));
        }
      }
    }

    void hydrateSecret();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.desktopSecrets) return;
    const key = String(appSettings.aiOpenAiApiKey || "").trim();
    if (!key) return;
    let cancelled = false;
    void window.desktopSecrets.setSecret("aiOpenAiApiKey", key).then((result) => {
      if (cancelled || result?.ok === false) return;
      setAppSettings((prev) => sanitizeAppSettings({ ...prev, aiOpenAiApiKey: key, hasAiOpenAiApiKey: true }));
    });
    return () => {
      cancelled = true;
    };
  }, [appSettings.aiOpenAiApiKey]);

  const setSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (key === "aiOpenAiApiKey" && typeof window !== "undefined" && window.desktopSecrets) {
      const nextValue = String(value || "");
      void window.desktopSecrets.setSecret("aiOpenAiApiKey", nextValue);
      setAppSettings((prev) => updateAppSetting(prev, key, value));
      setAppSettings((prev) => updateAppSetting(prev, "hasAiOpenAiApiKey", Boolean(nextValue.trim()) as AppSettings["hasAiOpenAiApiKey"]));
      return;
    }
    setAppSettings((prev) => updateAppSetting(prev, key, value));
  };

  const setDashboardCardSetting = (cardId: DashboardCardId, checked: boolean) => {
    setAppSettings((prev) => updateDashboardCardSetting(prev, cardId, checked));
  };

  const resetToDefaults = () => {
    if (typeof window !== "undefined" && window.desktopSecrets) {
      void window.desktopSecrets.deleteSecret("aiOpenAiApiKey");
    }
    setAppSettings(resetAppSettings());
  };

  const replaceSettings = (settings: unknown) => {
    setAppSettings(sanitizeAppSettings(settings));
  };

  return {
    appSettings,
    settingsSavedVisible,
    setSetting,
    setDashboardCardSetting,
    resetToDefaults,
    replaceSettings,
  };
}
