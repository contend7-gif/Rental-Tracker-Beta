import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { _electron as electron, expect } from "@playwright/test";
import { makeTextPdf } from "./fixtures/pdfFixture.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const executablePath = process.env.RENTAL_TRACKER_E2E_EXECUTABLE || path.join(root, "release", "win-unpacked", "Rental Tracker.exe");
const outputPath = path.resolve(process.argv[2] || path.join(root, "output", "playwright", "desktop-benchmark.json"));
const sampleCount = Number(process.env.RENTAL_TRACKER_BENCH_SAMPLES || 5);
const viewport = { width: 1920, height: 1200 };
if (!Number.isInteger(sampleCount) || sampleCount < 3 || sampleCount > 20) throw new Error("Use 3–20 benchmark samples.");
if (process.env.RENTAL_TRACKER_BENCH_SIZE && !["small", "medium", "large"].includes(process.env.RENTAL_TRACKER_BENCH_SIZE)) throw new Error("Use small, medium, or large as the benchmark size.");
await fs.access(executablePath);
const paint = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const measure = async (page, action) => {
  const start = performance.now();
  await action();
  await paint(page);
  return Number((performance.now() - start).toFixed(1));
};
async function launch(profilePath) {
  return electron.launch({ executablePath, args: ["--disable-gpu"], timeout: 60_000, env: { ...process.env, RENTAL_TRACKER_E2E: "1", RENTAL_TRACKER_E2E_USER_DATA_PATH: profilePath, ELECTRON_DISABLE_SECURITY_WARNINGS: "true" } });
}
async function prepareWindow(app) {
  const page = await app.firstWindow();
  // Keep both comparison packages at the same size even on smaller CI displays.
  await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height), viewport);
  await page.setViewportSize(viewport);
  return page;
}
async function dismissReleaseNotes(page) {
  const heading = page.getByRole("heading", { name: /What's new in/i });
  await heading.waitFor({ state: "visible", timeout: 2_000 }).catch(() => {});
  if (await heading.isVisible()) await page.getByRole("button", { name: "Close", exact: true }).last().click();
}
async function seed(profilePath, counts) {
  const app = await launch(profilePath);
  try {
    const page = await prepareWindow(app);
    const appVersion = await app.evaluate(({ app }) => app.getVersion());
    await page.getByRole("button", { name: "Transactions", exact: true }).waitFor();
    await page.waitForFunction(() => Boolean(window.desktopPersistence));
    await page.evaluate(async ({ counts, pdf, year }) => {
      const { backup } = await window.desktopPersistence.loadAppData();
      if (!backup?.data?.properties?.length) throw new Error("Missing fictional seed profile.");
      const propertyId = backup.data.properties[0].id;
      backup.data.properties[0].name = "Example performance property";
      backup.data.transactions = Array.from({ length: counts.transactions }, (_, index) => ({
        id: `bench-txn-${index}`, propertyId, unit: "Shared", date: `${year}-08-15`, status: "active", type: "Expense", category: "Repairs", amount: 20 + index,
        description: index === 0 ? "Example benchmark target transaction" : `Example expense ${index}`, vendor: "Example vendor", receiptName: "example-invoice.pdf", taxChecked: true, reconciled: true,
      }));
      backup.data.documents = Array.from({ length: counts.documents }, (_, index) => ({
        id: `bench-doc-${index}`, propertyId, unit: "Shared", name: index === 0 ? "Example benchmark target document.pdf" : `Example supporting document ${index}.pdf`,
        type: "Receipt", tags: ["supporting-only"], uploadedAt: `${year}-08-15T12:00:00.000Z`, transactionId: index === 0 ? "bench-txn-0" : "",
        extractedText: "Example fictional supporting text. ".repeat(40), ...(index === 0 ? { dataUrl: pdf } : {}),
      }));
      backup.data.activityLog = Array.from({ length: counts.activity }, (_, index) => ({ id: `bench-audit-${index}`, at: `${year}-08-15T12:00:00.000Z`, action: "update", entityType: "transaction", entityId: `bench-txn-${index % counts.transactions}`, summary: "Example record updated", immutable: true }));
      backup.settings.leaseAutomationEnabled = false;
      const saved = await window.desktopPersistence.saveAppData(backup);
      if (saved?.ok === false) throw new Error(saved.message);
    }, { counts, year: new Date().getFullYear(), pdf: `data:application/pdf;base64,${makeTextPdf([[{ text: "Example fictional benchmark invoice" }]]).toString("base64")}` });
    return appVersion;
  } finally { await app.close(); }
}
async function sample(profilePath) {
  const start = performance.now();
  const app = await launch(profilePath);
  try {
    const page = await prepareWindow(app);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await expect(page.getByRole("option", { name: "Example performance property", exact: true })).toHaveCount(1, { timeout: 60_000 });
    await page.getByRole("button", { name: "Transactions", exact: true }).waitFor();
    await paint(page);
    const result = { startupHydratedMs: Number((performance.now() - start).toFixed(1)) };
    await dismissReleaseNotes(page);
    const pager = page.getByRole("navigation", { name: "Transactions pages" });
    await page.getByRole("button", { name: "Transactions", exact: true }).evaluate((button) => {
      window.__benchTransactionFirstPaintMs = null;
      button.addEventListener("click", () => {
        const startedAt = performance.now();
        const observeReady = () => {
          const element = document.querySelector('[aria-label="Transactions pages"]');
          if (element?.textContent.includes("1–50") && element.getBoundingClientRect().height > 0) {
            requestAnimationFrame(() => { window.__benchTransactionFirstPaintMs = performance.now() - startedAt; });
          } else if (performance.now() - startedAt < 60_000) requestAnimationFrame(observeReady);
        };
        requestAnimationFrame(observeReady);
      }, { once: true, capture: true });
    });
    result.transactionsFirstOpenMs = await measure(page, async () => {
      await page.getByRole("button", { name: "Transactions", exact: true }).click();
      await expect(pager).toContainText("1–50");
    });
    await page.waitForFunction(() => Number.isFinite(window.__benchTransactionFirstPaintMs));
    result.transactionsFirstPaintMs = Number((await page.evaluate(() => window.__benchTransactionFirstPaintMs)).toFixed(1));
    result.transactionsNextPageMs = await measure(page, async () => {
      await pager.getByRole("button", { name: "Next", exact: true }).click();
      await expect(pager).toContainText("51–100");
    });
    const search = page.getByRole("combobox", { name: "Search all records and actions" });
    result.searchOpenMs = await measure(page, async () => {
      await page.keyboard.press("Control+k");
      await expect(search).toBeFocused();
    });
    result.searchQueryMs = await measure(page, async () => {
      await search.fill("benchmark target transaction");
      await expect(page.getByRole("listbox", { name: "Search results" }).getByRole("option")).toHaveCount(1);
      await expect(page.getByRole("listbox", { name: "Search results" })).toHaveAttribute("aria-busy", "false");
    });
    result.transactionPanelWithFileMs = await measure(page, async () => {
      await search.press("Enter");
      await expect(page.getByRole("dialog", { name: "Example benchmark target transaction", exact: true })).toBeVisible();
      await expect(page.getByText("Preview available", { exact: true })).toBeVisible();
      await expect(page.locator('iframe[title="Preview of Example benchmark target document.pdf"]')).toBeVisible();
    });
    await page.keyboard.press("Escape");
    result.documentsFirstOpenMs = await measure(page, async () => {
      await page.getByRole("button", { name: "Documents", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Upload document", exact: true })).toBeVisible();
    });
    await page.keyboard.press("Control+k");
    await search.fill("benchmark target document");
    await expect(page.getByRole("listbox", { name: "Search results" }).getByRole("option")).toHaveCount(1);
    const profiler = process.env.RENTAL_TRACKER_BENCH_PROFILE === "1" ? await page.context().newCDPSession(page) : null;
    if (profiler) { await profiler.send("Profiler.enable"); await profiler.send("Profiler.start"); }
    result.documentPanelWithFileMs = await measure(page, async () => {
      await search.press("Enter");
      await expect(page.getByRole("dialog", { name: "Example benchmark target document.pdf", exact: true })).toBeVisible();
      await expect(page.getByText("Preview available", { exact: true })).toBeVisible();
      await expect(page.locator('iframe[title="Preview of Example benchmark target document.pdf"]')).toBeVisible();
    });
    if (profiler) {
      const { profile } = await profiler.send("Profiler.stop");
      await fs.writeFile(path.join(root, "output", "playwright", "document-review.cpuprofile"), JSON.stringify(profile));
      await profiler.detach();
    }
    await page.keyboard.press("Escape");
    result.transactionsReturnMs = await measure(page, async () => {
      await page.getByRole("button", { name: "Transactions", exact: true }).click();
      await expect(pager).toBeVisible();
    });
    // Open and edit outside the timed save, then verify the stored value via the
    // desktop bridge. This includes the UI save queue and verification-read cost.
    await page.keyboard.press("Control+k");
    await search.fill("benchmark target transaction");
    await expect(page.getByRole("listbox", { name: "Search results" }).getByRole("option")).toHaveCount(1);
    await search.press("Enter");
    await page.getByRole("dialog", { name: "Example benchmark target transaction", exact: true }).getByRole("button", { name: "Edit", exact: true }).click();
    const amountField = page.getByLabel("Amount", { exact: true });
    await expect(page.getByLabel("Description / memo", { exact: true })).toHaveValue("Example benchmark target transaction");
    const newAmount = Number(await amountField.inputValue()) + 1;
    await amountField.fill(String(newAmount));
    result.transactionSaveToDiskMs = await measure(page, async () => {
      await page.getByRole("button", { name: "Save transaction", exact: true }).click();
      await expect.poll(async () => page.evaluate(async () => {
        const { backup } = await window.desktopPersistence.loadAppData();
        return Number(backup.data.transactions.find((item) => item.id === "bench-txn-0")?.amount);
      }), { timeout: 60_000, intervals: [50] }).toBe(newAmount);
    });
    if (errors.length) throw new Error(errors.join("\n"));
    return result;
  } finally { await app.close(); }
}
const report = {
  complete: false,
  measuredAt: new Date().toISOString(), appVersion: null,
  packageSha256: createHash("sha256").update(await fs.readFile(path.join(path.dirname(executablePath), "resources", "app.asar"))).digest("hex"),
  runnerSha256: createHash("sha256").update(await fs.readFile(fileURLToPath(import.meta.url))).digest("hex"),
  environment: { platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model, samples: sampleCount, gpuDisabled: true, viewport },
  methodology: "Sequential fresh-process launches, one excluded warm-up per size, same seeded profile reused. Version comes from the packaged Electron runtime. OS disk cache is warm. Timings include fixed window setup, Playwright action/observation overhead and two animation frames; startup ends at hydrated property controls. Transactions first-paint is separately measured inside the renderer from the actual click to a painted visible pager, excluding automation observation delay. Panel readiness means loaded file bytes and visible iframe, not completed PDF rendering. Save-to-disk includes UI submission, the save queue, IPC, and repeated snapshot verification reads; it is not raw SQLite write latency. No universal speed thresholds.",
  results: [],
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
for (const [name, transactions, activity, documents] of [["small", 200, 400, 20], ["medium", 2000, 5000, 100], ["large", 10000, 20000, 500]]) {
  if (process.env.RENTAL_TRACKER_BENCH_SIZE && process.env.RENTAL_TRACKER_BENCH_SIZE !== name) continue;
  const profilePath = await fs.mkdtemp(path.join(os.tmpdir(), "rental-tracker-desktop-bench-"));
  try {
    const counts = { transactions, activity, documents };
    const packagedVersion = await seed(profilePath, counts);
    if (report.appVersion && report.appVersion !== packagedVersion) throw new Error("Mixed package versions in one benchmark");
    report.appVersion = packagedVersion;
    await sample(profilePath);
    const samples = [];
    for (let index = 0; index < sampleCount; index++) {
      samples.push(await sample(profilePath));
      console.log(`${name}: ${index + 1}/${sampleCount} samples complete`);
    }
    const metrics = Object.fromEntries(Object.keys(samples[0]).map((key) => {
      const values = samples.map((item) => item[key]).sort((a, b) => a - b);
      return [key, { medianMs: values[Math.floor(values.length / 2)], minMs: values[0], maxMs: values.at(-1) }];
    }));
    report.results.push({ name, counts, metrics, samples });
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
  } finally {
    const resolved = path.resolve(profilePath);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("rental-tracker-desktop-bench-")) throw new Error("Unexpected benchmark cleanup path");
    await fs.rm(resolved, { recursive: true, force: true });
  }
}
report.complete = true;
await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.results.map(({ name, metrics }) => ({ name, metrics })), null, 2));
console.log(`Report: ${outputPath}`);
