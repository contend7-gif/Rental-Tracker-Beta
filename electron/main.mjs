import { app, BrowserWindow, dialog, ipcMain, Notification, shell } from "electron";
import electronUpdater from "electron-updater";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerDocumentAiIpc } from "./documentAi.mjs";
import { registerDocumentOcrIpc } from "./documentOcr.mjs";
import { getRentalTrackerDataPaths } from "./fileStore.mjs";
import { registerPersistenceIpc, registerSecretsIpc } from "./persistenceIpc.mjs";

const { autoUpdater } = electronUpdater;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isEndToEndTest = process.env.RENTAL_TRACKER_E2E === "1";
const endToEndUserDataPath = String(process.env.RENTAL_TRACKER_E2E_USER_DATA_PATH || "").trim();
if (isEndToEndTest && endToEndUserDataPath) {
  app.setPath("userData", path.resolve(endToEndUserDataPath));
}
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const UPDATE_STATUS_CHANNEL = "app-update:status";
const UPDATE_GET_STATE_CHANNEL = "app-update:get-state";
const UPDATE_CHECK_CHANNEL = "app-update:check";
const UPDATE_INSTALL_CHANNEL = "app-update:install";
const NOTIFICATION_SEND_CHANNEL = "app-notify:send";
const NOTIFICATION_SUPPORTED_CHANNEL = "app-notify:supported";
const DOCUMENT_OPEN_EXTERNAL_CHANNEL = "document-open:external";
const STATEMENT_PDF_SAVE_CHANNEL = "statement-pdf:save";
const DESKTOP_DIAGNOSTICS_RUN_CHANNEL = "desktop-diagnostics:run";
const DOCUMENT_OPEN_TEMP_DIR = path.join(os.tmpdir(), "rental-tracker-open");
const MAX_DESKTOP_HEALTH_EVENTS = 20;

let mainWindow = null;
let updateCheckTimer = null;
let updateIpcRegistered = false;
let desktopHealthEvents = [];
let persistenceServicePromise = null;
let secretStore = null;
let updateState = {
  status: "idle",
  message: "Waiting to check for updates.",
  currentVersion: app.getVersion(),
  availableVersion: "",
  downloadedVersion: "",
  progressPercent: 0,
  checkedAt: "",
  releaseDate: "",
  releaseName: "",
  releaseNotesUrl: "",
  releaseNotes: [],
  error: "",
  packaged: app.isPackaged,
};

function nowIso() {
  return new Date().toISOString();
}

function recordDesktopHealthEvent(level, message, detail = "") {
  const entry = {
    at: nowIso(),
    level: level === "error" ? "error" : level === "warn" ? "warn" : "info",
    message: String(message || "").trim() || "Desktop event",
    detail: String(detail || "").trim(),
  };
  desktopHealthEvents = [entry, ...desktopHealthEvents].slice(0, MAX_DESKTOP_HEALTH_EVENTS);
  return entry;
}

function parseDocumentDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)?;base64,(.+)$/s);
  if (!match) {
    throw new Error("Document open expects a base64 data URL.");
  }

  return {
    mimeType: String(match[1] || "application/octet-stream").toLowerCase(),
    buffer: Buffer.from(match[2], "base64"),
  };
}

function documentExtensionForMimeType(mimeType, fileName = "") {
  const explicitExtension = path.extname(String(fileName || "")).toLowerCase();
  if (explicitExtension) return explicitExtension;

  const mimeExtensionMap = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
    "image/gif": ".gif",
    "image/tif": ".tif",
    "image/tiff": ".tiff",
    "text/plain": ".txt",
  };

  return mimeExtensionMap[String(mimeType || "").trim().toLowerCase()] || ".bin";
}

