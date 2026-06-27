import { useRef } from "react";

export function useAppElementRefs() {
  return {
    backupImportInputRef: useRef(null),
    documentImportInputRef: useRef(null),
    leasePdfInputRef: useRef(null),
    statementLogoInputRef: useRef(null),
    txnAttachmentInputRef: useRef(null),
    txnInlineAttachmentInputRef: useRef(null),
    workOrderAttachmentInputRef: useRef(null),
  };
}
