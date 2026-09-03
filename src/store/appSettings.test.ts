import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_RECURRING_HELPER_TEXT,
  DASHBOARD_DENSITY_OPTIONS,
  DASHBOARD_METRIC_OPTIONS,
  DEFAULT_APP_SETTINGS,
  LEDGER_SORT_OPTIONS,
  LEASE_AUTOMATION_HELPER_TEXT,
  SETTINGS_LABELS,
  SETTINGS_SAVED_TEXT,
  SETTINGS_TOOLTIPS,
  SIDEBAR_DEFAULT_OPTIONS,
  createSettingsSavedNotifier,
  resetAppSettings,
  sanitizeAppSettings,
  sanitizeAppSettingsForExport,
  sanitizeAppSettingsForStorage,
  updateAppSetting,
  updateDashboardCardSetting,
} from "./appSettings.ts";

test("settings labels/options expose renamed ledger and sidebar labels", () => {
  assert.equal(SETTINGS_LABELS.defaultLedgerSort, "Default ledger sort");
  assert.equal(SETTINGS_LABELS.sidebarDefault, "Sidebar default");
  assert.equal(SETTINGS_LABELS.dashboardDensity, "Dashboard density");
  assert.equal(SETTINGS_LABELS.dashboardMetrics, "Dashboard metrics");
  assert.equal(SETTINGS_LABELS.autoGenerateRecurringEntries, "Auto-generate recurring entries");
  assert.equal(SETTINGS_LABELS.leaseAutomation, "Lease automation");
  assert.equal(SETTINGS_LABELS.statementBranding, "Statement branding");
  assert.equal(SETTINGS_LABELS.accessProfile, "Access profile");
  assert.equal(SETTINGS_LABELS.aiDocumentCopilot, "AI document copilot");
  assert.equal(LEDGER_SORT_OPTIONS[0].label, "Date desc");
  assert.equal(LEDGER_SORT_OPTIONS[1].label, "Date asc");
  assert.deepEqual(
    SIDEBAR_DEFAULT_OPTIONS.map((item) => item.label),
    ["Expanded (wide)", "Collapsed (icons only)"],
  );
  assert.ok(DASHBOARD_METRIC_OPTIONS.some((item) => item.id === "grossRent"));
  assert.deepEqual(DASHBOARD_DENSITY_OPTIONS.map((item) => item.value), ["compact", "comfortable", "detailed"]);
});

test("dashboard density is sanitized", () => {
  assert.equal(sanitizeAppSettings({ ...DEFAULT_APP_SETTINGS, dashboardDensity: "compact" }).dashboardDensity, "compact");
  assert.equal(sanitizeAppSettings({ ...DEFAULT_APP_SETTINGS, dashboardDensity: "detailed" }).dashboardDensity, "detailed");
  assert.equal(sanitizeAppSettings({ ...DEFAULT_APP_SETTINGS, dashboardDensity: "noisy" }).dashboardDensity, "comfortable");
});

test("helper text copy is exposed", () => {
  assert.equal(
    AUTO_RECURRING_HELPER_TEXT,
    "Automatically create recurring transactions when dates or filters change.",
  );
  assert.equal(
    LEASE_AUTOMATION_HELPER_TEXT,
    "Auto-create rent charges, optional late fees, and due reminders.",
  );
});

test("restore defaults returns default settings and clears mutations", () => {
  const updated = updateAppSetting(DEFAULT_APP_SETTINGS, "ledgerDefaultSort", "date_asc");
  const toggled = updateDashboardCardSetting(updated, "scheduleE", false);
  assert.equal(toggled.ledgerDefaultSort, "date_asc");
  assert.equal(toggled.dashboardCards.scheduleE, false);

  const restored = resetAppSettings();
  assert.deepEqual(restored, DEFAULT_APP_SETTINGS);
});

test("recurring expense check acknowledgements keep only opaque keys and dates", () => {
  const updated = sanitizeAppSettings({
    ...DEFAULT_APP_SETTINGS,
    recurringExpenseCheckAcknowledgements: {
      "repeat-1234abcd": "2026-08-30",
      "Utility Provider": "2026-08-30",
      "repeat-deadbeef": "not-a-date",
    },
  });

  assert.deepEqual(updated.recurringExpenseCheckAcknowledgements, {
    "repeat-1234abcd": "2026-08-30",
  });
  assert.deepEqual(resetAppSettings().recurringExpenseCheckAcknowledgements, {});
});

