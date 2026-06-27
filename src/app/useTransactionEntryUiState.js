import { useState } from "react";
import { createBlankForm } from "./draftFactories.js";

export function useTransactionEntryUiState() {
  const [form, setForm] = useState(() => createBlankForm());
  const [pendingDocumentExpenseSource, setPendingDocumentExpenseSource] = useState(null);
  const [editingTxnId, setEditingTxnId] = useState("");
  const [pendingTxnAttachment, setPendingTxnAttachment] = useState(null);
  const [rentAmountTouched, setRentAmountTouched] = useState(false);

  return {
    editingTxnId,
    form,
    pendingDocumentExpenseSource,
    pendingTxnAttachment,
    rentAmountTouched,
    setEditingTxnId,
    setForm,
    setPendingDocumentExpenseSource,
    setPendingTxnAttachment,
    setRentAmountTouched,
  };
}
