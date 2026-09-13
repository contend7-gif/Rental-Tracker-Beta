import fs from "node:fs";
import { makeTextPdf } from "../scripts/fixtures/pdfFixture.mjs";
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
    args: ["--disable-gpu"],
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

test("document upload buttons save a document type rather than the click event", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-import-type-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);
  try {
    // Keep this metadata regression independent of installed OCR software.
    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler("document-ocr:extract");
      ipcMain.handle("document-ocr:extract", () => ({ ok: false, reason: "unsupported", error: "OCR disabled in import metadata test." }));
    });
    await page.getByRole("button", { name: "Documents", exact: true }).click();
    for (const [index, button] of ["Upload document", "Upload bill"].entries()) {
      const chooserPromise = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: button, exact: true }).click();
      const chooser = await chooserPromise;
      await chooser.setFiles({
        name: `example-import-${index}.png`, mimeType: "image/png",
        buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"),
      });
      await expect(page.getByRole("heading", { name: "Add document", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Save document only", exact: true }).click();
      await expect.poll(async () => page.evaluate(async (name) => {
        const saved = await window.desktopPersistence.loadAppData();
        return saved.backup?.data?.documents?.find((document) => document.name === name)?.type;
      }, `example-import-${index}.png`)).toBe("Scanned Image");
    }
    expect(rendererErrors).toEqual([]);
  } finally {
    await electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("desktop AI response normalization preserves unknown amounts and explicit zero", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-ai-amount-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);
  try {
    for (const totalAmount of [null, "", false, [], 0, "0", "425.32"]) {
      // Stub the transport in this disposable process; no key or network request is used.
      await electronApp.evaluate((_electron, amount) => {
        globalThis.fetch = async () => ({
          ok: true,
          json: async () => ({ output_text: JSON.stringify({ summary: "Example document", totalAmount: amount }) }),
        });
      }, totalAmount);
      const response = await page.evaluate(async () => window.desktopDocumentAi.analyze({
        apiKey: "fictional-test-key",
        context: { document: { extractedText: "Fictional document for amount handling test." } },
      }));
      expect(response.ok).toBe(true);
      expect(response.analysis.totalAmount).toBe(
        totalAmount === 0 || totalAmount === "0" ? 0 : totalAmount === "425.32" ? 425.32 : undefined,
      );
    }
    expect(rendererErrors).toEqual([]);
  } finally {
    await electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("monthly close remains closed after a packaged-app restart", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-close-"));
  let run = await launchDesktopApp(profilePath);
  try {
    await run.page.getByRole("button", { name: "Calendar", exact: true }).click();
    await run.page.getByRole("button", { name: "Monthly Close", exact: true }).click();
    await run.page.getByRole("button", { name: /^Close (month|with open checks)$/ }).click();
    await expect(run.page.getByRole("button", { name: "Reopen month", exact: true })).toBeVisible();
    await expect.poll(async () => run.page.evaluate(async () => {
      const saved = await window.desktopPersistence.loadAppData();
      return Object.values(saved.backup?.settings?.monthlyCloseRecords || {}).some((record) => record.reviewVersion === 2);
    })).toBe(true);
    expect(run.rendererErrors).toEqual([]);
    await run.electronApp.close();
    run = await launchDesktopApp(profilePath);
    await run.page.getByRole("button", { name: "Calendar", exact: true }).click();
    await run.page.getByRole("button", { name: "Monthly Close", exact: true }).click();
    await expect(run.page.getByRole("button", { name: "Reopen month", exact: true })).toBeVisible();
    expect(run.rendererErrors).toEqual([]);
  } finally {
    await run.electronApp.close().catch(() => {});
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("packaged planning coordination supports the primary planning views", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-planning-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);
  try {
    await page.getByRole("button", { name: "Planning", exact: true }).click();
    await expect(page.getByText("Signed rent roll now", { exact: true })).toBeVisible();
    for (const name of ["Forecast", "Capital", "Rent", "Action plan", "Overview"]) {
      const tab = page.getByRole("button", { name, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-pressed", "true");
    }
    await expect(page.getByText("Signed rent roll now", { exact: true })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: /tasks? to work through/i })).toBeVisible();
    await expect(page.getByText(/Tax Center has \d+ cross-check/i)).toBeVisible();
    await expect(page.getByRole("region", { name: "Selected task", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /All tasks/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Tax Overview", exact: true })).toBeVisible();
    await page.getByLabel("Find a task").fill("no-matching-task-xyz");
    await expect(page.getByText("No tasks match these filters", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Reset filters", exact: true }).click();
    await expect(page.getByRole("region", { name: "Selected task", exact: true })).toBeVisible();
    await page.getByLabel("Priority", { exact: true }).selectOption("medium");
    await expect(page.getByRole("region", { name: "Open tasks", exact: true }).getByText("Review first", { exact: true })).toHaveCount(0);
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

test("packaged desktop creates an encrypted verified restore point", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-backup-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);

  try {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: /Data & Backup/ }).click();
    await page.getByRole("button", { name: "Expand", exact: true }).click();
    await page.getByRole("button", { name: "Create restore point", exact: true }).click();

    await expect.poll(async () => {
      const result = await page.evaluate(async () => window.desktopPersistence?.getHealth?.());
      return result?.managedBackupsEncrypted;
    }).toBe(true);
    await expect.poll(async () => {
      const result = await page.evaluate(async () => window.desktopPersistence?.getHealth?.());
      return Boolean(result?.lastRecoverableBackupAt);
    }).toBe(true);
    await expect(page.getByText("Protection: OS-encrypted", { exact: true })).toBeVisible();
    expect(rendererErrors).toEqual([]);
  } finally {
    await electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});


test("guided lease extension survives SQLite restart with linked payment and cancellation credit", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-extension-"));
  let run = await launchDesktopApp(profilePath);
  const openExtension = async () => {
    await run.page.getByRole("button", { name: "Leases", exact: true }).click();
    await run.page.getByRole("button", { name: /History & coverage/i }).click();
    await run.page.getByRole("button", { name: /Extension Test Tenant/ }).click();
    await run.page.getByRole("button", { name: "Extend lease", exact: true }).click();
  };
  try {
    await expect(run.page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
    await run.page.evaluate(async () => {
      const saved = await window.desktopPersistence.loadAppData();
      const backup = saved.backup;
      const unit = backup.data.units.find((item) => item.name !== "Shared");
      backup.data.leases = [{ id: "extension-test-lease", propertyId: unit.propertyId, unit: unit.name, tenantName: "Extension Test Tenant", startDate: "2026-08-12", endDate: "2026-09-11", actualEndDate: "", monthlyRent: 1550, rentAmount: 1550, rentalType: "Mid-term", agreementType: "fixed_term", billingCadence: "full_term", status: "Active", utilitiesIncluded: false, monthToMonthAfterTerm: false, notes: "" }];
      backup.data.tenantLedgerEntries = [];
      backup.data.transactions = [];
      backup.settings.leaseAutomationEnabled = false;
      backup.settings.confirmDestructiveActions = false;
      const result = await window.desktopPersistence.saveAppData(backup);
      if (result.ok === false) throw new Error(result.message);
    });
    await run.electronApp.close();
    run = await launchDesktopApp(profilePath);
    await openExtension();
    await run.page.getByLabel("Extension ends", { exact: true }).fill("2026-09-18");
    await run.page.getByLabel("Expected departure time (optional)").fill("12:00");
    await run.page.getByLabel("Additional fixed-term rent").fill("350");
    await run.page.getByLabel("Total amount received", { exact: true }).fill("100");
    await run.page.getByLabel("Actual payment-received date").fill("2026-09-08");
    await expect(run.page.getByText("Payment status: partially paid", { exact: true })).toBeVisible();
    await expect(run.page.getByText("Combined lease rent: $1,900.00", { exact: true })).toBeVisible();
    await run.page.locator('input[type="file"][accept="application/pdf"]').last().setInputFiles({ name: "extension-test.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
    await expect(run.page.getByRole("button", { name: "extension-test.pdf", exact: true })).toBeVisible();
    await run.electronApp.evaluate(({ ipcMain }) => {
      globalThis.extensionTestSaveHandler = ipcMain._invokeHandlers.get("persistence:save-app-data");
      ipcMain.removeHandler("persistence:save-app-data");
      ipcMain.handle("persistence:save-app-data", () => ({ ok: false, message: "Simulated isolated save failure" }));
    });
    await run.page.getByRole("button", { name: "Save extension", exact: true }).click();
    await expect(run.page.getByText(/Extension is pending on this screen/)).toBeVisible();
    expect(await run.page.evaluate(async () => (await window.desktopPersistence.loadAppData()).backup.data.leases.find((item) => item.id === "extension-test-lease").extensions?.length || 0)).toBe(0);
    await run.electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler("persistence:save-app-data");
      ipcMain.handle("persistence:save-app-data", globalThis.extensionTestSaveHandler);
      delete globalThis.extensionTestSaveHandler;
    });
    await run.page.getByRole("button", { name: "Save extension", exact: true }).click();
    await expect(run.page.getByRole("heading", { name: /^Extend lease/ })).toHaveCount(0);
    const saved = await run.page.evaluate(async () => (await window.desktopPersistence.loadAppData()).backup.data);
    const lease = saved.leases.find((item) => item.id === "extension-test-lease");
    expect(lease.endDate).toBe("2026-09-18");
    expect(lease.actualEndDate).toBe("");
    expect(lease.originalTerm.endDate).toBe("2026-09-11");
    expect(lease.extensions[0].endTime).toBe("12:00");
    expect(saved.tenantLedgerEntries.filter((item) => item.leaseExtensionId === lease.extensions[0].id)).toHaveLength(2);
    expect(saved.transactions.filter((item) => item.rentLeaseExtensionId === lease.extensions[0].id)).toHaveLength(1);
    expect(saved.documents.find((item) => item.id === lease.extensions[0].documentIds[0]).leaseExtensionId).toBe(lease.extensions[0].id);
    expect(run.rendererErrors).toEqual([]);
    await run.electronApp.close();
    run = await launchDesktopApp(profilePath);
    await openExtension();
    await expect(run.page.getByText(/2026-09-18 at 12:00/)).toBeVisible();
    await run.page.getByRole("button", { name: "Cancel", exact: true }).first().click();
    await expect.poll(async () => run.page.evaluate(async () => {
      const data = (await window.desktopPersistence.loadAppData()).backup.data;
      const lease = data.leases.find((item) => item.id === "extension-test-lease");
      return { end: lease.endDate, canceled: Boolean(lease.extensions[0].canceledAt), activeCash: data.transactions.filter((item) => item.rentLeaseId === lease.id && item.status === "active").reduce((sum, item) => sum + item.amount, 0) };
    })).toEqual({ end: "2026-09-11", canceled: true, activeCash: 100 });
    expect(run.rendererErrors).toEqual([]);
  } finally {
    await run.electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});


test("receipt import reads an oversized photo locally and preserves receipt lines", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-large-receipt-"));
  const { electronApp, page } = await launchDesktopApp(profilePath);
  try {
    const result = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 2400;
      canvas.height = 6000;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "black";
      ctx.font = "100px Arial";
      ["SAMPLE MARKET", "09/11/2026"].forEach((line, i) => ctx.fillText(line, 160, 300 + i * 200));
      ["ITEM ONE", "ITEM TWO", "SUBTOTAL", "TAX", "TOTAL", "VISA CREDIT TEND"].forEach((line, i) => ctx.fillText(line, 160, 900 + i * 200));
      ["10.00", "14.00", "24.00", "1.20", "25.20", "25.20"].forEach((line, i) => ctx.fillText(line, 1800, 900 + i * 200));
      const dataUrl = canvas.toDataURL("image/png");
      return { ...(await window.desktopDocumentOcr.extract({ name: "large-receipt.png", mimeType: "image/png", dataUrl })), dataUrl };
    });
    expect(result.ok).toBe(true);
    expect(result.text).toMatch(/SAMPLE MARKET/i);
    expect(result.text).toMatch(/TOTAL\s+25\.20/i);
    expect(result.text.split("\n").length).toBeGreaterThanOrEqual(4);
    await page.getByRole("button", { name: "Documents", exact: true }).click();
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload document", exact: true }).click();
    await (await chooserPromise).setFiles({ name: "large-receipt.png", mimeType: "image/png", buffer: Buffer.from(result.dataUrl.split(",")[1], "base64") });
    await expect(page.getByText("Ready to review", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Review expense", exact: true })).toBeEnabled();
    await page.screenshot({ path: path.join(rootDir, "output/playwright/receipt-import-success.png") });
    await page.getByRole("button", { name: "Review expense", exact: true }).click();
    await expect(page.getByRole("button", { name: "Save transaction and attach document", exact: true })).toBeVisible();
    await expect(page.locator('input[value="25.20"], input[value="25.2"]').first()).toBeVisible();

  } finally {
    await electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("failed receipt reading offers manual entry without posting a transaction", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-manual-receipt-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);
  try {
    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler("document-ocr:extract");
      ipcMain.handle("document-ocr:extract", () => { throw new Error("Simulated unreadable photo"); });
    });
    const original = await page.evaluate(async () => (await window.desktopPersistence.loadAppData()).backup.data);
    await page.getByRole("button", { name: "Documents", exact: true }).click();
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload document", exact: true }).click();
    await (await chooserPromise).setFiles({ name: "unreadable-receipt.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64") });
    await expect(page.getByText(/Your selected file is still here/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save document only", exact: true })).toBeEnabled();
    await page.screenshot({ path: path.join(rootDir, "output/playwright/receipt-import-review.png") });
    await page.getByRole("button", { name: "Enter expense manually", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Add document", exact: true })).toHaveCount(0);
    await expect.poll(async () => page.evaluate(async () => (await window.desktopPersistence.loadAppData()).backup.data.documents.length)).toBe(original.documents.length + 1);
    const saved = await page.evaluate(async () => (await window.desktopPersistence.loadAppData()).backup.data);
    expect(saved.transactions.length).toBe(original.transactions.length);
    expect(saved.documents.find((doc) => doc.name === "unreadable-receipt.png").transactionId || "").toBe("");
    expect(rendererErrors).toEqual([]);
  } finally {
    await electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});


test("saving a receipt only never applies a suggested transaction link", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-receipt-link-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);
  try {
    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler("document-ocr:extract");
      ipcMain.handle("document-ocr:extract", () => ({ ok: true, text: "Example Plumbing Co.\nReceipt\n04/12/2026\nSink repair\nTOTAL 385.00" }));
    });
    await page.getByRole("button", { name: "Documents", exact: true }).click();
    for (const [index, action] of ["Save document only", "Save and attach to this transaction"].entries()) {
      const chooserPromise = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "Upload document", exact: true }).click();
      const name = `plumbing-match-${index}.png`;
      await (await chooserPromise).setFiles({ name, mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64") });
      await expect(page.getByText("Possible existing transaction", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: action, exact: true }).click();
      await expect.poll(async () => page.evaluate(async (fileName) => {
        const data = (await window.desktopPersistence.loadAppData()).backup.data;
        const doc = data.documents.find((item) => item.name === fileName);
        return doc ? (doc.transactionId || "unlinked") : "missing";
      }, name)).toBe(index === 0 ? "unlinked" : "demo-repair-expense");
    }
    expect(rendererErrors).toEqual([]);
  } finally {
    await electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});


test("packaged reader extracts embedded PDF text before OCR", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-native-pdf-"));
  const { electronApp, page } = await launchDesktopApp(profilePath);
  try {
    const pdf = makeTextPdf([[{ text: "Sample utility statement", y: 720 }, { text: "Statement Date 04/17/2026", y: 680 }, { text: "Amount Due", y: 640 }, { text: "40.00", x: 450, y: 640 }]]);
    const result = await page.evaluate(async (dataUrl) => window.desktopDocumentOcr.extract({ name: "sample-bill.pdf", mimeType: "application/pdf", dataUrl }), `data:application/pdf;base64,${pdf.toString("base64")}`);
    expect(result.engine).toBe("pdf-text");
    expect(result.text).toMatch(/Amount Due 40\.00/);
    expect(result.processedPages).toBe(1);
  } finally {
    await electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("Work Queue reaches every task and confirms a reviewed service-period correction", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-work-queue-"));
  let run = await launchDesktopApp(profilePath);
  try {
    await expect(run.page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
    await run.page.evaluate(async () => {
      const { backup } = await window.desktopPersistence.loadAppData();
      const propertyId = backup.data.properties[0].id;
      backup.data.transactions = Array.from({ length: 25 }, (_, index) => ({
        id: `queue-test-${index}`, status: "active", propertyId, unit: "Shared", date: "2026-08-15", type: "Expense", category: "Utilities",
        vendor: `Queue utility ${String(index).padStart(2, "0")}`, description: "Monthly utility bill", amount: 80,
        receiptName: "example-support.pdf", taxChecked: true, reconciled: true,
        servicePeriodStart: "", servicePeriodEnd: "", ownerUsePctOverride: false,
      }));
      backup.settings.leaseAutomationEnabled = false;
      const saved = await window.desktopPersistence.saveAppData(backup);
      if (saved.ok === false) throw new Error(saved.message);
    });
    await run.electronApp.close();
    run = await launchDesktopApp(profilePath);
    const { page } = run;
    const loaded = await page.evaluate(async () => (await window.desktopPersistence.loadAppData()).backup.data.transactions);
    expect(loaded.filter((t) => t.id.startsWith("queue-test-")).length).toBe(25);
    await page.getByRole("button", { name: "Transactions", exact: true }).click();
    await page.getByPlaceholder("Search", { exact: true }).fill("unrelated-ledger-search");
    await page.getByRole("button", { name: "Work Queue", exact: true }).click();
    await page.getByRole("button", { name: /^Transactions \(/ }).click();
    const list = page.getByRole("region", { name: "Open tasks", exact: true });
    const detail = page.getByRole("region", { name: "Selected task", exact: true });
    await expect(list.getByRole("button", { name: /Queue utility/ })).toHaveCount(20);
    await page.getByRole("button", { name: /Show more tasks/ }).click();
    await expect(list.getByRole("button", { name: /Queue utility/ })).toHaveCount(25);
    await page.getByLabel("Find a task").fill("Queue utility 24");
    await expect(list.getByRole("button", { name: /Queue utility/ })).toHaveCount(1);
    await detail.getByRole("button", { name: "Set service period", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Monthly utility bill", exact: true })).toBeVisible();
    const storedDate = await page.evaluate(async () => (await window.desktopPersistence.loadAppData()).backup.data.transactions.find((t) => t.id === "queue-test-24").servicePeriodStart);
    expect(storedDate || "").toBe("");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(list.getByRole("button", { name: /Queue utility 24/ })).toBeVisible();
    await detail.getByText("Other actions", { exact: true }).click();
    await detail.getByRole("button", { name: "Use transaction date as service period", exact: true }).click();
    await expect(page.getByText(/both the start and end/)).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(list.getByRole("button", { name: /Queue utility 24/ })).toBeVisible();
    await detail.getByRole("button", { name: "Use transaction date as service period", exact: true }).click();
    await page.getByRole("button", { name: "Use this date", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Queue utility 24: updated" })).toBeVisible();
    await expect(detail.getByRole("button", { name: "Review tax", exact: true })).toBeVisible();
    await detail.getByRole("button", { name: "Mark reviewed", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Queue utility 24: no open checks remain" })).toBeVisible();
    await expect(page.getByText("No tasks match these filters", { exact: true })).toBeVisible();
    await expect.poll(async () => page.evaluate(async () => (await window.desktopPersistence.loadAppData()).backup.data.transactions.find((t) => t.id === "queue-test-24").servicePeriodStart)).toBe("2026-08-15");
    await page.getByLabel("Find a task").fill("");
    await page.screenshot({ path: "output/playwright/work-queue-revamp.png", fullPage: true });
    expect(run.rendererErrors).toEqual([]);
  } finally {
    await run.electronApp.close().catch(() => {});
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});
