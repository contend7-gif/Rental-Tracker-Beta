import assert from "node:assert/strict";
import test from "node:test";

import { formatDesktopUpdateDate } from "./desktopUpdateShared.ts";

test("release-note date-only values stay on the intended local calendar date", () => {
  const expected = new Date(2026, 7, 24).toLocaleDateString();

  assert.equal(formatDesktopUpdateDate("2026-08-24"), expected);
});

test("desktop update timestamps retain their local date and time", () => {
  const timestamp = "2026-08-24T15:30:00Z";

  assert.equal(formatDesktopUpdateDate(timestamp), new Date(timestamp).toLocaleString());
});

test("invalid desktop update dates stay blank", () => {
  assert.equal(formatDesktopUpdateDate("2026-02-30"), "");
  assert.equal(formatDesktopUpdateDate("not-a-date"), "");
  assert.equal(formatDesktopUpdateDate(""), "");
});
