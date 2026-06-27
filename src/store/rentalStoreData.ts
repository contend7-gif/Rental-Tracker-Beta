import type { ActivityLogEntry, Asset, DocumentItem, Lease, Loan, LoanPayment, Property, RecurringDraft, RecurringTemplate, TenantLedgerEntry, Transaction, Unit, UsePeriod, Vendor, WorkOrder } from "../models.ts";
import { createSampleDatasetReplacement } from "../domain/dataSafety.ts";
import { normalizeActivityLogEntry } from "./activityStore.ts";
import { normalizeAsset } from "./assetStore.ts";
import { normalizeDocument } from "./documentStore.ts";
import { normalizeLease } from "./leaseStore.ts";
import { normalizeLoansWithUniqueIds } from "./loanStore.ts";
import { normalizeWorkOrder } from "./maintenanceStore.ts";
import { normalizeProperty } from "./propertyStore.ts";
import { cloneItems, dedupeRecordsById, isRecord, readBackupCollection } from "./storeUtils.ts";
import { normalizeTenantLedgerEntry } from "./tenantLedgerStore.ts";
import { normalizeUsePeriod } from "./usePeriodStore.ts";

export type RentalStoreData = {
  transactions: Transaction[];
  assets: Asset[];
  documents: DocumentItem[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  usePeriods: UsePeriod[];
  recurringTemplates: RecurringTemplate[];
  recurringDrafts: RecurringDraft[];
  tenantLedgerEntries: TenantLedgerEntry[];
  activityLog: ActivityLogEntry[];
  leases: Lease[];
  vendors: Vendor[];
  workOrders: WorkOrder[];
  properties: Property[];
  units: Unit[];
};

export async function createDemoDataState(): Promise<RentalStoreData> {
  const demo = createSampleDatasetReplacement();
  return {
    transactions: cloneItems(demo.transactions),
    assets: cloneItems(demo.assets).map((asset) => normalizeAsset(asset as Asset)),
    documents: cloneItems(demo.documents).map((document) => normalizeDocument(document as DocumentItem)),
    loans: normalizeLoansWithUniqueIds(cloneItems(demo.loans) as Loan[]),
    loanPayments: cloneItems(demo.loanPayments),
    usePeriods: cloneItems(demo.usePeriods).map((period) => normalizeUsePeriod(period as UsePeriod)),
    recurringTemplates: cloneItems(demo.recurringTemplates),
    recurringDrafts: cloneItems(demo.recurringDrafts),
    tenantLedgerEntries: cloneItems(demo.tenantLedgerEntries).map((entry) => normalizeTenantLedgerEntry(entry as TenantLedgerEntry)),
    activityLog: [],
    leases: cloneItems(demo.leases).map((lease) => normalizeLease(lease as Lease)),
    vendors: cloneItems(demo.vendors),
    workOrders: cloneItems(demo.workOrders).map((workOrder) => normalizeWorkOrder(workOrder as WorkOrder)),
    properties: cloneItems(demo.properties).map((property) => normalizeProperty(property as Property)),
    units: cloneItems(demo.units),
  };
}

export function normalizeBackupData(rawData: unknown): RentalStoreData {
  const data = isRecord(rawData) ? rawData : {};
  return {
    transactions: dedupeRecordsById(readBackupCollection<Transaction>(data.transactions)),
    assets: readBackupCollection<Asset>(data.assets).map((asset) => normalizeAsset(asset)),
    documents: readBackupCollection<DocumentItem>(data.documents).map((document) => normalizeDocument(document)),
    leases: readBackupCollection<Lease>(data.leases).map((lease) => normalizeLease(lease)),
    tenantLedgerEntries: readBackupCollection<TenantLedgerEntry>(data.tenantLedgerEntries).map((entry) => normalizeTenantLedgerEntry(entry)),
    loans: normalizeLoansWithUniqueIds(readBackupCollection<Loan>(data.loans)),
    loanPayments: readBackupCollection<LoanPayment>(data.loanPayments),
    usePeriods: readBackupCollection<UsePeriod>(data.usePeriods).map((period) => normalizeUsePeriod(period)),
    recurringTemplates: readBackupCollection<RecurringTemplate>(data.recurringTemplates),
    recurringDrafts: readBackupCollection<RecurringDraft>(data.recurringDrafts),
    activityLog: readBackupCollection<Record<string, unknown>>(data.activityLog).map((entry) => normalizeActivityLogEntry(entry)).filter((entry): entry is ActivityLogEntry => Boolean(entry)),
    vendors: readBackupCollection<Vendor>(data.vendors),
    workOrders: readBackupCollection<WorkOrder>(data.workOrders).map((workOrder) => normalizeWorkOrder(workOrder)),
    properties: readBackupCollection<Property>(data.properties).map((property) => normalizeProperty(property)),
    units: readBackupCollection<Unit>(data.units),
  };
}
