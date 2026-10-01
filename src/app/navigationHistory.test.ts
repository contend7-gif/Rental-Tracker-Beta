import assert from "node:assert/strict";
import test from "node:test";
import { moveNavigation, pushNavigation, type NavigationHistory } from "./navigationHistory.ts";

const entry = (view: string) => ({ view, yearFilter: "2024", propertyFilter: "property-1", unitFilter: "614" });
test("history restores scope, clamps at either end, and drops forward visits when branching", () => {
  const first: NavigationHistory = { entries: [entry("dashboard")], index: 0 };
  const second = pushNavigation(first, entry("ledger"));
  const third = pushNavigation(second, { ...entry("documents"), yearFilter: "2026", unitFilter: "all" });
  const back = moveNavigation(third, -1);
  assert.deepEqual(back.entries[back.index], entry("ledger"));
  assert.equal(moveNavigation(back, 1).entries[2].yearFilter, "2026");
  const branch = pushNavigation(back, entry("properties"));
  assert.deepEqual(branch.entries.map((item) => item.view), ["dashboard", "ledger", "properties"]);
  assert.equal(moveNavigation(branch, 1), branch);
  assert.equal(moveNavigation(first, -1), first);
  assert.equal(pushNavigation(second, entry("ledger")), second);
});

test("history stays bounded during a long session", () => {
  let history: NavigationHistory = { entries: [entry("dashboard")], index: 0 };
  for (let index = 0; index < 200; index++) history = pushNavigation(history, entry(`view-${index}`));
  assert.equal(history.entries.length, 100);
  assert.equal(history.index, 99);
  assert.equal(history.entries[99].view, "view-199");
});