test("monthly close snapshots and optional operations notifications are sanitized", () => {
  const updated = sanitizeAppSettings({
    ...DEFAULT_APP_SETTINGS,
    operationsDesktopNotifications: true,
    operationsLeaseReviewDaysBefore: 999,
    monthlyCloseRecords: {
      "2026-08::all": { closedAt: "2026-08-31T12:00:00.000Z", signature: "close-1234abcd", issueCount: 3 },
      "bad-key": { closedAt: "yesterday", signature: "unsafe", issueCount: -4 },
    },
  });

  assert.equal(updated.operationsDesktopNotifications, true);
  assert.equal(updated.operationsLeaseReviewDaysBefore, 180);
  assert.deepEqual(updated.monthlyCloseRecords, {
    "2026-08::all": { closedAt: "2026-08-31T12:00:00.000Z", signature: "close-1234abcd", issueCount: 3 },
  });
  assert.equal(sanitizeAppSettings({ ...DEFAULT_APP_SETTINGS, operationsDesktopNotifications: "yes" }).operationsDesktopNotifications, false);
  assert.equal(sanitizeAppSettings({ ...DEFAULT_APP_SETTINGS, operationsLeaseReviewDaysBefore: "bad" }).operationsLeaseReviewDaysBefore, 60);
});

test("settings saved feedback is shown and debounced", async () => {
  const events: boolean[] = [];
  const notifier = createSettingsSavedNotifier((isVisible) => events.push(isVisible), 120);

  notifier.notify();
  await new Promise((resolve) => setTimeout(resolve, 40));
  notifier.notify();
  await new Promise((resolve) => setTimeout(resolve, 40));
  notifier.notify();

  await new Promise((resolve) => setTimeout(resolve, 180));
  notifier.dispose();

  assert.equal(events[0], true);
  assert.equal(events.filter((v) => v === false).length, 1);
  assert.equal(events.at(-1), false);
});

test("settings tooltip text and saved feedback copy are exposed", () => {
  assert.equal(SETTINGS_TOOLTIPS.autoGenerateRecurringEntries, AUTO_RECURRING_HELPER_TEXT);
  assert.equal(SETTINGS_TOOLTIPS.dashboardMetrics, "Select which dashboard metric cards are visible.");
  assert.equal(SETTINGS_TOOLTIPS.leaseAutomation, LEASE_AUTOMATION_HELPER_TEXT);
  assert.equal(SETTINGS_SAVED_TEXT, "Settings saved.");
});

test("de minimis settings are sanitized and persisted", () => {
  const updated = sanitizeAppSettings({
    ...DEFAULT_APP_SETTINGS,
    deMinimisElectionEnabled: true,
    deMinimisHasAFS: true,
    deMinimisStatementPrepared: true,
  });

  assert.equal(updated.deMinimisElectionEnabled, true);
  assert.equal(updated.deMinimisHasAFS, true);
  assert.equal(updated.deMinimisStatementPrepared, true);

  const fallback = sanitizeAppSettings({
    ...DEFAULT_APP_SETTINGS,
    deMinimisElectionEnabled: "yes",
    deMinimisHasAFS: 1,
    deMinimisStatementPrepared: null,
  });

  assert.equal(fallback.deMinimisElectionEnabled, false);
  assert.equal(fallback.deMinimisHasAFS, false);
  assert.equal(fallback.deMinimisStatementPrepared, false);
});

