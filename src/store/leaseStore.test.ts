import assert from "node:assert/strict";
import test from "node:test";
import type { DocumentItem, Lease, TenantLedgerEntry, Unit, UsePeriod } from "../models.ts";
import { createLeaseActions, leaseIsEndedByDate, normalizeLease } from "./leaseStore.ts";

const baseLease: Lease = {
  id: "lease-1",
  propertyId: "property-1",
  unit: "Unit 1",
  tenantName: "Example Tenant",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  monthlyRent: 1200,
  securityDeposit: 1200,
  rentalType: "Long-term",
  utilitiesIncluded: false,
  monthToMonthAfterTerm: false,
  extensionTermMonths: 0,
  status: "Active",
  notes: "",
};

function update<T>(current: T[], updater: T[] | ((previous: T[]) => T[])) {
  return typeof updater === "function" ? updater(current) : updater;
}

test("lease deletion removes only records linked to that lease", () => {
  let leases = [baseLease, { ...baseLease, id: "lease-2", tenantName: "Other Tenant" }];
  let documents = [
    { id: "document-1", leaseId: "lease-1" } as DocumentItem,
    { id: "document-2", leaseId: "lease-2" } as DocumentItem,
  ];
  let ledgerEntries = [
    { id: "ledger-1", leaseId: "lease-1" } as TenantLedgerEntry,
    { id: "ledger-2", leaseId: "lease-2" } as TenantLedgerEntry,
  ];
  let units: Unit[] = [];
  const actions = createLeaseActions({
    getLeases: () => leases,
    getUsePeriods: () => [],
    setLeases: (updater) => { leases = update(leases, updater); },
    setDocuments: (updater) => { documents = update(documents, updater); },
    setTenantLedgerEntries: (updater) => { ledgerEntries = update(ledgerEntries, updater); },
    setUnits: (updater) => { units = update(units, updater); },
    appendActivityLog: () => undefined,
  });

  actions.deleteLease("lease-1");
  assert.deepEqual(leases.map((lease) => lease.id), ["lease-2"]);
  assert.deepEqual(documents.map((document) => document.id), ["document-2"]);
  assert.deepEqual(ledgerEntries.map((entry) => entry.id), ["ledger-2"]);
});

test("lease status sync updates leases and unit occupancy from current records", () => {
  let leases = [baseLease, { ...baseLease, id: "lease-ended", unit: "Unit 2", endDate: "2025-12-31" }];
  const usePeriods: UsePeriod[] = [{
    id: "period-1",
    propertyId: "property-1",
    unit: "Unit 3",
    startDate: "2026-01-01",
    useType: "Owner-Occupied",
  }];
  let documents: DocumentItem[] = [];
  let ledgerEntries: TenantLedgerEntry[] = [];
  let units: Unit[] = [
    { id: "unit-1", propertyId: "property-1", name: "Unit 1", status: "Vacant" },
    { id: "unit-2", propertyId: "property-1", name: "Unit 2", status: "Rental" },
    { id: "unit-3", propertyId: "property-1", name: "Unit 3", status: "Vacant" },
  ];
  const actions = createLeaseActions({
    getLeases: () => leases,
    getUsePeriods: () => usePeriods,
    setLeases: (updater) => { leases = update(leases, updater); },
    setDocuments: (updater) => { documents = update(documents, updater); },
    setTenantLedgerEntries: (updater) => { ledgerEntries = update(ledgerEntries, updater); },
    setUnits: (updater) => { units = update(units, updater); },
    appendActivityLog: () => undefined,
  });

  actions.syncLeaseStatuses("2026-06-01");
  assert.equal(leases.find((lease) => lease.id === "lease-ended")?.status, "Ended");
  assert.deepEqual(units.map((unit) => unit.status), ["Rental", "Vacant", "Owner-Occupied"]);
});

test("lease normalization preserves old monthly leases and adds explicit term fields", () => {
  const normalized = normalizeLease(baseLease);
  assert.equal(normalized.agreementType, "fixed_term");
  assert.equal(normalized.billingCadence, "monthly");
  assert.equal(normalized.rentAmount, 1200);
  assert.equal(normalized.monthlyRent, 1200);
});

test("lease normalization keeps a prepaid mid-term lease as one full-term amount", () => {
  const normalized = normalizeLease({
    ...baseLease,
    startDate: "2026-08-12",
    endDate: "2026-09-11",
    rentalType: "Mid-term",
    monthlyRent: 1550,
  });
  assert.equal(normalized.billingCadence, "full_term");
  assert.equal(normalized.rentAmount, 1550);
  assert.equal(normalized.monthlyRent, 1550);
});

test("month-to-month leases stay active without depending on duration classification", () => {
  const normalized = normalizeLease({
    ...baseLease,
    rentalType: "Short-term",
    agreementType: "month_to_month",
    billingCadence: "weekly",
    rentAmount: 400,
    endDate: "2026-01-01",
  });
  assert.equal(leaseIsEndedByDate(normalized, "2026-06-01"), false);
});
