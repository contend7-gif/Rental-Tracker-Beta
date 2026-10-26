import assert from "node:assert/strict";
import test from "node:test";
import { rentalAmountSplit } from "./rentalAmountSplit.ts";

test("dollar splits convert to the existing owner percentage without losing rental cents", () => {
  for (const [total, rental] of [[100, 60], [87.13, 29.99], [100, 0], [100, 100], [0.03, 0.01]]) {
    const split = rentalAmountSplit(total, rental.toFixed(2));
    assert.equal(split.error, undefined);
    const allocated = Math.round(total * (1 - Number(split.ownerUsePct) / 100) * 100) / 100;
    assert.equal(allocated, rental);
  }
  assert.equal(rentalAmountSplit(100, "60").ownerUsePct, "40");
});

test("invalid rental amounts cannot silently clamp into a different allocation", () => {
  for (const input of ["", "-1", "101", "NaN", "Infinity", "1.234", "1e2"]) {
    assert.ok(rentalAmountSplit(100, input).error, input);
  }
  for (const total of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) assert.ok(rentalAmountSplit(total, "0").error);
});
