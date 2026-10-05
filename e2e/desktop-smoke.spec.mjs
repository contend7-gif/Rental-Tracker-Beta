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

test("dialogs protect unsaved edits, contain focus, and keep invalid Quick Add entries open", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-dialogs-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);
  try {
    const initialCount = await page.evaluate(async () => (await window.desktopPersistence.loadAppData()).backup.data.transactions.length);
    await page.getByRole("button", { name: "Properties", exact: true }).click();
    const newButton = page.getByRole("button", { name: "Transaction", exact: true });
    const openQuickAdd = async () => {
      await newButton.click();
      await expect(page.getByRole("dialog", { name: "Quick Add Transaction", exact: true })).toBeVisible();
    };
    await openQuickAdd();
    const dialog = page.getByRole("dialog", { name: "Quick Add Transaction", exact: true });
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    for (let index = 0; index < 18; index++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    }
    await dialog.getByLabel("Description", { exact: true }).fill("Example unsaved keyboard draft");
    await dialog.getByLabel("Amount", { exact: true }).fill("0");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("alert")).toContainText("This entry was not saved");
    await expect(dialog.getByLabel("Description", { exact: true })).toHaveValue("Example unsaved keyboard draft");
    await page.keyboard.press("Escape");
    const discard = page.getByRole("alertdialog", { name: "Discard unsaved changes?", exact: true });
    await expect(discard).toBeVisible();
    await expect(discard.getByRole("button", { name: "Keep editing", exact: true })).toBeFocused();
    await discard.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(dialog.getByLabel("Description", { exact: true })).toHaveValue("Example unsaved keyboard draft");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await discard.getByRole("button", { name: "Discard changes", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(newButton).toBeFocused();
    expect(await page.evaluate(async () => (await window.desktopPersistence.loadAppData()).backup.data.transactions.length)).toBe(initialCount);
    await openQuickAdd();
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(discard).toHaveCount(0);
    await openQuickAdd();
    await dialog.getByLabel("Description", { exact: true }).fill("Example valid Quick Add entry");
    await dialog.getByLabel("Amount", { exact: true }).fill("20");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => page.evaluate(async () => (await window.desktopPersistence.loadAppData()).backup.data.transactions.filter((item) => item.description === "Example valid Quick Add entry").length)).toBe(1);
    expect(rendererErrors).toEqual([]);
  } finally {
    await electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("transaction drafts survive navigation and protect unsaved changes", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-drafts-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);
  try {
    const openEntry = async () => {
      await page.getByRole("button", { name: "New", exact: true }).click();
      await page.getByRole("menuitem", { name: /^Transaction/ }).click();
      await expect(page.getByLabel("Description / memo", { exact: true })).toBeVisible();
    };
    await openEntry();
    await page.getByRole("button", { name: /Repair \/ maintenance/ }).click();
    await page.getByLabel("Amount", { exact: true }).fill("0");
    await page.getByLabel("Description / memo", { exact: true }).fill("Example recoverable draft");
    await page.getByRole("button", { name: "Save transaction", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Not saved");
    await page.getByRole("button", { name: "Retry save", exact: true }).click();
    await expect(page.getByLabel("Description / memo", { exact: true })).toHaveValue("Example recoverable draft");
    await page.getByRole("button", { name: "Home", exact: true }).click();
    const prompt = page.getByRole("dialog", { name: "Leave unsaved transaction?", exact: true });
    await expect(prompt).toBeVisible();
    await prompt.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(page.getByLabel("Description / memo", { exact: true })).toHaveValue("Example recoverable draft");
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await prompt.getByRole("button", { name: "Save draft and leave", exact: true }).click();
    await openEntry();
    await page.getByRole("button", { name: "Restore draft", exact: true }).click();
    await expect(page.getByLabel("Description / memo", { exact: true })).toHaveValue("Example recoverable draft");
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await prompt.getByRole("button", { name: "Discard and leave", exact: true }).click();
    await openEntry();
    await expect(page.getByRole("button", { name: "Restore draft", exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Description / memo", { exact: true })).toHaveValue("");
    expect(rendererErrors).toEqual([]);
  } finally { await electronApp.close(); fs.rmSync(profilePath, { recursive: true, force: true }); }
});

test("saved transaction views and table columns survive restart", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-views-"));
  let run = await launchDesktopApp(profilePath);
  try {
    await run.page.evaluate(async () => {
      const { backup } = await window.desktopPersistence.loadAppData();
      const propertyId = backup.data.properties[0].id;
      backup.data.transactions = [10, 40].map((amount) => ({ id: `view-txn-${amount}`, propertyId, unit: "Shared", date: "2026-08-15", status: "active", type: "Expense", category: "Repairs", amount, description: `Example saved view ${amount}`, taxChecked: true, reconciled: true }));
      backup.settings.leaseAutomationEnabled = false;
      const result = await window.desktopPersistence.saveAppData(backup);
      if (result.ok === false) throw new Error(result.message);
    });
    await run.electronApp.close();
    run = await launchDesktopApp(profilePath);
    const page = run.page;
    await page.getByRole("button", { name: "Transactions", exact: true }).click();
    await page.getByRole("button", { name: "Table", exact: true }).click();
    const table = page.getByRole("table", { name: "Transactions table", exact: true });
    await table.getByRole("button", { name: /^Amount/ }).click();
    await expect(table.locator("tbody tr").first()).toContainText("Example saved view 40");
    await page.locator("summary").filter({ hasText: /^Columns$/ }).click();
    await page.getByRole("checkbox", { name: "Tax", exact: true }).uncheck();
    await expect(table.getByRole("columnheader", { name: "Tax", exact: true })).toHaveCount(0);
    await page.getByLabel("Search transactions", { exact: true }).fill("Example saved view 40");
    await page.locator("summary").filter({ hasText: /^Saved views$/ }).click();
    await page.getByLabel("Saved view name", { exact: true }).fill("Example saved filter");
    await page.getByRole("button", { name: "Save current view", exact: true }).click();
    await run.electronApp.close();
    run = await launchDesktopApp(profilePath);
    await run.page.getByRole("button", { name: "Transactions", exact: true }).click();
    await expect(run.page.getByRole("table", { name: "Transactions table", exact: true })).toBeVisible();
    await expect(run.page.getByRole("columnheader", { name: "Tax", exact: true })).toHaveCount(0);
    await run.page.locator("summary").filter({ hasText: /^Saved views$/ }).click();
    await run.page.getByLabel("Saved views", { exact: true }).selectOption("Example saved filter");
    await expect(run.page.getByLabel("Search transactions", { exact: true })).toHaveValue("Example saved view 40");
    await expect(run.page.getByRole("table").locator("tbody tr")).toHaveCount(1);
    expect(run.rendererErrors).toEqual([]);
  } finally { await run.electronApp.close(); fs.rmSync(profilePath, { recursive: true, force: true }); }
});

test("a missing file preview recovers through Retry after the file is restored", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-file-retry-"));
  let run = await launchDesktopApp(profilePath);
  try {
    await run.page.evaluate(async () => {
      const { backup } = await window.desktopPersistence.loadAppData();
      backup.data.documents.push({ id: "example-retry-document", propertyId: backup.data.properties[0].id, unit: "Shared", name: "Example retry document.pdf", type: "Other", tags: ["supporting-only"], uploadedAt: "2026-10-03T12:00:00.000Z", relativePath: "example-retry.pdf", mimeType: "application/pdf", extractedText: "Example fictional saved file" });
      const result = await window.desktopPersistence.saveAppData(backup);
      if (result.ok === false) throw new Error(result.message);
    });
    await run.electronApp.close();
    run = await launchDesktopApp(profilePath);
    await run.page.keyboard.press("Control+k");
    const search = run.page.getByRole("combobox", { name: "Search all records and actions" });
    await search.fill("Example retry document");
    await expect(run.page.getByRole("listbox").getByRole("option")).toHaveCount(1);
    await search.press("Enter");
    const preview = run.page.getByRole("region", { name: "File preview: Example retry document.pdf", exact: true });
    await expect(preview.getByRole("alert")).toBeVisible();
    fs.writeFileSync(path.join(profilePath, "documents", "example-retry.pdf"), makeTextPdf([[{ text: "Example restored file" }]]));
    await preview.getByRole("button", { name: "Retry file load", exact: true }).click();
    await expect(preview.getByText("Preview available", { exact: true })).toBeVisible();
    await expect(preview.getByRole("alert")).toHaveCount(0);
    expect(run.rendererErrors).toEqual([]);
  } finally { await run.electronApp.close(); fs.rmSync(profilePath, { recursive: true, force: true }); }
});

test("narrow windows retain scope filters and keyboard creation and saving", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-keyboard-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);
  try {
    const minimumSize = await electronApp.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.setContentSize(720, 900);
      return window.getMinimumSize();
    });
    expect(minimumSize).toEqual([640, 540]);
    await page.setViewportSize({ width: 720, height: 900 });
    await expect(page.getByRole("combobox", { name: "Year", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Property", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Unit", exact: true })).toBeVisible();
    const newButton = page.getByRole("button", { name: "New", exact: true });
    await newButton.click();
    const items = page.getByRole("menuitem");
    await expect(items.first()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press("Home");
    await expect(items.first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(newButton).toBeFocused();
    await newButton.click();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Description / memo", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Repair \/ maintenance/ }).click();
    await page.getByLabel("Amount", { exact: true }).fill("23");
    await page.getByLabel("Description / memo", { exact: true }).fill("Example keyboard save");
    await page.keyboard.press("Control+s");
    await expect.poll(async () => page.evaluate(async () => (await window.desktopPersistence.loadAppData()).backup.data.transactions.filter((record) => record.description === "Example keyboard save").length)).toBe(1);
    await page.screenshot({ path: path.join(rootDir, "output", "playwright", "modern-narrow-window.png") });
    expect(rendererErrors).toEqual([]);
  } finally { await electronApp.close(); fs.rmSync(profilePath, { recursive: true, force: true }); }
});

