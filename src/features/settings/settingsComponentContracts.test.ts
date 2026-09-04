import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("settings workspace exposes compact tab summaries and backup controls", () => {
  const source = readFileSync(new URL("./SettingsWorkspace.jsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /CardTitle>Settings<\/CardTitle>/);
  assert.doesNotMatch(source, /SettingsStatusTile/);
  assert.match(source, /Verified recoverable/);
  assert.match(source, /Daily preferences/);
  assert.match(source, /Restore points/);
  assert.match(source, /Admin tools/);
  assert.match(source, /Restore point/);
  assert.match(source, /Backup files/);
  assert.match(source, /Storage health/);
  assert.match(source, /Real data readiness/);
  assert.match(source, /Sample data reset/);
  assert.match(source, /Data anchored/);
  assert.match(source, /Create restore point/);
  assert.match(source, /Validate backup/);
  assert.match(source, /Export latest restore point/);
  assert.match(source, /Show folder paths/);
  assert.match(source, /Show recovery tools/);
  assert.match(source, /Show checklist/);
  assert.match(source, /counted as recoverable only after validation/);
  assert.match(source, /OS-encrypted/);
  assert.match(source, /Recovery tools/);
  assert.match(source, /Hidden for now\. Expand when you need to adjust these settings\./);
  assert.match(source, /title="Mobile companion"/);
  assert.match(source, /Rental Tracker remains complete and local-first when this feature is off/);
});

test("mobile companion settings expose opt-in, pairing status, and disconnect controls", () => {
  const source = readFileSync(new URL("./MobileCompanionSettings.jsx", import.meta.url), "utf8");

  assert.match(source, /Off and hidden/);
  assert.match(source, /Paired securely/);
  assert.match(source, /Update pairing/);
  assert.match(source, /Remove saved credentials/);
  assert.match(source, /Each user who wants mobile capture must deploy and privately own a separate companion Site/);
});
