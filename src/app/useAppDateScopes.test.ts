import test from "node:test";
import assert from "node:assert/strict";
import { toLocalIsoDate } from "../lib/localDate.ts";
import { buildAppDateScopes } from "./useAppDateScopes.js";

test("local app date does not roll forward at the UTC boundary", () => {
  const lateLocalMay31 = new Date(2026, 4, 31, 22, 30, 0);

  assert.equal(toLocalIsoDate(lateLocalMay31), "2026-05-31");
  assert.equal(buildAppDateScopes({ yearFilter: "2026", now: lateLocalMay31 }).todayIso, "2026-05-31");
  assert.equal(buildAppDateScopes({ yearFilter: "2026", now: lateLocalMay31 }).recurringThroughDate, "2026-05-31");
});

test("recurring date scope caps historical years at year end", () => {
  const localMay31 = new Date(2026, 4, 31, 12, 0, 0);

  assert.equal(buildAppDateScopes({ yearFilter: "2025", now: localMay31 }).recurringThroughDate, "2025-12-31");
});
