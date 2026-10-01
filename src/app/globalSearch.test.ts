import assert from "node:assert/strict";
import test from "node:test";
import { buildGlobalSearchIndex, searchGlobalRecords } from "./globalSearch.ts";

test("global search finds records across years, property names, tags, OCR, and tenant names", () => {
  const index = buildGlobalSearchIndex({
    transaction: [{ id: "t1", description: "Valve repair", vendor: "Example Plumbing", propertyId: "p2", date: "2024-05-01", status: "active" }, { id: "t2", description: "Voided repair", status: "voided" }],
    document: [{ id: "d1", name: "Example invoice", tags: ["utilities"], extractedText: "Invoice ABC-42", dataUrl: "secret-file-content", privateNote: "secret-note" }],
    lease: [{ id: "l1", tenantName: "Fictional René", startDate: "2025-01-01" }],
    action: [{ id: "transaction", name: "Transaction", description: "Record income" }],
  }, { p2: "Example Duplex" });
  assert.equal(searchGlobalRecords(index, "plumbing duplex 2024")[0].id, "t1");
  assert.equal(searchGlobalRecords(index, "utilities abc-42")[0].id, "d1");
  assert.equal(searchGlobalRecords(index, "rene")[0].id, "l1");
  assert.equal(searchGlobalRecords(index, "income")[0].kind, "action");
  assert.equal(searchGlobalRecords(index, "voided").length, 0);
  assert.equal(searchGlobalRecords(index, "secret").length, 0);
  assert.equal(searchGlobalRecords(index, "").length, 1);
});

test("search limits large matches and puts title-prefix matches first", () => {
  const index = buildGlobalSearchIndex({ document: Array.from({ length: 200 }, (_, id) => ({ id: String(id), name: id === 199 ? "Repair invoice" : "Invoice for repair" })) });
  const matches = searchGlobalRecords(index, "repair");
  assert.equal(matches.length, 50);
  assert.equal(matches[0].id, "199");
});
