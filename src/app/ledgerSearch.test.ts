import assert from "node:assert/strict";
import test from "node:test";

import { matchesLedgerTransactionSearch } from "./ledgerSearch.ts";

const transaction = {
  description: "Monthly water service",
  category: "Utilities",
  vendor: "Wisconsin Water Co",
};

test("ledger search includes vendor payees used by Smart Checks", () => {
  assert.equal(matchesLedgerTransactionSearch(transaction as never, "wisconsin water"), true);
  assert.equal(matchesLedgerTransactionSearch(transaction as never, "utilities"), true);
  assert.equal(matchesLedgerTransactionSearch(transaction as never, "monthly water"), true);
  assert.equal(matchesLedgerTransactionSearch(transaction as never, "electric"), false);
});
