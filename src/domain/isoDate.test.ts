import test from "node:test";
import assert from "node:assert/strict";
import { isValidIsoDate } from "./isoDate.ts";

test("isValidIsoDate accepts calendar dates and rejects impossible dates", () => {
  assert.equal(isValidIsoDate("2024-02-29"), true);
  assert.equal(isValidIsoDate("2025-02-29"), false);
  assert.equal(isValidIsoDate("2025-2-09"), false);
  assert.equal(isValidIsoDate("2025-13-01"), false);
  assert.equal(isValidIsoDate("2025-01-01T00:00:00.000Z"), false);
});
