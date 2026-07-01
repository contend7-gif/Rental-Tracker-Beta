import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("loan payment controls prevent duplicate dates and expose hidden future payments", () => {
  const controllerSource = readFileSync(new URL("../../app/useLoanWorkspaceController.js", import.meta.url), "utf8");
  const cardsSource = readFileSync(new URL("./LoanCardsPanel.jsx", import.meta.url), "utf8");

  assert.match(controllerSource, /A payment already exists for this loan and date/);
  assert.match(controllerSource, /return false/);
  assert.match(cardsSource, /Future payments hidden by the as-of date/);
  assert.match(cardsSource, /hiddenFuturePayments\.map/);
  assert.match(cardsSource, /deleteLoanPayment\(payment\)/);
});
