import { useMemo } from "react";

export function useDocumentDerivedCollections({
  documentImportDraft,
  documents,
  leaseAutomationReminders,
  propertyFilter,
  unitFilter,
  units,
}) {
  const documentImportUnitOptions = useMemo(() => {
    if (!documentImportDraft.propertyId) return ["Shared"];
    return ["Shared", ...units.filter((unit) => unit.propertyId === documentImportDraft.propertyId).map((unit) => unit.name)];
  }, [documentImportDraft.propertyId, units]);

  const filteredDocuments = useMemo(
    () => documents.filter((doc) => (propertyFilter === "all" || doc.propertyId === propertyFilter) && (unitFilter === "all" || !doc.unit || doc.unit === unitFilter)),
    [documents, propertyFilter, unitFilter],
  );

  const leaseDocCountById = useMemo(
    () =>
      documents.reduce((countByLease, doc) => {
        if (!doc.leaseId) return countByLease;
        countByLease[doc.leaseId] = (countByLease[doc.leaseId] || 0) + 1;
        return countByLease;
      }, {}),
    [documents],
  );

  const scopedLeaseAutomationReminders = useMemo(
    () =>
      leaseAutomationReminders.filter((reminder) => {
        if (propertyFilter !== "all" && reminder.propertyId !== propertyFilter) return false;
        if (unitFilter !== "all" && reminder.unit !== unitFilter) return false;
        return true;
      }),
    [leaseAutomationReminders, propertyFilter, unitFilter],
  );

  return {
    documentImportUnitOptions,
    filteredDocuments,
    leaseDocCountById,
    scopedLeaseAutomationReminders,
  };
}
