import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePropertyOperationNote,
  normalizePropertyOperationNotes,
  normalizePropertyValuation,
  normalizePropertyValuations,
  operationNoteScopeLabel,
  projectPropertyValue,
  estimatePropertyValueAtDate,
  getPropertyPurchaseValueSupport,
} from "./propertyOperations.js";

test("normalizePropertyOperationNote keeps property-level sensitive access notes", () => {
  const note = normalizePropertyOperationNote(
    {
      id: "n1",
      title: "Front door code",
      category: "Access",
      unit: "Shared",
      body: "Use the keypad reset process after turnovers.",
      sensitive: true,
    },
    { now: "2026-05-11T12:00:00.000Z" },
  );

  assert.equal(note.title, "Front door code");
  assert.equal(note.unit, "Shared");
  assert.equal(note.sensitive, true);
  assert.equal(note.createdAt, "2026-05-11T12:00:00.000Z");
});

test("normalizePropertyOperationNote supports unit-level notes", () => {
  const note = normalizePropertyOperationNote({
    category: "Appliances",
    unit: "616",
    body: "Filter size is 16x20x1.",
  });

  assert.equal(note.title, "Filter size is 16x20x1.");
  assert.equal(operationNoteScopeLabel(note), "Unit 616");
});

test("normalizePropertyOperationNotes sorts newest first and repairs unknown categories", () => {
  const notes = normalizePropertyOperationNotes([
    { id: "old", title: "Old", category: "Unknown", updatedAt: "2026-01-01T00:00:00.000Z" },
    { id: "new", title: "New", category: "Utilities", updatedAt: "2026-02-01T00:00:00.000Z" },
  ]);

  assert.equal(notes[0]?.id, "new");
  assert.equal(notes[1]?.category, "Access");
});

test("normalizePropertyValuation keeps source document support", () => {
  const valuation = normalizePropertyValuation({
    id: "v1",
    date: "2026-05-01",
    value: "250000",
    source: "Appraisal",
    documentId: "doc-1",
    notes: "Spring appraisal",
  });

  assert.equal(valuation.value, 250000);
  assert.equal(valuation.source, "Appraisal");
  assert.equal(valuation.documentId, "doc-1");
});

test("normalizePropertyValuations sorts newest valuation first", () => {
  const valuations = normalizePropertyValuations([
    { id: "old", date: "2025-01-01", value: 200000, source: "Manual estimate" },
    { id: "new", date: "2026-01-01", value: 210000, source: "Tax assessment" },
  ]);

  assert.deepEqual(valuations.map((valuation) => valuation.id), ["new", "old"]);
});

test("getPropertyPurchaseValueSupport prefers purchase closing valuation over cost basis field", () => {
  const support = getPropertyPurchaseValueSupport({
    purchasedOn: "2025-12-30",
    purchasePrice: 263000,
    propertyValuations: [
      { id: "manual", date: "2026-06-01", value: 257206.25, source: "Manual estimate" },
      { id: "closing", date: "2025-12-30", value: 254000, source: "Purchase / closing" },
    ],
  });

  assert.equal(support.value, 254000);
  assert.equal(support.source, "Purchase / closing");
  assert.equal(support.usesValuation, true);
});

test("getPropertyPurchaseValueSupport falls back to legacy purchase field", () => {
  const support = getPropertyPurchaseValueSupport({
    purchasedOn: "2025-12-30",
    purchasePrice: 263000,
    propertyValuations: [{ id: "manual", date: "2026-06-01", value: 257206.25, source: "Manual estimate" }],
  });

  assert.equal(support.value, 263000);
  assert.equal(support.source, "Property purchase/cost field");
  assert.equal(support.usesValuation, false);
});

test("projectPropertyValue uses annual appreciation rate for planning only", () => {
  assert.equal(projectPropertyValue(250000, 3, 12), 257500);
  assert.equal(projectPropertyValue(250000, 3, 0), 250000);
});

test("estimatePropertyValueAtDate projects from valuation date to current date", () => {
  assert.equal(estimatePropertyValueAtDate(254000, 3, "2025-12-30", "2026-12-30"), 261614.87);
  assert.equal(estimatePropertyValueAtDate(254000, 3, "2026-05-23", "2026-05-23"), 254000);
  assert.equal(estimatePropertyValueAtDate(254000, 0, "2025-12-30", "2026-12-30"), 254000);
});
