import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Documents hides Mobile Inbox when the optional integration is disabled", () => {
  const source = readFileSync(new URL("./DocumentsWorkspace.jsx", import.meta.url), "utf8");

  assert.match(source, /mobileCompanionEnabled \? \(/);
  assert.match(source, /openMobileCompanionSettings/);
});

test("Mobile Inbox routes pairing management to Settings", () => {
  const source = readFileSync(new URL("./MobileInboxPanel.jsx", import.meta.url), "utf8");

  assert.match(source, /Pair a private companion under Settings/);
  assert.match(source, /onOpenSettings/);
  assert.doesNotMatch(source, /Desktop sync secret/);
});
