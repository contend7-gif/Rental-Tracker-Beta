import { useCallback, useMemo, useRef, useState } from "react";
import type { DocumentItem } from "../models.ts";
import type { AppendActivityLog } from "./activityStore.ts";
import { createDocumentActions } from "./documentStore.ts";

type DocumentStateUpdater = DocumentItem[] | ((previous: DocumentItem[]) => DocumentItem[]);

export function useDocumentSlice({ appendActivityLog }: { appendActivityLog: AppendActivityLog }) {
  const [documents, setDocumentState] = useState<DocumentItem[]>([]);
  const documentsRef = useRef(documents);
  documentsRef.current = documents;

  const setDocuments = useCallback((updater: DocumentStateUpdater) => {
    setDocumentState(updater);
  }, []);

  const actions = useMemo(
    () => createDocumentActions({
      getDocuments: () => documentsRef.current,
      setDocuments,
      appendActivityLog,
    }),
    [appendActivityLog, setDocuments],
  );

  return { documents, setDocuments, actions };
}
