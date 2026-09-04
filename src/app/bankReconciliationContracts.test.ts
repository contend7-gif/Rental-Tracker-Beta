import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const workspacesSource = readFileSync(new URL("./AppWorkspaces.jsx", import.meta.url), "utf8");

function sourceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("statement reconciliation state and actions reach the ledger workspace", () => {
  const appWorkspaceProps = sourceBetween(appSource, "const appWorkspaceProps = {", "const appDialogProps = {");
  const ledgerContract = sourceBetween(workspacesSource, "function buildLedgerWorkspaceContract", "function buildTaxWorkspaceContract");
  const requiredProps = [
    "bankReconciliationDraft",
    "bankReconciliationRecords",
    "bankReconciliationSummary",
    "closeBankReconciliation",
    "reopenBankReconciliation",
    "updateBankReconciliationDraft",
  ];

  for (const prop of requiredProps) {
    assert.match(appWorkspaceProps, new RegExp(`\\b${prop}\\b`), `${prop} must be passed into AppWorkspaces`);
    assert.match(ledgerContract, new RegExp(`"${prop}"`), `${prop} must be forwarded into LedgerWorkspace`);
  }
});
