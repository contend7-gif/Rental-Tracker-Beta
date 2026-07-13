import { useRef, useState } from "react";
import type { DocumentItem } from "../models.ts";
import { createBlankDocumentImportDraft } from "./draftFactories.js";

type DocumentBusyMap = Record<string, boolean>;

export function useDocumentWorkspaceUiState() {
  const [expenseQueueFocusDocumentId, setExpenseQueueFocusDocumentId] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);
  const [selectedWorkOrderAttachmentId, setSelectedWorkOrderAttachmentId] = useState("");
  const [documentImportDialogOpen, setDocumentImportDialogOpen] = useState(false);
  const [documentImportDraft, setDocumentImportDraft] = useState(() => createBlankDocumentImportDraft());
  const [documentImportOcrBusy, setDocumentImportOcrBusy] = useState(false);
  const [documentImportOcrMessage, setDocumentImportOcrMessage] = useState("");
  const [documentAiBusyById, setDocumentAiBusyById] = useState<DocumentBusyMap>({});
  const [documentOcrBusyById, setDocumentOcrBusyById] = useState<DocumentBusyMap>({});
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
