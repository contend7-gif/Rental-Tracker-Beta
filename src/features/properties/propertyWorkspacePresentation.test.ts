import test from "node:test";
import assert from "node:assert/strict";
import {
  VISIBLE_RENT_SCHEDULE_HELP,
  buildPropertyWorkspaceModes,
  buildUnitOccupancyTimeline,
  documentRenewalStatus,
  propertyActivityEntries,
  readinessRecordSection,
  usefulPropertyDocumentTags,
} from "./propertyWorkspacePresentation.js";

test("property workspace modes give overview, units, records, and photos distinct jobs", () => {
  const modes = buildPropertyWorkspaceModes({
    openItemCount: 3,
    operationNoteCount: 2,
    photoCount: 4,
    propertyDocumentCount: 5,
    unitCount: 2,
    valuationCount: 1,
  });

  assert.deepEqual(modes.map((mode) => mode.key), ["overview", "units", "records", "photos"]);
  assert.deepEqual(modes.map((mode) => mode.badge), ["3 open", "2 units", "8 records", "4 photos"]);
  assert.match(modes[1].description, /occupancy history/i);
  assert.match(modes[2].description, /valuation support/i);
});

test("readiness routes operations issues to the operations records tab", () => {
  assert.equal(readinessRecordSection("operations"), "notes");
  assert.equal(readinessRecordSection("occupancy"), "occupancy");
});

test("property document tags suppress generic and type-derived labels", () => {
  assert.deepEqual(
    usefulPropertyDocumentTags({ type: "Tax assessment", tags: ["property", "tax-assessment", "tax", "2026", "scan", "supporting-only"] }),
    ["tax", "2026"],
  );
});

test("occupancy timeline combines leases, owner periods, and vacancy periods newest first", () => {
  const timeline = buildUnitOccupancyTimeline(
    "A",
    [
      { id: "owner", useType: "Owner-Occupied", startDate: "2024-01-01", endDate: "2024-06-30", reviewed: true },
      { id: "vacant", useType: "Vacant", startDate: "2024-07-01", endDate: "2024-07-31" },
    ],
    [{ id: "lease", unit: "A", tenantName: "Tenant", startDate: "2024-08-01", endDate: "2025-07-31", monthlyRent: 1200 }],
  );

  assert.deepEqual(timeline.map((row) => row.kind), ["lease", "vacancy", "occupancy"]);
  assert.match(timeline[0].detail, /1,200/);
});

test("visible schedule helper explains as-of and partial-history behavior", () => {
  assert.match(VISIBLE_RENT_SCHEDULE_HELP, /as-of date/);
  assert.match(VISIBLE_RENT_SCHEDULE_HELP, /partial/);
});

test("document renewal status distinguishes expired, upcoming, and current documents", () => {
  assert.equal(documentRenewalStatus("2026-06-01", "2026-06-12").key, "expired");
  assert.equal(documentRenewalStatus("2026-07-01", "2026-06-12").key, "due-soon");
  assert.equal(documentRenewalStatus("2027-01-01", "2026-06-12").key, "current");
  assert.equal(documentRenewalStatus("", "2026-06-12").key, "not-tracked");
});

test("property activity is scoped, sorted, and limited", () => {
  const rows = propertyActivityEntries([
    { id: "old", propertyId: "p1", at: "2026-01-01" },
    { id: "other", propertyId: "p2", at: "2026-06-01" },
    { id: "new", propertyId: "p1", at: "2026-06-12" },
  ], "p1", 1);
  assert.deepEqual(rows.map((row) => row.id), ["new"]);
});
