import assert from "node:assert/strict";
import test from "node:test";
import { createActionFacade } from "./useStableActions.ts";

test("stable action facade forwards calls to the latest implementation", () => {
  let multiplier = 2;
  let currentActions = { calculate: (value: number) => value * multiplier };
  const stableActions = createActionFacade(() => currentActions, ["calculate"]);
  const calculate = stableActions.calculate;

  assert.equal(calculate(3), 6);
  multiplier = 4;
  currentActions = { calculate: (value: number) => value * multiplier };

  assert.equal(stableActions.calculate, calculate);
  assert.equal(calculate(3), 12);
});
