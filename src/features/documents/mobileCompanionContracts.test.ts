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

test("maintenance captures receive a work-order-oriented desktop review", () => {
  const inbox = readFileSync(new URL("./MobileInboxPanel.jsx", import.meta.url), "utf8");
  const dialogs = readFileSync(new URL("./DocumentDialogs.jsx", import.meta.url), "utf8");

  assert.match(inbox, /submission\.kind === "maintenance"/);
  assert.match(dialogs, /Review maintenance capture/);
  assert.match(dialogs, /Confirm work order/);
});

test("Mobile Inbox syncs only the desktop-built property catalog", () => {
  const workspace = readFileSync(new URL("./DocumentsWorkspace.jsx", import.meta.url), "utf8");
  const inbox = readFileSync(new URL("./MobileInboxPanel.jsx", import.meta.url), "utf8");

  assert.match(workspace, /buildMobileCompanionCatalog\(\{ properties, units \}\)/);
  assert.match(inbox, /syncPropertyCatalog\(propertyCatalog\)/);
});

test("mobile mileage opens the existing desktop transaction review workflow", () => {
  const inbox = readFileSync(new URL("./MobileInboxPanel.jsx", import.meta.url), "utf8");
  const controller = readFileSync(new URL("../../app/useTransactionEntryController.js", import.meta.url), "utf8");

  assert.match(inbox, /Review trip/);
  assert.match(inbox, /onMileageReview/);
  assert.match(controller, /category: "Auto and travel"/);
  assert.match(controller, /mobileCompanionMileageId/);
  assert.match(controller, /completeMileage/);
});
