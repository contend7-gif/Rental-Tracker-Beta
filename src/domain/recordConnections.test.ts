import test from "node:test";
import assert from "node:assert/strict";
import { documentsForLease, leasesForTransaction } from "./recordConnections.ts";
import type { DocumentItem, Lease, TenantLedgerEntry } from "../models.ts";

const entries = [
  { id: "payment", leaseId: "lease-a", transactionId: "rent", linkedDocumentIds: ["receipt-direct"] },
  { id: "split", leaseId: "lease-a", transactionId: "rent" },
  { id: "void", leaseId: "lease-b", transactionId: "rent", voidedAt: "2026-10-01" },
  { id: "missing", leaseId: "missing-lease", transactionId: "rent" },
] as TenantLedgerEntry[];

test("payment navigation follows explicit active ledger links, deduplicates leases, and never guesses", () => {
  const leases = [{ id: "lease-a" }, { id: "lease-b" }] as Lease[];
  assert.deepEqual(leasesForTransaction("rent", entries, leases), [leases[0]]);
  assert.deepEqual(leasesForTransaction("unlinked", entries, leases), []);
  assert.deepEqual(leasesForTransaction("", entries, leases), []);
});

test("lease files include attached agreements and payment support without crossing conflicting lease links", () => {
  const documents = [
    { id: "agreement", leaseId: "lease-a" },
    { id: "receipt", transactionId: "rent" },
    { id: "receipt-direct" },
    { id: "conflict", transactionId: "rent", leaseId: "lease-b" },
    { id: "unlinked" },
  ] as DocumentItem[];
  assert.deepEqual(documentsForLease("lease-a", entries, documents), documents.slice(0, 3));
  assert.deepEqual(documentsForLease("", entries, documents), []);
  assert.deepEqual(documentsForLease("lease-b", entries, documents), [documents[3]]);
});