test("global search opens historical records and large lists page without losing matches", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-search-pages-"));
  let run = await launchDesktopApp(profilePath);
  try {
    await run.page.evaluate(async () => {
      const { backup } = await window.desktopPersistence.loadAppData();
      const propertyId = backup.data.properties[0].id;
      backup.data.transactions = Array.from({ length: 123 }, (_, index) => ({
        id: `page-transaction-${index}`, description: `Example paging transaction ${String(index).padStart(3, "0")}`,
        status: "active", propertyId, unit: "Shared", date: "2026-08-15", type: "Expense", category: "Repairs", amount: 20,
        vendor: "Example vendor", receiptName: "example-receipt.pdf", taxChecked: true, reconciled: true,
      }));
      backup.data.transactions.push({ ...backup.data.transactions[0], id: "historical-search", date: "2024-01-01", description: "Example historical search target" });
      backup.data.documents = Array.from({ length: 123 }, (_, index) => ({
        id: `page-document-${index}`, name: `Example paging document ${String(index).padStart(3, "0")}`, propertyId,
        unit: "Shared", workOrderId: index === 122 ? "global-closed-work" : "", type: "Other", tags: ["supporting-only"], uploadedAt: "2026-08-15T12:00:00.000Z", extractedText: "Example supporting record",
      }));
      backup.settings.leaseAutomationEnabled = false;
      backup.data.workOrders.push({ id: "global-closed-work", propertyId, unit: "Shared", title: "Example completed search repair", description: "Fictional completed task", status: "Completed", priority: "Low", reportedOn: "2026-08-01", createdAt: "2026-08-01T12:00:00.000Z" });
      const saved = await window.desktopPersistence.saveAppData(backup);
      if (saved.ok === false) throw new Error(saved.message);
    });
    await run.electronApp.close();
    run = await launchDesktopApp(profilePath);
    const { page } = run;
    await expect(page.getByText("Settings saved.", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Transactions", exact: true }).click();
    const transactionPager = page.getByRole("navigation", { name: "Transactions pages" });
    await expect(transactionPager).toContainText("1–50 of 123");
    await transactionPager.getByRole("button", { name: "Next", exact: true }).click();
    await expect(transactionPager).toContainText("51–100 of 123");
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(400);
    // Preserve the chosen offset; Playwright's click would scroll the sidebar button into view.
    await page.getByRole("button", { name: "Documents", exact: true }).dispatchEvent("click");
    await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await expect(transactionPager).toContainText("51\u2013100 of 123");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(400);
    await page.keyboard.press("Alt+ArrowRight");
    await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
    await page.keyboard.press("Alt+ArrowLeft");
    await expect(transactionPager).toContainText("51\u2013100 of 123");
    await page.getByPlaceholder("Search", { exact: true }).fill("transaction 122");
    await expect(page.getByText("Example paging transaction 122", { exact: true })).toBeVisible();
    await expect(transactionPager).toHaveCount(0);

    await page.keyboard.press("Control+k");
    const search = page.getByRole("combobox", { name: "Search all records and actions" });
    await expect(search).toBeFocused();
    await search.press("Tab");
    expect(await page.evaluate(() => document.querySelector("dialog[open]")?.contains(document.activeElement))).toBe(true);
    await search.focus();
    await search.fill("historical search target");
    await expect(page.getByRole("listbox", { name: "Search results" }).getByRole("option")).toHaveCount(1);
    await page.screenshot({ path: path.join(rootDir, "output", "playwright", "modern-search-preview.png") });
    await search.press("Enter");
    await expect(page.getByRole("heading", { name: "Example historical search target", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Documents", exact: true }).click();
    await page.getByRole("button", { name: /^Library \(123\)/ }).click();
    const documentPager = page.getByRole("navigation", { name: "Documents pages" });
    await expect(page.getByRole("group", { name: /^Document Example paging document/ })).toHaveCount(50);
    await documentPager.getByRole("button", { name: "Next", exact: true }).click();
    await documentPager.getByRole("button", { name: "Next", exact: true }).click();
    await expect(documentPager).toContainText("101–123 of 123");
    await expect(page.getByRole("group", { name: /^Document Example paging document/ })).toHaveCount(23);
    await page.getByRole("button", { name: "Transactions", exact: true }).click();
    await expect(page.getByPlaceholder("Search", { exact: true })).toHaveValue("transaction 122");
    await expect(page.getByRole("button", { name: "Go forward", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await expect(documentPager).toContainText("101–123 of 123");
    await expect(page.getByRole("group", { name: /^Document Example paging document/ })).toHaveCount(23);

    await page.getByRole("button", { name: "Search", exact: false }).filter({ hasText: "Ctrl K" }).click();
    await expect(search).toBeFocused();
    await search.fill("paging document 122");
    await expect(page.getByRole("listbox", { name: "Search results" }).getByRole("option")).toHaveCount(1);
    await search.press("Enter");
    await expect(page.getByRole("heading", { name: "Example paging document 122", exact: true })).toBeVisible();
    await page.getByRole("dialog", { name: "Example paging document 122", exact: true }).getByRole("button", { name: "Links", exact: true }).click();
    await page.getByRole("button", { name: "View", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Maintenance", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Example paging document 122", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+k");
    await search.fill("completed search repair");
    await expect(page.getByRole("listbox", { name: "Search results" }).getByRole("option")).toHaveCount(1);
    await search.press("Enter");
    await expect(page.locator("#workspace-focus-work-order-global-closed-work")).toBeVisible();
    expect(run.rendererErrors).toEqual([]);
  } finally {
    await run.electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("navigation restores property and unit scope and remembered property tabs", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-navigation-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);
  try {
    await expect(page.getByRole("button", { name: "Go back", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Transactions", exact: true }).click();
    const property = page.locator("main").getByLabel("Property", { exact: true });
    const unit = page.locator("main").getByLabel("Unit", { exact: true });
    const propertyId = await property.locator("option").nth(1).getAttribute("value");
    await property.selectOption(propertyId);
    const unitValue = await unit.locator('option:not([value="all"])').first().getAttribute("value");
    await unit.selectOption(unitValue);
    await page.getByRole("button", { name: "Loans", exact: true }).click();
    await property.selectOption("all");
    await page.locator("main").getByLabel("Year", { exact: true }).selectOption("2025");
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Transactions", exact: true })).toBeVisible();
    await expect(property).toHaveValue(propertyId);
    await expect(unit).toHaveValue(unitValue);
    await expect(page.locator("main").getByLabel("Year", { exact: true })).toHaveValue("2026");
    await page.getByRole("button", { name: "Go forward", exact: true }).click();
    await expect(property).toHaveValue("all");
    await expect(page.locator("main").getByLabel("Year", { exact: true })).toHaveValue("2025");
    await page.getByRole("button", { name: "Properties", exact: true }).click();
    const unitsTab = page.getByRole("tab", { name: /^Units/ });
    await unitsTab.click();
    await page.getByRole("button", { name: "Loans", exact: true }).click();
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await expect(unitsTab).toHaveAttribute("aria-selected", "true");
    expect(rendererErrors).toEqual([]);
  } finally {
    await electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("refreshed Home and navigation remain coherent at desktop and narrow sizes", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-ui-refresh-"));
  const run = await launchDesktopApp(profilePath);
  try {
    const { page, electronApp } = run;
    await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Portfolio overview" }).getByRole("button")).toHaveCount(4);
    await expect(page.getByRole("button", { name: /^Gross Rent YTD:/ })).toBeVisible();
    for (const [width, height] of [[1920, 1200], [1440, 900], [1280, 800]]) {
      await electronApp.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(...size), [width, height]);
      await page.setViewportSize({ width, height });
      await expect(page.locator(".rt-home-bottom-panels")).toBeVisible();
      await expect.poll(() => page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - window.innerHeight)), { message: `Home overflow at ${width} x ${height}` }).toBe(0);
      const alignment = await page.evaluate(() => {
        const fields = document.querySelector(".rt-scope-fields").getBoundingClientRect();
        const actions = document.querySelector(".rt-header-actions").getBoundingClientRect();
        const heading = document.querySelector(".rt-header-heading").getBoundingClientRect();
        return {
          centered: Math.abs((fields.top + fields.bottom - actions.top - actions.bottom) / 2) <= 1,
          between: fields.left >= heading.right && fields.right <= actions.left,
          contained: [...document.querySelectorAll(".rt-scope-field")].every((field) => {
            const parent = field.getBoundingClientRect();
            const select = field.querySelector("select").getBoundingClientRect();
            return select.top >= parent.top && select.bottom <= parent.bottom && select.left >= parent.left && select.right <= parent.right;
          }),
        };
      });
      expect(alignment).toEqual({ centered: true, between: true, contained: true });
      await page.screenshot({ path: path.join(rootDir, "output", "playwright", `compact-home-${width}.png`) });
    }
    for (const width of [1440, 1024, 720]) {
      await electronApp.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setContentSize(width, 1000), width);
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.getByRole("combobox", { name: "Property", exact: true })).toHaveCount(1);
      await expect(page.getByRole("combobox", { name: "Unit", exact: true })).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(rootDir, "output", "playwright", `refresh-home-${width}.png`) });
    }
    await page.getByRole("button", { name: "Navigation", exact: true }).click();
    const navigation = page.getByRole("dialog", { name: "Navigation", exact: true });
    await expect(navigation).toBeVisible();
    await page.screenshot({ path: path.join(rootDir, "output", "playwright", "refresh-navigation-720.png") });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Navigation", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Navigation", exact: true }).click();
    await navigation.getByRole("button", { name: "Transactions", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Transactions", exact: true })).toBeVisible();
    await expect(navigation).toHaveCount(0);
    await page.getByRole("button", { name: "Table", exact: true }).click();
    await expect(page.getByRole("table", { name: "Transactions table", exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(rootDir, "output", "playwright", "refresh-transactions-720.png") });
    await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 1000));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(rootDir, "output", "playwright", "refresh-transactions-1440.png") });
    await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(720, 1000));
    await page.setViewportSize({ width: 720, height: 1000 });
    await page.getByRole("button", { name: "Navigation", exact: true }).click();
    await navigation.getByRole("button", { name: "Home", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
    await page.evaluate(async () => {
      const { backup } = await window.desktopPersistence.loadAppData();
      backup.settings.theme = "dark";
      await window.desktopPersistence.saveAppData(backup);
    });
    await page.reload();
    await expect(page.locator(".rt-app-shell")).toHaveClass(/theme-dark/);
    await page.screenshot({ path: path.join(rootDir, "output", "playwright", "refresh-home-dark-720.png") });
    expect(run.rendererErrors).toEqual([]);
  } finally {
    await run.electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("Smart Check review preserves dashboard scope and recognizes reassigned bills", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-smart-scope-"));
  let run = await launchDesktopApp(profilePath);
  try {
    await run.page.evaluate(async () => {
      const { backup } = await window.desktopPersistence.loadAppData();
      const propertyId = backup.data.properties[0].id;
      const now = new Date();
      const billingDay = Math.min(now.getDate(), 28);
      const dateAt = (offset, day) => new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, day)).toISOString().slice(0, 10);
      const base = backup.data.transactions.find((transaction) => transaction.type === "Expense") || backup.data.transactions[0];
      for (const vendor of ["Example Missing Energy", "Example Reassigned Energy"]) {
        for (const offset of [-4, -3, -2]) backup.data.transactions.push({ ...base, id: `${vendor}-${offset}`, propertyId, unit: "Shared", vendor, description: vendor, date: dateAt(offset, billingDay), amount: 40, status: "active", type: "Expense", category: "Utilities", servicePeriodStart: dateAt(offset, billingDay), servicePeriodEnd: dateAt(offset + 1, billingDay - 1) });
      }
      backup.data.transactions.push({ ...base, id: "example-reassigned-current", propertyId, unit: "614", vendor: "Example Reassigned Energy", description: "Example Reassigned Energy", date: dateAt(-1, billingDay), amount: 40, status: "active", type: "Expense", category: "Utilities", servicePeriodStart: dateAt(-1, billingDay), servicePeriodEnd: dateAt(0, billingDay - 1) });
      backup.settings.leaseAutomationEnabled = false;
      await window.desktopPersistence.saveAppData(backup);
    });
    await run.electronApp.close();
    run = await launchDesktopApp(profilePath);
    const { page } = run;
    await page.getByRole("button", { name: "Transactions", exact: true }).click();
    await page.getByRole("tab", { name: /^Recurring/ }).click();
    await page.getByRole("button", { name: "Calendar", exact: true }).click();
    const property = page.locator("main").getByLabel("Property", { exact: true });
    const unit = page.locator("main").getByLabel("Unit", { exact: true });
    await expect(property).toHaveValue("all");
    await expect(unit).toHaveValue("all");
    await expect(page.getByText("Check missing payment: Example Reassigned Energy", { exact: true })).toHaveCount(0);
    const row = page.locator("div.rounded-lg.border.border-slate-200.bg-white.p-3").filter({ has: page.getByText("Check missing payment: Example Missing Energy", { exact: true }) });
    await expect(row.getByText("Suggested check", { exact: true })).toBeVisible();
    await expect(row.getByText(/overdue/i)).toHaveCount(0);
    await page.getByRole("combobox", { name: "Calendar source", exact: true }).selectOption("smart_check");
    await page.getByRole("combobox", { name: "Calendar horizon", exact: true }).selectOption("180");
    await expect(row).toBeVisible();
    for (const width of [1920, 1440, 720]) {
      await page.setViewportSize({ width, height: width === 1920 ? 1200 : 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(rootDir, "output", "playwright", `calendar-refresh-${width}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Month", exact: true }).click();
    await expect(page.getByLabel("Jump to month", { exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Calendar horizon", exact: true })).toHaveCount(0);
    await page.screenshot({ path: path.join(rootDir, "output", "playwright", "calendar-month-refresh-1440.png") });
    await page.getByRole("button", { name: "Agenda", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Calendar source", exact: true })).toHaveValue("smart_check");
    await expect(page.getByRole("combobox", { name: "Calendar horizon", exact: true })).toHaveValue("180");
    await row.getByRole("button", { name: "Review transactions", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Transactions", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Activity/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("textbox", { name: "Search transactions", exact: true })).toHaveValue("Example Missing Energy");
    await expect(property).toHaveValue("all");
    await expect(unit).toHaveValue("all");
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
    await expect(property).toHaveValue("all");
    await expect(unit).toHaveValue("all");
    await expect(page.getByText("No units or properties match the selected scope.", { exact: true })).toHaveCount(0);
    expect(run.rendererErrors).toEqual([]);
  } finally {
    await run.electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("packaged desktop supports the core Documents workflow", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-documents-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);

  try {
    await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Documents", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
    await expect(page.getByText("4 files", { exact: true })).toBeVisible();
    const processingTools = page.locator("details.rt-document-processing");
    await expect(processingTools).toBeVisible();
    expect(await processingTools.evaluate((element) => element.open)).toBe(false);
    await page.getByRole("button", { name: "Library (4)", exact: true }).click();

    const search = page.getByRole("textbox", { name: "Search documents", exact: true });
    await search.fill("plumbing");
    await expect(page.getByText("Example Plumbing receipt", { exact: true })).toBeVisible();
    await expect(page.getByText("Example Hardware roof receipt", { exact: true })).toHaveCount(0);

    const plumbingCard = page.getByRole("group", { name: "Document Example Plumbing receipt", exact: true });
    await plumbingCard.getByRole("button", { name: "Example Plumbing receipt", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Example Plumbing receipt", exact: true })).toBeVisible();
    await expect(page.getByText("Extracted fields", { exact: true })).toBeVisible();
    const review = page.getByRole("dialog", { name: "Example Plumbing receipt", exact: true });
    await expect(review.getByRole("button", { name: "View linked record", exact: true })).toBeEnabled();
    await review.getByRole("button", { name: "Links", exact: true }).click();
    await expect(review.getByText("Record links", { exact: true })).toBeVisible();
    await expect(review.getByText("Extracted fields", { exact: true })).toBeHidden();
    await review.getByRole("button", { name: "Text & tools", exact: true }).click();
    await expect(review.getByText("Extracted text editor", { exact: true })).toBeVisible();
    await review.getByRole("button", { name: "Review", exact: true }).click();
    await review.getByRole("button", { name: "Edit extracted text", exact: true }).first().click();
    await expect(review.getByRole("button", { name: "Text & tools", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(review.locator("textarea")).toBeFocused();
    await review.getByRole("button", { name: "Review", exact: true }).click();
    for (const width of [1440, 720]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await review.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: path.join(rootDir, "output", "playwright", `documents-review-${width}.png`) });
    }
    await review.getByRole("button", { name: "Close document review", exact: true }).click();
    await search.fill("");
    for (const width of [1920, 1440, 720]) {
      await page.setViewportSize({ width, height: width === 1920 ? 1200 : 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(rootDir, "output", "playwright", `documents-list-${width}.png`) });
    }
    expect(rendererErrors).toEqual([]);
  } finally {
    await electronApp.close();
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("saved PDF review retains its preview after a complete desktop restart", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-pdf-review-"));
  let firstRun = null;
  let secondRun = null;
  try {
    firstRun = await launchDesktopApp(profilePath);
    await firstRun.page.getByRole("button", { name: "Documents", exact: true }).click();
    const chooserPromise = firstRun.page.waitForEvent("filechooser");
    await firstRun.page.getByRole("button", { name: "Upload document", exact: true }).click();
    await (await chooserPromise).setFiles({ name: "saved-lease.pdf", mimeType: "application/pdf", buffer: makeTextPdf([[{ text: "Example signed lease" }]]) });
    await expect(firstRun.page.getByRole("heading", { name: "Add document", exact: true })).toBeVisible();
    await firstRun.page.getByRole("button", { name: "Save document only", exact: true }).click();
    await expect.poll(async () => firstRun.page.evaluate(async () => {
      const saved = await window.desktopPersistence.loadAppData();
      const doc = saved.backup?.data?.documents?.find((item) => item.name === "saved-lease.pdf");
      return Boolean(doc?.relativePath && !doc?.dataUrl);
    })).toBe(true);
    await firstRun.page.evaluate(async () => {
      const { backup } = await window.desktopPersistence.loadAppData();
      backup.data.transactions.push({ ...backup.data.transactions[0], id: "panel-preview-transaction", description: "Example linked panel transaction", status: "active", date: "2026-09-20" });
      backup.data.documents.find((item) => item.name === "saved-lease.pdf").transactionId = "panel-preview-transaction";
      await window.desktopPersistence.saveAppData(backup);
    });
    await firstRun.electronApp.close();
    firstRun = null;
    secondRun = await launchDesktopApp(profilePath);
    const { page } = secondRun;
    await page.getByRole("button", { name: "Documents", exact: true }).click();
    await page.getByRole("button", { name: "Library (5)", exact: true }).click();
    const card = page.getByRole("group", { name: "Document saved-lease.pdf", exact: true });
    await card.getByTitle("More actions", { exact: true }).click();
    await card.getByRole("button", { name: "Review details", exact: true }).click();
    await expect(page.getByText("Preview available", { exact: true })).toBeVisible();
    await expect(page.getByText("Preview not loaded", { exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('iframe[title="Preview of saved-lease.pdf"]')).toHaveAttribute("data-preview-ready", "true");
    // Native PDF pages paint after the frame's load event; allow the visual capture to show the page.
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(rootDir, "output", "playwright", "documents-pdf-review-1440.png") });
    await page.getByRole("button", { name: "View file", exact: true }).first().click();
    await expect(page.locator('iframe[title="saved-lease.pdf"]')).toBeVisible();
    await expect(page.locator('iframe[title="saved-lease.pdf"]')).toHaveAttribute("data-preview-ready", "true");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "saved-lease.pdf", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "View file", exact: true }).first()).toBeFocused();
    await expect(page.locator('iframe[title="Preview of saved-lease.pdf"]')).toBeVisible();
    const correctionSection = page.locator("details").filter({ has: page.locator("summary", { hasText: "Correct OCR fields" }) });
    if (!await correctionSection.evaluate((element) => element.open)) await correctionSection.locator("summary").click();
    const originalVendor = await page.getByLabel("Vendor", { exact: true }).inputValue();
    await page.getByLabel("Vendor", { exact: true }).fill("Example unsaved OCR vendor");
    const documentPanel = page.getByRole("dialog", { name: "saved-lease.pdf", exact: true });
    await documentPanel.getByRole("button", { name: "Links", exact: true }).click();
    await documentPanel.getByRole("button", { name: "Review", exact: true }).click();
    await expect(page.getByLabel("Vendor", { exact: true })).toHaveValue("Example unsaved OCR vendor");
    await page.getByRole("button", { name: "Open linked transaction", exact: true }).click();
    await page.getByRole("alertdialog", { name: "Discard unsaved changes?", exact: true }).getByRole("button", { name: "Discard changes", exact: true }).click();
    const transactionPanel = page.getByRole("dialog", { name: "Example linked panel transaction", exact: true });
    await expect(transactionPanel.locator('iframe[title="Preview of saved-lease.pdf"]')).toBeVisible();
    await expect(transactionPanel.locator('iframe[title="Preview of saved-lease.pdf"]')).toHaveAttribute("data-preview-ready", "true");
    await page.screenshot({ path: path.join(rootDir, "output", "playwright", "record-panel-preview.png") });
    await page.keyboard.press("Escape");
    await expect(transactionPanel).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open linked transaction", exact: true })).toBeFocused();
    await expect(page.getByLabel("Vendor", { exact: true })).toHaveValue(originalVendor);
    await documentPanel.getByRole("button", { name: "Links", exact: true }).click();
    const manualAttachment = page.locator("summary").filter({ hasText: /^Attach manually$/ }).locator("..");
    await manualAttachment.locator("summary").click();
    await expect(manualAttachment.getByRole("combobox")).toHaveCount(2);
    await manualAttachment.getByRole("combobox").first().selectOption("lease");
    await expect(manualAttachment.getByRole("option", { name: /^Choose lease$/i })).toHaveCount(1);
    expect(secondRun.rendererErrors).toEqual([]);
  } finally {
    await firstRun?.electronApp.close().catch(() => {});
    await secondRun?.electronApp.close().catch(() => {});
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
      if (button === "Upload bill") await page.locator("details.rt-document-processing > summary").click();
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
    await page.getByRole("combobox", { name: "Planning horizon", exact: true }).selectOption("24");
    for (const name of ["Scenarios", "Insights", "Exit / refinance"]) {
      const tool = page.getByRole("group", { name: "Planning tools", exact: true }).getByRole("button", { name, exact: true });
      await tool.click();
      await expect(tool).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("combobox", { name: "Planning horizon", exact: true })).toHaveValue("24");
    }
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    for (const horizon of ["24", "36"]) {
      await page.getByRole("combobox", { name: "Planning horizon", exact: true }).selectOption(horizon);
      const averageText = await page.getByText("Planned monthly average", { exact: true }).locator("..").innerText();
      const average = Number(averageText.match(/-?\$[\d,]+\.\d{2}/)[0].replace(/[$,]/g, ""));
      await expect(page.getByText(new RegExp(`about ${Math.round(average)} per month`)).first()).toBeVisible();
    }
    await page.getByRole("combobox", { name: "Planning horizon", exact: true }).selectOption("24");
    for (const width of [1920, 1440, 1024, 720]) {
      await electronApp.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setContentSize(width, width === 1920 ? 1200 : 900), width);
      await page.setViewportSize({ width, height: width === 1920 ? 1200 : 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(rootDir, "output", "playwright", `planning-refresh-${width}.png`) });
    }
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

test("leases keep agreements focused and occupancy audits on demand", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-leases-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);
  try {
    await page.evaluate(async () => {
      const { backup } = await window.desktopPersistence.loadAppData();
      const base = backup.data.leases[0];
      const today = new Date();
      const dateAt = (offset) => new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + offset)).toISOString().slice(0, 10);
      backup.data.leases.push({ ...base, id: "example-upcoming", tenantName: "Example Upcoming Tenant", startDate: dateAt(30), endDate: dateAt(90), actualEndDate: "", extensions: [] });
      backup.data.leases.push({ ...base, id: "example-past", tenantName: "Example Past Tenant", startDate: dateAt(-120), endDate: dateAt(-60), actualEndDate: "", extensions: [] });
      for (let index = 0; index < 35; index += 1) backup.data.leases.push({ ...base, id: `example-archive-${index}`, tenantName: `Example Archive ${index}`, startDate: dateAt(-200), endDate: dateAt(-140), actualEndDate: "", extensions: [] });
      backup.settings.leaseAutomationEnabled = false;
      await window.desktopPersistence.saveAppData(backup);
    });
    await page.reload();
    await page.getByRole("button", { name: "Leases", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Leases", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Active \d/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: /^Coverage audit/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Example Upcoming Tenant", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: /^Upcoming \d/ }).click();
    await expect(page.getByRole("button", { name: "Example Upcoming Tenant", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^Past \d/ }).click();
    await expect(page.getByRole("button", { name: "Example Past Tenant", exact: true })).toBeVisible();
    await expect(page.locator("article.rt-lease-list-row")).toHaveCount(30);
    await page.getByRole("navigation", { name: "Leases pages", exact: true }).getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator("article.rt-lease-list-row")).toHaveCount(6);
    await page.getByRole("textbox", { name: "Search leases", exact: true }).fill("Example Past");
    await expect(page.locator("article.rt-lease-list-row")).toHaveCount(1);
    await page.getByRole("textbox", { name: "Search leases", exact: true }).fill("");
    await page.getByRole("button", { name: /^Active \d/ }).click();
    for (const width of [1440, 1280, 720]) {
      await electronApp.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setContentSize(width, 900), width);
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(rootDir, "output", "playwright", `leases-refresh-${width}.png`) });
    }
    await page.getByRole("button", { name: /^Open lease for / }).first().click();
    const leasePanel = page.getByRole("dialog");
    await expect(leasePanel.getByRole("region", { name: "Lease overview", exact: true })).toBeVisible();
    await expect(leasePanel.getByRole("button", { name: "Save lease", exact: true })).toHaveCount(0);
    await expect(leasePanel.getByLabel("Tenant", { exact: true })).toBeHidden();
    await page.screenshot({ path: path.join(rootDir, "output", "playwright", "lease-detail-overview-720.png") });
    await leasePanel.getByRole("button", { name: "Payments", exact: true }).click();
    await expect(leasePanel.getByRole("button", { name: "Add entry", exact: true })).toBeVisible();
    await leasePanel.getByPlaceholder("Memo", { exact: true }).fill("Example retained payment draft");
    await leasePanel.getByRole("button", { name: "Documents", exact: true }).click();
    await expect(leasePanel.getByRole("button", { name: "Add PDF", exact: true })).toBeVisible();
    await leasePanel.getByRole("button", { name: "History", exact: true }).click();
    await expect(leasePanel.getByRole("heading", { name: "Recorded extensions", exact: true })).toBeVisible();
    await leasePanel.getByRole("button", { name: "Payments", exact: true }).click();
    await expect(leasePanel.getByPlaceholder("Memo", { exact: true })).toHaveValue("Example retained payment draft");
    await leasePanel.getByRole("button", { name: "Edit agreement", exact: true }).click();
    await expect(page.getByText("Term and billing are tracked separately", { exact: true })).toBeVisible();
    await expect(page.getByText("Stay length", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Agreement", { exact: true })).toBeVisible();
    await expect(page.getByText("Billing schedule", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Extend lease", exact: true })).toBeVisible();
    await leasePanel.getByLabel("Tenant", { exact: true }).fill("Example unsaved agreement edit");
    await leasePanel.getByRole("button", { name: "Documents", exact: true }).click();
    await expect(leasePanel.getByRole("button", { name: "Save lease", exact: true })).toBeVisible();
    await leasePanel.getByRole("button", { name: "Overview", exact: true }).click();
    await expect(leasePanel.getByLabel("Tenant", { exact: true })).toHaveValue("Example unsaved agreement edit");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByRole("alertdialog", { name: "Discard unsaved changes?", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(leasePanel.getByLabel("Tenant", { exact: true })).toHaveValue("Example unsaved agreement edit");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Discard changes", exact: true }).click();
    await expect(page.getByRole("button", { name: "Example unsaved agreement edit", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Occupancy & coverage", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Occupancy & coverage", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Coverage audit/ })).toHaveCount(0);
    await page.getByRole("button", { name: /^Coverage for / }).first().click();
    await expect(page.getByRole("heading", { name: /^Coverage audit/ })).toBeVisible();
    await page.getByRole("button", { name: "Back to leases", exact: true }).click();
    await page.getByRole("button", { name: "Add lease", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Choose a unit for the new lease", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Add lease", exact: true }).click();
    await page.getByRole("dialog", { name: "Choose a unit for the new lease", exact: true }).getByRole("button").first().click();
    await expect(page.getByRole("dialog").getByLabel("Tenant", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save lease", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete lease", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Close", exact: true }).click();
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
    for (const width of [1920, 1440, 720]) {
      await page.setViewportSize({ width, height: width === 1920 ? 1200 : 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.getByRole("region", { name: "Selected task", exact: true })).toBeVisible();
      await page.screenshot({ path: path.join(rootDir, "output", "playwright", `work-queue-refresh-${width}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Open calendar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Operations Calendar", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Open Work Queue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Work Queue", exact: true })).toBeVisible();
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

    await expect(page.getByRole("combobox", { name: "Category", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Sort", exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "Search transactions", exact: true }).fill("Example Plumbing Co. sink repair");
    await page.getByRole("button", { name: "Example Plumbing Co. sink repair", exact: true }).click();
    const transactionDetail = page.getByRole("dialog", { name: "Example Plumbing Co. sink repair", exact: true });
    await expect(transactionDetail.getByRole("button", { name: "Overview", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(transactionDetail.getByText("Guided review", { exact: true })).toBeHidden();
    await transactionDetail.getByRole("button", { name: /^Review \(/ }).click();
    await expect(transactionDetail.getByText("Guided review", { exact: true })).toBeVisible();
    await transactionDetail.getByRole("button", { name: /^Files \(/ }).click();
    await expect(transactionDetail.getByRole("button", { name: "Attach receipt/PDF", exact: true })).toBeVisible();
    await transactionDetail.getByRole("button", { name: "Overview", exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(rootDir, "output", "playwright", "transactions-detail-1440.png") });
    await transactionDetail.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Clear filters", exact: true }).click();
    for (const width of [1920, 1440, 720]) {
      await page.setViewportSize({ width, height: width === 1920 ? 1200 : 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(rootDir, "output", "playwright", `transactions-activity-${width}.png`) });
    }
    await page.getByRole("button", { name: "Table", exact: true }).click();
    await expect(page.getByRole("table", { name: "Transactions table", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(rootDir, "output", "playwright", "transactions-table-1440.png") });

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

test("packaged mileage log saves trips separately and posts a linked monthly expense", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-mileage-"));
  let run = await launchDesktopApp(profilePath);
  try {
    await run.page.getByRole("button", { name: "Transactions", exact: true }).click();
    await run.page.getByRole("tab", { name: /Mileage log/ }).click();
    await run.page.getByLabel("Trip date").fill("2026-08-10");
    await run.page.getByLabel("Destination").fill("Hardware store");
    await run.page.getByLabel("Business purpose").fill("Buy rental supplies");
    await run.page.getByLabel("Business miles").fill("20");
    await run.page.getByLabel("Rate per mile").fill("0.725");
    await run.page.getByRole("button", { name: "Save trip", exact: true }).click();
    await expect(run.page.getByText("Hardware store · Buy rental supplies")).toBeVisible();
    await expect.poll(async () => run.page.evaluate(async () => {
      const data = (await window.desktopPersistence.loadAppData()).backup.data;
      return { trips: data.mileageEntries?.length || 0, postings: data.transactions.filter((transaction) => transaction.mileageEntryIds?.length).length };
    })).toEqual({ trips: 1, postings: 0 });
    await run.electronApp.close();
    run = await launchDesktopApp(profilePath);
    await run.page.getByRole("button", { name: "Transactions", exact: true }).click();
    await run.page.getByRole("tab", { name: /Mileage log/ }).click();
    await expect(run.page.getByText("Hardware store · Buy rental supplies")).toBeVisible();
    run.page.once("dialog", (dialog) => dialog.accept());
    await run.page.getByRole("button", { name: "Review and post month" }).click();
    await expect.poll(async () => run.page.evaluate(async () => {
      const data = (await window.desktopPersistence.loadAppData()).backup.data;
      return data.transactions.find((transaction) => transaction.mileageEntryIds?.length)?.amount;
    })).toBe(14.5);
    run.page.once("dialog", (dialog) => dialog.accept());
    await run.page.getByRole("button", { name: "Undo posting" }).click();
    await expect(run.page.getByText("1 unposted")).toBeVisible();
    expect(run.rendererErrors).toEqual([]);
  } finally {
    await run?.electronApp.close().catch(() => {});
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});

test("packaged desktop gives each Properties mode one clear job", async () => {
  const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), "rental-tracker-e2e-properties-"));
  const { electronApp, page, rendererErrors } = await launchDesktopApp(profilePath);

  try {
    const propertyId = await page.evaluate(async () => {
      const { backup } = await window.desktopPersistence.loadAppData();
      const property = backup.data.properties[0];
      backup.data.properties.push({ ...property, id: "example-cottage-property", name: "Example Cottage", photos: [], propertyValuations: [], operationNotes: [] });
      backup.data.units.push({ id: "example-studio-unit", propertyId: property.id, name: "Example Studio", status: "Vacant" });
      backup.data.workOrders.push({ id: "example-studio-work", propertyId: property.id, unit: "Example Studio", title: "Example studio repair", status: "Open", priority: "High", reportedOn: "2026-10-03" });
      const result = await window.desktopPersistence.saveAppData(backup);
      if (result.ok === false) throw new Error(result.message);
      return property.id;
    });
    await page.reload();
    await page.getByRole("button", { name: "Properties", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Properties", exact: true })).toBeVisible();

    const overviewTab = page.getByRole("tab", { name: /Overview/ });
    const unitsTab = page.getByRole("tab", { name: /Units & occupancy/ });
    const recordsTab = page.getByRole("tab", { name: /Property records/ });
    const photosTab = page.getByRole("tab", { name: /Photos/ });
    await expect(overviewTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Property readiness", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1920, height: 1200 });
    await page.getByRole("button", { name: /Example Cottage.*Occupancy/ }).click();
    await expect(page.getByRole("heading", { name: "Example Cottage", exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Property", exact: true }).selectOption(propertyId);
    await expect(page.getByText("Unit snapshot", { exact: true })).toBeVisible();
    for (const [width, height] of [[1920, 1200], [1440, 900], [1024, 900], [720, 900]]) {
      await page.setViewportSize({ width, height });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(rootDir, "output", "playwright", `properties-refresh-${width}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const unitButton = page.getByRole("button", { name: /^Unit Example Studio/ });
    await unitButton.click();
    const unitPanel = page.getByRole("dialog");
    await expect(unitPanel.getByRole("heading", { name: "Unit Example Studio", exact: true })).toBeVisible();
    await expect(unitPanel.getByRole("heading", { name: "Current agreement", exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(rootDir, "output", "playwright", "unit-overview-refresh.png") });
    await unitPanel.getByRole("button", { name: "Occupancy history", exact: true }).click();
    await expect(unitPanel.getByText("Lease & occupancy", { exact: true })).toBeVisible();
    await unitPanel.getByRole("button", { name: "Files & work", exact: true }).click();
    await expect(unitPanel.getByRole("button", { name: "Example studio repair", exact: true })).toBeVisible();
    await page.setViewportSize({ width: 720, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(rootDir, "output", "playwright", "unit-records-refresh-720.png") });
    await unitPanel.getByTitle("Close unit details").click();
    await expect(unitButton).toBeFocused();
    await page.setViewportSize({ width: 1440, height: 900 });
    await unitButton.click();
    await unitPanel.getByRole("button", { name: "Files & work", exact: true }).click();
    await unitPanel.getByRole("button", { name: "Example studio repair", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Maintenance", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Property", exact: true })).toHaveValue(propertyId);
    await expect(page.getByRole("combobox", { name: "Unit", exact: true })).toHaveValue("Example Studio");
    await expect(page.locator("#workspace-focus-work-order-example-studio-work")).toBeVisible();
    await page.getByRole("button", { name: "Properties", exact: true }).click();

    await unitsTab.click();
    await expect(page.getByText("Current status, active agreements, and occupancy history for each unit.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open lease workspace", exact: true })).toBeVisible();
    const unitRow = page.getByRole("button", { name: "Unit Example Studio", exact: true });
    await unitRow.click();
    await expect(unitPanel.getByRole("heading", { name: "Unit Example Studio", exact: true })).toBeVisible();
    await unitPanel.getByTitle("Close unit details").click();
    await expect(unitRow).toBeFocused();

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
    await page.evaluate(async () => {
      const { backup } = await window.desktopPersistence.loadAppData();
      backup.data.workOrders.push({ id: "example-panel-work", propertyId: backup.data.properties[0].id, unit: "Shared", title: "Example panel maintenance", description: "Fictional panel test", status: "Open", priority: "Low", reportedOn: "2026-10-03", createdAt: "2026-10-03T12:00:00.000Z" });
      const result = await window.desktopPersistence.saveAppData(backup);
      if (result.ok === false) throw new Error(result.message);
    });
    await page.reload();
    await page.getByRole("button", { name: "Maintenance", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Maintenance", exact: true })).toBeVisible();

    const activeTab = page.getByRole("tab", { name: /Active work/ });
    const historyTab = page.getByRole("tab", { name: /History & costs/ });
    const cleanupTab = page.getByRole("tab", { name: /Cleanup & accounting/ });
    const vendorsTab = page.getByRole("tab", { name: /Vendors/ });
    await expect(activeTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Active work orders", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "New Work Order", exact: true })).toBeVisible();
    const maintenanceRow = page.locator("#workspace-focus-work-order-example-panel-work");
    const recordButton = maintenanceRow.getByRole("button", { name: "Open record", exact: true });
    for (const [width, height] of [[1920, 1200], [1440, 900], [1024, 900], [720, 900]]) {
      await page.setViewportSize({ width, height });
      await expect(maintenanceRow).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(rootDir, "output", "playwright", `maintenance-refresh-${width}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("textbox", { name: "Search work orders" }).fill("no matching maintenance example");
    await expect(page.getByText("No matching work orders.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    await recordButton.click();
    const recordPanel = page.getByRole("dialog");
    await expect(recordPanel.getByRole("button", { name: "Edit details", exact: true })).toBeVisible();
    await recordPanel.getByRole("button", { name: "Edit details", exact: true }).click();
    await recordPanel.getByRole("button", { name: "Start", exact: true }).click();
    await expect(recordPanel.getByRole("combobox", { name: "Work order status" })).toHaveValue("In Progress");
    await recordPanel.getByRole("spinbutton", { name: "Work order actual cost" }).fill("87");
    await expect.poll(async () => page.evaluate(async () => {
      const result = await window.desktopPersistence.loadAppData();
      const order = result.backup.data.workOrders.find((record) => record.id === "example-panel-work");
      return [order.status, order.actualCost];
    })).toEqual(["In Progress", 87]);
    await page.screenshot({ path: path.join(rootDir, "output", "playwright", "maintenance-update-refresh.png") });
    await page.setViewportSize({ width: 720, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(rootDir, "output", "playwright", "maintenance-update-refresh-720.png") });
    await page.setViewportSize({ width: 1440, height: 900 });
    await recordPanel.getByRole("button", { name: /^Files \(/ }).click();
    await expect(recordPanel.getByRole("button", { name: "Attach file", exact: true })).toBeVisible();
    await recordPanel.getByRole("button", { name: "Close", exact: true }).click();
    await expect(recordButton).toBeFocused();
    await page.getByRole("combobox", { name: "Work order filter" }).selectOption("in_progress");
    await expect(maintenanceRow).toContainText("In Progress");

    await historyTab.click();
    await expect(page.getByText("Maintenance history", { exact: true })).toBeVisible();
    await expect(page.getByText("Maintenance cost roll-up", { exact: true })).toBeVisible();

    await cleanupTab.click();
    await expect(page.getByText("Work orders needing cleanup", { exact: true })).toBeVisible();
    await expect(page.getByText("Cleanup status", { exact: true })).toBeVisible();

    await vendorsTab.click();
    await expect(page.getByText("Vendor Directory", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Vendor", exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Maintenance", exact: true }).click();
    await activeTab.click();
    await expect(maintenanceRow).toContainText("In Progress");
    await expect(maintenanceRow).toContainText("$87.00");
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
    for (const width of [1920, 1440, 1024, 720]) {
      await electronApp.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setContentSize(width, width === 1920 ? 1200 : 900), width);
      await page.setViewportSize({ width, height: width === 1920 ? 1200 : 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(rootDir, "output", "playwright", `loans-refresh-${width}.png`) });
    }
    await overviewTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(paymentsTab).toHaveAttribute("aria-selected", "true");
    await expect(paymentsTab).toBeFocused();

    await paymentsTab.click();
    await expect(page.getByRole("heading", { name: "Payment management", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Record payment", exact: true }).first()).toBeVisible();
    const historyButton = page.getByRole("button", { name: "View history", exact: true }).first();
    await historyButton.click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Payment history", exact: true })).toBeVisible();
    expect(await page.getByRole("dialog").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: path.join(rootDir, "output", "playwright", "loan-history-720.png") });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(historyButton).toBeFocused();
    await historyButton.click();
    await page.getByRole("dialog").getByRole("button", { name: /^Show older payments/ }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: /^Show older payments/ })).toHaveCount(0);
    const originalPayment = await page.evaluate(async () => {
      const { backup } = await window.desktopPersistence.loadAppData();
      return { id: backup.data.loanPayments.find((payment) => payment.paymentDate === "2026-10-01").id, count: backup.data.loanPayments.length };
    });
    await page.getByRole("dialog").getByRole("button", { name: "Edit", exact: true }).first().click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Edit loan payment", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Payment date", exact: true })).toHaveValue("2026-10-01");
    await expect(page.getByRole("spinbutton", { name: "Interest", exact: true })).toHaveValue("853");
    await page.getByRole("spinbutton", { name: "Interest", exact: true }).fill("854");
    await page.getByRole("button", { name: "Save payment changes", exact: true }).click();
    await expect.poll(async () => page.evaluate(async (id) => {
      const { backup } = await window.desktopPersistence.loadAppData();
      return { count: backup.data.loanPayments.length, interest: Number(backup.data.loanPayments.find((payment) => payment.id === id)?.interest) };
    }, originalPayment.id)).toEqual({ count: originalPayment.count, interest: 854 });
    await expect(page.getByText("Edit loan payment", { exact: true })).toHaveCount(0);

    await taxTab.click();
    await expect(page.getByText("Loan review status", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Loan tax and escrow review", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Work Queue", exact: true })).toBeVisible();

    await detailsTab.click();
    await expect(page.getByRole("heading", { name: "Loan records and schedules", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit loan", exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "View schedule", exact: true }).first().click();
    const loanPanel = page.getByRole("dialog");
    await loanPanel.getByRole("button", { name: "Show next 12 payments", exact: true }).click();
    await expect(loanPanel.getByRole("columnheader", { name: "End balance", exact: true })).toBeVisible();
    await loanPanel.getByRole("button", { name: "Edit loan", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(2);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(loanPanel.getByRole("button", { name: "Edit loan", exact: true })).toBeFocused();
    await loanPanel.getByRole("button", { name: "Close loan details", exact: true }).click();
    await overviewTab.click();
    await page.getByRole("button", { name: "Manage loan", exact: true }).first().click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(detailsTab).toBeFocused();
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
    for (const width of [1920, 1440, 1024, 720]) {
      await electronApp.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setContentSize(width, width === 1920 ? 1200 : 900), width);
      await page.setViewportSize({ width, height: width === 1920 ? 1200 : 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(rootDir, "output", "playwright", `tax-center-refresh-${width}.png`) });
    }

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
    await run.page.getByRole("button", { name: /^All \d/ }).click();
    await run.page.getByRole("button", { name: "Extension Test Tenant", exact: true }).click();
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
    await expect(page.getByRole("dialog", { name: "Monthly utility bill", exact: true }).getByRole("button", { name: /^Review \(/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Guided review", { exact: true })).toBeVisible();
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
