import { useRef, useState } from "react";
import { createBlankDocumentImportDraft } from "./draftFactories.js";

export function useDocumentWorkspaceUiState() {
  const [expenseQueueFocusDocumentId, setExpenseQueueFocusDocumentId] = useState("");
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedWorkOrderAttachmentId, setSelectedWorkOrderAttachmentId] = useState("");
  const [documentImportDialogOpen, setDocumentImportDialogOpen] = useState(false);
  const [documentImportDraft, setDocumentImportDraft] = useState(() => createBlankDocumentImportDraft());
  const [documentImportOcrBusy, setDocumentImportOcrBusy] = useState(false);
  const [documentImportOcrMessage, setDocumentImportOcrMessage] = useState("");
  const [documentAiBusyById, setDocumentAiBusyById] = useState({});
  const [documentOcrBusyById, setDocumentOcrBusyById] = useState({});
  const [documentBatchOcrBusy, setDocumentBatchOcrBusy] = useState(false);
  const documentImportOcrRequestIdRef = useRef(0);

  return {
    documentAiBusyById,
    documentBatchOcrBusy,
    documentImportDialogOpen,
    documentImportDraft,
    documentImportOcrBusy,
    documentImportOcrMessage,
    documentImportOcrRequestIdRef,
    documentOcrBusyById,
    expenseQueueFocusDocumentId,
    selectedDocument,
    selectedWorkOrderAttachmentId,
    setDocumentAiBusyById,
    setDocumentBatchOcrBusy,
    setDocumentImportDialogOpen,
    setDocumentImportDraft,
    setDocumentImportOcrBusy,
    setDocumentImportOcrMessage,
    setDocumentOcrBusyById,
    setExpenseQueueFocusDocumentId,
    setSelectedDocument,
    setSelectedWorkOrderAttachmentId,
  };
}
