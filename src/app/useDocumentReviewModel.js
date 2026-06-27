import { useMemo } from "react";
import { formatUnitLabel } from "../domain/unitLabels.js";
import {
  documentNeedsIndexing,
  documentNeedsOcr,
  documentNeedsTags,
  documentSupportsAutomaticOcr,
  inferDocumentExpenseSuggestion,
  inferDocumentExtractedFields,
  inferDocumentLinkSuggestions,
  inferDocumentTagSuggestions,
  inferDocumentUtilitySections,
  inferDocumentWorkOrderSuggestion,
  normalizeExtractedDocumentText,
} from "../domain/documentIntelligence.ts";
import { parseDocumentTags } from "./documentShared.js";

export function useDocumentReviewModel({
  documentImportDraft,
  documentSearch,
  documentSort,
  documentStatusFilter,
  documents,
  expenseQueueFocusDocumentId,
  expenseQueueShowDismissed,
  filteredDocuments,
  leaseById,
  leases,
  propertyNameById,
  properties,
  selectedDocument,
  setDocumentStatusFilter,
  setExpenseQueueShowDismissed,
  transactionById,
  transactions,
  units,
  vendorById,
  vendors,
  workOrderById,
  workOrders,
}) {
  const candidateWorkOrders = useMemo(
    () =>
      workOrders.map((workOrder) => ({
        ...workOrder,
        vendorName: workOrder.vendorId ? vendorById[workOrder.vendorId]?.name || "" : "",
      })),
    [workOrders, vendorById],
  );

  const getProperty = (propertyId) => properties.find((item) => item.id === propertyId) || null;

  const getDocumentLinkedWorkOrder = (document) => {
    const directId = String(document.workOrderId || "").trim();
    if (directId && workOrderById[directId]) return workOrderById[directId];
    if (document.transactionId) {
      const linkedTxn = transactionById[document.transactionId];
      const txnLinkedId = String(linkedTxn?.workOrderId || "").trim();
      if (txnLinkedId && workOrderById[txnLinkedId]) return workOrderById[txnLinkedId];
      return workOrders.find((workOrder) => workOrder.transactionId === document.transactionId) || null;
    }
    return null;
  };

  const buildCandidateContext = ({ document, draft, extractedText, includeTransactionVendor = false, preferLinkedProperty = false }) => {
    const linkType = draft?.linkType || "";
    const linkedLease = document?.leaseId
      ? leaseById[document.leaseId]
      : linkType === "lease"
        ? leaseById[draft.linkedId]
        : null;
    const linkedTxn = document?.transactionId
      ? transactionById[document.transactionId]
      : linkType === "transaction"
        ? transactionById[draft.linkedId]
        : null;
    const linkedWorkOrder = document
      ? getDocumentLinkedWorkOrder(document)
      : linkType === "workOrder"
        ? workOrderById[draft.linkedId]
        : null;
    const linkedPropertyId = linkedWorkOrder?.propertyId || linkedTxn?.propertyId || linkedLease?.propertyId;
    const propertyId = draft ? linkedPropertyId || draft.propertyId : preferLinkedProperty ? linkedPropertyId || document?.propertyId : document?.propertyId;
    const property = getProperty(propertyId);
    const vendor = linkedWorkOrder?.vendorId
      ? vendorById[linkedWorkOrder.vendorId]
      : includeTransactionVendor && linkedTxn?.vendor
        ? vendors.find((item) => item.name === linkedTxn.vendor) || null
        : null;

    return {
      document: document
        ? {
            name: document.name,
            type: document.type,
            tags: document.tags,
            extractedText: document.extractedText,
            propertyId: document.propertyId,
            unit: document.unit,
          }
        : {
            name: draft.name,
            type: draft.type,
            tags: parseDocumentTags(draft.tags),
            extractedText,
            propertyId: draft.propertyId,
            unit: draft.unit,
          },
      property,
      lease: linkedLease,
      transaction: linkedTxn,
      workOrder: linkedWorkOrder,
      vendor,
      candidateVendors: vendors,
      candidateLeases: leases,
      candidateProperties: properties,
      candidateUnits: units,
      candidateTransactions: transactions,
      candidateWorkOrders,
    };
  };

  const getDocumentUtilitySections = (document) => {
    if (!document) return [];
    return inferDocumentUtilitySections(buildCandidateContext({ document, preferLinkedProperty: true }));
  };

  const getDocumentSuggestedTags = (document) => {
    const existingTags = Array.isArray(document.tags) ? document.tags : [];
    const suggested = inferDocumentTagSuggestions(buildCandidateContext({ document }));
    return suggested.filter((suggestion) => !existingTags.some((existing) => String(existing || "").toLowerCase() === String(suggestion.tag || "").toLowerCase()));
  };

  const getDocumentLinkSuggestions = (document) => {
    const linkedWorkOrder = getDocumentLinkedWorkOrder(document);
    const suggestions = inferDocumentLinkSuggestions(buildCandidateContext({ document }));

    return suggestions.filter((suggestion) => {
      if (suggestion.kind === "lease") return String(document.leaseId || "") !== suggestion.id;
      if (suggestion.kind === "transaction") return String(document.transactionId || "") !== suggestion.id;
      return String(linkedWorkOrder?.id || document.workOrderId || "") !== suggestion.id;
    });
  };

  const getDocumentImportSuggestedTags = (draft, extractedText = draft?.extractedText || "") => {
    if (!draft) return [];
    return inferDocumentTagSuggestions(buildCandidateContext({ draft, extractedText }));
  };

  const getDocumentImportLinkSuggestions = (draft, extractedText = draft?.extractedText || "") => {
    if (!draft) return [];
    return inferDocumentLinkSuggestions(buildCandidateContext({ draft, extractedText })).filter((suggestion) => {
      if (suggestion.kind === "lease") return !(draft.linkType === "lease" && draft.linkedId === suggestion.id);
      if (suggestion.kind === "transaction") return !(draft.linkType === "transaction" && draft.linkedId === suggestion.id);
      return !(draft.linkType === "workOrder" && draft.linkedId === suggestion.id);
    });
  };

  const getDocumentExpenseSuggestion = (document) => {
    if (!document) return null;
    return inferDocumentExpenseSuggestion(buildCandidateContext({ document, preferLinkedProperty: true }));
  };

  const getDocumentWorkOrderSuggestion = (document) => {
    if (!document) return null;
    return inferDocumentWorkOrderSuggestion(buildCandidateContext({ document, preferLinkedProperty: true }));
  };

  const getDocumentImportExpenseSuggestion = (draft, extractedText = draft?.extractedText || "") => {
    if (!draft) return null;
    return inferDocumentExpenseSuggestion(buildCandidateContext({ draft, extractedText }));
  };

  const getDocumentImportWorkOrderSuggestion = (draft, extractedText = draft?.extractedText || "") => {
    if (!draft) return null;
    return inferDocumentWorkOrderSuggestion(buildCandidateContext({ draft, extractedText }));
  };

  const getDocumentExtractedFields = (document) => {
    if (!document) return null;
    return inferDocumentExtractedFields(buildCandidateContext({ document, includeTransactionVendor: true }));
  };

  const getDocumentImportExtractedFields = (draft, extractedText = draft?.extractedText || "") => {
    if (!draft) return null;
    return inferDocumentExtractedFields(buildCandidateContext({ draft, extractedText }));
  };

  const getDocumentImportUtilitySections = (draft, extractedText = draft?.extractedText || "") => {
    if (!draft) return [];
    return inferDocumentUtilitySections(buildCandidateContext({ draft, extractedText }));
  };

  const buildDocumentAiContext = (document) => {
    if (!document) return null;
    const linkedLease = document.leaseId ? leaseById[document.leaseId] : null;
    const linkedTxn = document.transactionId ? transactionById[document.transactionId] : null;
    const linkedWorkOrder = getDocumentLinkedWorkOrder(document);
    const linkedVendor = linkedWorkOrder?.vendorId ? vendorById[linkedWorkOrder.vendorId] : null;
    const propertyId = linkedWorkOrder?.propertyId || linkedTxn?.propertyId || linkedLease?.propertyId || document.propertyId;
    const property = getProperty(propertyId);

    return {
      document: {
        id: document.id,
        name: document.name,
        type: document.type,
        tags: Array.isArray(document.tags) ? document.tags : [],
        uploadedAt: document.uploadedAt || "",
        extractedText: normalizeExtractedDocumentText(document.extractedText || ""),
      },
      property: property
        ? {
            id: property.id,
            name: property.name,
            address: property.address,
          }
        : null,
      lease: linkedLease
        ? {
            id: linkedLease.id,
            tenantName: linkedLease.tenantName,
            startDate: linkedLease.startDate,
            endDate: linkedLease.endDate,
            unit: linkedLease.unit,
          }
        : null,
      transaction: linkedTxn
        ? {
            id: linkedTxn.id,
            date: linkedTxn.date,
            description: linkedTxn.description,
            category: linkedTxn.category,
            amount: linkedTxn.amount,
            unit: linkedTxn.unit,
            invoiceRef: linkedTxn.invoiceRef || "",
          }
        : null,
      workOrder: linkedWorkOrder
        ? {
            id: linkedWorkOrder.id,
            title: linkedWorkOrder.title,
            status: linkedWorkOrder.status,
            priority: linkedWorkOrder.priority,
            unit: linkedWorkOrder.unit,
            description: linkedWorkOrder.description,
            reportedOn: linkedWorkOrder.reportedOn,
            dueDate: linkedWorkOrder.dueDate || "",
          }
        : null,
      extractedFields: getDocumentExtractedFields(document),
      tagSuggestions: getDocumentSuggestedTags(document).slice(0, 6).map((suggestion) => suggestion.tag),
      linkSuggestions: getDocumentLinkSuggestions(document).slice(0, 3).map((suggestion) => ({
        kind: suggestion.kind,
        label: suggestion.label,
        confidence: suggestion.confidence,
      })),
      expenseSuggestion: getDocumentExpenseSuggestion(document),
      workOrderSuggestion: getDocumentWorkOrderSuggestion(document),
      vendor: linkedVendor
        ? {
            id: linkedVendor.id,
            name: linkedVendor.name,
            defaultCategory: linkedVendor.defaultCategory || "",
          }
        : null,
    };
  };

  const documentImportSuggestedTags = getDocumentImportSuggestedTags(documentImportDraft);
  const documentImportLinkSuggestions = getDocumentImportLinkSuggestions(documentImportDraft);
  const documentImportExtractedFields = getDocumentImportExtractedFields(documentImportDraft);
  const documentImportExpenseSuggestion = getDocumentImportExpenseSuggestion(documentImportDraft);
  const documentImportWorkOrderSuggestion = getDocumentImportWorkOrderSuggestion(documentImportDraft);
  const documentImportUtilitySections = getDocumentImportUtilitySections(documentImportDraft);
  const selectedDocumentExtractedFields = selectedDocument ? getDocumentExtractedFields(selectedDocument) : null;
  const selectedDocumentAiAnalysis = selectedDocument?.aiAnalysis || null;
  const selectedDocumentUtilitySections = selectedDocument ? getDocumentUtilitySections(selectedDocument) : [];

  const describeDocumentOwnership = (document) => {
    const ownershipParts = [];
    if (document.transactionId) {
      const txn = transactionById[document.transactionId];
      ownershipParts.push(txn ? `Transaction: ${txn.date} | ${txn.category} | ${txn.description || "(no description)"}` : "Transaction attachment");
    }
    if (Array.isArray(document.relatedTransactionIds) && document.relatedTransactionIds.length > 0) {
      const relatedSummary = document.relatedTransactionIds
        .map((txnId) => transactionById[txnId])
        .filter(Boolean)
        .slice(0, 3)
        .map((txn) => `${txn.date} | ${txn.category}`)
        .join(", ");
      ownershipParts.push(relatedSummary ? `Related txns: ${relatedSummary}` : `Related txns: ${document.relatedTransactionIds.length}`);
    }
    if (document.leaseId) {
      const lease = leaseById[document.leaseId];
      ownershipParts.push(lease ? `Lease: ${lease.tenantName} | ${formatUnitLabel(lease.unit)}` : "Lease attachment");
    }
    const linkedWorkOrder = getDocumentLinkedWorkOrder(document);
    if (document.workOrderId || linkedWorkOrder) {
      ownershipParts.push(linkedWorkOrder ? `Work order: ${linkedWorkOrder.title} | ${formatUnitLabel(linkedWorkOrder.unit)}` : "Work order attachment");
    }
    return ownershipParts.length > 0 ? ownershipParts.join(" | ") : "General document";
  };

  const workOrderDocumentCountById = useMemo(() => {
    const counts = {};
    const workOrderIdByTransactionId = Object.fromEntries(
      workOrders.filter((workOrder) => String(workOrder.transactionId || "").trim()).map((workOrder) => [workOrder.transactionId, workOrder.id]),
    );

    documents.forEach((document) => {
      const directId = String(document.workOrderId || "").trim();
      const txnLinkedId = document.transactionId ? String(workOrderIdByTransactionId[document.transactionId] || "").trim() : "";
      const targetId = directId || txnLinkedId;
      if (!targetId) return;
      counts[targetId] = (counts[targetId] || 0) + 1;
    });

    return counts;
  }, [documents, workOrders]);

  const documentExpenseReviewRecords = useMemo(() => {
    const records = filteredDocuments
      .map((document) => {
        const suggestion = getDocumentExpenseSuggestion(document);
        if (!suggestion || document.transactionId) return null;
        return {
          document,
          suggestion,
          dismissed: Boolean(document.expenseReviewDismissedAt),
        };
      })
      .filter(Boolean);

    records.sort((left, right) => {
      if (left.dismissed !== right.dismissed) return Number(left.dismissed) - Number(right.dismissed);
      if (left.suggestion.confidence !== right.suggestion.confidence) return left.suggestion.confidence === "high" ? -1 : 1;
      return (Date.parse(right.document.uploadedAt || "") || 0) - (Date.parse(left.document.uploadedAt || "") || 0);
    });

    return records;
  }, [candidateWorkOrders, filteredDocuments, transactions, leases, workOrders, properties, vendors]);

  const documentWorkOrderReviewRecords = useMemo(() => {
    const records = filteredDocuments
      .map((document) => {
        const suggestion = getDocumentWorkOrderSuggestion(document);
        if (!suggestion || getDocumentLinkedWorkOrder(document)) return null;
        return {
          document,
          suggestion,
          dismissed: Boolean(document.workOrderReviewDismissedAt),
        };
      })
      .filter(Boolean);

    records.sort((left, right) => {
      if (left.dismissed !== right.dismissed) return Number(left.dismissed) - Number(right.dismissed);
      if (left.suggestion.confidence !== right.suggestion.confidence) return left.suggestion.confidence === "high" ? -1 : 1;
      return (Date.parse(right.document.uploadedAt || "") || 0) - (Date.parse(left.document.uploadedAt || "") || 0);
    });

    return records;
  }, [candidateWorkOrders, filteredDocuments, transactions, leases, workOrders, properties, vendors]);

  const documentExpenseReviewRecordById = useMemo(
    () => Object.fromEntries(documentExpenseReviewRecords.map((record) => [record.document.id, record])),
    [documentExpenseReviewRecords],
  );

  const documentWorkOrderReviewRecordById = useMemo(
    () => Object.fromEntries(documentWorkOrderReviewRecords.map((record) => [record.document.id, record])),
    [documentWorkOrderReviewRecords],
  );

  const pendingExpenseReviewCount = useMemo(
    () => documentExpenseReviewRecords.filter((record) => !record.dismissed).length,
    [documentExpenseReviewRecords],
  );

  const dismissedExpenseReviewCount = useMemo(
    () => documentExpenseReviewRecords.filter((record) => record.dismissed).length,
    [documentExpenseReviewRecords],
  );

  const pendingHighConfidenceExpenseReviewCount = useMemo(
    () => documentExpenseReviewRecords.filter((record) => !record.dismissed && record.suggestion.confidence === "high").length,
    [documentExpenseReviewRecords],
  );

  const pendingWorkOrderReviewCount = useMemo(
    () => documentWorkOrderReviewRecords.filter((record) => !record.dismissed).length,
    [documentWorkOrderReviewRecords],
  );

  const dismissedWorkOrderReviewCount = useMemo(
    () => documentWorkOrderReviewRecords.filter((record) => record.dismissed).length,
    [documentWorkOrderReviewRecords],
  );

  const pendingHighConfidenceWorkOrderReviewCount = useMemo(
    () => documentWorkOrderReviewRecords.filter((record) => !record.dismissed && record.suggestion.confidence === "high").length,
    [documentWorkOrderReviewRecords],
  );

  const visibleDocuments = useMemo(() => {
    const query = documentSearch.trim().toLowerCase();
    const scoped = filteredDocuments.filter((document) => {
      const linkedWorkOrder = getDocumentLinkedWorkOrder(document);
      const hasLinkedRecord = Boolean(document.transactionId || document.leaseId || document.workOrderId || linkedWorkOrder);
      const missingTags = documentNeedsTags(document);
      const missingIndex = documentNeedsIndexing(document);
      const needsOcr = documentNeedsOcr(document) || missingIndex;
      const expenseReviewRecord = documentExpenseReviewRecordById[document.id];

      if (documentStatusFilter === "needs_attention") return missingTags || missingIndex;
      if (documentStatusFilter === "needs_tags") return missingTags;
      if (documentStatusFilter === "needs_indexing") return missingIndex;
      if (documentStatusFilter === "ocr_queue") return needsOcr;
      if (documentStatusFilter === "expense_queue") return Boolean(expenseReviewRecord && (!expenseReviewRecord.dismissed || expenseQueueShowDismissed));
      if (documentStatusFilter === "work_order_queue") {
        const workOrderReviewRecord = documentWorkOrderReviewRecordById[document.id];
        return Boolean(workOrderReviewRecord && (!workOrderReviewRecord.dismissed || expenseQueueShowDismissed));
      }
      if (documentStatusFilter === "linked") return hasLinkedRecord;
      if (documentStatusFilter === "unlinked") return !hasLinkedRecord;
      return true;
    });

    const searched = query
      ? scoped.filter((document) => {
          const propertyLabel = propertyNameById[document.propertyId] || document.propertyId || "";
          const linkedTxn = document.transactionId ? transactionById[document.transactionId] : null;
          const linkedLease = document.leaseId ? leaseById[document.leaseId] : null;
          const linkedWorkOrder = getDocumentLinkedWorkOrder(document);
          const workOrderVendor = linkedWorkOrder?.vendorId ? vendorById[linkedWorkOrder.vendorId]?.name || "" : "";
          const ownershipText = describeDocumentOwnership(document);
          const tagsText = Array.isArray(document.tags) ? document.tags.join(" ") : "";
          const extractedText = String(document.extractedText || "");
          const workOrderText = linkedWorkOrder
            ? `Work order: ${linkedWorkOrder.title} ${linkedWorkOrder.description || ""} ${linkedWorkOrder.priority} ${workOrderVendor}`
            : "";
          const searchBlob = [
            document.name || "",
            document.type || "",
            propertyLabel,
            document.unit || "",
            ownershipText,
            tagsText,
            extractedText,
            linkedLease?.tenantName || "",
            linkedTxn?.vendor || "",
            linkedTxn?.category || "",
            linkedTxn?.description || "",
            workOrderText,
          ]
            .join(" ")
            .toLowerCase();
          return searchBlob.includes(query);
        })
      : scoped;

    const sorted = [...searched];
    sorted.sort((a, b) => {
      if (documentSort === "uploaded_desc") {
        return (Date.parse(b.uploadedAt || "") || 0) - (Date.parse(a.uploadedAt || "") || 0);
      }
      if (documentSort === "uploaded_asc") {
        return (Date.parse(a.uploadedAt || "") || 0) - (Date.parse(b.uploadedAt || "") || 0);
      }
      if (documentSort === "name_desc") {
        return (b.name || "").localeCompare(a.name || "");
      }
      if (documentSort === "type_asc") {
        return (a.type || "").localeCompare(b.type || "");
      }
      return (a.name || "").localeCompare(b.name || "");
    });
    return sorted;
  }, [documentSearch, documentSort, documentStatusFilter, filteredDocuments, propertyNameById, transactionById, leaseById, vendorById, workOrderById, workOrders, documentExpenseReviewRecordById, documentWorkOrderReviewRecordById, expenseQueueShowDismissed]);

  const visibleDocumentsMissingIndex = useMemo(
    () => visibleDocuments.filter((document) => documentNeedsOcr(document) || documentNeedsIndexing(document)),
    [visibleDocuments],
  );

  const visibleAutomaticOcrDocuments = useMemo(
    () => visibleDocumentsMissingIndex.filter((document) => document.dataUrl && documentSupportsAutomaticOcr(document.name, document.mimeType)),
    [visibleDocumentsMissingIndex],
  );

  const visibleExpenseReviewRecords = useMemo(
    () => visibleDocuments.map((document) => documentExpenseReviewRecordById[document.id]).filter((record) => record && !record.dismissed),
    [visibleDocuments, documentExpenseReviewRecordById],
  );

  const visibleWorkOrderReviewRecords = useMemo(
    () => visibleDocuments.map((document) => documentWorkOrderReviewRecordById[document.id]).filter((record) => record && !record.dismissed),
    [visibleDocuments, documentWorkOrderReviewRecordById],
  );

  const focusedExpenseQueueDocumentId = useMemo(() => {
    if (visibleExpenseReviewRecords.some((record) => record.document.id === expenseQueueFocusDocumentId)) {
      return expenseQueueFocusDocumentId;
    }
    return visibleExpenseReviewRecords[0]?.document.id || "";
  }, [visibleExpenseReviewRecords, expenseQueueFocusDocumentId]);

  const selectExpenseQueueFilter = () => {
    setDocumentStatusFilter("expense_queue");
    setExpenseQueueShowDismissed(false);
  };

  const selectWorkOrderQueueFilter = () => {
    setDocumentStatusFilter("work_order_queue");
    setExpenseQueueShowDismissed(false);
  };

  const getNextExpenseQueueRecord = (currentDocumentId = "", records = visibleExpenseReviewRecords) => {
    if (!Array.isArray(records) || records.length === 0) return null;
    const startIndex = currentDocumentId ? records.findIndex((record) => record.document.id === currentDocumentId) : -1;
    if (startIndex >= 0 && startIndex + 1 < records.length) return records[startIndex + 1];
    return records.find((record) => record.document.id !== currentDocumentId) || null;
  };

  const getNextWorkOrderQueueRecord = (currentDocumentId = "", records = visibleWorkOrderReviewRecords) => {
    if (!Array.isArray(records) || records.length === 0) return null;
    const startIndex = currentDocumentId ? records.findIndex((record) => record.document.id === currentDocumentId) : -1;
    if (startIndex >= 0 && startIndex + 1 < records.length) return records[startIndex + 1];
    return records.find((record) => record.document.id !== currentDocumentId) || null;
  };

  return {
    buildDocumentAiContext,
    describeDocumentOwnership,
    dismissedExpenseReviewCount,
    dismissedWorkOrderReviewCount,
    documentExpenseReviewRecordById,
    documentExpenseReviewRecords,
    documentImportExpenseSuggestion,
    documentImportExtractedFields,
    documentImportLinkSuggestions,
    documentImportSuggestedTags,
    documentImportUtilitySections,
    documentImportWorkOrderSuggestion,
    documentWorkOrderReviewRecordById,
    documentWorkOrderReviewRecords,
    focusedExpenseQueueDocumentId,
    getDocumentExpenseSuggestion,
    getDocumentExtractedFields,
    getDocumentImportSuggestedTags,
    getDocumentLinkSuggestions,
    getDocumentLinkedWorkOrder,
    getDocumentSuggestedTags,
    getDocumentUtilitySections,
    getDocumentWorkOrderSuggestion,
    getNextExpenseQueueRecord,
    getNextWorkOrderQueueRecord,
    pendingExpenseReviewCount,
    pendingHighConfidenceExpenseReviewCount,
    pendingHighConfidenceWorkOrderReviewCount,
    pendingWorkOrderReviewCount,
    selectedDocumentAiAnalysis,
    selectedDocumentExtractedFields,
    selectedDocumentUtilitySections,
    selectExpenseQueueFilter,
    selectWorkOrderQueueFilter,
    visibleAutomaticOcrDocuments,
    visibleDocuments,
    visibleDocumentsMissingIndex,
    visibleExpenseReviewRecords,
    visibleWorkOrderReviewRecords,
    workOrderDocumentCountById,
  };
}
