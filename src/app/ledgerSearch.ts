import type { Transaction } from "../models.ts";

export function matchesLedgerTransactionSearch(transaction: Transaction, search: string) {
  const term = String(search || "").trim().toLowerCase();
  if (!term) return true;
  return [transaction.description, transaction.category, transaction.vendor, transaction.fromAccount, transaction.toAccount, transaction.sourceConfirmation?.provider, transaction.sourceConfirmation?.reference]
    .join(" ")
    .toLowerCase()
    .includes(term);
}
