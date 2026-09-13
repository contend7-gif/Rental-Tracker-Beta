import test from "node:test";
import assert from "node:assert/strict";
import type { Asset, Lease, Unit, UsePeriod } from "../models.ts";
import { adjustedAssetDepreciationForYear, assetDepreciationForYear, rentalUsePctForAssetOnDate } from "./assetDepreciation.ts";

const sharedBuilding: Asset = {
  id: "asset-building",
  propertyId: "prop-1",
  unit: "Shared",
  description: "Duplex building",
  type: "Residential Building",
  placedInService: "2026-01-01",
  cost: 220000,
  basis: 220000,
  life: 27.5,
  currentYearDep: 8000,
  landValue: 50000,
  bonusEligible: false,
  bonusElected: false,
  bonusRate: 0,
};

const duplexUnits: Unit[] = [
  { id: "u-614", propertyId: "prop-1", name: "614", status: "Owner-Occupied" },
  { id: "u-616", propertyId: "prop-1", name: "616", status: "Rental" },
];

test("legacy turnover vacancy retains depreciation while explicit nonrental vacancy reduces it", () => {
  const owner: UsePeriod = { id: "owner", propertyId: "prop-1", unit: "614", startDate: "2026-01-01", useType: "Owner-Occupied", rentalUsePct: 0 };
  const gap: UsePeriod = { id: "gap", propertyId: "prop-1", unit: "616", startDate: "2026-08-10", endDate: "2026-08-11", useType: "Vacant", rentalUsePct: 0 };
  for (const unit of ["Shared", "616"]) {
    const args = { asset: { ...sharedBuilding, unit }, year: 2026, units: duplexUnits };
    const before = adjustedAssetDepreciationForYear({ ...args, usePeriods: [owner] });
    assert.equal(adjustedAssetDepreciationForYear({ ...args, usePeriods: [owner, gap] }), before);
    assert.ok(adjustedAssetDepreciationForYear({ ...args, usePeriods: [owner, { ...gap, vacancyTreatment: "nonrental" }] }) < before);
  }
});

test("shared building rental use follows mixed unit occupancy", () => {
  const leases: Lease[] = [
    {
      id: "lease-616",
      propertyId: "prop-1",
      unit: "616",
      tenantName: "Tenant",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      monthlyRent: 1000,
      deposit: 1000,
      rentalType: "Long-term",
      status: "Active",
      rentDueDay: 1,
      reminderDaysBefore: 3,
      lateFeeGraceDays: 5,
      lateFeeType: "flat",
      lateFeeValue: 50,
      autoLateFeeEnabled: false,
      monthToMonthAfterTerm: false,
    },
  ];
  const usePeriods: UsePeriod[] = [
    {
      id: "owner-614",
      propertyId: "prop-1",
      unit: "614",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      useType: "Owner-Occupied",
      rentalUsePct: 0,
    },
  ];

  assert.equal(assetDepreciationForYear(sharedBuilding, 2026), 7666.67);
  assert.equal(
    rentalUsePctForAssetOnDate({ asset: sharedBuilding, date: "2026-06-15", usePeriods, leases, units: duplexUnits }),
    0.5,
  );
  assert.equal(
    adjustedAssetDepreciationForYear({ asset: sharedBuilding, year: 2026, usePeriods, leases, units: duplexUnits }),
    3833.34,
  );
});

