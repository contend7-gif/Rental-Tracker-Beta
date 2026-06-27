import test from "node:test";
import assert from "node:assert/strict";
import { formatUnitLabel } from "./unitLabels.js";

test("formatUnitLabel avoids duplicate Unit prefixes", () => {
  assert.equal(formatUnitLabel("A"), "Unit A");
  assert.equal(formatUnitLabel("616"), "Unit 616");
  assert.equal(formatUnitLabel("Unit A"), "Unit A");
  assert.equal(formatUnitLabel("unit 614"), "unit 614");
  assert.equal(formatUnitLabel("Shared"), "Shared");
  assert.equal(formatUnitLabel(""), "Unit not entered");
});
