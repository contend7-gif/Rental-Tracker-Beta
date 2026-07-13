import assert from "node:assert/strict";
import test from "node:test";

import { loadAndApplyDesktopPersistenceData } from "../src/app/desktopPersistenceHydration.ts";

test("desktop hydration applies SQLite data once and does not load demo data over it", async () => {
  let loadCount = 0;
  let restoreCount = 0;
  let demoLoadCount = 0;
  const restoredBackups = [];
  const health = { structuredDataRecordCount: 3, lastBackupAt: "2026-05-07T00:00:00.000Z" };
  const desktopPersistence = {
    async loadAppData() {
      loadCount += 1;
      return {
        ok: true,
        hasData: true,
        meta: { lastBackupAt: health.lastBackupAt },
        backup: {
          schemaVersion: 5,
          appVersion: "9.9.9-test",
          exportedAt: "2026-05-07T00:00:00.000Z",
          settings: { hasAiOpenAiApiKey: true },
          data: {
            properties: [{ id: "p1" }],
            units: [{ id: "u1" }],
            transactions: [{ id: "t1", status: "active" }],
          },
        },
      };
    },
    async getHealth() {
      return health;
    },
  };

  const applied = await loadAndApplyDesktopPersistenceData({
    desktopPersistence,
    restoreBackupEnvelope: (backup) => {
      restoreCount += 1;
      restoredBackups.push(backup);
    },
    replaceSettings: () => undefined,
    setLastAutoBackupAt: () => undefined,
    setPersistenceHealth: () => undefined,
    setPersistenceLastError: () => undefined,
    loadDemoData: () => {
      demoLoadCount += 1;
    },
  });

  assert.equal(applied, true);
  assert.equal(loadCount, 1);
  assert.equal(restoreCount, 1);
  assert.equal(demoLoadCount, 0);
  assert.equal(restoredBackups[0].data.transactions[0].id, "t1");
});
