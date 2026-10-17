import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveMileageRate, standardMileageRate } from "./mileageRates.ts";
import { createFullYearDemoScenario } from "./demoScenario.ts";
import { postedMileageEntryIds, validateMileageEntry } from "./mileageLog.ts";
import { createDemoDataState } from "../store/rentalStoreData.ts";

test("automatic mileage respects year and midyear rate boundaries", () => {
  for (const [date, expected] of [["2022-06-30", .585], ["2022-07-01", .625], ["2025-12-31", .7], ["2026-01-01", .725], ["2026-06-30", .725], ["2026-07-01", .76], ["2026-12-31", .76]] as const) {
    assert.equal(standardMileageRate(date), expected);
    assert.equal(resolveMileageRate(date, ""), expected);
  }
  for (const date of ["", "2026-02-30", "2027-01-01", "2019-12-31"]) assert.equal(standardMileageRate(date), null);
});

test("saved rates and explicit overrides survive date changes", () => {
  assert.equal(resolveMileageRate("2026-07-01", .725), .725);
  assert.equal(resolveMileageRate("2027-01-01", "0.8"), .8);
  for (const rate of ["0", "-1", "bad"]) assert.equal(resolveMileageRate("2026-07-01", rate), null);
});

test("demo includes valid linked mileage postings and an unposted trip", () => {
  const demo = createFullYearDemoScenario();
  assert.ok(demo.mileageEntries.every(validateMileageEntry));
  const posted = postedMileageEntryIds(demo.transactions);
  assert.equal(posted.size, 2);
  assert.equal(demo.mileageEntries.filter((entry) => !posted.has(entry.id)).length, 1);
  for (const entry of demo.mileageEntries) assert.equal(entry.rate, standardMileageRate(entry.date));
});

test("startup demo retains the trips referenced by its mileage expenses", async () => {
  const demo = await createDemoDataState();
  const ids = new Set(demo.mileageEntries.map((entry) => entry.id));
  assert.equal(ids.size, 3);
  for (const id of postedMileageEntryIds(demo.transactions)) assert.ok(ids.has(id));
});
