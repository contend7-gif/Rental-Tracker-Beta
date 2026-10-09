import assert from "node:assert/strict";
import test from "node:test";
import { parseCaptureMemory, emptyMemory, hasDraftContent, rememberPurpose } from "../lib/capture-drafts.ts";
const draft = { selectedPropertyId: "example-property", selectedUnitId: "", propertyLabel: "Example", unitLabel: "", note: "Example note", tripDate: "2026-10-09", businessMiles: "", purpose: "", startLocation: "", endLocation: "" };
test("recover separate capture drafts and exclude file bytes or unexpected fields", () => {
  const memory = emptyMemory();
  memory.drafts.receipt = { ...draft, file: "private bytes" };
  memory.drafts.mileage = { ...draft, businessMiles: "12", purpose: "Inspection" };
  const restored = parseCaptureMemory(JSON.stringify(memory));
  assert.deepEqual(restored.drafts.receipt, draft);
  assert.equal(restored.drafts.mileage.businessMiles, "12");
  assert.equal(JSON.stringify(restored).includes("private bytes"), false);
});
test("invalid and oversized saved state cannot overwrite a usable blank form", () => {
  for (const raw of ["not-json", JSON.stringify({ version: 9, drafts: { receipt: draft } }), "x".repeat(20001)]) assert.deepEqual(parseCaptureMemory(raw), emptyMemory());
  const state = parseCaptureMemory(JSON.stringify({ version: 1, drafts: { receipt: { ...draft, note: 42 } } }));
  assert.deepEqual(state.drafts, {});
});
test("recent purposes remain bounded and deduplicated, and blank scope is not unfinished work", () => {
  assert.deepEqual(rememberPurpose(["Inspection", "Hardware pickup"], "Hardware pickup"), ["Hardware pickup", "Inspection"]);
  assert.equal(rememberPurpose(["a", "b", "c", "d", "e"], "f").length, 5);
  assert.equal(hasDraftContent({ ...draft, note: "" }), false);
  assert.equal(hasDraftContent(draft), true);
});
