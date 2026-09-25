import assert from "node:assert/strict";
import test from "node:test";
import type { MileageEntry, Transaction } from "../models.ts";
import { buildMileagePosting, postedMileageEntryIds } from "./mileageLog.ts";

const trips: MileageEntry[] = [
  { id: "a", date: "2026-08-10", propertyId: "p1", unit: "616", destination: "Hardware store", purpose: "Buy rental supplies", miles: 10, rate: 0.725 },
  { id: "b", date: "2026-08-20", propertyId: "p1", unit: "616", destination: "Rental property", purpose: "Inspect repair", miles: 20, rate: 0.725 },
];
const context = { transactions: [] as Transaction[], usePeriods: [], leases: [], units: [], todayIso: "2026-09-24" };

test("monthly mileage posting totals separate trip records once", () => {
  const posting = buildMileagePosting(trips, context);
  assert.ok(posting);
  assert.equal(posting.date, "2026-08-31");
  assert.equal(posting.amount, 21.75);
  assert.equal(posting.deductibleAmount, 21.75);
  assert.deepEqual(posting.mileageEntryIds, ["a", "b"]);
  assert.equal(postedMileageEntryIds([{ ...posting, id: "posted" } as Transaction]).has("a"), true);
  assert.equal(buildMileagePosting(trips, { ...context, transactions: [{ ...posting, id: "posted" } as Transaction] }), null);
});

test("mileage posting waits for a complete month and keeps property scopes separate", () => {
  assert.equal(buildMileagePosting(trips, { ...context, todayIso: "2026-08-24" }), null);
  assert.equal(buildMileagePosting([{ ...trips[0], destination: "" }], context), null);
  assert.equal(buildMileagePosting([trips[0], { ...trips[1], unit: "614" }], context), null);
});

test("mileage posting applies rental use on each trip date", () => {
  const posting = buildMileagePosting(trips, {
    ...context,
    usePeriods: [{ id: "owner", propertyId: "p1", unit: "616", startDate: "2026-08-01", endDate: "2026-08-15", useType: "Owner use", rentalUsePct: 0 }] as never[],
  });
  assert.ok(posting);
  assert.equal(posting.deductibleAmount, 14.5);
});
