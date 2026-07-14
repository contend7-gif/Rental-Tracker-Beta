import { toLocalIsoDate } from "../lib/localDate.ts";
import type { Asset, DocumentItem, Lease, Property, RecurringDraft, RecurringTemplate, Transaction, Unit, UsePeriod, WorkOrder } from "../models.ts";
import type { AppendActivityLog } from "./activityStore.ts";

type StateSetter<T> = (updater: T[] | ((previous: T[]) => T[])) => void;
type ScopedItem = { propertyId?: string; unit?: string };

export function createUnitActions({
  getProperties,
  getUnits,
  getTransactions,
  getLeases,
  getDocuments,
  getWorkOrders,
  getAssets,
  getUsePeriods,
  getRecurringTemplates,
  getRecurringDrafts,
  setUnits,
  setLeases,
  appendActivityLog,
}: {
  getProperties: () => Property[];
  getUnits: () => Unit[];
  getTransactions: () => Transaction[];
  getLeases: () => Lease[];
  getDocuments: () => DocumentItem[];
  getWorkOrders: () => WorkOrder[];
  getAssets: () => Asset[];
  getUsePeriods: () => UsePeriod[];
  getRecurringTemplates: () => RecurringTemplate[];
  getRecurringDrafts: () => RecurringDraft[];
  setUnits: StateSetter<Unit>;
  setLeases: StateSetter<Lease>;
  appendActivityLog: AppendActivityLog;
}) {
  const linkCounts = (propertyId: string, unitName: string) => {
    const matches = (item: ScopedItem) => item.propertyId === propertyId && item.unit === unitName;
    return {
      transactions: getTransactions().filter(matches).length,
      leases: getLeases().filter(matches).length,
      documents: getDocuments().filter(matches).length,
      maintenance: getWorkOrders().filter(matches).length,
      assets: getAssets().filter(matches).length,
      occupancy: getUsePeriods().filter(matches).length,
      recurring: getRecurringTemplates().filter(matches).length
        + getRecurringDrafts().filter((draft) => matches(draft.transactionSeed)).length,
    };
  };
  const totalLinks = (propertyId: string, unitName: string) => Object.values(linkCounts(propertyId, unitName)).reduce((sum, count) => sum + count, 0);
  return {
    getUnitLinkSummary(propertyId: string, unitName: string) {
      const counts = linkCounts(propertyId, unitName);
      return { counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0) };
    },
    addUnit(propertyId: string, name: string, status: Unit["status"] = "Vacant") {
      const normalizedName = String(name || "").trim();
      if (!normalizedName || !getProperties().some((property) => property.id === propertyId)) return null;
      if (getUnits().some((unit) => unit.propertyId === propertyId && unit.name.toLowerCase() === normalizedName.toLowerCase())) return null;
      const unit: Unit = { id: `u-${Date.now()}`, propertyId, name: normalizedName, status };
      setUnits((previous) => [...previous, unit]);
      appendActivityLog({
        action: "create",
        entityType: "unit",
        entityId: unit.id,
        propertyId,
        unit: unit.name,
        summary: "Unit created.",
        details: status,
      });
      return unit;
    },
    renameUnit(unitId: string, name: string) {
      const units = getUnits();
      const existingUnit = units.find((unit) => unit.id === unitId);
      const normalizedName = String(name || "").trim();
      if (!existingUnit || !normalizedName) return null;
      if (units.some((unit) => unit.id !== unitId && unit.propertyId === existingUnit.propertyId && unit.name.toLowerCase() === normalizedName.toLowerCase())) return null;
      if (totalLinks(existingUnit.propertyId, existingUnit.name) > 0) return null;
      setUnits((previous) => previous.map((unit) => unit.id === unitId ? { ...unit, name: normalizedName } : unit));
      appendActivityLog({
        action: "update",
        entityType: "unit",
        entityId: unitId,
        propertyId: existingUnit.propertyId,
        unit: normalizedName,
        summary: "Unit renamed.",
        details: `${existingUnit.name} to ${normalizedName}`,
      });
      return { ...existingUnit, name: normalizedName };
    },
    deleteUnit(unitId: string) {
      const existingUnit = getUnits().find((unit) => unit.id === unitId);
      if (!existingUnit || totalLinks(existingUnit.propertyId, existingUnit.name) > 0) return false;
      setUnits((previous) => previous.filter((unit) => unit.id !== unitId));
      appendActivityLog({
        action: "delete",
        entityType: "unit",
        entityId: unitId,
        propertyId: existingUnit.propertyId,
        unit: existingUnit.name,
        summary: "Unit deleted.",
      });
      return true;
    },
    updateUnitStatus(unitId: string, status: Unit["status"]) {
      const existingUnit = getUnits().find((unit) => unit.id === unitId);
      setUnits((previous) => previous.map((unit) => unit.id === unitId ? { ...unit, status } : unit));
      if (existingUnit && existingUnit.status !== status) {
        appendActivityLog({
          action: "status",
          entityType: "unit",
          entityId: unitId,
          propertyId: existingUnit.propertyId,
          unit: existingUnit.name,
          summary: `Unit status changed to ${status}.`,
        });
      }
      if (!existingUnit) return;
      setLeases((previous) => {
        const today = toLocalIsoDate();
        const nextYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
        const sameUnit = previous.filter((lease) => lease.propertyId === existingUnit.propertyId && lease.unit === existingUnit.name);
        if (status === "Rental") {
          if (sameUnit.some((lease) => lease.status === "Active")) return previous;
          const reusableLease = sameUnit.find((lease) => lease.status !== "Ended");
          if (reusableLease) return previous.map((lease) => lease.id === reusableLease.id ? { ...lease, status: "Active" } : lease);
          return [{
            id: `lease-${Date.now()}`,
            propertyId: existingUnit.propertyId,
            unit: existingUnit.name,
            tenantName: "New Tenant",
            startDate: today,
            endDate: nextYear,
            actualEndDate: "",
            monthlyRent: 0,
            rentalType: "Long-term",
            utilitiesIncluded: false,
            monthToMonthAfterTerm: true,
            extensionTermMonths: 0,
            status: "Active",
            notes: "Created from unit status change. Update lease details.",
          }, ...previous];
        }
        return previous.map((lease) => lease.propertyId === existingUnit.propertyId
          && lease.unit === existingUnit.name
          && lease.status === "Active"
          ? { ...lease, status: "Ended" }
          : lease);
      });
    },
  };
}