test("lease automation settings are sanitized and clamped", () => {
  const updated = sanitizeAppSettings({
    ...DEFAULT_APP_SETTINGS,
    leaseAutomationEnabled: true,
    leaseDefaultRentDueDay: 35,
    leaseReminderDaysBefore: -4,
    leaseAutoLateFeeEnabled: true,
    leaseLateFeeGraceDays: 90,
    leaseLateFeeType: "percent",
    leaseLateFeeValue: 175,
    leaseDesktopNotifications: false,
  });

  assert.equal(updated.leaseAutomationEnabled, true);
  assert.equal(updated.leaseDefaultRentDueDay, 28);
  assert.equal(updated.leaseReminderDaysBefore, 0);
  assert.equal(updated.leaseAutoLateFeeEnabled, true);
  assert.equal(updated.leaseLateFeeGraceDays, 30);
  assert.equal(updated.leaseLateFeeType, "percent");
  assert.equal(updated.leaseLateFeeValue, 175);
  assert.equal(updated.leaseDesktopNotifications, false);

  const fallback = sanitizeAppSettings({
    ...DEFAULT_APP_SETTINGS,
    leaseAutomationEnabled: "yes",
    leaseDefaultRentDueDay: "bad",
    leaseReminderDaysBefore: "bad",
    leaseAutoLateFeeEnabled: "on",
    leaseLateFeeGraceDays: null,
    leaseLateFeeType: "broken",
    leaseLateFeeValue: -999,
    leaseDesktopNotifications: "yes",
  });

  assert.equal(fallback.leaseAutomationEnabled, true);
  assert.equal(fallback.leaseDefaultRentDueDay, DEFAULT_APP_SETTINGS.leaseDefaultRentDueDay);
  assert.equal(fallback.leaseReminderDaysBefore, DEFAULT_APP_SETTINGS.leaseReminderDaysBefore);
  assert.equal(fallback.leaseAutoLateFeeEnabled, false);
  assert.equal(fallback.leaseLateFeeGraceDays, 0);
  assert.equal(fallback.leaseLateFeeType, "flat");
  assert.equal(fallback.leaseLateFeeValue, 0);
  assert.equal(fallback.leaseDesktopNotifications, true);
});

test("statement branding settings are sanitized and trimmed", () => {
  const updated = sanitizeAppSettings({
    ...DEFAULT_APP_SETTINGS,
    statementBusinessName: "North Shore Property Management",
    statementBusinessAddress: "123 Main St, Suite 400\nMadison, WI 53703",
    statementBusinessEmail: "hello@example.com",
    statementBusinessPhone: "(608) 555-0100",
    statementLogoDataUrl: "data:image/png;base64,AAAA",
    statementPreparedBy: "Alicia Conte",
    statementOwnerRecipient: "North Shore Ownership Group",
    statementOwnerEmail: "owners@example.com",
    statementOwnerPhone: "(715) 555-0112",
    statementOwnerNote: "Please review March repairs before filing.",
    statementTenantNote: "Please submit payment by the due date listed above.",
  });

  assert.equal(updated.statementBusinessName, "North Shore Property Management");
  assert.equal(updated.statementBusinessAddress, "123 Main St, Suite 400\nMadison, WI 53703");
  assert.equal(updated.statementBusinessEmail, "hello@example.com");
  assert.equal(updated.statementBusinessPhone, "(608) 555-0100");
  assert.equal(updated.statementLogoDataUrl, "data:image/png;base64,AAAA");
  assert.equal(updated.statementPreparedBy, "Alicia Conte");
  assert.equal(updated.statementOwnerRecipient, "North Shore Ownership Group");
  assert.equal(updated.statementOwnerEmail, "owners@example.com");
  assert.equal(updated.statementOwnerPhone, "(715) 555-0112");
  assert.equal(updated.statementOwnerNote, "Please review March repairs before filing.");
  assert.equal(updated.statementTenantNote, "Please submit payment by the due date listed above.");

  const fallback = sanitizeAppSettings({
    ...DEFAULT_APP_SETTINGS,
    statementBusinessName: "  " + "A".repeat(140),
    statementBusinessAddress: null,
    statementBusinessEmail: 12,
    statementBusinessPhone: {},
    statementLogoDataUrl: "https://example.com/logo.png",
    statementPreparedBy: " " + "B".repeat(150),
    statementOwnerRecipient: false,
    statementOwnerEmail: 13,
    statementOwnerPhone: {},
    statementOwnerNote: "  " + "C".repeat(900),
    statementTenantNote: null,
  });

  assert.equal(fallback.statementBusinessName.length, 120);
  assert.equal(fallback.statementBusinessAddress, "");
  assert.equal(fallback.statementBusinessEmail, "12");
  assert.equal(fallback.statementBusinessPhone, "[object Object]");
  assert.equal(fallback.statementLogoDataUrl, "");
  assert.equal(fallback.statementPreparedBy.length, 120);
  assert.equal(fallback.statementOwnerRecipient, "");
  assert.equal(fallback.statementOwnerEmail, "13");
  assert.equal(fallback.statementOwnerPhone, "[object Object]");
  assert.equal(fallback.statementOwnerNote.length, 800);
  assert.equal(fallback.statementTenantNote, "");
});

