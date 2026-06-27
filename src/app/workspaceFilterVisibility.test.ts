import assert from "node:assert/strict";
import test from "node:test";
import { getWorkspaceFilterVisibility } from "./workspaceFilterVisibility.js";

test("workspace filters only expose scope controls used by the active view", () => {
  assert.deepEqual(getWorkspaceFilterVisibility("ledger"), { year: true, property: true, unit: true });
  assert.deepEqual(getWorkspaceFilterVisibility("documents"), { property: true, unit: true });
  assert.deepEqual(getWorkspaceFilterVisibility("assets"), { year: true, property: true });
  assert.deepEqual(getWorkspaceFilterVisibility("loans"), { year: true, property: true });
  assert.deepEqual(getWorkspaceFilterVisibility("planning"), { property: true });
  assert.equal(getWorkspaceFilterVisibility("settings"), null);
});
