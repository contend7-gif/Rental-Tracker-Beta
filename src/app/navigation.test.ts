import assert from "node:assert/strict";
import { test } from "node:test";

import { adminNavItems, navGroups, navItems, viewDetails } from "./navigationShared.js";

test("primary navigation excludes Activity Log", () => {
  assert.equal(navItems.some(([key]) => key === "activity"), false);
});

test("Activity Log remains available as an admin tools destination", () => {
  assert.equal(adminNavItems.some(([key]) => key === "activity"), true);
});

test("Work Queue is a primary navigation destination", () => {
  assert.equal(navItems.some(([key]) => key === "review"), true);
  assert.equal(viewDetails.review.title, "Work Queue");
});

test("Operations Calendar is a primary navigation destination", () => {
  assert.equal(navItems.some(([key]) => key === "operations"), true);
  assert.equal(viewDetails.operations.title, "Operations Calendar");
});

test("workspace headers expose icons through view details", () => {
  for (const key of ["dashboard", "ledger", "documents", "maintenance", "review", "operations", "properties", "loans", "settings"]) {
    assert.ok(viewDetails[key].icon, `${key} should provide a header icon`);
  }
});

test("Home, Work Queue, and Calendar lead the primary navigation", () => {
  const navKeys = navItems.map(([key]) => key);
  assert.deepEqual(navKeys.slice(0, 3), ["dashboard", "review", "operations"]);
});

test("creation is global instead of a sidebar destination", () => {
  assert.equal(navItems.some(([key]) => key === "quickAdd"), false);
  assert.equal(viewDetails.quickAdd.title, "New Transaction");
});

test("navigation groups separate portfolio and accounting work", () => {
  const groups = Object.fromEntries(navGroups.map((group) => [group.key, group.items.map(([key]) => key)]));
  assert.deepEqual(groups.portfolio, ["properties", "leaseHistory", "maintenance", "documents"]);
  assert.deepEqual(groups.accounting, ["ledger", "loans", "assets", "tax"]);
});
