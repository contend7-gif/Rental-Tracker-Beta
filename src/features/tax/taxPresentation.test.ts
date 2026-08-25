import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTaxWorkspaceModes } from "./taxPresentation.js";

describe("tax workspace presentation", () => {
  it("groups tax work into four landlord-facing jobs", () => {
    const modes = buildTaxWorkspaceModes({ packageStatus: "Preliminary", reviewCount: 5, sourceRowCount: 18 });

    assert.deepEqual(modes.map((mode) => mode.key), ["summary", "schedule", "review", "filing"]);
    assert.deepEqual(modes.find((mode) => mode.key === "schedule")?.tabs, ["schedule", "details"]);
    assert.deepEqual(modes.find((mode) => mode.key === "review")?.tabs, ["review", "depreciation", "loans", "tools"]);
    assert.equal(modes.find((mode) => mode.key === "review")?.badge, "5 open");
    assert.equal(modes.find((mode) => mode.key === "filing")?.badge, "Preliminary");
  });

  it("shows a clear review state when no tax work is open", () => {
    const reviewMode = buildTaxWorkspaceModes({ packageStatus: "Ready", reviewCount: 0, sourceRowCount: 1 })
      .find((mode) => mode.key === "review");

    assert.equal(reviewMode?.badge, "Ready");
  });
});