function sanitizeDocumentFileStem(fileName = "document") {
  const stem = path.basename(String(fileName || "document"), path.extname(String(fileName || "document")));
  const cleaned = stem.replace(/[^a-z0-9._-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned || "document";
}

async function ensureDocumentOpenTempDir() {
  await fs.mkdir(DOCUMENT_OPEN_TEMP_DIR, { recursive: true });
  return DOCUMENT_OPEN_TEMP_DIR;
}

async function openDocumentExternally(payload) {
  const parsed = parseDocumentDataUrl(payload?.dataUrl);
  const mimeType = String(payload?.mimeType || parsed.mimeType || "application/octet-stream").toLowerCase();
  const extension = documentExtensionForMimeType(mimeType, payload?.name);
  const fileName = `${sanitizeDocumentFileStem(payload?.name)}-${randomUUID()}${extension}`;
  const filePath = path.join(await ensureDocumentOpenTempDir(), fileName);
  await fs.writeFile(filePath, parsed.buffer);
  const shellResult = await shell.openPath(filePath);
  if (shellResult) {
    throw new Error(shellResult);
  }
  return { ok: true, filePath };
}

function renderDesktopFailureHtml(title, message, detail = "") {
  const safeTitle = String(title || "Desktop problem").replace(/[<>&]/g, "");
  const safeMessage = String(message || "The window could not load normally.").replace(/[<>&]/g, "");
  const safeDetail = String(detail || "").replace(/[<>&]/g, "");
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>
      body { font-family: "Segoe UI", Arial, sans-serif; margin: 0; background: #f8fafc; color: #172033; }
      .wrap { max-width: 720px; margin: 48px auto; padding: 0 20px; }
      .card { background: #ffffff; border: 1px solid #dbe4f0; border-radius: 18px; padding: 28px; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08); }
      h1 { margin: 0 0 12px; font-size: 28px; }
      p { margin: 10px 0; line-height: 1.6; }
      .detail { margin-top: 16px; padding: 14px; border-radius: 12px; background: #f8fafc; border: 1px solid #e5edf7; color: #425066; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>${safeTitle}</h1>
        <p>${safeMessage}</p>
        ${safeDetail ? `<div class="detail">${safeDetail}</div>` : ""}
        <p>Try reopening the app. If this keeps happening, install the newest update and run the Desktop diagnostics check in Settings.</p>
      </div>
    </div>
  </body>
</html>`;
}

function extractReleaseNotesUrl(releaseNotes) {
  if (typeof releaseNotes === "string") {
    const match = releaseNotes.match(/https?:\/\/\S+/i);
    return match ? match[0].replace(/[)\].,;]+$/, "") : "";
  }

  if (Array.isArray(releaseNotes)) {
    for (const note of releaseNotes) {
      if (!note || typeof note.note !== "string") continue;
      const match = note.note.match(/https?:\/\/\S+/i);
      if (match) return match[0].replace(/[)\].,;]+$/, "");
    }
  }

  return "";
}

function stripReleaseNotesHtml(text) {
  return String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeReleaseNotes(releaseNotes) {
  if (typeof releaseNotes === "string") {
    return stripReleaseNotesHtml(releaseNotes)
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
  }

  if (Array.isArray(releaseNotes)) {
    return releaseNotes
      .flatMap((note) => {
        const noteText = stripReleaseNotesHtml(typeof note?.note === "string" ? note.note : "");
        return noteText
          .split(/\r?\n/)
          .map((line) => line.replace(/^[-*]\s*/, "").trim())
          .filter(Boolean);
      })
      .filter(Boolean);
  }

  return [];
}

function getErrorMessage(error) {
  if (!error) return "Unknown updater error.";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || "Unknown updater error.";
  if (typeof error.message === "string") return error.message;
  return String(error);
}

function getFriendlyUpdaterError(error) {
  const raw = getErrorMessage(error);
  const normalized = raw.toLowerCase();
  const isMissingFeed = normalized.includes("releases.atom") && normalized.includes("404");

  if (isMissingFeed) {
    return {
      message: "No published GitHub release feed found.",
      detail: "Publish a GitHub Release with latest.yml + installer assets, or make the repo public for anonymous update checks.",
    };
  }

  return {
    message: "Update check failed.",
    detail: raw,
  };
}

function pushUpdateState(partialState) {
  updateState = {
    ...updateState,
    ...partialState,
    currentVersion: app.getVersion(),
    packaged: app.isPackaged,
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(UPDATE_STATUS_CHANNEL, updateState);
  }
}

async function checkForUpdates(source = "auto") {
  if (!app.isPackaged) {
    pushUpdateState({
      status: "unavailable",
      message: "Updates are available in installed desktop builds.",
      checkedAt: nowIso(),
      progressPercent: 0,
      error: "",
    });
    return { ok: false, reason: "not-packaged", source };
  }

  try {
    await autoUpdater.checkForUpdates();
    return { ok: true, source };
  } catch (error) {
    const friendly = getFriendlyUpdaterError(error);
    pushUpdateState({
      status: "error",
      message: friendly.message,
      error: friendly.detail,
      checkedAt: nowIso(),
    });
    return { ok: false, reason: "error", error: friendly.detail, source };
  }
}

function registerUpdateIpc() {
  if (updateIpcRegistered) return;
  updateIpcRegistered = true;

  ipcMain.handle(UPDATE_GET_STATE_CHANNEL, () => updateState);
  ipcMain.handle(UPDATE_CHECK_CHANNEL, () => checkForUpdates("manual"));
  ipcMain.handle(UPDATE_INSTALL_CHANNEL, () => {
    if (!app.isPackaged) {
      return { ok: false, reason: "not-packaged" };
    }
    if (updateState.status !== "downloaded") {
      return { ok: false, reason: "not-ready" };
    }
    autoUpdater.quitAndInstall();
    return { ok: true };
  });
}

function registerNotificationIpc() {
  ipcMain.handle(NOTIFICATION_SUPPORTED_CHANNEL, () => Notification.isSupported());

  ipcMain.handle(NOTIFICATION_SEND_CHANNEL, (_event, rawPayload) => {
    if (!Notification.isSupported()) {
      return { ok: false, reason: "unsupported" };
    }

    const payload = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
    const title = String(payload.title || "Rental Tracker").trim() || "Rental Tracker";
    const body = String(payload.body || "").trim();

    const notification = new Notification({
      title,
      body,
      silent: Boolean(payload.silent),
    });

    notification.show();
    return { ok: true };
  });
}

async function readPackageBuildConfig() {
  try {
    const packageJsonText = await fs.readFile(path.resolve(__dirname, "..", "package.json"), "utf8");
    const parsed = JSON.parse(packageJsonText);
    return parsed?.build || {};
  } catch {
    return {};
  }
}

async function getUpdaterConfigStatus() {
  const runtimeConfigPath = autoUpdater?.app?.appUpdateConfigPath;
  if (typeof runtimeConfigPath === "string" && runtimeConfigPath.trim()) {
    try {
      await fs.access(runtimeConfigPath);
      return {
        configured: true,
        source: "runtime",
        path: runtimeConfigPath,
      };
    } catch {
      return {
        configured: false,
        source: "runtime",
        path: runtimeConfigPath,
      };
    }
  }

  const buildConfig = await readPackageBuildConfig();
  const publishConfig = Array.isArray(buildConfig.publish) ? buildConfig.publish : [];
  const hasGithubPublish = publishConfig.some((entry) => entry && typeof entry === "object" && entry.provider === "github");
  return {
    configured: hasGithubPublish,
    source: "package-json",
    path: "",
  };
}

function registerDesktopDiagnosticsIpc() {
  ipcMain.handle(DESKTOP_DIAGNOSTICS_RUN_CHANNEL, async () => {
    const updaterConfig = await getUpdaterConfigStatus();
    let persistenceHealth = { persistenceAvailable: false };
    try {
      if (persistenceServicePromise) {
        const persistenceService = await persistenceServicePromise;
        persistenceHealth = await persistenceService.getHealth();
      }
    } catch (error) {
      persistenceHealth = {
        persistenceAvailable: false,
        persistenceError: getErrorMessage(error),
      };
    }

    return {
      ok: true,
      checkedAt: nowIso(),
      packaged: app.isPackaged,
      appVersion: app.getVersion(),
      platform: process.platform,
      nodeVersion: process.versions.node || "",
      electronVersion: process.versions.electron || "",
      updaterConfigured: updaterConfig.configured,
      updaterConfigSource: updaterConfig.source,
      updaterConfigPath: updaterConfig.path,
      notificationsSupported: Notification.isSupported(),
      ocrSupported: process.platform === "win32",
      pdfExportSupported: true,
      userDataPath: app.getPath("userData"),
      ...persistenceHealth,
      secretStorageEncryptionAvailable: Boolean(secretStore?.isEncryptionAvailable?.()),
      secretStorageBackend: secretStore?.getBackend?.() || "",
      recentEvents: desktopHealthEvents,
    };
  });
}

function registerStatementPdfIpc() {
  ipcMain.handle(STATEMENT_PDF_SAVE_CHANNEL, async (_event, rawPayload) => {
    const payload = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
    const html = String(payload.html || "");
    const suggestedFileName = String(payload.suggestedFileName || "statement.pdf").trim() || "statement.pdf";

    if (!html.trim()) {
      return { ok: false, message: "No statement HTML was provided for PDF export." };
    }

    const saveResult = await dialog.showSaveDialog(mainWindow || undefined, {
      title: "Save statement PDF",
      defaultPath: suggestedFileName.toLowerCase().endsWith(".pdf") ? suggestedFileName : `${suggestedFileName}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { ok: false, canceled: true };
    }

    const pdfWindow = new BrowserWindow({
      show: false,
      backgroundColor: "#ffffff",
      webPreferences: {
        sandbox: true,
      },
    });

    try {
      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      const pdfBuffer = await pdfWindow.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
      });
      await fs.writeFile(saveResult.filePath, pdfBuffer);
      return { ok: true, filePath: saveResult.filePath };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) };
    } finally {
      if (!pdfWindow.isDestroyed()) {
        pdfWindow.destroy();
      }
    }
  });
}

