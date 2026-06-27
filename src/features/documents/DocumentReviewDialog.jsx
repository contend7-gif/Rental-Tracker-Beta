import { useEffect, useState } from "react";
import { Eye, FileWarning, Sparkles, X } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { documentSupportsAutomaticOcr, normalizeExtractedDocumentText } from "../../domain/documentIntelligence.ts";
import {
  DocumentAiAnalysisPanel,
  DocumentExtractedFieldsPanel,
  DocumentUtilitySectionsPanel,
} from "./DocumentPanels.jsx";
import {
  buildDocumentQualityWarnings,
  buildLinkedRecordSummary,
  formatDocumentUnitLabel,
} from "./documentPresentation.js";
import { sortDocumentAttachOptions } from "./documentWorkflow.js";

function getDocumentPreviewKind(document) {
  const mimeType = String(document?.mimeType || "").toLowerCase();
  const name = String(document?.name || "").toLowerCase();
  if (mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(name)) return "image";
  if (mimeType === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (mimeType.startsWith("text/") || /\.(txt|csv|log)$/i.test(name)) return "text";
  return "unsupported";
}

function DocumentInlinePreview({ document, hasIndexedText, openDocumentPreview }) {
  const previewKind = getDocumentPreviewKind(document);
  if (!document?.dataUrl) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        <div className="font-medium text-slate-800">No preview available</div>
        <div className="mt-1 text-xs">The file metadata is saved, but the preview source is not loaded in this session.</div>
      </div>
    );
  }
  if (previewKind === "image") {
    return (
      <button type="button" className="block w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-left" onClick={() => openDocumentPreview(document)}>
        <img src={document.dataUrl} alt={document.name || "Document preview"} className="max-h-72 w-full rounded object-contain" />
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-teal-700"><Eye className="h-3.5 w-3.5" />Open full preview</span>
      </button>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
      <div className="font-medium text-slate-800">{previewKind === "unsupported" ? "Preview externally" : "Preview available"}</div>
      <div className="mt-1 text-xs">
        {previewKind === "unsupported"
          ? "This file type is saved, but inline preview is not supported here."
          : hasIndexedText
            ? "Text has been extracted. Open the full preview for the document frame."
            : "Open the full preview to inspect this file."}
      </div>
      <Button size="sm" variant="secondary" className="mt-2" onClick={() => openDocumentPreview(document)}>
        View file
      </Button>
    </div>
  );
}

