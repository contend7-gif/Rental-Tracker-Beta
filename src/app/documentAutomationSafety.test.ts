import assert from "node:assert/strict";
import test from "node:test";
import type { Transaction } from "../models.ts";
import {
  canAutoCreateExpenseSuggestion,
  canAutoCreateWorkOrderSuggestion,
  findMatchingUtilitySectionTransaction,
} from "./documentAutomationSafety.ts";

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "t1",
    date: "2026-07-01",
    propertyId: "p1",
    unit: "Shared",
    type: "Expense",
    category: "Utilities",
    description: "Water utility",
    amount: 125.5,
    ownerUsePct: 0,
    rentalUsePct: 100,
    deductibleAmount: 125.5,
    paidFrom: "Operating account",
    paymentMethod: "ACH",
    reimbursable: false,
    reimbursed: false,
    capitalImprovement: false,
    vendor: "City Water",
    receiptName: "",
    notes: "",
    taxChecked: false,
    status: "active",
    ...overrides,
  };
}

test("high-confidence invoices can create expenses while estimates cannot", () => {
  const suggestion = { confidence: "high", propertyId: "p1", amount: 125.5, date: "2026-07-01" };
  assert.equal(canAutoCreateExpenseSuggestion({ name: "water invoice.pdf" }, suggestion), true);
  assert.equal(canAutoCreateExpenseSuggestion({ name: "repair estimate.pdf" }, suggestion), false);
  assert.equal(canAutoCreateExpenseSuggestion({ name: "water invoice.pdf", transactionId: "t1" }, suggestion), false);
});

test("high-confidence estimates favor work-order creation", () => {
  assert.equal(canAutoCreateWorkOrderSuggestion(
    { name: "roof proposal.pdf" },
    { confidence: "high", propertyId: "p1", title: "Repair roof" },
    { hasLinkedWorkOrder: false },
  ), true);
  assert.equal(canAutoCreateWorkOrderSuggestion(
    { name: "roof proposal.pdf" },
    { confidence: "high", propertyId: "p1", title: "Repair roof" },
    { hasLinkedWorkOrder: true },
  ), false);
});

test("utility duplicate matching uses scope date amount and invoice or vendor", () => {
  const existing = transaction({ invoiceRef: "INV-42" });
  assert.equal(findMatchingUtilitySectionTransaction({
    propertyId: "p1",
    unit: "Shared",
    amount: 125.5,
    date: "2026-07-01",
    invoiceRef: "inv-42",
  }, [existing])?.id, "t1");
  assert.equal(findMatchingUtilitySectionTransaction({
    propertyId: "p1",
    unit: "Unit 1",
    amount: 125.5,
    date: "2026-07-01",
    vendor: "City Water",
  }, [existing]), null);
});
