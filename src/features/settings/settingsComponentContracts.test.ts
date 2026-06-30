import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("settings workspace exposes compact tab summaries and backup controls", () => {
  const source = readFileSync(new URL("./SettingsWorkspace.jsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /CardTitle>Settings<\/CardTitle>/);
  assert.doesNotMatch(source, /SettingsStatusTile/);
  assert.match(source, /Restore point available/);
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
  assert.match(source, /Desktop keeps the newest 8 managed restore-point files/);
  assert.match(source, /Recovery tools/);
  assert.match(source, /Hidden for now\. Expand when you need to adjust these settings\./);
});
