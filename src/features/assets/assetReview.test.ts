import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAssetDraftFromTransaction,
  buildCapitalImprovementTransactionCandidates,
  getAssetReadiness,
  getAssetReviewIssues,
} from "./assetReview.js";

const baseTransaction = {
  id: "t1",
  date: "2026-04-12",
  propertyId: "p1",
  unit: "Shared",
  type: "Expense",
  category: "Repairs",
  description: "Roof replacement",
  amount: 842.15,
  ownerUsePct: 0,
  rentalUsePct: 1,
  deductibleAmount: 842.15,
  paidFrom: "Checking",
  paymentMethod: "Card",
  reimbursable: false,
  reimbursed: false,
  capitalImprovement: true,
  vendor: "Menards",
  receiptName: "",
  notes: "",
  taxChecked: false,
  status: "active",
};

const readyAsset = {
  id: "a1",
  propertyId: "p1",
  unit: "Shared",
  description: "Roof replacement",
  type: "Capital Improvement",
  placedInService: "2026-04-12",
  cost: 842.15,
  basis: 842.15,
  life: 27.5,
  currentYearDep: 30.62,
  bonusEligible: false,
  bonusElected: false,
  bonusRate: 0,
};

describe("asset review helpers", () => {
  it("shows capital-improvement transactions without linked assets", () => {
    const records = buildCapitalImprovementTransactionCandidates({
      transactions: [baseTransaction],
      assets: [],
      yearFilter: "2026",
    });

    assert.equal(records.length, 1);
    assert.equal(records[0].issues[0].key, "capital_transaction_without_asset");
  });

  it("shows possible improvement wording as a candidate", () => {
    const transaction = {
      ...baseTransaction,
      id: "t2",
      capitalImprovement: false,
      description: "replace water heater",
    };

    const records = buildCapitalImprovementTransactionCandidates({
      transactions: [transaction],
      assets: [],
      yearFilter: "2026",
    });

    assert.equal(records.length, 1);
    assert.equal(records[0].issues[0].key, "possible_improvement_without_asset");
  });

  it("hides transactions already linked to an asset", () => {
    const records = buildCapitalImprovementTransactionCandidates({
      transactions: [baseTransaction],
      assets: [{ ...readyAsset, sourceTransactionId: baseTransaction.id }],
      yearFilter: "2026",
    });

    assert.equal(records.length, 0);
  });

  it("hides capital-improvement transactions linked through multi-source asset support", () => {
    const records = buildCapitalImprovementTransactionCandidates({
      transactions: [baseTransaction],
      assets: [{ ...readyAsset, sourceTransactionId: "", sourceTransactionIds: [baseTransaction.id] }],
      yearFilter: "2026",
    });

    assert.equal(records.length, 0);
  });

  it("flags missing placed-in-service date", () => {
    const issues = getAssetReviewIssues({ ...readyAsset, placedInService: "" }, { yearFilter: "2026" });
    assert.ok(issues.some((issue) => issue.key === "asset_missing_placed_in_service"));
  });

  it("flags missing basis", () => {
    const issues = getAssetReviewIssues({ ...readyAsset, basis: 0 }, { yearFilter: "2026" });
    assert.ok(issues.some((issue) => issue.key === "asset_missing_basis"));
  });

  it("flags residential buildings missing land value", () => {
    const issues = getAssetReviewIssues({
      ...readyAsset,
      type: "Residential Building",
      cost: 300000,
      basis: 300000,
      life: 27.5,
      landValue: 0,
    }, { yearFilter: "2026" });

    assert.ok(issues.some((issue) => issue.key === "building_missing_land_value"));
  });

  it("flags bonus depreciation on buildings or long-life assets", () => {
    const buildingIssues = getAssetReviewIssues({
      ...readyAsset,
      type: "Residential Building",
      life: 27.5,
      landValue: 50000,
      bonusElected: true,
      bonusRate: 0.6,
    }, { yearFilter: "2026" });
    const longLifeIssues = getAssetReviewIssues({
      ...readyAsset,
      life: 25,
      bonusElected: true,
      bonusRate: 0.6,
    }, { yearFilter: "2026" });

    assert.ok(buildingIssues.some((issue) => issue.key === "bonus_review_needed"));
    assert.ok(longLifeIssues.some((issue) => issue.key === "bonus_review_needed"));
  });

  it("returns ready readiness for a clean asset", () => {
    const readiness = getAssetReadiness(readyAsset, { yearFilter: "2026" });
    assert.equal(readiness.key, "ready");
  });

  it("detects source transaction amount mismatch", () => {
    const issues = getAssetReviewIssues(
      { ...readyAsset, basis: 1000, sourceTransactionId: baseTransaction.id },
      { transactions: [baseTransaction], yearFilter: "2026" },
    );

    assert.ok(issues.some((issue) => issue.key === "source_transaction_amount_mismatch"));
  });

  it("maps transaction candidates to sensible draft defaults", () => {
    const draft = buildAssetDraftFromTransaction(baseTransaction, {
      defaultLifeForAssetType: (type: string) => (type === "Capital Improvement" ? 27.5 : 5),
    });

    assert.equal(draft.propertyId, "p1");
    assert.equal(draft.unit, "Shared");
    assert.equal(draft.description, "Roof replacement");
    assert.equal(draft.placedInService, "2026-04-12");
    assert.equal(draft.cost, "842.15");
    assert.equal(draft.basis, "842.15");
    assert.equal(draft.sourceTransactionId, "t1");
  });
});
