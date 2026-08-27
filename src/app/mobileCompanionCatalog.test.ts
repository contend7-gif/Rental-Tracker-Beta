import assert from "node:assert/strict";
import test from "node:test";
import { buildMobileCompanionCatalog } from "./mobileCompanionCatalog.ts";

test("mobile companion catalog includes only active property and unit labels", () => {
  const catalog = buildMobileCompanionCatalog({
    properties: [
      {
        id: "property-1",
        name: " Oak Street Duplex ",
        address: "123 Oak St",
        type: "Duplex",
        ownerName: "Private Owner",
        ownerEmail: "owner@example.test",
        ownerPhone: "555-0100",
        purchasePrice: 300000,
        currentValue: 350000,
        operationNotes: [{ id: "note-1", propertyId: "property-1", note: "Private note", createdAt: "2026-01-01", updatedAt: "2026-01-01" }],
      },
      {
        id: "property-archived",
        name: "Old Property",
        address: "9 Old Rd",
        type: "Single family",
        archivedAt: "2026-01-01",
      },
    ],
    units: [
      { id: "unit-1", propertyId: "property-1", name: " Unit 1 ", status: "Rental" },
      { id: "unit-old", propertyId: "property-archived", name: "Old Unit", status: "Vacant" },
    ],
  });

  assert.deepEqual(catalog, {
    version: 1,
    properties: [{
      id: "property-1",
      label: "Oak Street Duplex",
      addressLabel: "123 Oak St",
      units: [{ id: "unit-1", label: "Unit 1" }],
    }],
  });
  assert.doesNotMatch(JSON.stringify(catalog), /Private Owner|owner@example|555-0100|300000|350000|Private note/);
});

test("mobile companion catalog falls back to an address when a property has no name", () => {
  const catalog = buildMobileCompanionCatalog({
    properties: [{ id: "property-2", name: "", address: "45 Pine Ave", type: "Duplex" }],
    units: [],
  });

  assert.deepEqual(catalog.properties[0], {
    id: "property-2",
    label: "45 Pine Ave",
    addressLabel: "",
    units: [],
  });
});
