import assert from "node:assert/strict";
import test from "node:test";
import { activeProperties, selectableProperties } from "./propertyLifecycle.js";

const properties = [
  { id: "active", name: "Active" },
  { id: "archived", name: "Archived", archivedAt: "2026-06-12T00:00:00.000Z" },
];

test("activeProperties removes archived properties from active selectors", () => {
  assert.deepEqual(activeProperties(properties).map((property) => property.id), ["active"]);
});

test("selectableProperties retains the archived property on an existing record", () => {
  assert.deepEqual(selectableProperties(properties, "archived").map((property) => property.id), ["active", "archived"]);
  assert.deepEqual(selectableProperties(properties, "").map((property) => property.id), ["active"]);
});
