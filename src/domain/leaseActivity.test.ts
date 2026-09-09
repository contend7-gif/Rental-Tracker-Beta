import test from "node:test";
import assert from "node:assert/strict";
import { leaseIsActiveByDate } from "./leaseActivity.ts";

const baseLease = {
  startDate: "2025-01-01",
  actualEndDate: "",
  endDate: "2025-12-31",
  agreementType: "fixed_term",
  monthToMonthAfterTerm: false,
} as const;

test("leaseIsActiveByDate respects start, actual end, fixed end, and open-ended terms", () => {
  assert.equal(leaseIsActiveByDate(baseLease, "2024-12-31"), false);
  assert.equal(leaseIsActiveByDate(baseLease, "2025-06-01"), true);
  assert.equal(leaseIsActiveByDate(baseLease, "2026-01-01"), false);
  assert.equal(leaseIsActiveByDate({ ...baseLease, actualEndDate: "2025-06-15" }, "2025-06-15"), true);
  assert.equal(leaseIsActiveByDate({ ...baseLease, actualEndDate: "2025-06-15" }, "2025-06-16"), false);
  assert.equal(leaseIsActiveByDate({ ...baseLease, agreementType: "month_to_month", endDate: "" }, "2030-01-01"), true);
  assert.equal(leaseIsActiveByDate(baseLease, ""), false);
});
