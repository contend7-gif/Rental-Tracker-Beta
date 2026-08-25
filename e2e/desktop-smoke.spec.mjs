import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron, expect, test } from "@playwright/test";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const executablePath = process.env.RENTAL_TRACKER_E2E_EXECUTABLE
  || path.join(rootDir, "release", "win-unpacked", "Rental Tracker.exe");

async function launchDesktopApp(profilePath) {
  if (!fs.existsSync(executablePath)) {
    throw new Error(`Packaged desktop executable not found at ${executablePath}. Run npm run desktop:pack first.`);
  }

  const rendererErrors = [];
  const electronApp = await electron.launch({
    executablePath,
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      RENTAL_TRACKER_E2E: "1",
      RENTAL_TRACKER_E2E_USER_DATA_PATH: profilePath,
    },
  });
  const page = await electronApp.firstWindow();
  page.on("pageerror", (error) => rendererErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") rendererErrors.push(message.text());
  });
  await expect(page).toHaveTitle("Rental Tracker");

  const releaseNotesHeading = page.getByRole("heading", { name: /What's new in/i });
  await releaseNotesHeading.waitFor({ state: "visible", timeout: 2_000 }).catch(() => {});
  if (await releaseNotesHeading.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Close", exact: true }).last().click();
  }

  return { electronApp, page, rendererErrors };
}

test("packaged desktop supports the core Documents workflow", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-documents-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);

  try {
    await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Documents", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
    await expect(page.getByText("4 files", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Library (4)", exact: true }).click();

    const search = page.getByRole("textbox", { name: /Search files, tags, extracted text/i });
    await search.fill("plumbing");
    await expect(page.getByText("Example Plumbing receipt", { exact: true })).toBeVisible();
    await expect(page.getByText("Example Hardware roof receipt", { exact: true })).toHaveCount(0);

    const plumbingCard = page.getByRole("group", { name: "Document Example Plumbing receipt", exact: true });
    await plumbingCard.getByTitle("More actions", { exact: true }).click();
    await plumbingCard.getByRole("button", { name: "Review details", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Example Plumbing receipt", exact: true })).toBeVisible();
    await expect(page.getByText("Extracted fields", { exact: true })).toBeVisible();
    expect(rendererErrors).toEqual([]);
  } finally {
    await electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("SQLite data survives a complete packaged-app restart", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-restart-"));
  let firstRun = null;
  let secondRun = null;

  try {
    firstRun = await launchDesktopApp(profilePath);
    await firstRun.page.getByRole("button", { name: "Documents", exact: true }).click();
    await expect(firstRun.page.getByText("4 files", { exact: true })).toBeVisible();
    await expect.poll(async () => firstRun.page.evaluate(async () => {
      const saved = await window.desktopPersistence?.loadAppData?.();
      if (saved?.ok === false) throw new Error(saved.message || "SQLite load failed.");
      return saved?.hasData ? saved.backup?.data?.documents?.length ?? 0 : 0;
    })).toBe(4);
    await firstRun.electronApp.close();
    firstRun = null;

    secondRun = await launchDesktopApp(profilePath);
    await secondRun.page.getByRole("button", { name: "Documents", exact: true }).click();
    await expect(secondRun.page.getByText("4 files", { exact: true })).toBeVisible();
    await secondRun.page.getByRole("button", { name: "Library (4)", exact: true }).click();
    await expect(secondRun.page.getByText("Example Plumbing receipt", { exact: true })).toBeVisible();
    expect(secondRun.rendererErrors).toEqual([]);
  } finally {
    await firstRun?.electronApp.close().catch(() => {});
    await secondRun?.electronApp.close().catch(() => {});
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("packaged desktop exposes clear lease term and billing views", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-leases-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);

  try {
    await page.getByRole("button", { name: "Leases", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Leases", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Current leases/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Payments & reminders/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /History & coverage/i })).toBeVisible();

    await page.getByRole("button", { name: /Payments & reminders/i }).click();
    await expect(page.getByRole("heading", { name: "Rent schedules", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Open ledger", exact: true }).first().click();
    await expect(page.getByText("Term and billing are tracked separately", { exact: true })).toBeVisible();
    await expect(page.getByText("Stay length", { exact: true })).toBeVisible();
    await expect(page.getByText("Agreement", { exact: true })).toBeVisible();
    await expect(page.getByText("Billing schedule", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();

    await page.getByRole("button", { name: /History & coverage/i }).click();
    await expect(page.getByRole("heading", { name: "Lease History & Occupancy Coverage", exact: true })).toBeVisible();
    expect(rendererErrors).toEqual([]);
  } finally {
    await electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("packaged desktop separates Work Queue records from tax cross-checks", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-review-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);

  try {
    await page.getByRole("button", { name: "Work Queue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Work Queue", exact: true })).toBeVisible();
    await expect(page.getByText(/records need attention$/i)).toBeVisible();
    await expect(page.getByText(/Tax Center has \d+ cross-check/i)).toBeVisible();
    await expect(page.getByText("Workflow:", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /All records/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Tax cross-checks/i })).toBeVisible();
    expect(rendererErrors).toEqual([]);
  } finally {
    await electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("packaged desktop gives each Transactions mode one clear job", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-transactions-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);

  try {
    await page.getByRole("button", { name: "Transactions", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Transactions", exact: true })).toBeVisible();

    const activityTab = page.getByRole("tab", { name: /Activity/ });
    const attentionTab = page.getByRole("tab", { name: /Needs attention/ });
    const recurringTab = page.getByRole("tab", { name: /Recurring/ });
    const importsTab = page.getByRole("tab", { name: /Imports & matching/ });
    await expect(activityTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Transaction activity", exact: true })).toBeVisible();

    await attentionTab.click();
    await expect(page.getByRole("heading", { name: "Transactions needing attention", exact: true })).toBeVisible();
    await expect(page.getByText(/transactions have open flags|No transaction flags are open/i)).toBeVisible();

    await recurringTab.click();
    await expect(page.getByText("Recurring schedule", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recurring activity", exact: true })).toBeVisible();

    await importsTab.click();
    await expect(page.getByText("Import / Reconcile", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Imported activity", exact: true })).toBeVisible();
    expect(rendererErrors).toEqual([]);
  } finally {
    await electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("packaged desktop gives each Properties mode one clear job", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-properties-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);

  try {
    await page.getByRole("button", { name: "Properties", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Properties", exact: true })).toBeVisible();

    const overviewTab = page.getByRole("tab", { name: /Overview/ });
    const unitsTab = page.getByRole("tab", { name: /Units & occupancy/ });
    const recordsTab = page.getByRole("tab", { name: /Property records/ });
    const photosTab = page.getByRole("tab", { name: /Photos/ });
    await expect(overviewTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Property readiness", { exact: true })).toBeVisible();

    await unitsTab.click();
    await expect(page.getByText("Current status, active agreements, and occupancy history for each unit.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open lease workspace", exact: true })).toBeVisible();

    await recordsTab.click();
    await expect(page.getByText("Choose valuation, documents, or operating notes without mixing in unit occupancy.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Valuation/ })).toHaveAttribute("aria-pressed", "true");

    await photosTab.click();
    await expect(page.getByText("Property photos", { exact: true })).toBeVisible();
    expect(rendererErrors).toEqual([]);
  } finally {
    await electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("packaged desktop gives each Maintenance mode one clear job", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-maintenance-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);

  try {
    await page.getByRole("button", { name: "Maintenance", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Maintenance", exact: true })).toBeVisible();

    const activeTab = page.getByRole("tab", { name: /Active work/ });
    const historyTab = page.getByRole("tab", { name: /History & costs/ });
    const cleanupTab = page.getByRole("tab", { name: /Cleanup & accounting/ });
    const vendorsTab = page.getByRole("tab", { name: /Vendors/ });
    await expect(activeTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Active work orders", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "New Work Order", exact: true })).toBeVisible();

    await historyTab.click();
    await expect(page.getByText("Maintenance history", { exact: true })).toBeVisible();
    await expect(page.getByText("Maintenance cost roll-up", { exact: true })).toBeVisible();

    await cleanupTab.click();
    await expect(page.getByText("Work orders needing cleanup", { exact: true })).toBeVisible();
    await expect(page.getByText("Cleanup status", { exact: true })).toBeVisible();

    await vendorsTab.click();
    await expect(page.getByText("Vendor Directory", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Vendor", exact: true })).toBeVisible();
    expect(rendererErrors).toEqual([]);
  } finally {
    await electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("packaged desktop gives each Loans mode one clear job", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-loans-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);

  try {
    await page.getByRole("button", { name: "Loans", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Loans", exact: true })).toBeVisible();

    const overviewTab = page.getByRole("tab", { name: /Portfolio overview/ });
    const paymentsTab = page.getByRole("tab", { name: /Payments/ });
    const taxTab = page.getByRole("tab", { name: /Tax & escrow/ });
    const detailsTab = page.getByRole("tab", { name: /Loan details/ });
    await expect(overviewTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Loan portfolio", exact: true })).toBeVisible();
    await expect(page.getByText("Property debt summary", { exact: true })).toBeVisible();

    await paymentsTab.click();
    await expect(page.getByRole("heading", { name: "Payment management", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Record payment", exact: true }).first()).toBeVisible();

    await taxTab.click();
    await expect(page.getByText("Loan review status", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Loan tax and escrow review", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Work Queue", exact: true })).toBeVisible();

    await detailsTab.click();
    await expect(page.getByRole("heading", { name: "Loan records and schedules", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit loan", exact: true }).first()).toBeVisible();
    expect(rendererErrors).toEqual([]);
  } finally {
    await electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("packaged desktop gives each Depreciation mode one clear job", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-assets-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);

  try {
    await page.getByRole("button", { name: "Depreciation", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Depreciation Assets", exact: true })).toBeVisible();

    const overviewTab = page.getByRole("tab", { name: /Overview/ });
    const registerTab = page.getByRole("tab", { name: /Asset register/ });
    const schedulesTab = page.getByRole("tab", { name: /Schedules/ });
    const cleanupTab = page.getByRole("tab", { name: /Cleanup & sources/ });
    await expect(overviewTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Depreciation overview", exact: true })).toBeVisible();
    await expect(page.getByText("Depreciation readiness", { exact: true })).toBeVisible();

    await registerTab.click();
    await expect(page.getByRole("heading", { name: "Asset register", exact: true })).toBeVisible();
    await expect(page.getByText("Edit the authoritative asset record.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit", exact: true }).first()).toBeVisible();

    await schedulesTab.click();
    await expect(page.getByRole("heading", { name: "Depreciation schedules", exact: true })).toBeVisible();
    await expect(page.getByText(/year preview$/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);

    await cleanupTab.click();
    await expect(page.getByRole("heading", { name: "Asset cleanup and sources", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Work Queue", exact: true })).toBeVisible();
    await expect(page.getByText("Only asset records needing attention appear below.", { exact: true })).toBeVisible();
    expect(rendererErrors).toEqual([]);
  } finally {
    await electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("packaged desktop gives each Tax Center mode one clear job", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-tax-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);

  try {
    await page.getByRole("button", { name: "Tax Center", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Tax Center", exact: true })).toBeVisible();

    const summaryTab = page.getByRole("tab", { name: /^Summary/ });
    const scheduleTab = page.getByRole("tab", { name: /^Schedule E/ });
    const reviewTab = page.getByRole("tab", { name: /^Review & support/ });
    const filingTab = page.getByRole("tab", { name: /^Filing package/ });
    await expect(summaryTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Tax package status", { exact: true })).toBeVisible();
    await expect(page.getByText("Schedule E summary (computed)", { exact: true })).toBeVisible();

    await scheduleTab.click();
    const lineTotalsTab = page.getByRole("tab", { name: /^Line totals/ });
    const sourceDetailsTab = page.getByRole("tab", { name: /^Source details/ });
    await expect(lineTotalsTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Schedule E - Computed line totals", { exact: true })).toBeVisible();
    await sourceDetailsTab.click();
    await expect(page.getByText("Schedule E source details", { exact: true })).toBeVisible();

    await reviewTab.click();
    await expect(page.getByText("Tax review overview", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Depreciation/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Loans & escrow/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Work Queue", exact: true })).toBeVisible();

    await filingTab.click();
    await expect(page.getByText("Tax Packet", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Print packet", exact: true })).toBeVisible();
    expect(rendererErrors).toEqual([]);
  } finally {
    await electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});
