import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("settings workspace exposes modern tab summaries and status tiles", () => {
  const source = readFileSync(new URL("./SettingsWorkspace.jsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /CardTitle>Settings<\/CardTitle>/);
  assert.match(source, /SettingsStatusTile/);
  assert.match(source, /Data safety/);
  assert.match(source, /Restore point available/);
  assert.match(source, /Daily preferences/);
  assert.match(source, /Restore points/);
  assert.match(source, /Admin tools/);
  assert.match(source, /Beta install safety/);
  assert.match(source, /Data anchored/);
  assert.match(source, /Confirm data folder before installing beta/);
  assert.match(source, /Hidden for now\. Expand when you need to adjust these settings\./);
});
