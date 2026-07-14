import assert from "node:assert/strict";
import test from "node:test";
import type { Asset, WorkOrder } from "../models.ts";
import { createAssetActions } from "./assetStore.ts";

test("asset actions keep work-order and transaction links consistent", () => {
  let assets: Asset[] = [];
  let workOrders: WorkOrder[] = [{
    id: "work-order-1",
    propertyId: "property-1",
    unit: "Unit 1",
    title: "Replace furnace",
    description: "",
    priority: "High",
    status: "Completed",
    reportedOn: "2026-01-01",
    createdAt: "2026-01-01T00:00:00.000Z",
  }];
  const setAssets = (updater: Asset[] | ((previous: Asset[]) => Asset[])) => {
    assets = typeof updater === "function" ? updater(assets) : updater;
  };
  const setWorkOrders = (updater: WorkOrder[] | ((previous: WorkOrder[]) => WorkOrder[])) => {
    workOrders = typeof updater === "function" ? updater(workOrders) : updater;
  };
  const actions = createAssetActions({
    getAssets: () => assets,
    getTransactions: () => [],
    setAssets,
    setWorkOrders,
    appendActivityLog: () => undefined,
  });
  const asset: Asset = {
    id: "asset-1",
    propertyId: "property-1",
    unit: "Unit 1",
    description: "Furnace",
    type: "Equipment",
    placedInService: "2026-01-01",
    cost: 6000,
    basis: 6000,
    life: 5,
    currentYearDep: 1200,
    sourceWorkOrderId: "work-order-1",
    createdFrom: "maintenance",
  };

  actions.addOrUpdateAsset(asset);
  actions.linkAssetToTransaction(asset.id, "transaction-1");
  actions.linkAssetToTransaction(asset.id, "transaction-2");
  assert.equal(workOrders[0].assetId, asset.id);
  assert.equal(assets[0].sourceTransactionId, "transaction-1");
  assert.deepEqual(assets[0].sourceTransactionIds, ["transaction-1", "transaction-2"]);
});
