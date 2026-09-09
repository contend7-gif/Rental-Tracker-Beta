import type { DocumentItem, Transaction } from "../models.ts";

export function buildTransactionSupportIndex(documents: DocumentItem[] = []): Set<string> {
  return new Set(documents.flatMap((document) => [
    document.transactionId, ...(document.relatedTransactionIds || []),
  ]).filter((id): id is string => Boolean(id)));
}

export function hasTransactionSupport(
  transaction: Pick<Transaction, "id" | "receiptName"> | null | undefined,
  supportedTransactionIds: ReadonlySet<string>,
): boolean {
  if (!transaction) return false;
  return Boolean(String(transaction.receiptName || "").trim())
    || Boolean(transaction.id && supportedTransactionIds.has(transaction.id));
}
