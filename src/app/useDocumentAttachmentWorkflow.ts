import type { ChangeEvent } from "react";
import type { DocumentItem, Transaction, Vendor, WorkOrder } from "../models.ts";

type UseDocumentAttachmentWorkflowArgs = {
  actions: {
    addDocument: (document: DocumentItem) => void;
    addOrUpdateWorkOrder: (workOrder: WorkOrder) => void;
  };
  canAttachToTransaction: (file?: Pick<File, "type"> | null) => boolean;
  inferDocumentTags: (context: {
    document: { name: string; type: string; tags: string[] };
    transaction?: Transaction;
    workOrder?: WorkOrder;
    vendor?: Vendor | null;
  }) => string[];
  readFileAsDataUrl: (file: File) => Promise<string>;
  selectedWorkOrderAttachmentId: string;
  setDocumentSearch: (search: string) => void;
  setDocumentStatusFilter: (filter: string) => void;
  setNotice: (notice: string) => void;
  setPropertyFilter: (filter: string) => void;
  setSelectedWorkOrderAttachmentId: (id: string) => void;
  setUnitFilter: (filter: string) => void;
  setView: (view: string) => void;
  vendorById: Record<string, Vendor>;
  workOrderAttachmentInputRef: { current: HTMLInputElement | null };
  workOrderById: Record<string, WorkOrder>;
};

export function useDocumentAttachmentWorkflow({
  actions,
  canAttachToTransaction,
  inferDocumentTags,
  readFileAsDataUrl,
  selectedWorkOrderAttachmentId,
  setDocumentSearch,
  setDocumentStatusFilter,
  setNotice,
  setPropertyFilter,
  setSelectedWorkOrderAttachmentId,
  setUnitFilter,
  setView,
  vendorById,
  workOrderAttachmentInputRef,
  workOrderById,
}: UseDocumentAttachmentWorkflowArgs) {
  async function attachDocumentToTransaction(txn: Transaction | null | undefined, file: File | null | undefined) {
    if (!txn || !file) return;
    if (!canAttachToTransaction(file)) {
      setNotice("Attach a PDF or image file for transaction receipts.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      actions.addDocument({
        id: `d${Date.now()}`,
        propertyId: txn.propertyId,
        unit: txn.unit,
        transactionId: txn.id,
        name: file.name,
        type: "Transaction Receipt",
        mimeType: file.type || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
        dataUrl,
        tags: inferDocumentTags({
          document: { name: file.name, type: "Transaction Receipt", tags: [] },
          transaction: txn,
        }),
      });
      setNotice(`Attached ${file.name} to transaction.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not attach transaction file.");
    }
  }

  async function attachDocumentToWorkOrder(workOrder: WorkOrder | null | undefined, file: File | null | undefined) {
    if (!workOrder || !file) return;
    if (!canAttachToTransaction(file)) {
      setNotice("Attach a PDF or image file for work order documents.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const vendor = workOrder.vendorId ? vendorById[workOrder.vendorId] : null;
      const documentId = `d${Date.now()}`;
      actions.addDocument({
        id: documentId,
        propertyId: workOrder.propertyId,
        unit: workOrder.unit,
        workOrderId: workOrder.id,
        name: file.name,
        type: "Work Order File",
        mimeType: file.type || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
        dataUrl,
        tags: inferDocumentTags({
          document: { name: file.name, type: "Work Order File", tags: [] },
          workOrder,
          vendor,
        }),
      });
      actions.addOrUpdateWorkOrder({
        ...workOrder,
        sourceDocumentIds: Array.from(new Set([...(workOrder.sourceDocumentIds || []), documentId])),
      });
      setNotice(`Attached ${file.name} to work order ${workOrder.title}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not attach work order file.");
    }
  }

  const onWorkOrderAttachmentInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const workOrder = selectedWorkOrderAttachmentId ? workOrderById[selectedWorkOrderAttachmentId] : null;
    await attachDocumentToWorkOrder(workOrder, file);
    setSelectedWorkOrderAttachmentId("");
    event.target.value = "";
  };

  const openWorkOrderAttachmentPicker = (workOrder: WorkOrder) => {
    setSelectedWorkOrderAttachmentId(workOrder.id);
    workOrderAttachmentInputRef.current?.click();
  };

  const openWorkOrderDocuments = (workOrder: WorkOrder) => {
    setPropertyFilter(workOrder.propertyId);
    setUnitFilter(workOrder.unit || "all");
    setDocumentStatusFilter("all");
    setDocumentSearch(workOrder.title || "");
    setView("documents");
    setNotice(`Showing documents for work order ${workOrder.title}.`);
  };

  return {
    attachDocumentToTransaction,
    onWorkOrderAttachmentInputChange,
    openWorkOrderAttachmentPicker,
    openWorkOrderDocuments,
  };
}
