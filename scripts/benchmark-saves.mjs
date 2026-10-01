import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createEmptyBackupForTests, createPersistenceService, saveAppDataToDatabase } from "../electron/db.mjs";

function median(values) {
  return [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)];
}

const results = [];
for (const [name, transactionCount, activityCount, documentCount] of [["small", 200, 400, 20], ["medium", 2000, 5000, 100], ["large", 10000, 20000, 500]]) {
  const profilePath = await fs.mkdtemp(path.join(os.tmpdir(), "rental-tracker-save-bench-"));
  const service = await createPersistenceService({ userDataPath: profilePath, appVersion: "benchmark" });
  try {
    const backup = createEmptyBackupForTests("benchmark");
    backup.data.properties = [{ id: "example-property", name: "Example property" }];
    backup.data.transactions = Array.from({ length: transactionCount }, (_, index) => ({ id: `txn-${index}`, propertyId: "example-property", unit: "Shared", date: "2026-08-01", type: "Expense", category: "Repairs", description: `Example expense ${index}`, amount: 20 + index, status: "active", taxChecked: true }));
    backup.data.activityLog = Array.from({ length: activityCount }, (_, index) => ({ id: `activity-${index}`, at: "2026-08-01T12:00:00.000Z", action: "update", entityType: "transaction", entityId: `txn-${index % transactionCount}`, summary: "Example record updated", immutable: true }));
    backup.data.documents = Array.from({ length: documentCount }, (_, index) => ({ id: `doc-${index}`, name: `Example invoice ${index}`, propertyId: "example-property", extractedText: "Example document text. ".repeat(40), tags: ["example"] }));
    const save = () => saveAppDataToDatabase({ db: service.db, paths: service.paths, backup, autoBackup: false });
    await save();
    const times = { unchanged: [], editAndAudit: [] };
    const changes = { unchanged: [], editAndAudit: [] };
    for (const mode of Object.keys(times)) {
      for (let iteration = 0; iteration < 7; iteration += 1) {
        if (mode === "editAndAudit") {
          backup.data.transactions[0] = { ...backup.data.transactions[0], amount: backup.data.transactions[0].amount + 1 };
          backup.data.activityLog.unshift({ ...backup.data.activityLog[0], id: `new-audit-${iteration}` });
        }
        const before = service.db.prepare("SELECT total_changes() AS count").get().count;
        const started = performance.now();
        await save();
        times[mode].push(performance.now() - started);
        changes[mode].push(service.db.prepare("SELECT total_changes() AS count").get().count - before);
      }
    }
    results.push({ name, transactionCount, activityCount, documentCount, unchangedMedianMs: Number(median(times.unchanged).toFixed(2)), editAndAuditMedianMs: Number(median(times.editAndAudit).toFixed(2)), unchangedMedianRowChanges: median(changes.unchanged), editAndAuditMedianRowChanges: median(changes.editAndAudit) });
  } finally {
    service.close();
    const resolved = path.resolve(profilePath);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("rental-tracker-save-bench-")) throw new Error("Unexpected benchmark cleanup path");
    await fs.rm(resolved, { recursive: true, force: true });
  }
}
const report = { benchmark: "fictional full-snapshot saves, automatic backups excluded, seven iterations per operation", nodeVersion: process.version, results };
if (process.argv[2]) {
  await fs.mkdir(path.dirname(path.resolve(process.argv[2])), { recursive: true });
  await fs.writeFile(process.argv[2], JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
