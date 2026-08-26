import assert from "node:assert/strict";
import test from "node:test";
import { inferDocumentWorkOrderSuggestion } from "../domain/documentIntelligence.ts";
import { buildMobileCompanionImportContext, companionCaptureKind } from "./mobileCompanionImport.ts";

const baseSubmission = {
  id: "capture-1",
  status: "pending" as const,
  propertyLabel: "Oak Street Duplex",
  unitLabel: "Unit 2",
  originalFileName: "photo.jpg",
  contentType: "image/jpeg",
  byteSize: 1200,
  sha256: "abc123",
  capturedAt: "2026-08-26T12:00:00.000Z",
  createdAt: "2026-08-26T12:00:00.000Z",
  updatedAt: "2026-08-26T12:00:00.000Z",
};

test("unknown companion kinds remain backward-compatible receipts", () => {
  assert.equal(companionCaptureKind(undefined), "receipt");
  assert.equal(companionCaptureKind("receipt"), "receipt");
});

test("maintenance captures seed desktop work-order review context", () => {
  const context = buildMobileCompanionImportContext({
    ...baseSubmission,
    kind: "maintenance",
    note: "Kitchen sink is leaking under the cabinet.",
  });

  assert.equal(context.documentType, "Maintenance Photo");
  assert.equal(context.contextTag, "Maintenance");
  assert.match(context.extractedText, /sink is leaking/i);
  assert.equal(context.ocrStatus, "completed");
  assert.equal(context.shouldRunOcr, false);

  const workOrder = inferDocumentWorkOrderSuggestion({
    document: {
      name: baseSubmission.originalFileName,
      type: context.documentType,
      propertyId: "p1",
      unit: "Unit 2",
      tags: [context.contextTag, "Mobile capture"],
      extractedText: context.extractedText,
    },
    property: { id: "p1", name: "Oak Street Duplex", address: "101 Oak Street" },
  });
  assert.match(workOrder?.title || "", /sink/i);
  assert.equal(workOrder?.propertyId, "p1");
  assert.equal(workOrder?.unit, "Unit 2");
});

test("receipt captures keep the existing automatic OCR path", () => {
  const context = buildMobileCompanionImportContext({
    ...baseSubmission,
    kind: "receipt",
    note: "Hardware store",
  });

  assert.equal(context.documentType, "Receipt");
  assert.equal(context.contextTag, "Receipt");
  assert.equal(context.extractedText, "");
  assert.equal(context.shouldRunOcr, true);
});

test("maintenance filenames remain recognizable to the already released desktop", () => {
  const workOrder = inferDocumentWorkOrderSuggestion({
    document: {
      name: "maintenance-kitchen-sink.jpg",
      type: "Other",
      propertyId: "p1",
      unit: "Unit 2",
      tags: ["Receipt", "Mobile capture"],
      extractedText: "",
    },
    property: { id: "p1", name: "Oak Street Duplex", address: "101 Oak Street" },
  });

  assert.match(workOrder?.title || "", /maintenance|kitchen|sink/i);
  assert.equal(workOrder?.propertyId, "p1");
});
