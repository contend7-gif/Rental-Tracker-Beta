import assert from "node:assert/strict";
import test from "node:test";
import type { Asset, DocumentItem, TenantLedgerEntry, Transaction, WorkOrder } from "../models.ts";
import { createTransactionActions } from "./transactionStore.ts";

const baseTransaction: Transaction = {
  id: "transaction-1",
  date: "2026-05-01",
  propertyId: "property-1",
  unit: "Unit 1",
  type: "Expense",
  category: "Repairs",
  description: "Sink repair",
  amount: 125,
  ownerUsePct: 0,
  rentalUsePct: 1,
  deductibleAmount: 125,
  paidFrom: "Checking",
  paymentMethod: "Card",
  reimbursable: false,
  reimbursed: false,
  capitalImprovement: false,
  vendor: "Example Plumbing",
  receiptName: "receipt.pdf",
  notes: "",
  taxChecked: false,
  status: "active",
};

function update<T>(current: T[], updater: T[] | ((previous: T[]) => T[])) {
  return typeof updater === "function" ? updater(current) : updater;
}

test("a transaction scope correction updates only its single-purpose receipt and persists through later edits", () => {
  let transactions = [baseTransaction];
  const receipt: DocumentItem = { id: "receipt", name: "Utility bill", type: "Invoice", propertyId: "property-1", unit: "Unit 1", unitScopeOverride: true, transactionId: baseTransaction.id };
  const combined = { ...receipt, id: "combined", relatedTransactionIds: ["other-transaction"] };
  const unrelated = { ...receipt, id: "unrelated", transactionId: "other-transaction" };
  let documents: DocumentItem[] = [receipt, combined, unrelated];
  const actions = createTransactionActions({
    getTransactions: () => transactions, getUsePeriods: () => [], getLeases: () => [], getUnits: () => [],
    setTransactions: (updater) => { transactions = update(transactions, updater); },
    setDocuments: (updater) => { documents = update(documents, updater); },
    setWorkOrders: () => undefined, setTenantLedgerEntries: () => undefined, setAssets: () => undefined, appendActivityLog: () => undefined,
  });
  actions.addOrUpdateTransaction({ ...baseTransaction, unit: "Unit 2" });
  assert.equal(documents[0].unit, "Unit 2");
  assert.equal(documents[0].unitScopeOverride, true);
  assert.equal(documents[1], combined);
  assert.equal(documents[2], unrelated);
  actions.addOrUpdateTransaction({ ...transactions[0], amount: 100 });
  assert.equal(documents[0].unit, "Unit 2");
  actions.addOrUpdateTransaction({ ...transactions[0], unit: "Shared" });
  assert.equal(documents[0].unit, "Shared");
});

test("transaction deletion audits the existing record and safely unlinks related records", () => {
  let transactions = [baseTransaction, { ...baseTransaction, id: "transaction-2" }];
  let documents: DocumentItem[] = [{
    id: "document-1",
    propertyId: "property-1",
    name: "Invoice.pdf",
    type: "Invoice",
    transactionId: "transaction-1",
    relatedTransactionIds: ["transaction-2"],
  }];
  let workOrders: WorkOrder[] = [{
    id: "work-order-1",
    propertyId: "property-1",
    unit: "Unit 1",
    title: "Sink repair",
    description: "",
    priority: "Medium",
    status: "Completed",
    reportedOn: "2026-05-01",
    transactionId: "transaction-1",
    createdAt: "2026-05-01T00:00:00.000Z",
  }];
  let ledgerEntries: TenantLedgerEntry[] = [{
    id: "ledger-1",
    leaseId: "lease-1",
    date: "2026-05-01",
    kind: "charge",
    amount: 125,
    memo: "Damage repair",
    transactionId: "transaction-1",
    createdAt: "2026-05-01T00:00:00.000Z",
  }];
  let assets: Asset[] = [];
  const activity: Array<{ propertyId?: string; details?: string }> = [];
  const actions = createTransactionActions({
    getTransactions: () => transactions,
    getUsePeriods: () => [],
    getLeases: () => [],
    getUnits: () => [],
    setTransactions: (updater) => { transactions = update(transactions, updater); },
    setDocuments: (updater) => { documents = update(documents, updater); },
    setWorkOrders: (updater) => { workOrders = update(workOrders, updater); },
    setTenantLedgerEntries: (updater) => { ledgerEntries = update(ledgerEntries, updater); },
    setAssets: (updater) => { assets = update(assets, updater); },
    appendActivityLog: (entry) => { activity.push(entry); },
  });

  assert.doesNotThrow(() => actions.deleteTransaction("transaction-1"));
  assert.deepEqual(transactions.map((transaction) => transaction.id), ["transaction-2"]);
  assert.equal(documents[0].transactionId, "transaction-2");
  assert.equal(documents[0].relatedTransactionIds, undefined);
  assert.equal(workOrders[0].transactionId, "");
  assert.equal(ledgerEntries[0].transactionId, undefined);
  assert.equal(activity[0].propertyId, "property-1");
  assert.equal(activity[0].details, "Sink repair");
});
