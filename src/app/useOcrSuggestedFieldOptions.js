import { useMemo } from "react";
import { suggestedFieldHint } from "./documentShared.js";

export function useOcrSuggestedFieldOptions({ pendingDocumentExpenseSource }) {
  const ocrPrefilledFieldSet = useMemo(
    () => new Set(Array.isArray(pendingDocumentExpenseSource?.prefilledFields) ? pendingDocumentExpenseSource.prefilledFields : []),
    [pendingDocumentExpenseSource],
  );

  const getSuggestedFieldOptions = (fieldKey, label) =>
    ocrPrefilledFieldSet.has(fieldKey)
      ? { highlighted: true, badgeLabel: "Suggested", hint: suggestedFieldHint(label) }
      : undefined;

  return { getSuggestedFieldOptions };
}
