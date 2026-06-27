import test from "node:test";
import assert from "node:assert/strict";
import { deriveLeaseRoll, groupLeaseCleanup, leaseRollCleanupLabel, leaseRollOccupantLabel, summarizeLeaseRoll } from "./leaseWorkspacePresentation.js";

const property = { id: "p1", name: "Duplex" };
const baseRow = {
  unit: { id: "u1", propertyId: "p1", name: "A" }, auditStart: "2026-01-01", auditEnd: "2026-06-13",
  inServiceForYear: true, gaps: [], overlaps: [], totalDays: 164, coveredDays: 164, monthlyStatus: [],
  leasesForUnit: [], occupancyForUnit: [], statusAsOfAuditEnd: "Vacant", isCoverageComplete: true,
};

test("lease roll distinguishes occupied, owner occupied, and future units", () => {
  const roll = deriveLeaseRoll({
    todayIso: "2026-06-13",
    leaseCoverageByProperty: [{ property, unitRows: [
      { ...baseRow, leasesForUnit: [{ id: "l1", propertyId: "p1", unit: "A", tenantName: "Tenant", startDate: "2026-01-01", endDate: "2026-07-01", monthlyRent: 1200 }] },
      { ...baseRow, unit: { id: "u2", propertyId: "p1", name: "B" }, occupancyForUnit: [{ id: "o1", propertyId: "p1", unit: "B", useType: "Owner-Occupied", startDate: "2026-01-01", endDate: "" }] },
      { ...baseRow, unit: { id: "u3", propertyId: "p1", name: "C" }, leasesForUnit: [{ id: "l2", propertyId: "p1", unit: "C", tenantName: "Future", startDate: "2026-08-01", endDate: "2027-07-31", monthlyRent: 1300 }] },
    ] }],
  });
  assert.deepEqual(roll.map((item) => item.status), ["Occupied", "Owner occupied", "Future"]);
  assert.equal(summarizeLeaseRoll(roll, 2, true).upcomingExpirations, 1);
});

test("cleanup grouping keeps detailed counts behind three landlord-facing categories", () => {
  const groups = groupLeaseCleanup({
    occupancyReviewInbox: { records: [{}, {}] },
    tenantLedgerReviewInbox: { records: [{}], counts: { depositIssues: 1, openBalances: 2, unappliedCredits: 0, feeClassificationIssues: 1 } },
  });
  assert.deepEqual(groups.map((group) => group.count), [2, 1, 4]);
});

test("lease roll occupant labels never use status as a tenant name", () => {
  assert.equal(leaseRollOccupantLabel({ status: "Occupied", activeLease: { tenantName: "" } }), "No tenant name on file");
  assert.equal(leaseRollOccupantLabel({ status: "Owner occupied" }), "Owner occupied");
  assert.equal(leaseRollOccupantLabel({ status: "Vacant" }), "No current occupant");
});

test("lease roll cleanup labels distinguish ledger and occupancy work", () => {
  assert.equal(leaseRollCleanupLabel({ ledgerCleanupCount: 1, occupancyCleanupCount: 0 }), "1 ledger item");
  assert.equal(leaseRollCleanupLabel({ ledgerCleanupCount: 0, occupancyCleanupCount: 2 }), "2 occupancy items");
  assert.equal(leaseRollCleanupLabel({ ledgerCleanupCount: 0, occupancyCleanupCount: 0 }), "No cleanup items");
});
