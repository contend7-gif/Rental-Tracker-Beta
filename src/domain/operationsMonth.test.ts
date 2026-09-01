import test from "node:test";
import assert from "node:assert/strict";
import { buildCalendarMonthDays, shiftCalendarMonth } from "./operationsMonth.ts";

test("calendar month grid includes six complete Sunday-first weeks", () => {
  const days = buildCalendarMonthDays("2026-08");
  assert.equal(days.length, 42);
  assert.equal(days[0].date, "2026-07-26");
  assert.equal(days.at(-1)?.date, "2026-09-05");
  assert.equal(days.filter((day) => day.inMonth).length, 31);
});

test("calendar month navigation crosses year boundaries", () => {
  assert.equal(shiftCalendarMonth("2026-12", 1), "2027-01");
  assert.equal(shiftCalendarMonth("2026-01", -1), "2025-12");
});

