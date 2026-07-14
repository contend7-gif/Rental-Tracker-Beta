import assert from "node:assert/strict";
import test from "node:test";
import type { Lease, TenantLedgerEntry } from "../models.ts";
import { createTenantLedgerActions } from "./tenantLedgerStore.ts";

const lease: Lease = {
  id: "lease-1",
  propertyId: "property-1",
  unit: "Unit 1",
  tenantName: "Example Tenant",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  monthlyRent: 1200,
  rentalType: "Long-term",
  utilitiesIncluded: false,
  monthToMonthAfterTerm: false,
  extensionTermMonths: 0,
  status: "Active",
  notes: "",
};

test("tenant ledger actions use current entries and preserve lease audit scope", () => {
  let entries: TenantLedgerEntry[] = [];
  const activity: Array<{ action: string; propertyId?: string; unit?: string }> = [];
  const setEntries = (updater: TenantLedgerEntry[] | ((previous: TenantLedgerEntry[]) => TenantLedgerEntry[])) => {
    entries = typeof updater === "function" ? updater(entries) : updater;
  };
  const actions = createTenantLedgerActions({
    getEntries: () => entries,
    getLeases: () => [lease],
    setEntries,
    appendActivityLog: (entry) => { activity.push(entry); },
  });
  const entry: TenantLedgerEntry = {
    id: "ledger-1",
    leaseId: lease.id,
    date: "2026-05-01",
    kind: "charge",
    amount: 75,
    memo: "Repair charge",
    createdAt: "2026-05-01T00:00:00.000Z",
  };

  actions.addOrUpdateTenantLedgerEntry(entry);
  actions.updateTenantLedgerEntryReview(entry.id, { reviewed: true, reviewNotes: "Verified" });
  assert.equal(entries[0].reviewed, true);
  assert.equal(entries[0].reviewNotes, "Verified");
  assert.deepEqual(activity.map((item) => item.action), ["create", "review"]);
  assert.equal(activity[1].propertyId, lease.propertyId);
  assert.equal(activity[1].unit, lease.unit);
});
