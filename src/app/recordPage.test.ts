import assert from "node:assert/strict";
import test from "node:test";
import { recordPage } from "./recordPage.ts";

test("pages cover every record exactly once and clamp after deletions", () => {
  const records = Array.from({ length: 123 }, (_, id) => ({ id }));
  assert.deepEqual([0, 1, 2].flatMap((page) => recordPage(records, page).records), records);
  assert.equal(recordPage(records, 2).records.length, 23);
  assert.equal(recordPage(records.slice(0, 20), 2).page, 0);
  assert.equal(recordPage([], 9).total, 0);
  assert.equal(recordPage(records, -1).page, 0);
});