function registerDocumentOpenIpc() {
  ipcMain.handle(DOCUMENT_OPEN_EXTERNAL_CHANNEL, async (_event, payload) => {
    try {
      return await openDocumentExternally(payload);
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) };
    }
  });
}

function createMainWindow() {
  const iconPath = path.resolve(__dirname, "..", "build", process.platform === "win32" ? "icon.ico" : "icon.png");

  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    autoHideMenuBar: true,
    icon: iconPath,
    backgroundColor: "#f1f5f9",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    window.loadURL(devServerUrl);
  } else {
    const indexPath = path.resolve(__dirname, "..", "dist", "index.html");
    window.loadFile(indexPath);
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("did-finish-load", () => {
    window.webContents.send(UPDATE_STATUS_CHANNEL, updateState);
  });

  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    const detail = `URL: ${validatedURL || "unknown"}\nCode: ${errorCode}\nDescription: ${errorDescription || "Unknown load error."}`;
    recordDesktopHealthEvent("error", "Renderer failed to load.", detail);
    if (!window.isDestroyed()) {
      window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderDesktopFailureHtml("Window failed to load", "The desktop window could not finish loading normally.", detail))}`);
    }
  });

  window.webContents.on("render-process-gone", async (_event, details) => {
    const detail = `Reason: ${details?.reason || "unknown"}\nExit code: ${details?.exitCode ?? "unknown"}`;
    recordDesktopHealthEvent("error", "Renderer process exited unexpectedly.", detail);
    if (window.isDestroyed()) return;
    const result = await dialog.showMessageBox(window, {
      type: "error",
      buttons: ["Reload window", "Close"],
      defaultId: 0,
      cancelId: 1,
      title: "Desktop window stopped",
      message: "The main window stopped unexpectedly.",
      detail,
    });
    if (result.response === 0 && !window.isDestroyed()) {
      window.reload();
    } else if (!window.isDestroyed()) {
      window.close();
    }
  });

  window.on("unresponsive", () => {
    recordDesktopHealthEvent("warn", "Desktop window became unresponsive.");
  });

  window.on("responsive", () => {
    recordDesktopHealthEvent("info", "Desktop window recovered.");
  });

  return window;
}

function configureAutoUpdates() {
  registerUpdateIpc();

  if (isEndToEndTest) {
    pushUpdateState({
      status: "unavailable",
      message: "Update checks are disabled during automated desktop testing.",
      checkedAt: nowIso(),
      progressPercent: 0,
      error: "",
    });
    return;
  }

  if (!app.isPackaged) {
    pushUpdateState({
      status: "unavailable",
      message: "Updates are available in installed desktop builds.",
      checkedAt: nowIso(),
      progressPercent: 0,
      error: "",
    });
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    pushUpdateState({
      status: "checking",
      message: "Checking for updates...",
      checkedAt: nowIso(),
      progressPercent: 0,
      error: "",
    });
  });

  autoUpdater.on("update-available", (info) => {
    pushUpdateState({
      status: "available",
      message: "Update found. Downloading now.",
      availableVersion: info?.version || "",
      downloadedVersion: "",
      releaseDate: info?.releaseDate || "",
      releaseName: info?.releaseName || "",
      releaseNotesUrl: extractReleaseNotesUrl(info?.releaseNotes),
      releaseNotes: normalizeReleaseNotes(info?.releaseNotes),
      checkedAt: nowIso(),
      progressPercent: 0,
      error: "",
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    pushUpdateState({
      status: "downloading",
      message: "Downloading update...",
      progressPercent: Math.max(0, Math.min(100, Math.round(progress?.percent || 0))),
      checkedAt: nowIso(),
      error: "",
    });
  });

  autoUpdater.on("update-not-available", () => {
    pushUpdateState({
      status: "up-to-date",
      message: "You're on the latest version.",
      availableVersion: "",
      downloadedVersion: "",
      progressPercent: 0,
      checkedAt: nowIso(),
      releaseDate: "",
      releaseName: "",
      releaseNotesUrl: "",
      releaseNotes: [],
      error: "",
    });
  });

  autoUpdater.on("error", (error) => {
    const friendly = getFriendlyUpdaterError(error);
    console.error("[autoUpdater]", friendly.detail);
    pushUpdateState({
      status: "error",
      message: friendly.message,
      error: friendly.detail,
      checkedAt: nowIso(),
    });
  });

  autoUpdater.on("update-downloaded", async (info) => {
    pushUpdateState({
      status: "downloaded",
      message: "Update downloaded. Restart to apply.",
      downloadedVersion: info?.version || updateState.availableVersion || "",
      availableVersion: info?.version || updateState.availableVersion || "",
      releaseDate: info?.releaseDate || updateState.releaseDate || "",
      releaseName: info?.releaseName || updateState.releaseName || "",
      releaseNotesUrl: extractReleaseNotesUrl(info?.releaseNotes) || updateState.releaseNotesUrl || "",
      releaseNotes: normalizeReleaseNotes(info?.releaseNotes).length > 0 ? normalizeReleaseNotes(info?.releaseNotes) : updateState.releaseNotes || [],
      progressPercent: 100,
      checkedAt: nowIso(),
      error: "",
    });

    const targetWindow = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
    const result = await dialog.showMessageBox(targetWindow, {
      type: "info",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1,
      title: "Update ready",
      message: "A new version has been downloaded.",
      detail: "Restart the app now to apply the update.",
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  const runAutoCheck = () => {
    checkForUpdates("auto").then((result) => {
      if (!result.ok && result.reason === "error") {
        console.error("[autoUpdater] check failed", result.error);
      }
    });
  };

  runAutoCheck();

  if (!updateCheckTimer) {
    updateCheckTimer = setInterval(runAutoCheck, UPDATE_CHECK_INTERVAL_MS);
  }
}

app.whenReady().then(() => {
  const dataPaths = getRentalTrackerDataPaths(app.getPath("userData"));
  persistenceServicePromise = registerPersistenceIpc({ app, recordDesktopHealthEvent });
  secretStore = registerSecretsIpc({ paths: dataPaths, recordDesktopHealthEvent });
  registerNotificationIpc();
  registerDesktopDiagnosticsIpc();
  registerStatementPdfIpc();
  registerDocumentOpenIpc();
  registerDocumentAiIpc();
  registerDocumentOcrIpc();
  mainWindow = createMainWindow();
  configureAutoUpdates();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

process.on("uncaughtException", (error) => {
  recordDesktopHealthEvent("error", "Main process uncaught exception.", getErrorMessage(error));
  console.error("[main] uncaughtException", error);
});

process.on("unhandledRejection", (reason) => {
  recordDesktopHealthEvent("error", "Main process unhandled rejection.", getErrorMessage(reason));
  console.error("[main] unhandledRejection", reason);
});

app.on("window-all-closed", () => {
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
