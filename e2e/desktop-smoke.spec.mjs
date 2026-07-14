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
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Property" })).toContainText("Sample Duplex");

    await page.getByRole("button", { name: "Documents", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
    await expect(page.getByText("4 files", { exact: true })).toBeVisible();

    const search = page.getByRole("textbox", { name: /Search files, tags, extracted text/i });
    await search.fill("plumbing");
    await expect(page.getByText("Example Plumbing receipt", { exact: true })).toBeVisible();
    await expect(page.getByText("Example Hardware roof receipt", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Review details", exact: true }).click();
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
    await secondRun.page.getByRole("button", { name: "All Files (4)", exact: true }).click();
    await expect(secondRun.page.getByText("Example Plumbing receipt", { exact: true })).toBeVisible();
    expect(secondRun.rendererErrors).toEqual([]);
  } finally {
    await firstRun?.electronApp.close().catch(() => {});
    await secondRun?.electronApp.close().catch(() => {});
    fs.rmSync(profilePath, { recursive: true, force: true });
  }
});
