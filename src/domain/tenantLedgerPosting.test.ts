import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultTenantLedgerPostingDescription,
  isTenantLedgerKindAllowedForTreatment,
  normalizeTenantLedgerAccountingTreatment,
  recommendedTenantLedgerAccountingTreatment,
  recommendedTenantLedgerKindForTreatment,
  tenantLedgerKindsForTreatment,
  tenantLedgerPostingTemplate,
} from "./tenantLedgerPosting.ts";

test("normalizeTenantLedgerAccountingTreatment falls back to none", () => {
  assert.equal(normalizeTenantLedgerAccountingTreatment("rent_income"), "rent_income");
  assert.equal(normalizeTenantLedgerAccountingTreatment("bad-value"), "none");
});

test("recommendedTenantLedgerAccountingTreatment favors payment and refund defaults", () => {
  assert.equal(recommendedTenantLedgerAccountingTreatment("payment"), "rent_income");
  assert.equal(recommendedTenantLedgerAccountingTreatment("refund"), "security_deposit_return");
  assert.equal(recommendedTenantLedgerAccountingTreatment("charge"), "none");
});

test("tenantLedgerKindsForTreatment enforces deposit accounting combinations", () => {
  assert.deepEqual(tenantLedgerKindsForTreatment("security_deposit_liability"), ["payment"]);
  assert.deepEqual(tenantLedgerKindsForTreatment("security_deposit_applied_damages"), ["charge", "adjustment"]);
  assert.equal(recommendedTenantLedgerKindForTreatment("security_deposit_return"), "refund");
  assert.equal(isTenantLedgerKindAllowedForTreatment("charge", "security_deposit_liability"), false);
  assert.equal(isTenantLedgerKindAllowedForTreatment("payment", "security_deposit_liability"), true);
});

test("tenantLedgerPostingTemplate marks security deposit treatments as non-income", () => {
  const deposit = tenantLedgerPostingTemplate("security_deposit_liability");
  assert.ok(deposit);
  assert.equal(deposit?.txType, "Transfer");
  assert.equal(deposit?.nonIncome, true);

  const damages = tenantLedgerPostingTemplate("security_deposit_applied_damages");
  assert.ok(damages);
  assert.equal(damages?.txType, "Income");
  assert.equal(damages?.category, "Other income");
  assert.equal(damages?.nonIncome, false);
});

test("defaultTenantLedgerPostingDescription uses memo when provided", () => {
  const description = defaultTenantLedgerPostingDescription({
    treatment: "rent_income",
    tenantName: "Tenant Alpha",
    unit: "616",
    memo: "April rent",
  });
  assert.equal(description, "April rent");
});

