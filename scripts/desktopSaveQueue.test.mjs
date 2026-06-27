import assert from "node:assert/strict";
import test from "node:test";

import { createDesktopSaveQueue } from "../src/app/desktopSaveQueue.js";

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(predicate(), true);
}

test("desktop save queue writes immediately and coalesces pending snapshots", async () => {
  const firstSave = deferred();
  const savedIds = [];
  const queue = createDesktopSaveQueue({
    saveSnapshot: async (snapshot) => {
      savedIds.push(snapshot.id);
      if (snapshot.id === "first") {
        await firstSave.promise;
      }
      return { ok: true };
    },
  });

  queue.enqueue({ id: "first" });
  await waitFor(() => savedIds.length === 1);

  queue.enqueue({ id: "second" });
  queue.enqueue({ id: "third" });
  assert.deepEqual(savedIds, ["first"]);

  firstSave.resolve();
  await waitFor(() => savedIds.length === 2);
  assert.deepEqual(savedIds, ["first", "third"]);
});

test("desktop save queue flush waits for the latest queued snapshot", async () => {
  const firstSave = deferred();
  const savedIds = [];
  const queue = createDesktopSaveQueue({
    saveSnapshot: async (snapshot) => {
      savedIds.push(snapshot.id);
      if (snapshot.id === "first") {
        await firstSave.promise;
      }
      return { ok: true, savedAt: snapshot.id };
    },
  });

  queue.enqueue({ id: "first" });
  await waitFor(() => savedIds.length === 1);
  queue.enqueue({ id: "latest" });

  const flushed = queue.flush();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(savedIds, ["first"]);

  firstSave.resolve();
  const result = await flushed;
  assert.deepEqual(savedIds, ["first", "latest"]);
  assert.deepEqual(result, { ok: true, savedAt: "latest" });
});

test("desktop save queue flush reports save errors", async () => {
  const queue = createDesktopSaveQueue({
    saveSnapshot: async () => ({ ok: false, message: "disk full" }),
  });

  queue.enqueue({ id: "will-fail" });
  const result = await queue.flush();

  assert.deepEqual(result, { ok: false, message: "disk full" });
});
