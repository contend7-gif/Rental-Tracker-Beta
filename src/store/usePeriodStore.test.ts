import assert from "node:assert/strict";
import test from "node:test";
import type { UsePeriod } from "../models.ts";
import { createUsePeriodActions, normalizeUsePeriod } from "./usePeriodStore.ts";

test("vacancy normalization and editing preserve the selected rental purpose", () => {
  const legacy: UsePeriod = { id: "gap", propertyId: "p1", unit: "616", startDate: "2026-08-10", endDate: "2026-08-11", useType: "Vacant", rentalUsePct: 0 };
  assert.equal(normalizeUsePeriod(legacy).rentalUsePct, 1);
  assert.equal(legacy.rentalUsePct, 0);
  let periods: UsePeriod[] = [];
  const actions = createUsePeriodActions({ getUsePeriods: () => periods, setUsePeriods: (update) => { periods = typeof update === "function" ? update(periods) : update; }, appendActivityLog: () => undefined });
  actions.upsertUsePeriod(legacy);
  assert.equal(periods[0].rentalUsePct, 1);
  actions.upsertUsePeriod({ ...legacy, vacancyTreatment: "nonrental" });
  actions.updateUsePeriodReview("gap", { reviewed: true });
  assert.equal(periods[0].rentalUsePct, 0);
  assert.equal(periods[0].vacancyTreatment, "nonrental");
});

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
