import assert from "node:assert/strict";
import test from "node:test";

import { createWorkspaceFocusRequest, workspaceFocusDomId } from "./workspaceFocus.ts";

test("workspace focus requests remain distinct for repeated navigation", () => {
  const first = createWorkspaceFocusRequest("maintenance", "wo-1");
  const second = createWorkspaceFocusRequest("maintenance", "wo-1");
  assert.equal(first.source, "maintenance");
  assert.equal(first.recordId, "wo-1");
  assert.notEqual(first.requestId, second.requestId);
});

test("workspace focus DOM ids are stable and selector safe", () => {
  assert.equal(workspaceFocusDomId("work order", "wo:1 / sink"), "workspace-focus-work-order-wo-1-sink");
});

