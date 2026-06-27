import test from "node:test";
import assert from "node:assert/strict";
import { compareReleaseVersions, findReleaseNotesEntry, getRecentReleaseNotes } from "./releaseNotes.ts";

test("findReleaseNotesEntry returns bundled notes for known versions", () => {
  const entry = findReleaseNotesEntry("v1.15.0");
  assert.equal(entry?.version, "1.15.0");
  assert.ok(entry?.changes.length);
});

test("compareReleaseVersions sorts semantic versions correctly", () => {
  assert.equal(compareReleaseVersions("1.15.0", "1.14.9") > 0, true);
  assert.equal(compareReleaseVersions("1.12.1", "1.12.1"), 0);
  assert.equal(compareReleaseVersions("1.12.0", "1.12.1") < 0, true);
});

test("getRecentReleaseNotes returns newest entries first", () => {
  const entries = getRecentReleaseNotes(3);
  assert.equal(entries.length, 3);
  assert.equal(compareReleaseVersions(entries[0]?.version, entries[1]?.version) >= 0, true);
  assert.equal(compareReleaseVersions(entries[1]?.version, entries[2]?.version) >= 0, true);
});
