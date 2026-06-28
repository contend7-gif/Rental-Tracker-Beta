import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("desktop restore points do not write full backup snapshots to localStorage", () => {
  const source = readFileSync(new URL("./useDesktopPersistenceController.js", import.meta.url), "utf8");
  const restorePointFunction = source.match(/const createAutoBackupNow = async \(\) => \{([\s\S]+?)\n  \};/)?.[1] || "";
  const desktopRestorePointBranch = restorePointFunction.match(/if \(window\.desktopPersistence\?\.createRestorePoint \|\| window\.desktopPersistence\?\.saveAppData\) \{([\s\S]+?)\n        return;\n      \}/)?.[1] || "";

  assert.match(desktopRestorePointBranch, /desktopPersistence\?\.createRestorePoint/);
  assert.match(desktopRestorePointBranch, /AUTO_BACKUP_META_STORAGE_KEY/);
  assert.match(desktopRestorePointBranch, /setNotice\("Restore point created\."\)/);
  assert.doesNotMatch(desktopRestorePointBranch, /AUTO_BACKUP_STORAGE_KEY/);
});

test("desktop backup export saves the live snapshot before exporting SQLite data", () => {
  const source = readFileSync(new URL("./useDesktopPersistenceController.js", import.meta.url), "utf8");
  const exportFunction = source.match(/const exportDataBackup = async \(\) => \{([\s\S]+?)\n  \};/)?.[1] || "";

  assert.match(source, /const saveCurrentDesktopSnapshotNow = async \(\) =>/);
  assert.match(exportFunction, /await saveCurrentDesktopSnapshotNow\(\)/);
  assert.doesNotMatch(exportFunction, /await flushCurrentDesktopSave\(\)/);
});
