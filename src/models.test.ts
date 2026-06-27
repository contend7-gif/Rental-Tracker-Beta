import test from "node:test";
import assert from "node:assert/strict";
import { assertHasCostBasis, getPropertyCostBasis, hasCostBasis, hasPurchaseMeta, type Property } from "./models.ts";

const baseProperty: Property = {
  id: "p1",
  name: "Maple Duplex",
  address: "1 Main",
  type: "Duplex",
};

test("property purchase meta guard requires date and positive price", () => {
  assert.equal(hasPurchaseMeta(baseProperty), false);
  assert.equal(hasPurchaseMeta({ ...baseProperty, purchasedOn: "2025-01-01", purchasePrice: 250000 }), true);
});

test("property cost basis guard requires land value and positive building basis", () => {
  assert.equal(hasCostBasis({ ...baseProperty, purchasedOn: "2025-01-01", purchasePrice: 250000 }), false);
  assert.equal(hasCostBasis({ ...baseProperty, purchasedOn: "2025-01-01", purchasePrice: 250000, landValue: 250000 }), false);
  assert.equal(hasCostBasis({ ...baseProperty, purchasedOn: "2025-01-01", purchasePrice: 250000, landValue: 50000 }), true);
});

test("property cost basis result reports missing fields instead of defaulting to zero", () => {
  const result = getPropertyCostBasis({ ...baseProperty, purchasePrice: 250000 });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(result.missing, ["purchasedOn", "landValue"]);
  }
});

test("property cost basis result exposes building basis when complete", () => {
  const result = getPropertyCostBasis({ ...baseProperty, purchasedOn: "2025-01-01", purchasePrice: 250000, landValue: 50000 });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.buildingBasis, 200000);
    assert.equal(result.landValue, 50000);
  }
});

test("assertHasCostBasis throws an explicit missing-field message", () => {
  assert.throws(() => assertHasCostBasis(baseProperty), /purchasedOn/);
});
