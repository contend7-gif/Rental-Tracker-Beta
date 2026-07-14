import assert from "node:assert/strict";
import test from "node:test";
import type { UsePeriod } from "../models.ts";
import { createUsePeriodActions } from "./usePeriodStore.ts";

test("occupancy actions update current state and review metadata", () => {
  let usePeriods: UsePeriod[] = [];
  const setUsePeriods = (updater: UsePeriod[] | ((previous: UsePeriod[]) => UsePeriod[])) => {
    usePeriods = typeof updater === "function" ? updater(usePeriods) : updater;
  };
  const actions = createUsePeriodActions({
    getUsePeriods: () => usePeriods,
    setUsePeriods,
    appendActivityLog: () => undefined,
  });

  actions.upsertUsePeriod({
    id: "period-1",
    propertyId: "property-1",
    unit: "Unit 1",
    startDate: "2026-01-01",
    useType: "Owner-Occupied",
  });
  actions.updateUsePeriodReview("period-1", { reviewed: true, reviewNotes: "Verified" });
  assert.equal(usePeriods[0].rentalUsePct, 0);
  assert.equal(usePeriods[0].reviewed, true);
  assert.equal(usePeriods[0].reviewNotes, "Verified");
});
