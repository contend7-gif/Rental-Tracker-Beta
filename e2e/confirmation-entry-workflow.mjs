import { expect } from "@playwright/test";

export const EXAMPLE_DRAW_CONFIRMATION = "Fidelity: Transfer from Fidelity 1234 to SoFi 5678 processed successfully on 2026-10-20. Amount: $337.25. Confirmation ID: DEMO-TRANSFER-1234";

export async function exerciseConfirmationEntry(page, readState) {
  await expect.poll(async () => (await readState()).data?.transactions?.length || 0).toBeGreaterThan(0);
  const initial = await readState();
  const operatingTotal = transactions => transactions.filter(tx => tx.status === "active" && ["Income", "Expense"].includes(tx.type)).reduce((sum, tx) => sum + Number(tx.amount), 0);
  const before = operatingTotal(initial.data.transactions);
  const openNew = async () => {
    await page.getByRole("button", { name: "New", exact: true }).click();
    await page.getByRole("menuitem", { name: /^Transaction/ }).click();
  };
  const paste = async text => {
    const field = page.getByLabel("Confirmation text", { exact: true });
    if (!await field.isVisible()) await page.getByText("Paste a payment confirmation", { exact: true }).click();
    await field.fill(text);
    await page.getByRole("button", { name: "Review confirmation draft", exact: true }).click();
    await page.getByRole("button", { name: "Use reviewed draft", exact: true }).click();
  };
  await openNew();
  await paste(EXAMPLE_DRAW_CONFIRMATION);
  await page.getByRole("combobox", { name: "Type", exact: true }).selectOption("Owner Draw");
  await page.getByText("Save or manage account rules", { exact: true }).click();
  await page.getByRole("checkbox", { name: /Also suggest Owner Contribution/ }).check();
  await page.getByRole("button", { name: "Save account rule", exact: true }).click();
  await page.getByRole("button", { name: "Save transaction", exact: true }).click();
  const receipt = page.getByRole("status", { name: "Saved transaction confirmation", exact: true });
  await expect(receipt).toContainText("$337.25 | Owner Draw");
  await expect.poll(async () => (await readState()).data.transactions.find(tx => tx.sourceConfirmation?.reference === "DEMO-TRANSFER-1234")?.type).toBe("Owner Draw");
  let state = await readState();
  const draw = state.data.transactions.find(tx => tx.sourceConfirmation?.reference === "DEMO-TRANSFER-1234");
  expect(draw.fromAccount).toBe("Fidelity 1234");
  expect(draw.toAccount).toBe("SoFi 5678");
  expect(draw.paidFrom).toBe("Fidelity 1234");
  expect(draw.reconciled).toBe(false);
  expect(draw.deductibleAmount).toBe(0);
  expect(operatingTotal(state.data.transactions)).toBe(before);
  expect(state.settings.cashMovementRules[0].reverseType).toBe("Owner Contribution");

  await page.reload();
  await openNew();
  await paste("Fidelity: Transfer from Fidelity 1234 to SoFi 5678 initiated on 2026-10-21. Amount: $342.75. Confirmation ID: DEMO-PENDING-1234");
  await page.getByRole("button", { name: "Apply account rule", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Type", exact: true })).toHaveValue("Owner Draw");
  await expect(page.getByRole("button", { name: "Save transaction", exact: true })).toBeDisabled();
  expect((await readState()).data.transactions.some(tx => tx.sourceConfirmation?.reference === "DEMO-PENDING-1234")).toBe(false);
  await page.getByLabel("Payment evidence status", { exact: true }).selectOption("completed");
  await page.getByRole("button", { name: "Save transaction", exact: true }).click();
  await receipt.getByRole("button", { name: "Undo new entry", exact: true }).click();
  await expect.poll(async () => (await readState()).data.transactions.find(tx => tx.sourceConfirmation?.reference === "DEMO-PENDING-1234")?.status).toBe("voided");

  await openNew();
  await paste(EXAMPLE_DRAW_CONFIRMATION);
  await expect(page.getByRole("button", { name: "Save transaction", exact: true })).toBeDisabled();
  await expect(page.getByRole("region", { name: "Possible duplicate confirmations", exact: true })).toContainText("already recorded");
  await page.getByRole("button", { name: "Open existing entry", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Account route: Fidelity 1234 to SoFi 5678");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Clear form", exact: true }).click();

  await paste("Venmo: Example Tenant paid you $123.45. Payment date: 2026-10-25. December 2026 rent. Transaction ID: DEMO-RENT-1234");
  await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("123.45");
  await expect(page.getByLabel("Date", { exact: true })).toHaveValue("2026-10-25");
  await expect(page.getByLabel("Rent reporting month", { exact: true })).toHaveValue("2026-12");
  await expect(page.getByText("Estimated rent remainder", { exact: false })).toContainText("$1,326.55");
  await page.getByRole("button", { name: "Save transaction", exact: true }).click();
  await expect(receipt).toContainText("Rent month 2026-12");
  await expect.poll(async () => (await readState()).data.transactions.find(tx => tx.sourceConfirmation?.reference === "DEMO-RENT-1234")?.amount).toBe(123.45);

  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  await page.getByText("Bookkeeping coverage", { exact: false }).first().click();
  await page.getByLabel("Owner draw review month", { exact: true }).fill("2026-10");
  await page.getByRole("button", { name: "Mark owner draws checked", exact: true }).click();
  const account = page.locator("section").filter({ has: page.getByText("Fidelity 1234 | Sample Duplex", { exact: true }) }).last();
  await expect(account).toContainText("No closed statement");
  await account.getByRole("button", { name: "Mark account activity reviewed", exact: true }).click();
  await expect.poll(async () => Object.keys((await readState()).settings.accountActivityReviews || {}).length).toBe(1);
  await expect.poll(async () => Object.keys((await readState()).settings.ownerDrawMonthlyReviews || {}).length).toBe(1);
  state = await readState();
  expect(Object.keys(state.settings.bankReconciliationRecords || {})).toHaveLength(0);
  await page.screenshot({ path: "output/playwright/confirmation-entry-coverage.png" });
  await page.reload();
  state = await readState();
  expect(state.data.transactions.find(tx => tx.sourceConfirmation?.reference === "DEMO-RENT-1234").sourceConfirmation.text).toContain("$123.45");
  expect(state.settings.cashMovementRules[0].type).toBe("Owner Draw");
  expect(Object.keys(state.settings.accountActivityReviews)).toHaveLength(1);
  expect(Object.keys(state.settings.ownerDrawMonthlyReviews)).toHaveLength(1);
}
