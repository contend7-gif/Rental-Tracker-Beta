import test from "node:test";
import assert from "node:assert/strict";
import { bankImportIdFromExternalId, findExistingImportedBankRows, matchBankRowsToTransactions, parseBankCsv, parseBankStatement, suggestBankTransactionTypeAndCategory } from "./bankImport.ts";

test("parseBankCsv supports amount column and skips invalid rows", () => {
  const csv = [
    "Date,Description,Amount",
    "2026-01-02,Rent payment,2500.00",
    "2026-01-03,Hardware Store,-112.45",
    "bad-date,Missing amount,",
  ].join("\n");

  const parsed = parseBankCsv(csv);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.skippedRows, 1);
  assert.equal(parsed.rows[0].amount, 2500);
  assert.equal(parsed.rows[1].amount, -112.45);
});

test("parseBankCsv supports debit/credit layouts", () => {
  const csv = [
    "Posted Date,Memo,Debit,Credit",
    "1/5/2026,Utility Bill,120.33,",
    "1/6/2026,Tenant Deposit,,1800.00",
  ].join("\n");

  const parsed = parseBankCsv(csv);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].date, "2026-01-05");
  assert.equal(parsed.rows[0].amount, -120.33);
  assert.equal(parsed.rows[1].amount, 1800);
});

test("parseBankStatement parses QBO/OFX transactions", () => {
  const qbo = [
    "OFXHEADER:100",
    "<OFX>",
    "<BANKTRANLIST>",
    "<STMTTRN>",
    "<DTPOSTED>20260205",
    "<TRNAMT>-95.40",
    "<FITID>20260205-1",
    "<NAME>Acme Plumbing",
    "<MEMO>Repair",
    "<STMTTRN>",
    "<DTPOSTED>20260206",
    "<TRNAMT>2200.00",
    "<FITID>20260206-1",
    "<MEMO>February Rent",
  ].join("\n");

  const parsed = parseBankStatement(qbo, "checking.qbo");
  assert.equal(parsed.format, "ofx");
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.skippedRows, 0);
  assert.equal(parsed.rows[0].date, "2026-02-05");
  assert.equal(parsed.rows[0].description, "Acme Plumbing");
  assert.equal(parsed.rows[0].amount, -95.4);
  assert.equal(parsed.rows[0].externalId, "20260205-1");
  assert.equal(parsed.rows[1].description, "February Rent");
  assert.equal(parsed.rows[1].amount, 2200);
});

test("parseBankStatement falls back to csv format", () => {
  const csv = [
    "Date,Description,Amount",
    "2026-01-02,Rent payment,2500.00",
  ].join("\n");

  const parsed = parseBankStatement(csv, "statement.csv");
  assert.equal(parsed.format, "csv");
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].amount, 2500);
});



test("findExistingImportedBankRows maps FITID rows to existing transactions", () => {
  const rows = parseBankStatement([
    "OFXHEADER:100",
    "<OFX>",
    "<BANKTRANLIST>",
    "<STMTTRN>",
    "<DTPOSTED>20260205",
    "<TRNAMT>-95.40",
    "<FITID>fit-1",
    "<NAME>Acme Plumbing",
    "<STMTTRN>",
    "<DTPOSTED>20260206",
    "<TRNAMT>2200.00",
    "<FITID>fit-2",
    "<MEMO>February Rent",
  ].join("\n"), "checking.qbo").rows;

  const existing = findExistingImportedBankRows(rows, [
    { id: "t-existing", bankImportId: bankImportIdFromExternalId("fit-1") },
    { id: "t-other", bankImportId: bankImportIdFromExternalId("other-fit") },
  ]);

  assert.equal(existing[rows[0].id], "t-existing");
  assert.equal(existing[rows[1].id], undefined);
});


test("matchBankRowsToTransactions finds closest one-to-one matches", () => {
  const rows = parseBankCsv(
    [
      "Date,Description,Amount",
      "2026-02-01,Acme Plumbing,-95.00",
      "2026-02-02,Rent February,2200.00",
    ].join("\n"),
  ).rows;

  const matches = matchBankRowsToTransactions(rows, [
    { id: "t1", date: "2026-02-01", type: "Expense", amount: 95, description: "Acme Plumbing repair" },
    { id: "t2", date: "2026-02-03", type: "Income", amount: 2200, description: "Rent payment" },
  ]);

  assert.equal(matches[rows[0].id]?.transactionId, "t1");
  assert.equal(matches[rows[1].id]?.transactionId, "t2");
});

test("suggestBankTransactionTypeAndCategory maps rent income and utilities expense", () => {
  const income = suggestBankTransactionTypeAndCategory(2200, "February Rent Payment");
  const expense = suggestBankTransactionTypeAndCategory(-180, "City water utility");

  assert.equal(income.type, "Income");
  assert.equal(income.category, "Rents received");
  assert.equal(expense.type, "Expense");
  assert.equal(expense.category, "Utilities");
});


test("matchBankRowsToTransactions can include low-confidence matches when requested", () => {
  const rows = parseBankCsv(
    [
      "Date,Description,Amount",
      "2026-02-01,Unlabeled transfer,-50.00",
    ].join("\n"),
  ).rows;

  const txns = [
    { id: "t1", date: "2026-02-06", type: "Expense", amount: 50, description: "Misc payment" },
  ];

  const standardMatches = matchBankRowsToTransactions(rows, txns);
  assert.equal(standardMatches[rows[0].id], undefined);

  const lenientMatches = matchBankRowsToTransactions(rows, txns, { minimumConfidence: "low", daysWindow: 6 });
  assert.equal(lenientMatches[rows[0].id]?.transactionId, "t1");
  assert.equal(lenientMatches[rows[0].id]?.confidence, "low");
});

test("matchBankRowsToTransactions uses global best one-to-one assignment", () => {
  const rows = parseBankCsv(
    [
      "Date,Description,Amount",
      "2026-02-01,Maple rent payment,100.00",
      "2026-02-02,Oak rent payment,100.00",
    ].join("\n"),
  ).rows;

  const txns = [
    { id: "t1", date: "2026-02-02", type: "Income", amount: 100, description: "Oak rent payment posted" },
    { id: "t2", date: "2026-02-03", type: "Income", amount: 100, description: "Maple rent payment posted" },
  ];

  const matches = matchBankRowsToTransactions(rows, txns, { minimumConfidence: "low" });
  assert.equal(matches[rows[0].id]?.transactionId, "t2");
  assert.equal(matches[rows[1].id]?.transactionId, "t1");
});
