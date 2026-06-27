import { useMemo } from "react";
import { buildTransactionVendorMemory } from "../features/transactions/transactionVendorMemory.js";

export function useAppTransactionCollections({ transactions }) {
  const activeTx = useMemo(() => transactions.filter((transaction) => transaction.status === "active"), [transactions]);
  const transactionVendorMemories = useMemo(() => buildTransactionVendorMemory(activeTx), [activeTx]);

  return {
    activeTx,
    transactionVendorMemories,
  };
}
