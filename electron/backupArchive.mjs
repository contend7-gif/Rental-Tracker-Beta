import JSZip from "jszip";
import fs from "node:fs/promises";
import path from "node:path";
import { safeRelativeDocumentPath } from "./fileStore.mjs";

export const ZIP_BACKUP_FORMAT = "zip-with-documents";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function documentItemsFromBackup(backup) {
  const documents = backup?.data?.documents;
  return Array.isArray(documents) ? documents.filter(isRecord) : [];
}

function bufferFromIpc(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value)) return Buffer.from(value);
  return Buffer.from([]);
}

function archiveDocumentPath(relativePath) {
  const safePath = safeRelativeDocumentPath(relativePath);
  if (!safePath) return "";
  return `documents/${safePath.replace(/\\/g, "/")}`;
}

export async function buildBackupZipBuffer({ backup, documentsDir }) {
  const zip = new JSZip();
  const documents = documentItemsFromBackup(backup);
  const missingDocumentFiles = [];
  let embeddedDocumentFileCount = 0;

  const archiveBackup = {
    ...backup,
    backupFormat: ZIP_BACKUP_FORMAT,
    documentsEmbedded: true,
    documentBackupNote: "Document files are embedded in this zip under documents/.",
  };

  for (const document of documents) {
    const relativePath = safeRelativeDocumentPath(document.relativePath || document.filePath);
    const archivePath = archiveDocumentPath(relativePath);
    if (!relativePath || !archivePath) continue;
    try {
      const fileBuffer = await fs.readFile(path.join(documentsDir, relativePath));
      zip.file(archivePath, fileBuffer);
      embeddedDocumentFileCount += 1;
    } catch {
      missingDocumentFiles.push({
        id: String(document.id || ""),
        name: String(document.name || ""),
        relativePath,
      });
    }
  }

  archiveBackup.missingDocumentFiles = missingDocumentFiles;
  archiveBackup.embeddedDocumentFileCount = embeddedDocumentFileCount;
  zip.file("backup.json", JSON.stringify(archiveBackup, null, 2));

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    buffer,
    embeddedDocumentFileCount,
    missingDocumentFiles,
  };
}

export async function readBackupZipBuffer({ archiveBuffer, documentsDir }) {
  const zip = await JSZip.loadAsync(bufferFromIpc(archiveBuffer));
  const backupFile = zip.file("backup.json");
  if (!backupFile) {
    throw new Error("Zip backup is missing backup.json.");
  }

  const backup = JSON.parse(await backupFile.async("string"));
  if (!isRecord(backup) || !isRecord(backup.data)) {
    throw new Error("Zip backup contains an invalid backup.json.");
  }

  const documents = documentItemsFromBackup(backup);
  const restoredDocumentFiles = [];
  const missingDocumentFiles = [];
  await fs.mkdir(documentsDir, { recursive: true });

  for (const document of documents) {
    const relativePath = safeRelativeDocumentPath(document.relativePath || document.filePath);
    const archivePath = archiveDocumentPath(relativePath);
    if (!relativePath || !archivePath) continue;
    const zippedFile = zip.file(archivePath);
    if (!zippedFile) {
      missingDocumentFiles.push({
        id: String(document.id || ""),
        name: String(document.name || ""),
        relativePath,
      });
      continue;
    }

    const destination = path.join(documentsDir, relativePath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, await zippedFile.async("nodebuffer"));
    restoredDocumentFiles.push(relativePath);
  }

  return {
    backup,
    restoredDocumentFiles,
    missingDocumentFiles,
  };
}

export async function inspectBackupZipBuffer(archiveBuffer) {
  const zip = await JSZip.loadAsync(bufferFromIpc(archiveBuffer));
  const backupFile = zip.file("backup.json");
  if (!backupFile) {
    throw new Error("Zip backup is missing backup.json.");
  }
  const backup = JSON.parse(await backupFile.async("string"));
  const archiveFilePaths = new Set(Object.keys(zip.files).filter((name) => !zip.files[name].dir));
  return { backup, archiveFilePaths };
}

export function backupDocumentArchivePath(relativePath) {
  return archiveDocumentPath(relativePath);
}
