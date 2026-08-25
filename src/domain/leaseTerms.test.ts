import assert from "node:assert/strict";
import test from "node:test";

import {
  leaseBillingCadenceLabel,
  leaseMonthlyEquivalent,
  leaseRentSummaryLabel,
  leaseTermSummaryLabel,
  normalizeLeaseAgreementType,
  normalizeLeaseBillingCadence,
} from "./leaseTerms.js";

function lease(overrides = {}) {
  return {
    startDate: "2026-08-12",
    endDate: "2026-09-11",
    monthlyRent: 1550,
    rentalType: "Mid-term",
    monthToMonthAfterTerm: false,
    extensionTermMonths: 0,
    ...overrides,
  };
}

test("legacy 30-day mid-term leases remain one full-term charge", () => {
  const record = lease();
  assert.equal(normalizeLeaseAgreementType(record), "fixed_term");
  assert.equal(normalizeLeaseBillingCadence(record), "full_term");
  assert.equal(leaseBillingCadenceLabel(record), "Full term, paid upfront");
  assert.equal(leaseRentSummaryLabel(record, (value) => `$${value}`), "$1550 full term");
});

test("duration and agreement are independent", () => {
  const record = lease({
    rentalType: "Mid-term",
    agreementType: "fixed_then_month_to_month",
    billingCadence: "monthly",
  });
  assert.equal(leaseTermSummaryLabel(record), "Mid-term | Fixed, then month-to-month");
});

test("weekly and custom rents expose planning-safe monthly equivalents", () => {
  assert.equal(leaseMonthlyEquivalent(lease({ billingCadence: "weekly", rentAmount: 500 })), 2166.67);
  assert.equal(leaseMonthlyEquivalent(lease({ billingCadence: "custom", billingIntervalDays: 10, rentAmount: 300 })), 913.13);
});

test("a roughly one-month full-term rent keeps its familiar monthly planning amount", () => {
  assert.equal(leaseMonthlyEquivalent(lease({ billingCadence: "full_term", rentAmount: 1550 })), 1550);
});
