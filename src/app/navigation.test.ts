import assert from "node:assert/strict";
import { test } from "node:test";

import { adminNavItems, navItems, viewDetails } from "./navigationShared.js";

test("primary navigation excludes Activity Log", () => {
  assert.equal(navItems.some(([key]) => key === "activity"), false);
});

test("Activity Log remains available as an admin tools destination", () => {
  assert.equal(adminNavItems.some(([key]) => key === "activity"), true);
});

test("Review Center is a primary navigation destination", () => {
  assert.equal(navItems.some(([key]) => key === "review"), true);
  assert.equal(viewDetails.review.title, "Review Center");
});

test("workspace headers expose icons through view details", () => {
  for (const key of ["dashboard", "ledger", "documents", "maintenance", "review", "properties", "loans", "settings"]) {
    assert.ok(viewDetails[key].icon, `${key} should provide a header icon`);
  }
});

test("Review Center follows core record workspaces in primary navigation", () => {
  const navKeys = navItems.map(([key]) => key);
  assert.ok(navKeys.indexOf("review") > navKeys.indexOf("tax"));
  assert.ok(navKeys.indexOf("review") < navKeys.indexOf("properties"));
});
