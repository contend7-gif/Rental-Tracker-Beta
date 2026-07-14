import assert from "node:assert/strict";
import test from "node:test";
import type { DocumentItem, Vendor, WorkOrder } from "../models.ts";
import { createMaintenanceActions } from "./maintenanceStore.ts";

const workOrder: WorkOrder = {
  id: "wo-1",
  propertyId: "p1",
  unit: "Unit B",
  title: "Repair sink",
  description: "Kitchen leak",
  priority: "High",
  status: "Open",
  reportedOn: "2026-07-14",
  vendorId: "v1",
  createdAt: "2026-07-14T10:00:00.000Z",
};

test("maintenance actions keep vendor, work-order, and document links consistent", () => {
  let vendors: Vendor[] = [{ id: "v1", name: "Plumber", active: true }];
  let workOrders: WorkOrder[] = [workOrder];
  let documents: DocumentItem[] = [{
    id: "doc-1",
    propertyId: "p1",
    name: "Invoice",
    type: "Receipt",
    workOrderId: "wo-1",
  }];
  const activity: string[] = [];
  const update = <T>(current: T[], updater: T[] | ((previous: T[]) => T[])) => (
    typeof updater === "function" ? updater(current) : updater
  );
  const actions = createMaintenanceActions({
    getVendors: () => vendors,
    getWorkOrders: () => workOrders,
    setVendors: (updater) => { vendors = update(vendors, updater); },
    setWorkOrders: (updater) => { workOrders = update(workOrders, updater); },
    setDocuments: (updater) => { documents = update(documents, updater); },
    appendActivityLog: (entry) => { activity.push(`${entry.action}:${entry.entityType}`); },
  });

  actions.deleteVendor("v1");
  assert.equal(workOrders[0].vendorId, "");
  actions.setWorkOrderStatus("wo-1", "Completed");
  assert.equal(workOrders[0].status, "Completed");
  assert.match(String(workOrders[0].completedAt), /^\d{4}-\d{2}-\d{2}$/);
  actions.deleteWorkOrder("wo-1");

  assert.deepEqual(vendors, []);
  assert.deepEqual(workOrders, []);
  assert.deepEqual(documents, []);
  assert.deepEqual(activity, ["delete:vendor", "status:work-order", "delete:work-order"]);
});
