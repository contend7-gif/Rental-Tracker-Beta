import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { documentSupportsAutomaticOcr, normalizeExtractedDocumentText } from "../../domain/documentIntelligence.ts";
import { DialogLoadFallback } from "../shared/CommonDialogs.jsx";
import { field } from "../shared/uiHelpers.jsx";
import {
  DocumentAiAnalysisPanel,
  DocumentExtractedFieldsPanel,
  DocumentUtilitySectionsPanel,
} from "./DocumentPanels.jsx";
import { formatDocumentUnitLabel } from "./documentPresentation.js";

import { getDocumentPreviewKind } from "./documentPresentation.js";

function DocumentFilePreview({ document, openDocumentExternally }) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [document?.dataUrl]);
  const previewKind = getDocumentPreviewKind(document);
  const hasPreviewSource = Boolean(document?.dataUrl);

  if (!hasPreviewSource) {
    return (
      <div className="mt-3 flex min-h-[18rem] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center">
        <div className="text-sm font-medium text-slate-800">No inline preview available</div>
        <div className="mt-1 max-w-md text-sm text-slate-500">This file is saved in document storage but is not loaded for preview.</div>
      </div>
    );
  }

  if (previewKind === "image") {
    if (imageFailed) return <div className="mt-3 rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">This photo cannot be previewed. Export it as JPG or PNG for preview and automatic reading. You can still save the original file.</div>;
    return (
      <div className="mt-3 flex max-h-[70vh] min-h-[18rem] items-center justify-center overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
        <img
          src={document.dataUrl}
          alt={document.name || "Document preview"}
          className="max-h-[66vh] max-w-full object-contain"
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  if (previewKind === "pdf" || previewKind === "text") {
    return (
      <iframe
        className="mt-3 h-[70vh] w-full rounded-lg border border-slate-200 bg-white"
        src={document.dataUrl}
        title={document.name}
      />
    );
  }

  return (
    <div className="mt-3 flex min-h-[18rem] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center">
      <div className="text-sm font-medium text-slate-800">Preview this file externally</div>
      <div className="mt-1 max-w-md text-sm text-slate-500">This file type is not supported in the inline preview.</div>
      {openDocumentExternally ? <Button className="mt-3" variant="secondary" onClick={() => void openDocumentExternally(document)}>
        Open externally
      </Button> : null}
    </div>
  );
}

export function DocumentImportDialog({
  DOCUMENT_OCR_STATUS_OPTIONS,
  applyAutomaticOcrToImportDraft,
  applyDocumentImportLinkSuggestion,
  automaticDocumentOcrAvailable,
  closeDocumentImportDialog,
  currency,
  dialogContentXlClass,
  documentImportDialogOpen,
  documentImportDraft,
  documentImportExpenseSuggestion,
  documentImportExtractedFields,
  documentImportLinkSuggestions,
  documentImportOcrBusy,
  documentImportOcrMessage,
  documentImportSuggestedTags,
  documentImportUnitOptions,
  documentImportUtilitySections,
  documentImportWorkOrderSuggestion,
  documentLinkSuggestionKindLabel,
  documentTagSuggestionSourceLabel,
  leases,
  onOpenChange,
  properties,
  propertyNameById,
  saveImportedDocument,
  setDocumentImportDraft,
  transactions,
  workOrderSuggestionConfidenceLabel,
  workOrders,
}) {
  const hasText = Boolean(normalizeExtractedDocumentText(documentImportDraft.extractedText));
  const bestMatch = documentImportLinkSuggestions.find((item) => item.kind === "transaction" && item.confidence === "high");
  const canRead = automaticDocumentOcrAvailable && documentSupportsAutomaticOcr(documentImportDraft.name, documentImportDraft.mimeType);
  const canSave = Boolean(documentImportDraft.dataUrl && documentImportDraft.name.trim() && documentImportDraft.propertyId);
  const hasLink = documentImportDraft.linkType !== "none";
  const saveDisabled = !canSave || (hasLink && !documentImportDraft.linkedId);
  const tags = String(documentImportDraft.tags || "").toLowerCase().split(",").map((tag) => tag.trim());
  const supportingFile = tags.includes("property");
  const maintenanceCapture = tags.includes("maintenance");
  const multipleUtilityUnits = documentImportUtilitySections.filter((section) => !section.external && section.propertyId).length > 1;
  return (
    <Dialog open={documentImportDialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className={`${dialogContentXlClass} max-h-[92vh] overflow-y-auto`}>
        <DialogHeader><DialogTitle>{maintenanceCapture ? "Review maintenance capture" : "Add document"}</DialogTitle></DialogHeader>
        <p className="mt-1 text-sm text-slate-600">Check the file, choose where it belongs, then save it or review an expense.</p>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div className="min-w-0">
            <div className="break-words text-sm font-medium text-slate-800">{documentImportDraft.name}</div>
            <DocumentFilePreview document={documentImportDraft} />
          </div>
          <div className="min-w-0 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" role="status" aria-live="polite">
              <div className="text-sm font-semibold">{documentImportOcrBusy ? "Reading your document…" : hasText ? "Ready to review" : "File ready — details need your review"}</div>
              <p className="mt-1 text-sm text-slate-600">{documentImportOcrMessage || "Your file is ready. You can save it even if automatic reading is unavailable."}</p>
              {!documentImportOcrBusy && canRead ? <Button className="mt-2" size="sm" variant="secondary" onClick={() => void applyAutomaticOcrToImportDraft(documentImportDraft)}>Try reading again</Button> : null}
              {documentImportOcrBusy ? <p className="mt-2 text-xs text-slate-500">You can save the file now or enter the expense yourself without waiting.</p> : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {field("Property", <Select value={documentImportDraft.propertyId} onValueChange={(value) => setDocumentImportDraft((prev) => ({ ...prev, propertyId: value, unit: "Shared", linkType: "none", linkedId: "" }))}>
                <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>{properties.map((property) => <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>)}</SelectContent>
              </Select>)}
              {field("Unit", <Select value={documentImportDraft.unit || "Shared"} onValueChange={(value) => setDocumentImportDraft((prev) => ({ ...prev, unit: value, unitScopeOverride: true }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{documentImportUnitOptions.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent>
              </Select>)}
            </div>
            {documentImportExtractedFields && hasText ? <div className="rounded-lg border p-3">
              <h3 className="text-sm font-semibold">Details found — check against the original</h3>
              <dl className="mt-3 grid gap-3 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Vendor</dt><dd className="text-right font-medium">{documentImportExtractedFields.vendorName || "Enter vendor in the draft"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Date</dt><dd className="text-right font-medium">{documentImportExtractedFields.invoiceDate || "Choose date in the draft"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Total</dt><dd className="text-right text-lg font-semibold">{documentImportExtractedFields.totalAmount != null ? currency(documentImportExtractedFields.totalAmount) : "Enter amount in the draft"}</dd></div>
              </dl>
            </div> : null}
            {documentImportWorkOrderSuggestion ? <div className="rounded-lg border border-slate-200 p-3">
              <h3 className="text-sm font-semibold">{documentImportWorkOrderSuggestion.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{documentImportWorkOrderSuggestion.description}</p>
            </div> : null}
            {bestMatch && !hasLink ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <h3 className="text-sm font-semibold">Possible existing transaction</h3>
              <p className="mt-1 text-sm">{bestMatch.label}</p>
              <p className="mt-1 text-xs text-slate-600">Check this match to avoid recording the expense twice.</p>
              <Button className="mt-2" variant="secondary" disabled={saveDisabled || documentImportOcrBusy} onClick={() => saveImportedDocument({ linkSuggestion: bestMatch })}>Save and attach to this transaction</Button>
            </div> : null}
            {documentImportUtilitySections.length > 0 ? <details className="rounded-lg border p-3" open={multipleUtilityUnits}>
              <summary className="cursor-pointer text-sm font-medium">Review utility sections ({documentImportUtilitySections.length})</summary>
              {multipleUtilityUnits ? <p className="mt-2 text-sm text-slate-600">This bill covers multiple units. Review each unit amount below before recording expenses.</p> : null}
              <DocumentUtilitySectionsPanel sections={documentImportUtilitySections} className="mt-2" currency={currency}
                onReviewSection={(section) => saveImportedDocument({ reviewUtilitySection: section })} />
            </details> : null}
            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">Attach to an existing record</summary>
              <div className="mt-3 space-y-3">
                {field("Record type", <Select value={documentImportDraft.linkType} onValueChange={(value) => setDocumentImportDraft((prev) => ({ ...prev, linkType: value, linkedId: "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">No attachment</SelectItem><SelectItem value="lease">Lease</SelectItem><SelectItem value="transaction">Transaction</SelectItem><SelectItem value="workOrder">Work order</SelectItem></SelectContent>
                </Select>)}
          {documentImportDraft.linkType === "lease" ? field(
            "Lease",
            <Select value={documentImportDraft.linkedId || "__none__"} onValueChange={(value) => setDocumentImportDraft((prev) => ({ ...prev, linkedId: value === "__none__" ? "" : value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No lease link</SelectItem>
                {leases.filter((lease) => lease.propertyId === documentImportDraft.propertyId).map((lease) => <SelectItem key={`import-lease-${lease.id}`} value={lease.id}>{`${lease.tenantName || "Tenant"} | ${(propertyNameById[lease.propertyId] || lease.propertyId)} | ${formatDocumentUnitLabel(lease.unit)}`}</SelectItem>)}
              </SelectContent>
            </Select>,
          ) : documentImportDraft.linkType === "transaction" ? field(
            "Transaction",
            <Select value={documentImportDraft.linkedId || "__none__"} onValueChange={(value) => setDocumentImportDraft((prev) => ({ ...prev, linkedId: value === "__none__" ? "" : value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No transaction link</SelectItem>
                {transactions.slice(0, 200).map((txn) => <SelectItem key={`import-txn-${txn.id}`} value={txn.id}>{`${txn.date} | ${(propertyNameById[txn.propertyId] || txn.propertyId)} | ${txn.description || txn.category}`}</SelectItem>)}
              </SelectContent>
            </Select>,
          ) : documentImportDraft.linkType === "workOrder" ? field(
            "Work order",
            <Select value={documentImportDraft.linkedId || "__none__"} onValueChange={(value) => setDocumentImportDraft((prev) => ({ ...prev, linkedId: value === "__none__" ? "" : value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No work order link</SelectItem>
                {workOrders.filter((workOrder) => workOrder.propertyId === documentImportDraft.propertyId).map((workOrder) => <SelectItem key={`import-workorder-${workOrder.id}`} value={workOrder.id}>{`${workOrder.title} | ${(propertyNameById[workOrder.propertyId] || workOrder.propertyId)} | ${formatDocumentUnitLabel(workOrder.unit)}`}</SelectItem>)}
              </SelectContent>
            </Select>,
          ) : field("Linked record", <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">Save as a general document or choose a linked record type above.</div>)}
              </div>
            </details>
            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">File details and extracted text</summary>
              <div className="mt-3 space-y-3">
                {field("File name", <Input value={documentImportDraft.name} onChange={(e) => setDocumentImportDraft((prev) => ({ ...prev, name: e.target.value }))} />)}
                {field("Document type", <Input value={documentImportDraft.type} onChange={(e) => setDocumentImportDraft((prev) => ({ ...prev, type: e.target.value }))} />)}
                {field("Tags", <Input value={documentImportDraft.tags} onChange={(e) => setDocumentImportDraft((prev) => ({ ...prev, tags: e.target.value }))} />)}
                <Label htmlFor="import-extracted-text">Extracted text</Label>
                <textarea id="import-extracted-text" className="h-32 w-full rounded-md border p-2 text-sm" value={documentImportDraft.extractedText} disabled={documentImportOcrBusy}
                  onChange={(e) => setDocumentImportDraft((prev) => ({ ...prev, extractedText: e.target.value, ocrStatus: e.target.value.trim() ? "completed" : "pending" }))} />
              </div>
            </details>
          </div>
        </div>
        <div className="sticky bottom-0 mt-4 border-t bg-white pt-3">
          <p className="mb-2 text-xs text-slate-600">{hasLink ? "The file will be attached to the record you selected." : "Saving the document does not add a transaction. Review expense opens an editable draft with this file attached."}</p>
          {!canSave ? <p className="mb-2 text-sm text-amber-800">Choose a property and keep a file name before saving.</p> : null}
          <div className="flex flex-wrap gap-2">
            {!supportingFile && !hasLink && !multipleUtilityUnits && (!maintenanceCapture || documentImportExpenseSuggestion) ? <Button disabled={saveDisabled} onClick={() => saveImportedDocument({ reviewExpenseDraft: true })}>{documentImportExpenseSuggestion ? "Review expense" : "Enter expense manually"}</Button> : null}
            {documentImportWorkOrderSuggestion && !hasLink ? <Button variant="secondary" disabled={saveDisabled} onClick={() => saveImportedDocument({ reviewWorkOrderDraft: true })}>Review work order</Button> : null}
            <Button variant={supportingFile || hasLink ? undefined : "secondary"} disabled={saveDisabled} onClick={() => saveImportedDocument()}>{hasLink ? "Save and attach document" : "Save document only"}</Button>
            <Button variant="secondary" onClick={closeDocumentImportDialog}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentPreviewDialog({
  aiDocumentCopilotConfigured,
  aiDocumentCopilotReady,
  automaticDocumentOcrAvailable,
  currency,
  desktopDocumentOpenApi,
  dialogContent2xlClass,
  documentAiBusyById,
  onOpenChange,
  open,
  createExpenseTransactionsFromUtilitySections,
  openDocumentExternally,
  openExpenseDraftFromUtilitySection,
  runDocumentAiAnalysis,
  selectedDocument,
  selectedDocumentAiAnalysis,
  selectedDocumentExtractedFields,
  selectedDocumentUtilitySections,
  setSelectedDocument,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogContent2xlClass}>
        {!selectedDocument ? (
          <DialogLoadFallback message="We could not load this document preview. Close and try opening it again." onClose={() => setSelectedDocument(null)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{selectedDocument.name}</DialogTitle>
            </DialogHeader>
            {selectedDocumentExtractedFields && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-slate-900">Extracted OCR fields</div>
                  <Badge variant="outline" className={selectedDocumentExtractedFields.confidence === "high" ? "text-slate-800" : "border-amber-300 text-amber-800"}>
                    {selectedDocumentExtractedFields.confidence === "high" ? "High confidence" : "Review suggested fields"}
                  </Badge>
                </div>
                <DocumentExtractedFieldsPanel fields={selectedDocumentExtractedFields} className="mt-2" currency={currency} />
              </div>
            )}
            {selectedDocumentAiAnalysis && (
              <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-slate-900">AI document copilot</div>
                  <Badge variant="outline" className="border-violet-300 text-violet-800 hover:bg-white">
                    {selectedDocumentAiAnalysis.suggestedAction ? "Suggested action" : "Analysis saved"}
                  </Badge>
                </div>
                <DocumentAiAnalysisPanel analysis={selectedDocumentAiAnalysis} className="mt-2" currency={currency} />
              </div>
            )}
            {selectedDocumentUtilitySections.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                <div className="text-sm font-medium text-slate-900">Detected utility sections</div>
                <div className="mt-1 text-xs text-slate-600">
                  {selectedDocumentUtilitySections.length > 1
                    ? "This document contains multiple utility sections. Review each matched section separately."
                    : "One utility section was detected from OCR text."}
                </div>
                <DocumentUtilitySectionsPanel
                  sections={selectedDocumentUtilitySections}
                  className="mt-2"
                  currency={currency}
                  onCreateReadySections={(sections) => createExpenseTransactionsFromUtilitySections?.(selectedDocument, sections)}
                  onReviewSection={(section) => openExpenseDraftFromUtilitySection(selectedDocument, section)}
                />
              </div>
            )}
            <DocumentFilePreview document={selectedDocument} openDocumentExternally={openDocumentExternally} />
            <div className="mt-3 flex gap-2">
              {(() => {
                const selectedDocumentHasIndexedText = Boolean(normalizeExtractedDocumentText(selectedDocument.extractedText || ""));
                const selectedDocumentCanRunAutomaticOcr = Boolean(
                  automaticDocumentOcrAvailable &&
                  selectedDocument.dataUrl &&
                  documentSupportsAutomaticOcr(selectedDocument.name, selectedDocument.mimeType),
                );
                const selectedDocumentCanRunAi = Boolean(aiDocumentCopilotReady && (selectedDocumentHasIndexedText || selectedDocumentCanRunAutomaticOcr));
                const selectedDocumentAiBusy = Boolean(documentAiBusyById[selectedDocument.id]);
                const selectedDocumentAiButtonLabel = selectedDocumentAiBusy
                  ? "Running AI..."
                  : selectedDocumentHasIndexedText
                    ? "AI analyze"
                    : selectedDocumentCanRunAutomaticOcr
                      ? "OCR then AI"
                      : "AI analyze";
                return aiDocumentCopilotConfigured ? (
                  <Button variant="secondary" onClick={() => void runDocumentAiAnalysis(selectedDocument)} disabled={selectedDocumentAiBusy || !selectedDocumentCanRunAi}>
                    <Sparkles className="mr-1 h-4 w-4" />
                    {selectedDocumentAiButtonLabel}
                  </Button>
                ) : null;
              })()}
              <Button variant="secondary" onClick={() => setSelectedDocument(null)}>
                Close
              </Button>
              <Button
                variant="secondary"
                onClick={() => void openDocumentExternally(selectedDocument)}
                disabled={!selectedDocument?.dataUrl}
              >
                {desktopDocumentOpenApi?.openExternal ? "Open externally" : "Open in new tab"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
