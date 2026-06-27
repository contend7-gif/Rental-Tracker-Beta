import test from "node:test";
import assert from "node:assert/strict";
import { proratedRentForMonth30Day } from "./rentProration.js";

const lease = {
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  actualEndDate: "",
  monthlyRent: 1500,
  rentalType: "Long-term",
  monthToMonthAfterTerm: false,
};

test("30-day rent proration handles a partial final month", () => {
  assert.equal(proratedRentForMonth30Day({ ...lease, endDate: "2026-02-20" }, "2026-02-01"), 1000);
});

test("30-day rent proration handles a partial first month", () => {
  assert.equal(proratedRentForMonth30Day({ ...lease, startDate: "2026-02-21" }, "2026-02-21"), 500);
});

test("30-day rent proration preserves full monthly rent in short calendar months", () => {
  assert.equal(proratedRentForMonth30Day(lease, "2026-02-01"), 1500);
});
