import assert from "node:assert/strict";
import test from "node:test";
import type { Lease, Property, Transaction, Unit } from "../models.ts";
import { createUnitActions } from "./unitStore.ts";

const property = { id: "property-1", name: "Example", address: "123 Main", type: "Duplex" } as Property;

test("unit actions block destructive changes when records are linked", () => {
  let units: Unit[] = [{ id: "unit-1", propertyId: property.id, name: "Unit 1", status: "Vacant" }];
  let leases: Lease[] = [];
  const transactions = [{ propertyId: property.id, unit: "Unit 1" }] as Transaction[];
  const actions = createUnitActions({
    getProperties: () => [property],
    getUnits: () => units,
    getTransactions: () => transactions,
    getLeases: () => leases,
    getDocuments: () => [],
    getWorkOrders: () => [],
    getAssets: () => [],
    getUsePeriods: () => [],
    getRecurringTemplates: () => [],
    getRecurringDrafts: () => [],
    setUnits: (updater) => { units = typeof updater === "function" ? updater(units) : updater; },
    setLeases: (updater) => { leases = typeof updater === "function" ? updater(leases) : updater; },
    appendActivityLog: () => undefined,
  });

  assert.equal(actions.renameUnit("unit-1", "Upper"), null);
  assert.equal(actions.deleteUnit("unit-1"), false);
  assert.equal(units[0].name, "Unit 1");
});

test("changing a vacant unit to rental creates one placeholder lease", () => {
  let units: Unit[] = [{ id: "unit-1", propertyId: property.id, name: "Unit 1", status: "Vacant" }];
  let leases: Lease[] = [];
  const actions = createUnitActions({
    getProperties: () => [property],
    getUnits: () => units,
    getTransactions: () => [],
    getLeases: () => leases,
    getDocuments: () => [],
    getWorkOrders: () => [],
    getAssets: () => [],
    getUsePeriods: () => [],
    getRecurringTemplates: () => [],
    getRecurringDrafts: () => [],
    setUnits: (updater) => { units = typeof updater === "function" ? updater(units) : updater; },
    setLeases: (updater) => { leases = typeof updater === "function" ? updater(leases) : updater; },
    appendActivityLog: () => undefined,
  });

  actions.updateUnitStatus("unit-1", "Rental");
  actions.updateUnitStatus("unit-1", "Rental");
  assert.equal(units[0].status, "Rental");
  assert.equal(leases.length, 1);
  assert.equal(leases[0].status, "Active");
});
