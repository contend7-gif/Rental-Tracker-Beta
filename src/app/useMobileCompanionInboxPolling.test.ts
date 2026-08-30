import assert from "node:assert/strict";
import test from "node:test";
import { countMobileCompanionWaiting, MOBILE_COMPANION_POLL_INTERVAL_MS } from "./useMobileCompanionInboxPolling.ts";

test("mobile companion waiting count includes capture and mileage review items", () => {
  const submissions = [
    { id: "capture-1", status: "pending" },
    { id: "capture-2", status: "claimed" },
    { id: "capture-3", status: "imported" },
  ];
  const mileageEntries = [
    { id: "trip-1", status: "pending" },
    { id: "trip-2", status: "imported" },
  ];

  assert.equal(countMobileCompanionWaiting(submissions, mileageEntries), 3);
  assert.equal(MOBILE_COMPANION_POLL_INTERVAL_MS, 30_000);
});
