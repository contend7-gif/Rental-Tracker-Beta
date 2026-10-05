import test from "node:test";
import assert from "node:assert/strict";
import { deriveLeaseList, deriveLeaseRoll, groupLeaseCleanup, leaseRollCleanupLabel, leaseRollOccupantLabel, summarizeLeaseRoll } from "./leaseWorkspacePresentation.js";

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

test("agreement list retains overlapping active leases and every upcoming agreement", () => {
  const leases = [
    { id: "a", propertyId: "p1", unit: "A", startDate: "2026-01-01", endDate: "2026-12-31" },
    { id: "overlap", propertyId: "p1", unit: "A", startDate: "2026-02-01", endDate: "2026-12-31" },
    { id: "future1", propertyId: "p1", unit: "A", startDate: "2027-01-01", endDate: "2027-03-01" },
    { id: "future2", propertyId: "p1", unit: "A", startDate: "2027-04-01", endDate: "2027-06-01" },
  ];
  const rows = deriveLeaseList({ leases, todayIso: "2026-10-03" });
  assert.equal(rows.filter((row) => row.category === "active").length, 2);
  assert.equal(rows.filter((row) => row.category === "upcoming").length, 2);
});

test("agreement list respects actual departures, open-ended terms and incomplete dates", () => {
  const rows = deriveLeaseList({ todayIso: "2026-10-03", leases: [
    { id: "departed", startDate: "2026-01-01", endDate: "2026-12-31", actualEndDate: "2026-09-30" },
    { id: "open", startDate: "2026-01-01", agreementType: "month_to_month" },
    { id: "incomplete", startDate: "2026-01-01", agreementType: "fixed_term" },
  ] });
  assert.equal(rows.find((row) => row.lease.id === "departed").category, "past");
  assert.equal(rows.find((row) => row.lease.id === "open").category, "active");
  assert.equal(rows.find((row) => row.lease.id === "open").expirationDays, null);
  assert.equal(rows.find((row) => row.lease.id === "incomplete").category, "review");
});

test("agreement list scopes records and attaches review issues to the exact lease", () => {
  const leases = [{ id: "old", propertyId: "p1", unit: "A", startDate: "2025-01-01", endDate: "2025-12-31" },
    { id: "new", propertyId: "p1", unit: "A", startDate: "2026-01-01", endDate: "2026-12-31" },
    { id: "other", propertyId: "p2", unit: "A", startDate: "2026-01-01", endDate: "2026-12-31" }];
  const rows = deriveLeaseList({ leases, properties: [property], propertyFilter: "p1", unitFilter: "A", todayIso: "2026-10-03",
    tenantLedgerReviewInbox: { records: [{ lease: leases[0], issues: [{ label: "Deposit disposition open" }] }] } });
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.lease.id === "old").reviewIssues.length, 1);
  assert.equal(rows.find((row) => row.lease.id === "new").reviewIssues.length, 0);
});