test("shared building depreciation returns to full when both units are rented again", () => {
  const leases: Lease[] = [
    {
      id: "lease-614",
      propertyId: "prop-1",
      unit: "614",
      tenantName: "Tenant A",
      startDate: "2027-01-01",
      endDate: "2027-12-31",
      monthlyRent: 1000,
      deposit: 1000,
      rentalType: "Long-term",
      status: "Active",
      rentDueDay: 1,
      reminderDaysBefore: 3,
      lateFeeGraceDays: 5,
      lateFeeType: "flat",
      lateFeeValue: 50,
      autoLateFeeEnabled: false,
      monthToMonthAfterTerm: false,
    },
    {
      id: "lease-616",
      propertyId: "prop-1",
      unit: "616",
      tenantName: "Tenant B",
      startDate: "2027-01-01",
      endDate: "2027-12-31",
      monthlyRent: 1000,
      deposit: 1000,
      rentalType: "Long-term",
      status: "Active",
      rentDueDay: 1,
      reminderDaysBefore: 3,
      lateFeeGraceDays: 5,
      lateFeeType: "flat",
      lateFeeValue: 50,
      autoLateFeeEnabled: false,
      monthToMonthAfterTerm: false,
    },
  ];
  const usePeriods: UsePeriod[] = [
    {
      id: "owner-614",
      propertyId: "prop-1",
      unit: "614",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      useType: "Owner-Occupied",
      rentalUsePct: 0,
    },
  ];

  assert.equal(
    rentalUsePctForAssetOnDate({ asset: sharedBuilding, date: "2027-06-15", usePeriods, leases, units: duplexUnits }),
    1,
  );
  assert.equal(
    adjustedAssetDepreciationForYear({ asset: sharedBuilding, year: 2027, usePeriods, leases, units: duplexUnits }),
    8000,
  );
});

test("legacy shared mixed-use periods do not override tracked unit-level leases for shared building depreciation", () => {
  const leases: Lease[] = [
    {
      id: "lease-614",
      propertyId: "prop-1",
      unit: "614",
      tenantName: "Tenant A",
      startDate: "2026-10-01",
      endDate: "2027-03-07",
      monthlyRent: 1000,
      deposit: 1000,
      rentalType: "Mid-term",
      status: "Active",
      rentDueDay: 1,
      reminderDaysBefore: 3,
      lateFeeGraceDays: 5,
      lateFeeType: "flat",
      lateFeeValue: 50,
      autoLateFeeEnabled: false,
      monthToMonthAfterTerm: false,
    },
    {
      id: "lease-616",
      propertyId: "prop-1",
      unit: "616",
      tenantName: "Tenant B",
      startDate: "2026-01-01",
      endDate: "2027-12-31",
      monthlyRent: 1000,
      deposit: 1000,
      rentalType: "Long-term",
      status: "Active",
      rentDueDay: 1,
      reminderDaysBefore: 3,
      lateFeeGraceDays: 5,
      lateFeeType: "flat",
      lateFeeValue: 50,
      autoLateFeeEnabled: false,
      monthToMonthAfterTerm: false,
    },
  ];
  const usePeriods: UsePeriod[] = [
    {
      id: "shared-mixed",
      propertyId: "prop-1",
      unit: "Shared",
      startDate: "2026-02-21",
      endDate: "",
      useType: "Shared - mixed use",
      rentalUsePct: 0.8,
    },
    {
      id: "owner-614",
      propertyId: "prop-1",
      unit: "614",
      startDate: "2026-02-21",
      endDate: "2026-09-30",
      useType: "Owner-Occupied",
      rentalUsePct: 0,
    },
  ];

  assert.equal(
    rentalUsePctForAssetOnDate({ asset: sharedBuilding, date: "2026-11-01", usePeriods, leases, units: duplexUnits }),
    1,
  );
  assert.equal(
    adjustedAssetDepreciationForYear({ asset: sharedBuilding, year: 2027, usePeriods, leases, units: duplexUnits }),
    8000,
  );
});

test("residential building depreciation uses half-month convention in placed-in-service year", () => {
  const lateDecemberBuilding: Asset = {
    id: "asset-late-december",
    propertyId: "prop-2",
    unit: "Shared",
    description: "Filed return building basis",
    type: "Residential Building",
    placedInService: "2025-12-30",
    cost: 263000,
    basis: 213000,
    life: 27.5,
    currentYearDep: 0,
    landValue: 50000,
    bonusEligible: false,
    bonusElected: false,
    bonusRate: 0,
  };

  assert.equal(assetDepreciationForYear(lateDecemberBuilding, 2025), 322.73);
});
