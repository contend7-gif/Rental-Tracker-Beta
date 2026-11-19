import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import type { DocumentItem, Transaction } from "../models.ts";
import { createBlankForm } from "./draftFactories.js";
import { useDocumentAttachmentWorkflow } from "./useDocumentAttachmentWorkflow.ts";
import { useTransactionEntryController } from "./useTransactionEntryController.js";

test("an unreadable receipt leaves the transaction draft unsaved and a retry posts exactly once", async () => {
  const transactions: Transaction[] = [];
  const documents: DocumentItem[] = [];
  const notices: string[] = [];
  const dataUrl = "data:application/pdf;base64,JVBERi0=";
  let fileReadable = false;
  const setNotice = (notice: string) => { notices.push(notice); };
  const noop = () => {};
  const actions = {
    addOrUpdateTransaction: (transaction: Transaction) => { transactions.push(transaction); },
    addDocument: (document: DocumentItem) => { documents.push(document); },
    addOrUpdateWorkOrder: noop,
    computeTransactionPreview: () => ({ rentalUsePct: 1, deductibleAmount: 100 }),
  };
  const { prepareTransactionReceipt } = useDocumentAttachmentWorkflow({
    actions,
    canAttachToTransaction: () => true,
    inferDocumentTags: () => [],
    readFileAsDataUrl: async () => {
      if (!fileReadable) throw new Error("The receipt file could not be read.");
      return dataUrl;
    },
    selectedWorkOrderAttachmentId: "",
    setDocumentSearch: noop, setDocumentStatusFilter: noop, setNotice, setPropertyFilter: noop,
    setSelectedWorkOrderAttachmentId: noop, setUnitFilter: noop, setView: noop,
    vendorById: {}, workOrderAttachmentInputRef: { current: null }, workOrderById: {},
  });
  const form = { ...createBlankForm("p1"), date: "2026-11-01", amount: "100", description: "Example receipt expense" };
  let controller: ReturnType<typeof useTransactionEntryController> | undefined;
  function TransactionForm() {
    controller = useTransactionEntryController({
      actions,
      appSettings: {},
      canAttachToTransaction: () => true,
      categories: {},
      createBlankForm,
      currency: String,
      deMinimisThreshold: 2500,
      documents,
      desktopCompanionApi: null,
      editReturnView: "ledger",
      editingTxnId: "",
      form,
      getRentalUsePctForDate: () => 1,
      getRentalUsePctForRange: () => 1,
      isDeMinimisCategoryEligible: () => false,
      isTaxReviewRelevantTransaction: () => true,
      leases: [],
      pendingDocumentExpenseSource: null,
      pendingTxnAttachment: new File(["%PDF-"], "receipt.pdf", { type: "application/pdf" }),
      prepareTransactionReceipt,
      prefetchDialog: noop,
      properties: [{ id: "p1" }],
      recurringThroughDate: form.date,
      requirePermission: () => true,
      setDashboardQuickAddOpen: noop, setDocumentStatusFilter: noop, setEditingTxnId: noop,
      setExpenseQueueFocusDocumentId: noop, setExpenseQueueShowDismissed: noop, setForm: noop,
      setNotice, setPendingDocumentExpenseSource: noop, setPendingTxnAttachment: noop,
      setPropertyQuickAddOpen: noop, setRentAmountTouched: noop, setEditReturnView: noop, setView: noop,
      transactionVendorMemories: [], transactions, txnAttachmentInputRef: { current: null }, units: [], usePeriods: [],
    });
    return null;
  }
  renderToString(createElement(TransactionForm));
  assert.ok(controller);

  assert.equal(await controller.saveTransaction(), false);
  assert.equal(transactions.length, 0);
  assert.equal(documents.length, 0);
  assert.equal(form.receiptName, "");
  assert.match(notices.at(-1) || "", /Replace or remove the file/);

  fileReadable = true;
  assert.equal(await controller.saveTransaction(), true);
  assert.equal(transactions.length, 1);
  assert.equal(documents.length, 1);
  assert.equal(transactions[0].receiptName, "receipt.pdf");
  assert.equal(documents[0].transactionId, transactions[0].id);
  assert.equal(documents[0].dataUrl, dataUrl);
  assert.match(notices.at(-1) || "", /Receipt attached/);
});
