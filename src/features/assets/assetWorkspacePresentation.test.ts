import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAssetReviewGroups,
  buildAssetSummary,
  buildAssetWorkspaceModes,
  getAssetSourceStatus,
} from "./assetWorkspacePresentation.js";

const readyAsset = {
  id: "asset-1",
  propertyId: "p1",
  unit: "Shared",
  description: "Building basis",
  type: "Residential Building",
  placedInService: "2026-01-01",
  cost: 300000,
  basis: 240000,
  landValue: 60000,
  life: 27.5,
  sourceTransactionId: "txn-1",
};

describe("asset workspace presentation helpers", () => {
  it("separates the depreciation workspace into four clear modes", () => {
    const modes = buildAssetWorkspaceModes({ assetCount: 3, cleanupCount: 2, year: 2026 });

    assert.deepEqual(modes.map((mode) => mode.key), ["overview", "register", "schedules", "cleanup"]);
    assert.equal(modes.find((mode) => mode.key === "register")?.badge, "3 assets");
    assert.equal(modes.find((mode) => mode.key === "schedules")?.badge, "2026 tax year");
    assert.equal(modes.find((mode) => mode.key === "cleanup")?.badge, "2 open");
  });

  it("shows a clear cleanup state when no asset work is open", () => {
    const cleanup = buildAssetWorkspaceModes({ assetCount: 1, cleanupCount: 0, year: 2026 })
      .find((mode) => mode.key === "cleanup");

    assert.equal(cleanup?.badge, "Clear");
  });

  it("summarizes selected-year cost, basis, depreciation, review, and source counts", () => {
    const summary = buildAssetSummary({
      assets: [
        readyAsset,
        { ...readyAsset, id: "asset-2", cost: 1200, basis: 0, sourceTransactionId: "" },
      ],
      adjustedAssetDepreciationForYear: ({ asset }) => asset.id === "asset-1" ? 8727.27 : 0,
      reviewContext: { transactions: [{ id: "txn-1", amount: 240000, capitalImprovement: true }], yearFilter: "2026" },
      transactionById: { "txn-1": { id: "txn-1" } },
      year: 2026,
    });

    assert.equal(summary.totalCost, 301200);
    assert.equal(summary.totalBasis, 240000);
    assert.equal(summary.selectedYearDepreciation, 8727.27);
    assert.equal(summary.assetCount, 2);
    assert.equal(summary.needsReviewCount, 1);
    assert.equal(summary.sourceLinkedCount, 1);
  });

  it("counts missing source documentation as review attention", () => {
    const summary = buildAssetSummary({
      assets: [{ ...readyAsset, sourceTransactionId: "" }],
      adjustedAssetDepreciationForYear: () => 8727.27,
      reviewContext: { transactions: [{ id: "txn-1", amount: 240000, capitalImprovement: true }], yearFilter: "2026" },
      transactionById: { "txn-1": { id: "txn-1" } },
      year: 2026,
    });

    assert.equal(summary.needsReviewCount, 1);
    assert.equal(summary.sourceLinkedCount, 0);
  });

  it("labels source record states", () => {
    assert.equal(getAssetSourceStatus(readyAsset, { transactionById: { "txn-1": {} } }).key, "source_linked");
    assert.equal(getAssetSourceStatus({ ...readyAsset, sourceTransactionIds: ["txn-1", "txn-2"] }, { transactionById: { "txn-1": {}, "txn-2": {} } }).key, "multiple_sources");
    assert.equal(getAssetSourceStatus({ ...readyAsset, sourceTransactionId: "missing" }, { transactionById: {} }).key, "missing_source");
    assert.equal(getAssetSourceStatus({ ...readyAsset, sourceTransactionId: "" }, { transactionById: {} }).key, "missing_source");
  });

  it("groups asset review status into landlord-facing categories", () => {
    const groups = buildAssetReviewGroups({
      assets: [readyAsset, { ...readyAsset, id: "asset-2", sourceTransactionId: "" }],
      transactionById: { "txn-1": {} },
      assetReviewInbox: {
        transactionCandidates: [{ transaction: { id: "candidate" } }],
        assetRecords: [{
          asset: readyAsset,
          issues: [
            { key: "mixed_use_review_needed" },
            { key: "source_transaction_amount_mismatch" },
          ],
        }],
        counts: { readyAssets: 1 },
      },
    });

    assert.equal(groups.find((group) => group.key === "transaction_candidates")?.count, 1);
    assert.equal(groups.find((group) => group.key === "asset_warnings")?.count, 2);
    assert.equal(groups.find((group) => group.key === "missing_sources")?.count, 1);
    assert.equal(groups.find((group) => group.key === "missing_sources")?.label, "Source documentation missing");
    assert.equal(groups.find((group) => group.key === "mixed_use")?.count, 1);
    assert.equal(groups.find((group) => group.key === "basis_source")?.count, 1);
    assert.equal(groups.find((group) => group.key === "ready_assets")?.count, 1);
    assert.equal(groups.find((group) => group.key === "ready_assets")?.label, "Tax-ready assets");
  });
});
