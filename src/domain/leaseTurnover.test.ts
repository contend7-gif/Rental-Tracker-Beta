import test from "node:test";
import assert from "node:assert/strict";
import { createLeaseTurnover, normalizeLeaseTurnover } from "./leaseTurnover.ts";

test("each turnover gets independent tasks without assumed dates or completion", () => {
  const first = createLeaseTurnover();
  const second = createLeaseTurnover();
  first.tasks[0].photoIds.push("example-photo");
  first.tasks[0].completedAt = "2026-10-18T12:00:00Z";
  assert.equal(second.tasks.length, 7);
  assert.ok(second.tasks.every((task) => !task.dueDate && !task.completedAt && task.photoIds.length === 0));
  assert.equal(normalizeLeaseTurnover(undefined), undefined);
});

test("turnover import preserves progress and rejects malformed dates and duplicate tasks", () => {
  const turnover = createLeaseTurnover();
  turnover.status = "preparing";
  Object.assign(turnover.tasks[0], { dueDate: "2026-10-20", completedAt: "2026-10-18T12:00:00Z", photoIds: ["photo-1", "photo-1"], notes: "Before inspection" });
  turnover.tasks[1].dueDate = "2026-02-30";
  turnover.tasks.push(turnover.tasks[0]);
  const normalized = normalizeLeaseTurnover(JSON.parse(JSON.stringify(turnover)))!;
  assert.equal(normalized.status, "preparing");
  assert.equal(normalized.tasks.length, 7);
  assert.deepEqual(normalized.tasks[0].photoIds, ["photo-1"]);
  assert.equal(normalized.tasks[0].completedAt, "2026-10-18T12:00:00Z");
  assert.equal(normalized.tasks[0].notes, "Before inspection");
  assert.equal(normalized.tasks[1].dueDate, "");
});
