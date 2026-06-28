import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DATA_URL_PATTERN = /^data:([^;,]+)?;base64,(.+)$/s;

export function getRentalTrackerDataPaths(userDataPath) {
  const rootDir = userDataPath;
  return {
    rootDir,
    databasePath: path.join(rootDir, "rental-tracker.sqlite3"),
    documentsDir: path.join(rootDir, "documents"),
    backupsDir: path.join(rootDir, "backups"),
    secretsDir: path.join(rootDir, "secrets"),
  };
}

export async function ensureRentalTrackerDataDirs(paths) {
  await fs.mkdir(paths.rootDir, { recursive: true });
  await fs.mkdir(paths.documentsDir, { recursive: true });
  await fs.mkdir(paths.backupsDir, { recursive: true });
  await fs.mkdir(paths.secretsDir, { recursive: true });
}

export function parseDocumentDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(DATA_URL_PATTERN);
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  return {
    mimeType: String(match[1] || "application/octet-stream").toLowerCase(),
    buffer,
    hash: createHash("sha256").update(buffer).digest("hex"),
    size: buffer.length,
  };
}

export function extensionForMimeType(mimeType, fileName = "") {
  const explicitExtension = path.extname(String(fileName || "")).toLowerCase();
  if (explicitExtension) return explicitExtension;
  const byMimeType = {
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
  return byMimeType[String(mimeType || "").toLowerCase()] || ".bin";
}

export function sanitizeFileStem(fileName = "document") {
  const stem = path.basename(String(fileName || "document"), path.extname(String(fileName || "document")));
  const cleaned = stem.replace(/[^a-z0-9._-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned || "document";
}

export function safeRelativeDocumentPath(relativePath) {
  const value = String(relativePath || "").replace(/\\/g, "/").trim();
  if (!value || value.includes("..") || path.isAbsolute(value)) return "";
  return value;
}

export async function writeDocumentBlob(document, documentsDir) {
  const parsed = parseDocumentDataUrl(document?.dataUrl);
  if (!parsed) {
    return {
      ...document,
      relativePath: safeRelativeDocumentPath(document?.relativePath || document?.filePath),
      fileHash: String(document?.fileHash || ""),
      fileSize: Number(document?.fileSize || 0) || 0,
      mimeType: String(document?.mimeType || ""),
    };
  }

  await fs.mkdir(documentsDir, { recursive: true });
  const id = sanitizeFileStem(document?.id || parsed.hash.slice(0, 16));
  const stem = sanitizeFileStem(document?.name || "document").slice(0, 80);
  const extension = extensionForMimeType(document?.mimeType || parsed.mimeType, document?.name);
  const fileName = `${id}-${stem}-${parsed.hash.slice(0, 12)}${extension}`;
  const filePath = path.join(documentsDir, fileName);

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, parsed.buffer);
  }

  return {
    ...document,
    dataUrl: undefined,
    relativePath: fileName,
    fileHash: parsed.hash,
    fileSize: parsed.size,
    mimeType: String(document?.mimeType || parsed.mimeType || "application/octet-stream").toLowerCase(),
  };
}

export async function readDocumentAsDataUrl(document, documentsDir) {
  const relativePath = safeRelativeDocumentPath(document?.relativePath || document?.filePath);
  if (!relativePath) return "";
  const filePath = path.join(documentsDir, relativePath);
  const buffer = await fs.readFile(filePath);
  const mimeType = String(document?.mimeType || "application/octet-stream").toLowerCase();
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export async function hydrateDocumentDataUrl(document, documentsDir, errors = []) {
  if (document?.dataUrl) return document;
  try {
    const dataUrl = await readDocumentAsDataUrl(document, documentsDir);
    return dataUrl ? { ...document, dataUrl } : document;
  } catch (error) {
    errors.push({
      at: new Date().toISOString(),
      level: "warn",
      message: "Document file is missing or unreadable.",
      detail: `${document?.id || "unknown"}: ${error instanceof Error ? error.message : String(error)}`,
    });
    return document;
  }
}

export async function countFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).length;
  } catch {
    return 0;
  }
}

export async function getFileSize(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}
