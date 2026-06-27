import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTransactionVendorMemoryToDraft,
  buildTransactionVendorMemory,
  findTransactionVendorMemoryForDescription,
  findTransactionVendorMemoryForDraft,
  normalizeTransactionCounterparty,
} from "./transactionVendorMemory.js";

test("normalizeTransactionCounterparty removes bank noise", () => {
  assert.equal(normalizeTransactionCounterparty("ACH AUTOPAY Example Gas Utility 000998"), "example gas utility");
});

test("buildTransactionVendorMemory keeps the latest repeated vendor defaults", () => {
  const memory = buildTransactionVendorMemory([
    {
      id: "t1",
      status: "active",
      date: "2026-01-02",
      type: "Expense",
      category: "Other expenses",
      description: "Example Gas Utility",
      vendor: "Example Gas Utility",
      propertyId: "p1",
      unit: "Shared",
      paidFrom: "Old account",
      paymentMethod: "ACH",
      capitalImprovement: false,
    },
    {
      id: "t2",
      status: "active",
      date: "2026-02-02",
      type: "Expense",
      category: "Utilities",
      description: "Example Gas Utility",
      vendor: "Example Gas Utility",
      propertyId: "p1",
      unit: "102",
      paidFrom: "Duplex bank",
      paymentMethod: "ACH",
      capitalImprovement: false,
    },
  ]);

  assert.equal(memory[0]?.key, "example gas utility");
  assert.equal(memory[0]?.uses, 2);
  assert.equal(memory[0]?.category, "Utilities");
  assert.equal(memory[0]?.unit, "102");
});

test("findTransactionVendorMemoryForDescription matches noisy bank descriptions", () => {
  const memories = buildTransactionVendorMemory([
    {
      id: "t1",
      status: "active",
      date: "2026-03-01",
      type: "Expense",
      category: "Repairs",
      description: "Rapid Rooter Plumbing",
      vendor: "Rapid Rooter Plumbing",
      propertyId: "p1",
      unit: "Shared",
      paidFrom: "Duplex bank",
      paymentMethod: "Debit",
      capitalImprovement: false,
    },
  ]);

  const match = findTransactionVendorMemoryForDescription("POS Purchase Rapid Rooter Plumbing 4412", memories);
  assert.equal(match?.category, "Repairs");
});

test("findTransactionVendorMemoryForDraft matches vendor before description", () => {
  const memories = buildTransactionVendorMemory([
    {
      id: "t1",
      status: "active",
      date: "2026-04-01",
      type: "Expense",
      category: "Utilities",
      description: "Example Energy monthly bill",
      vendor: "Example Energy",
      propertyId: "p1",
      unit: "Shared",
      paidFrom: "Operating account",
      paymentMethod: "ACH",
      capitalImprovement: false,
    },
  ]);

  const match = findTransactionVendorMemoryForDraft({ vendor: "Example Energy", description: "Utility bill" }, memories);
  assert.equal(match?.category, "Utilities");
  assert.equal(match?.paidFrom, "Operating account");
});

test("applyTransactionVendorMemoryToDraft keeps amount and date while applying posting defaults", () => {
  const draft = {
    date: "2026-05-14",
    type: "Expense",
    category: "Other expenses",
    amount: "83.55",
    description: "Example Energy bill",
    vendor: "Example Energy",
    propertyId: "p-old",
    unit: "Shared",
    paidFrom: "Cash",
    paymentMethod: "Check",
    capitalImprovement: "No",
  };
  const memory = {
    type: "Expense",
    category: "Utilities",
    propertyId: "p1",
    unit: "614",
    paidFrom: "Operating account",
    paymentMethod: "ACH",
    vendor: "Example Energy",
    capitalImprovement: false,
    deMinimisTreatment: "auto",
  };
  const result = applyTransactionVendorMemoryToDraft(draft, memory, {
    Expense: ["Utilities", "Other expenses"],
  });

  assert.equal(result.date, "2026-05-14");
  assert.equal(result.amount, "83.55");
  assert.equal(result.category, "Utilities");
  assert.equal(result.propertyId, "p1");
  assert.equal(result.unit, "614");
  assert.equal(result.paidFrom, "Operating account");
  assert.equal(result.paymentMethod, "ACH");
});
