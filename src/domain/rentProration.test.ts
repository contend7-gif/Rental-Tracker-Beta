import test from "node:test";
import assert from "node:assert/strict";
import { isSingleMonthFixedTermLease, proratedRentForMonth30Day, rentAmountForLeasePayment } from "./rentProration.js";

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

test("one-month mid-term lease is billed once for the full prepaid term", () => {
  const prepaidLease = {
    ...lease,
    startDate: "2026-08-12",
    endDate: "2026-09-11",
    actualEndDate: "2026-09-11",
    monthlyRent: 1550,
    rentalType: "Mid-term",
    extensionTermMonths: 0,
  };

  assert.equal(isSingleMonthFixedTermLease(prepaidLease), true);
  assert.equal(proratedRentForMonth30Day(prepaidLease, "2026-08-12"), 1550);
  assert.equal(proratedRentForMonth30Day(prepaidLease, "2026-09-01"), 0);
  assert.equal(rentAmountForLeasePayment(prepaidLease, "2026-08-15"), 1550);
});