function ReviewSection({ children, className = "", defaultOpen = false, title }) {
  return (
    <details open={defaultOpen} className={`rounded-lg border border-slate-200 bg-white p-3 ${className}`}>
      <summary className="cursor-pointer text-sm font-semibold text-slate-900">{title}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export function DocumentReviewDialog({
  aiDocumentCopilotConfigured,
  aiDocumentCopilotReady,
  applyDocumentLinkSuggestion,
  applySafeSuggestionsToDocument,
  applySuggestedDocumentTags,
  automaticDocumentOcrAvailable,
  currency,
  document,
  documentAiActionLabel,
  documentAiBusyById,
  documentLinkSuggestionKindLabel,
  documentOcrBusyById,
  documentTagSuggestionSourceLabel,
  expenseSuggestionConfidenceLabel,
  expenseSuggestionReasonSummary,
  getDocumentExpenseSuggestion,
  getDocumentExtractedFields,
  getDocumentLinkSuggestions,
  getDocumentLinkedWorkOrder,
  getDocumentLinkedSummary,
  getDocumentSuggestedTags,
  getDocumentUtilitySections,
  getDocumentWorkOrderSuggestion,
  getSafeDocumentTagSuggestions,
  leaseById,
  leases = [],
  markSupportingOnly,
  nextDocumentName,
  onClose,
  onNextDocument,
  openDocumentPreview,
  openDocumentLinkedRecord,
  openExpenseDraftFromDocument,
  openExpenseDraftFromUtilitySection,
  openWorkOrderDraftFromDocument,
  queueDocumentForOcr,
  reopenDocumentExpenseReview,
  reopenDocumentWorkOrderReview,
  removeDocumentRecordLink,
  runDocumentAiAnalysis,
  saveDocumentExtractedText,
  saveDocumentTags,
  transactionById,
  transactions = [],
  workOrderSuggestionConfidenceLabel,
  workOrderSuggestionReasonSummary,
  workOrders = [],
}) {
  const [manualLinkKind, setManualLinkKind] = useState("transaction");
  const [manualLinkId, setManualLinkId] = useState("");
  useEffect(() => {
    setManualLinkKind("transaction");
    setManualLinkId("");
  }, [document?.id]);
  if (!document) return null;

  const suggestedTags = getDocumentSuggestedTags(document);
  const suggestedLinks = getDocumentLinkSuggestions(document);
  const extractedFields = getDocumentExtractedFields(document);
  const utilitySections = getDocumentUtilitySections(document);
  const linkedWorkOrder = getDocumentLinkedWorkOrder(document);
  const expenseSuggestion = !document.transactionId ? getDocumentExpenseSuggestion(document) : null;
  const workOrderSuggestion = !linkedWorkOrder ? getDocumentWorkOrderSuggestion(document) : null;
  const hasIndexedText = Boolean(normalizeExtractedDocumentText(document.extractedText || ""));
  const canRunAutomaticOcr = Boolean(automaticDocumentOcrAvailable && document.dataUrl && documentSupportsAutomaticOcr(document.name, document.mimeType));
  const canRunDocumentAi = Boolean(aiDocumentCopilotReady && (hasIndexedText || canRunAutomaticOcr));
  const documentOcrBusy = Boolean(documentOcrBusyById[document.id]);
  const documentAiBusy = Boolean(documentAiBusyById[document.id]);
  const safeTagSuggestions = getSafeDocumentTagSuggestions(document);
  const safeLinkSuggestion = suggestedLinks.find((suggestion) => suggestion.confidence === "high") || null;
  const aiButtonLabel = documentAiBusy ? "Running AI..." : hasIndexedText ? "AI analyze" : canRunAutomaticOcr ? "OCR then AI" : "AI analyze";
  const supportingOnly = Array.isArray(document.tags) && document.tags.some((tag) => String(tag || "").toLowerCase() === "supporting-only");
  const linkedTransaction = document.transactionId ? transactionById?.[document.transactionId] : null;
  const qualityWarnings = buildDocumentQualityWarnings(document, {
    currency,
    extractedFields,
    linkedTransaction,
  });
  const linkedRecordSummary = buildLinkedRecordSummary(document, {
    currency,
    getDocumentLinkedWorkOrder,
    leaseById,
    transactionById,
  });
  const relatedTransactions = (document.relatedTransactionIds || [])
    .map((transactionId) => transactionById?.[transactionId])
    .filter(Boolean);
  const linkedLease = document.leaseId ? leaseById?.[document.leaseId] : null;
  const currentLinks = [
    linkedTransaction
      ? {
          id: linkedTransaction.id,
          kind: "transaction",
          label: [
            linkedTransaction.date || "No date",
            linkedTransaction.vendor || linkedTransaction.category || linkedTransaction.description || "Transaction",
            linkedTransaction.amount != null ? currency(linkedTransaction.amount) : "",
            formatDocumentUnitLabel(linkedTransaction.unit || document.unit || "Shared"),
          ].filter(Boolean).join(" | "),
          removable: true,
        }
      : null,
    ...relatedTransactions.map((transaction) => ({
      id: transaction.id,
      kind: "transaction",
      related: true,
      label: [
        transaction.date || "No date",
        transaction.vendor || transaction.category || transaction.description || "Transaction",
        transaction.amount != null ? currency(transaction.amount) : "",
        formatDocumentUnitLabel(transaction.unit || document.unit || "Shared"),
        "related",
      ].filter(Boolean).join(" | "),
      removable: true,
    })),
    linkedLease
      ? {
          id: linkedLease.id,
          kind: "lease",
          label: `${linkedLease.tenantName || "Tenant"} | ${formatDocumentUnitLabel(linkedLease.unit || document.unit || "Shared")}`,
          removable: true,
        }
      : null,
    linkedWorkOrder
      ? {
          kind: "workOrder",
          label: `${linkedWorkOrder.title || "Work order"} | ${formatDocumentUnitLabel(linkedWorkOrder.unit || document.unit || "Shared")}${document.workOrderId ? "" : " | via linked transaction"}`,
          removable: Boolean(document.workOrderId),
        }
      : null,
  ].filter(Boolean);
  const hasLinkedRecord = currentLinks.length > 0;
  const manualLinkOptions = (() => {
    if (manualLinkKind === "lease") {
      return sortDocumentAttachOptions(document, leases.map((lease) => ({
        id: lease.id,
        label: `${lease.tenantName || "Tenant"} | ${formatDocumentUnitLabel(lease.unit || "Shared")}`,
        propertyId: lease.propertyId,
        unit: lease.unit,
        tenantName: lease.tenantName,
        startDate: lease.startDate,
      })));
    }
    if (manualLinkKind === "workOrder") {
      return sortDocumentAttachOptions(document, workOrders.map((workOrder) => ({
        id: workOrder.id,
        label: `${workOrder.title || "Work order"} | ${formatDocumentUnitLabel(workOrder.unit || "Shared")}${workOrder.reportedOn ? ` | ${workOrder.reportedOn}` : ""}`,
        propertyId: workOrder.propertyId,
        unit: workOrder.unit,
        title: workOrder.title,
        vendor: workOrder.vendorName || workOrder.vendor,
        reportedOn: workOrder.reportedOn,
      })));
    }
    return sortDocumentAttachOptions(
      document,
      transactions.map((transaction) => ({
        id: transaction.id,
        label: `${transaction.date || "No date"} | ${transaction.vendor || transaction.category || transaction.description || "Transaction"}${transaction.unit ? ` | ${formatDocumentUnitLabel(transaction.unit)}` : ""}`,
        propertyId: transaction.propertyId,
        unit: transaction.unit,
        date: transaction.date,
        vendor: transaction.vendor,
        description: transaction.description,
      })),
    ).slice(0, 300);
  })();
  const selectedManualLink = manualLinkOptions.find((option) => option.id === manualLinkId) || null;
  const applyManualLink = () => {
    if (!selectedManualLink) return;
    applyDocumentLinkSuggestion(document, {
      kind: manualLinkKind,
      id: selectedManualLink.id,
      label: selectedManualLink.label,
      propertyId: selectedManualLink.propertyId,
      unit: selectedManualLink.unit,
      confidence: "high",
      sources: ["context"],
    });
  };
  const recommendedAction = expenseSuggestion
    ? {
        title: "Review expense draft",
        body: `${expenseSuggestion.category}${expenseSuggestion.amount != null ? ` | ${currency(expenseSuggestion.amount)}` : ""}${expenseSuggestion.date ? ` | ${expenseSuggestion.date}` : ""}. Saving the reviewed transaction attaches this document automatically.`,
        button: "Review bill and auto-attach",
        onClick: () => openExpenseDraftFromDocument(document, expenseSuggestion),
      }
    : workOrderSuggestion
      ? {
          title: "Review work order draft",
          body: `${workOrderSuggestion.title}${workOrderSuggestion.estimatedCost != null ? ` | ${currency(workOrderSuggestion.estimatedCost)}` : ""}`,
          button: "Review work order draft",
          onClick: () => openWorkOrderDraftFromDocument(document, workOrderSuggestion),
        }
      : safeLinkSuggestion
        ? {
            title: "Review attachment",
            body: `${documentLinkSuggestionKindLabel(safeLinkSuggestion.kind)}: ${safeLinkSuggestion.label}`,
            button: "Apply link",
            onClick: () => applyDocumentLinkSuggestion(document, safeLinkSuggestion),
          }
        : canRunAutomaticOcr && !hasIndexedText
          ? {
              title: "Extract text",
              body: "Run OCR so this file becomes searchable and can suggest its next step.",
              button: documentOcrBusy ? "Running OCR..." : "Extract text",
              disabled: documentOcrBusy,
              onClick: () => queueDocumentForOcr(document),
            }
          : hasLinkedRecord
            ? {
                title: "Linked record",
                body: getDocumentLinkedSummary?.(document) || "This document is already attached to a rental record.",
                button: "View linked record",
                onClick: () => openDocumentLinkedRecord(document, currentLinks[0]?.kind || "transaction"),
              }
            : {
                title: supportingOnly ? "Supporting document" : "Attach or save supporting",
                body: supportingOnly ? "This file is saved as searchable supporting documentation. You can still attach it later." : "Attach this file to a record now, or save it as supporting documentation.",
                button: supportingOnly ? "Review details" : "Save as supporting only",
                onClick: supportingOnly ? undefined : () => markSupportingOnly(document),
              };

  return (
    <Dialog open={Boolean(document)} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader className="-mx-6 -mt-6 shrink-0 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="min-w-0 truncate pr-2">{document.name}</DialogTitle>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 w-8 shrink-0 p-0"
              onClick={onClose}
              aria-label="Close document review"
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="-mx-2 flex-1 space-y-3 overflow-y-auto px-2 py-3">
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Preview</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">{document.type || "Document"}</div>
            </div>
            {hasIndexedText ? <Badge variant="secondary">Text extracted</Badge> : <Badge variant="outline">No text yet</Badge>}
          </div>
          <DocumentInlinePreview document={document} hasIndexedText={hasIndexedText} openDocumentPreview={openDocumentPreview} />
        </section>

        {qualityWarnings.length > 0 ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <FileWarning className="h-4 w-4" aria-hidden="true" />
              Review warnings
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {qualityWarnings.map((warning) => (
                <div key={warning.key} className="rounded-md border border-amber-200 bg-white px-2 py-1.5 text-xs text-amber-900">
                  <div className="font-semibold">{warning.label}</div>
                  <div className="mt-0.5">{warning.detail}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-lg border border-blue-200 bg-blue-50/70 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-blue-700">Recommended action</div>
              <h3 className="mt-1 text-sm font-semibold text-slate-900">{recommendedAction.title}</h3>
              <div className="mt-1 text-sm text-slate-700">{recommendedAction.body}</div>
            </div>
            {recommendedAction.onClick ? (
              <Button
                size="sm"
                onClick={recommendedAction.onClick}
                disabled={recommendedAction.disabled || (qualityWarnings.length > 0 && (safeLinkSuggestion || safeTagSuggestions.length > 0))}
              >
                {qualityWarnings.length > 0 && (safeLinkSuggestion || safeTagSuggestions.length > 0) ? "Review flagged changes" : recommendedAction.button}
              </Button>
            ) : null}
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          {document.dataUrl ? (
            <Button size="sm" variant="secondary" onClick={() => openDocumentPreview(document)}>
              View file
            </Button>
          ) : (
            <Badge variant="secondary" className="h-9 rounded-md px-3 py-2">Preview unavailable</Badge>
          )}
          {canRunAutomaticOcr && !hasIndexedText ? (
            <Button size="sm" variant="secondary" onClick={() => queueDocumentForOcr(document)} disabled={documentOcrBusy}>
              {documentOcrBusy ? "Running OCR..." : "Extract text"}
            </Button>
          ) : null}
          {safeTagSuggestions.length > 0 || safeLinkSuggestion ? (
            qualityWarnings.length > 0 ? (
              <Button size="sm" variant="secondary" disabled>
                Review flagged changes
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => applySafeSuggestionsToDocument(document)}>
                Apply recommended changes
              </Button>
            )
          ) : null}
          {aiDocumentCopilotConfigured ? (
            <Button size="sm" variant="secondary" onClick={() => void runDocumentAiAnalysis(document)} disabled={documentAiBusy || !canRunDocumentAi}>
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              {aiButtonLabel}
            </Button>
          ) : null}
          {!hasLinkedRecord && !supportingOnly ? (
            <Button size="sm" variant="secondary" onClick={() => markSupportingOnly(document)}>
              Save as supporting only
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {extractedFields ? (
            <ReviewSection title="Extracted fields" defaultOpen className="bg-slate-50/80">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline" className={extractedFields.confidence === "high" ? "text-slate-800" : "border-amber-300 text-amber-800"}>
                  {extractedFields.confidence === "high" ? "High confidence" : "Review suggested fields"}
                </Badge>
              </div>
              <DocumentExtractedFieldsPanel fields={extractedFields} className="mt-2" currency={currency} />
            </ReviewSection>
          ) : null}

          {expenseSuggestion ? (
            <ReviewSection title="Suggested expense draft" defaultOpen className="border-emerald-200 bg-emerald-50/70 text-sm text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline" className={expenseSuggestion.confidence === "high" ? "border-emerald-300 text-emerald-800" : "border-amber-300 text-amber-800"}>
                  {expenseSuggestionConfidenceLabel(expenseSuggestion.confidence)}
                </Badge>
              </div>
              <div className="mt-2">{expenseSuggestion.category}{expenseSuggestion.amount != null ? ` | ${currency(expenseSuggestion.amount)}` : ""}{expenseSuggestion.date ? ` | ${expenseSuggestion.date}` : ""}</div>
              <div className="mt-1 text-xs text-slate-600">{expenseSuggestionReasonSummary(expenseSuggestion)}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => openExpenseDraftFromDocument(document, expenseSuggestion)}>Save transaction and attach document</Button>
                {document.expenseReviewDismissedAt ? (
                  <Button size="sm" variant="secondary" onClick={() => reopenDocumentExpenseReview(document)}>Reopen review</Button>
                ) : null}
              </div>
            </ReviewSection>
          ) : null}

          {workOrderSuggestion ? (
            <ReviewSection title="Suggested work-order draft" defaultOpen className="border-sky-200 bg-sky-50/70 text-sm text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline" className={workOrderSuggestion.confidence === "high" ? "border-sky-300 text-sky-800" : "border-amber-300 text-amber-800"}>
                  {workOrderSuggestionConfidenceLabel(workOrderSuggestion.confidence)}
                </Badge>
              </div>
              <div className="mt-2">{workOrderSuggestion.title}{workOrderSuggestion.estimatedCost != null ? ` | ${currency(workOrderSuggestion.estimatedCost)}` : ""}</div>
              <div className="mt-1 text-xs text-slate-600">{workOrderSuggestionReasonSummary(workOrderSuggestion)}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => openWorkOrderDraftFromDocument(document, workOrderSuggestion)}>Review work order draft</Button>
                {document.workOrderReviewDismissedAt ? (
                  <Button size="sm" variant="secondary" onClick={() => reopenDocumentWorkOrderReview(document)}>Reopen review</Button>
                ) : null}
              </div>
            </ReviewSection>
          ) : null}
        </div>

        <ReviewSection title="Record links" defaultOpen className="text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="mt-1 text-xs text-slate-500">
                {hasLinkedRecord
                  ? linkedRecordSummary?.label || getDocumentLinkedSummary?.(document) || "This document is attached to a rental record."
                  : supportingOnly
                    ? "Saved as supporting documentation. You can still attach it later."
                    : "Attach this document to a record or save it as supporting-only."}
              </div>
            </div>
            {!hasLinkedRecord && !supportingOnly ? (
              <Button size="sm" variant="secondary" onClick={() => markSupportingOnly(document)}>
                Save as supporting only
              </Button>
            ) : null}
          </div>
          <div className="mt-3 space-y-2">
            {currentLinks.map((link) => (
              <div key={`${document.id}-current-${link.kind}-${link.id || link.label}`} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2">
                <div>
                  <div className="text-slate-800">{documentLinkSuggestionKindLabel(link.kind)}: {link.label}</div>
                  {!link.removable ? <div className="text-xs text-slate-500">Remove the linked transaction to change this implied work-order link.</div> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openDocumentLinkedRecord(link.related ? { ...document, transactionId: link.id } : document, link.kind)}>
                    View
                  </Button>
                  {link.removable ? (
                    <Button size="sm" variant="secondary" onClick={() => removeDocumentRecordLink(document, link.kind, link.related ? { relatedTransactionId: link.id } : undefined)}>
                      Remove link
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
            {!hasLinkedRecord && !supportingOnly && suggestedLinks.length === 0 ? (
              <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-slate-500">
                No likely record match yet. Add extracted text or use suggestions when they appear.
              </div>
            ) : null}
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Attach later</div>
              <div className="mt-2 grid gap-2 md:grid-cols-[11rem_1fr_auto]">
                <Select
                  value={manualLinkKind}
                  onValueChange={(value) => {
                    setManualLinkKind(value);
                    setManualLinkId("");
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transaction">Transaction</SelectItem>
                    <SelectItem value="lease">Lease</SelectItem>
                    <SelectItem value="workOrder">Work order</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={manualLinkId || "__none__"} onValueChange={(value) => setManualLinkId(value === "__none__" ? "" : value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Choose {documentLinkSuggestionKindLabel(manualLinkKind).toLowerCase()}</SelectItem>
                    {manualLinkOptions.map((option) => (
                      <SelectItem key={`${manualLinkKind}-${option.id}`} value={option.id}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={applyManualLink} disabled={!selectedManualLink}>
                  Attach
                </Button>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Use this when the document was saved before the related record existed or before OCR found the right match.
              </div>
            </div>
          </div>
        </ReviewSection>

        {suggestedLinks.length > 0 ? (
          <ReviewSection title="Suggested links" className="border-blue-200 bg-blue-50/70 text-sm">
            <div className="space-y-2">
              {suggestedLinks.map((suggestion) => (
                <div key={`${suggestion.kind}-${suggestion.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded border border-blue-100 bg-white px-3 py-2">
                  <div>
                    <div className="text-slate-800">{documentLinkSuggestionKindLabel(suggestion.kind)}: {suggestion.label}</div>
                    <div className="text-xs text-slate-500">{suggestion.confidence === "high" ? "High confidence" : "Possible match"} | {documentTagSuggestionSourceLabel(suggestion)}</div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => applyDocumentLinkSuggestion(document, suggestion)}>Apply link</Button>
                </div>
              ))}
            </div>
          </ReviewSection>
        ) : null}

        {utilitySections.length > 0 ? (
          <ReviewSection title="Detected utility sections" className="border-amber-200 bg-amber-50/70">
            <DocumentUtilitySectionsPanel sections={utilitySections} currency={currency} onReviewSection={(section) => openExpenseDraftFromUtilitySection(document, section)} />
          </ReviewSection>
        ) : null}

        {document.aiAnalysis ? (
          <ReviewSection title="AI document copilot" className="border-violet-200 bg-violet-50/70">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="outline" className="border-violet-300 text-violet-800 hover:bg-white">
                {document.aiAnalysis.suggestedAction ? documentAiActionLabel(document.aiAnalysis.suggestedAction) : "Analysis saved"}
              </Badge>
            </div>
            <DocumentAiAnalysisPanel analysis={document.aiAnalysis} className="mt-2" currency={currency} />
          </ReviewSection>
        ) : null}

        <ReviewSection title="Tags" className="bg-slate-50/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {suggestedTags.length > 0 ? (
              <Button size="sm" variant="secondary" onClick={() => applySuggestedDocumentTags(document)}>Apply suggested tags</Button>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(document.tags || []).map((tag) => <Badge key={`${document.id}-${tag}`} variant="secondary" className="text-[11px]">#{tag}</Badge>)}
            {suggestedTags.map((suggestion) => <Badge key={`suggested-${suggestion.tag}`} variant="outline" className="text-[11px]">+ #{suggestion.tag}</Badge>)}
          </div>
        </ReviewSection>

        <details className="rounded-lg border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">Extracted text editor</summary>
          <Label className="mt-3 block text-xs text-slate-600">Extracted text</Label>
          <textarea
            className="mt-1 h-36 w-full rounded-md border border-slate-200 bg-white p-2 text-sm text-slate-700"
            defaultValue={document.extractedText || ""}
            onBlur={(event) => saveDocumentExtractedText(document, event.target.value)}
          />
        </details>

        <details className="rounded-lg border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">Tag editor</summary>
          <Label className="mt-3 block text-xs text-slate-600">Tags</Label>
          <Input
            className="mt-1"
            defaultValue={Array.isArray(document.tags) ? document.tags.join(", ") : ""}
            onBlur={(event) => saveDocumentTags(document, event.target.value)}
          />
        </details>

        </div>

        <div className="-mx-6 -mb-6 shrink-0 border-t border-slate-200 bg-white px-6 py-3">
          <div className="flex flex-wrap justify-end gap-2">
          {nextDocumentName ? (
            <Button type="button" onClick={onNextDocument}>
              Next inbox item
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
