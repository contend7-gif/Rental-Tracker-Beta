import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityLogEntry } from "../models.ts";
import { mergeActivityLogEntries } from "./activityStore.ts";

function activity(id: string, at: string): ActivityLogEntry {
  return {
    id,
    at,
    actor: "tester",
    action: "update",
    entityType: "document",
    entityId: id,
    summary: id,
    immutable: true,
  };
}

test("activity slice merge keeps existing entries, removes duplicates, and sorts newest first", () => {
  const existing = activity("existing", "2026-07-14T10:00:00.000Z");
  const merged = mergeActivityLogEntries(
    [existing],
    [activity("new", "2026-07-14T12:00:00.000Z"), activity("existing", "2026-07-14T14:00:00.000Z")],
  );

  assert.deepEqual(merged.map((entry) => entry.id), ["new", "existing"]);
  assert.equal(merged[1], existing);
});