test("access-profile settings are sanitized and preserved", () => {
  const updated = sanitizeAppSettings({
    ...DEFAULT_APP_SETTINGS,
    accessRole: "manager",
    operatorName: "Alicia Conte",
  });

  assert.equal(updated.accessRole, "manager");
  assert.equal(updated.operatorName, "Alicia Conte");

  const fallback = sanitizeAppSettings({
    ...DEFAULT_APP_SETTINGS,
    accessRole: "super-admin",
    operatorName: " " + "Z".repeat(120),
  });

  assert.equal(fallback.accessRole, "admin");
  assert.equal(fallback.operatorName.length, 80);
});

test("AI settings are sanitized and preserved", () => {
  const updated = sanitizeAppSettings({
    ...DEFAULT_APP_SETTINGS,
    aiDocumentCopilotEnabled: true,
    aiOpenAiApiKey: " OPENAI-TEST-123 ",
    aiOpenAiModel: " gpt-4o-mini ",
  });

  assert.equal(updated.aiDocumentCopilotEnabled, true);
  assert.equal(updated.aiOpenAiApiKey, "OPENAI-TEST-123");
  assert.equal(updated.hasAiOpenAiApiKey, true);
  assert.equal(updated.aiOpenAiModel, "gpt-4o-mini");

  const fallback = sanitizeAppSettings({
    ...DEFAULT_APP_SETTINGS,
    aiDocumentCopilotEnabled: "yes",
    aiOpenAiApiKey: " " + "k".repeat(400),
    aiOpenAiModel: " ",
  });

  assert.equal(fallback.aiDocumentCopilotEnabled, false);
  assert.equal(fallback.aiOpenAiApiKey.length, 240);
  assert.equal(fallback.hasAiOpenAiApiKey, true);
  assert.equal(fallback.aiOpenAiModel, DEFAULT_APP_SETTINGS.aiOpenAiModel);
});

test("mobile companion is opt-in for fresh installs and preserves older installs", () => {
  assert.equal(DEFAULT_APP_SETTINGS.mobileCompanionEnabled, false);
  assert.equal(sanitizeAppSettings({}).mobileCompanionEnabled, false);
  assert.equal(sanitizeAppSettings({ theme: "light", defaultView: "dashboard" }).mobileCompanionEnabled, true);
  assert.equal(sanitizeAppSettings({ ...DEFAULT_APP_SETTINGS, mobileCompanionEnabled: false }).mobileCompanionEnabled, false);
  assert.equal(sanitizeAppSettings({ ...DEFAULT_APP_SETTINGS, mobileCompanionEnabled: true }).mobileCompanionEnabled, true);
  assert.equal(sanitizeAppSettings({ ...DEFAULT_APP_SETTINGS, mobileCompanionEnabled: "yes" }).mobileCompanionEnabled, false);
});

test("AI API key is stripped from localStorage-shaped and exported settings", () => {
  const stored = sanitizeAppSettingsForStorage({
    ...DEFAULT_APP_SETTINGS,
    aiOpenAiApiKey: "OPENAI-TEST-123",
  });
  const exported = sanitizeAppSettingsForExport({
    ...DEFAULT_APP_SETTINGS,
    aiOpenAiApiKey: "OPENAI-TEST-456",
  });

  assert.equal(stored.aiOpenAiApiKey, undefined);
  assert.equal(stored.hasAiOpenAiApiKey, true);
  assert.equal(exported.aiOpenAiApiKey, undefined);
  assert.equal(exported.hasAiOpenAiApiKey, true);
  assert.equal(JSON.stringify(stored).includes("aiOpenAiApiKey"), false);
  assert.equal(JSON.stringify(stored).includes("OPENAI-TEST"), false);
  assert.equal(JSON.stringify(exported).includes("aiOpenAiApiKey"), false);
  assert.equal(JSON.stringify(exported).includes("OPENAI-TEST"), false);
});
