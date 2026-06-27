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

function getDocumentPreviewKind(document) {
  const mimeType = String(document?.mimeType || "").toLowerCase();
  const name = String(document?.name || "").toLowerCase();
  if (mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(name)) return "image";
  if (mimeType === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (mimeType.startsWith("text/") || /\.(txt|csv|log)$/i.test(name)) return "text";
  return "unsupported";
}

function DocumentFilePreview({ document, openDocumentExternally }) {
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
    return (
      <div className="mt-3 flex max-h-[70vh] min-h-[18rem] items-center justify-center overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
        <img
          src={document.dataUrl}
          alt={document.name || "Document preview"}
          className="max-h-[66vh] max-w-full object-contain"
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
      <Button className="mt-3" variant="secondary" onClick={() => void openDocumentExternally(document)}>
        Open externally
      </Button>
    </div>
  );
}

function WizardStep({ number, title, state = "pending" }) {
  const stateClass =
    state === "complete"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : state === "active"
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : "border-slate-200 bg-slate-50 text-slate-500";
  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${stateClass}`}>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[11px] font-semibold">{number}</span>
      <span className="truncate font-medium">{title}</span>
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
  const hasFile = Boolean(documentImportDraft?.dataUrl);
  const hasText = Boolean(normalizeExtractedDocumentText(documentImportDraft?.extractedText || ""));
  const hasExpenseDraft = Boolean(documentImportExpenseSuggestion);
  const hasWorkOrderDraft = Boolean(documentImportWorkOrderSuggestion);
  const isPropertyDocumentImport = String(documentImportDraft?.tags || "").toLowerCase().split(",").map((tag) => tag.trim()).includes("property");
  const readyToFinish = hasExpenseDraft || hasWorkOrderDraft || documentImportDraft.linkType !== "none" || hasText;
  const nextActionLabel = hasExpenseDraft
    ? "Save transaction and attach document"
    : hasWorkOrderDraft
      ? "Save and review work order draft"
      : documentImportLinkSuggestions[0]
        ? "Apply suggested link or save upload"
        : isPropertyDocumentImport
          ? "Save property document"
          : "Save upload only";

  return (
    <Dialog open={documentImportDialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className={dialogContentXlClass}>
        <DialogHeader>
          <DialogTitle>{isPropertyDocumentImport ? "Add property document" : "Add bill from document"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">{isPropertyDocumentImport ? "Property document intake" : "Guided bill entry"}</div>
                <div className="mt-1 text-xs text-slate-600">
                  {isPropertyDocumentImport
                    ? "Upload closing, deed, appraisal, insurance, inspection, or refinance support directly into this property's vault."
                    : "Upload, review the OCR draft, save the transaction, and attach the document in one path."}
                </div>
              </div>
              <Badge variant="outline" className="bg-white">{nextActionLabel}</Badge>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <WizardStep number="1" title="Upload" state={hasFile ? "complete" : "active"} />
              <WizardStep number="2" title="OCR draft" state={hasText ? "complete" : hasFile ? "active" : "pending"} />
              <WizardStep number="3" title="Confirm transaction" state={hasExpenseDraft || hasWorkOrderDraft ? "complete" : hasText ? "active" : "pending"} />
              <WizardStep number="4" title="Save + attach" state={readyToFinish ? "active" : "pending"} />
            </div>
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="secondary">Step 1</Badge>
              <h3 className="text-sm font-semibold text-slate-900">File and basic context</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {field("File name", <Input value={documentImportDraft.name} onChange={(e) => setDocumentImportDraft((prev) => ({ ...prev, name: e.target.value }))} />)}
              {field("Document type", <Input value={documentImportDraft.type} onChange={(e) => setDocumentImportDraft((prev) => ({ ...prev, type: e.target.value }))} />)}
              {field(
                "Property",
                <Select value={documentImportDraft.propertyId} onValueChange={(value) => setDocumentImportDraft((prev) => ({ ...prev, propertyId: value, unit: "Shared" }))}>
                  <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>
                    {properties.map((property) => <SelectItem key={`import-property-${property.id}`} value={property.id}>{property.name}</SelectItem>)}
                  </SelectContent>
                </Select>,
              )}
              {field(
                "Unit",
                <Select value={documentImportDraft.unit || "Shared"} onValueChange={(value) => setDocumentImportDraft((prev) => ({ ...prev, unit: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {documentImportUnitOptions.map((unitName) => <SelectItem key={`import-unit-${unitName}`} value={unitName}>{unitName}</SelectItem>)}
                  </SelectContent>
                </Select>,
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="secondary">Step 2</Badge>
              <h3 className="text-sm font-semibold text-slate-900">Extract text</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {field(
                "OCR status",
                <Select value={documentImportDraft.ocrStatus} onValueChange={(value) => setDocumentImportDraft((prev) => ({ ...prev, ocrStatus: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_OCR_STATUS_OPTIONS.map((option) => <SelectItem key={`ocr-status-${option.value}`} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>,
              )}
              <div className="flex items-end">
                <Button
                  variant="secondary"
                  onClick={() => void applyAutomaticOcrToImportDraft(documentImportDraft)}
                  disabled={documentImportOcrBusy || !documentSupportsAutomaticOcr(documentImportDraft.name, documentImportDraft.mimeType) || !automaticDocumentOcrAvailable}
                >
                  {documentImportOcrBusy ? "Running OCR..." : "Run OCR"}
                </Button>
              </div>
            </div>
            <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
              <div className="font-medium text-slate-700">
                {documentImportOcrBusy
                  ? "Automatic OCR is running now."
                  : (documentImportOcrMessage || (automaticDocumentOcrAvailable
                    ? "Supported PDFs and images can be OCRed automatically before you save."
                    : "Automatic OCR runs in the Windows desktop app. In the browser, you can still save this as pending OCR."))}
              </div>
              <div className="mt-1">
                {documentImportDraft.extractedText
                  ? `${normalizeExtractedDocumentText(documentImportDraft.extractedText).slice(0, 220)}${normalizeExtractedDocumentText(documentImportDraft.extractedText).length > 220 ? "..." : ""}`
                  : "No extracted text yet."}
              </div>
            </div>
            <details className="mt-3 rounded-md border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-900">Manual text editor</summary>
              <Label className="mt-3 block">Extracted text</Label>
              <textarea
                className="mt-1 h-32 w-full rounded-md border border-slate-200 bg-white p-2 text-sm text-slate-700"
                value={documentImportDraft.extractedText}
                onChange={(e) => setDocumentImportDraft((prev) => ({ ...prev, extractedText: e.target.value, ocrStatus: e.target.value.trim() ? "completed" : (prev.ocrStatus === "not_needed" ? "not_needed" : "pending") }))}
                placeholder="Automatic OCR will populate this for supported PDFs/images. You can also paste text manually."
              />
            </details>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="secondary">Step 3</Badge>
              <h3 className="text-sm font-semibold text-slate-900">Decide next step</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {field(
                "Recommended action",
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {nextActionLabel}
                </div>,
              )}
              {field(
                "Link record",
                <Select value={documentImportDraft.linkType} onValueChange={(value) => setDocumentImportDraft((prev) => ({ ...prev, linkType: value, linkedId: "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="lease">Lease</SelectItem>
                    <SelectItem value="transaction">Transaction</SelectItem>
                    <SelectItem value="workOrder">Work order</SelectItem>
                  </SelectContent>
                </Select>,
              )}
            </div>
          {documentImportDraft.linkType === "lease" ? field(
            "Lease",
            <Select value={documentImportDraft.linkedId || "__none__"} onValueChange={(value) => setDocumentImportDraft((prev) => ({ ...prev, linkedId: value === "__none__" ? "" : value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No lease link</SelectItem>
                {leases.map((lease) => <SelectItem key={`import-lease-${lease.id}`} value={lease.id}>{`${lease.tenantName || "Tenant"} | ${(propertyNameById[lease.propertyId] || lease.propertyId)} | ${formatDocumentUnitLabel(lease.unit)}`}</SelectItem>)}
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
                {workOrders.map((workOrder) => <SelectItem key={`import-workorder-${workOrder.id}`} value={workOrder.id}>{`${workOrder.title} | ${(propertyNameById[workOrder.propertyId] || workOrder.propertyId)} | ${formatDocumentUnitLabel(workOrder.unit)}`}</SelectItem>)}
              </SelectContent>
            </Select>,
          ) : field("Linked record", <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">Save as a general document or choose a linked record type above.</div>)}
          <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <div>
              <span className="font-medium text-slate-700">Suggested tags:</span>{" "}
              {documentImportSuggestedTags.length > 0
                ? documentImportSuggestedTags.map((suggestion) => `#${suggestion.tag} (${documentTagSuggestionSourceLabel(suggestion)})`).join(", ")
                : "No suggestions yet."}
            </div>
            {documentImportLinkSuggestions.length > 0 && (
              <div>
                <div className="font-medium text-slate-700">Suggested links</div>
                <div className="mt-2 space-y-2">
                  {documentImportLinkSuggestions.slice(0, 3).map((suggestion) => (
                    <div key={`import-${suggestion.kind}-${suggestion.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1.5">
                      <div>
                        <div>{documentLinkSuggestionKindLabel(suggestion.kind)}: {suggestion.label}</div>
                        <div className="text-[10px] text-slate-500">{suggestion.confidence === "high" ? "High confidence" : "Possible match"} | {documentTagSuggestionSourceLabel(suggestion)}</div>
                      </div>
                      <Button size="sm" variant="secondary" className="h-7" onClick={() => applyDocumentImportLinkSuggestion(suggestion)}>
                        Apply link
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {documentImportExtractedFields && (
              <div>
                <div className="font-medium text-slate-700">Extracted fields after OCR</div>
                <DocumentExtractedFieldsPanel fields={documentImportExtractedFields} className="mt-2" currency={currency} />
              </div>
            )}
            {documentImportUtilitySections.length > 0 && (
              <div>
                <div className="font-medium text-slate-700">Detected utility sections</div>
                <div className="mt-1 text-slate-600">
                  {documentImportUtilitySections.length > 1
                    ? "This OCR text looks like multiple utility sections in one document. Review the matched section before saving the transaction."
                    : "One utility section was detected from OCR text."}
                </div>
                <DocumentUtilitySectionsPanel sections={documentImportUtilitySections} className="mt-2" currency={currency} onReviewSection={(section) => saveImportedDocument({ reviewUtilitySection: section })} />
              </div>
            )}
            {documentImportExpenseSuggestion && (
              <div>
                <div className="font-medium text-slate-700">Suggested expense draft after import</div>
                <div className="mt-1 text-slate-600">
                  {documentImportExpenseSuggestion.confidence === "high" ? "High confidence" : "Review suggested fields"} | {documentImportExpenseSuggestion.category}
                  {documentImportExpenseSuggestion.amount != null ? ` | ${currency(documentImportExpenseSuggestion.amount)}` : ""}
                  {documentImportExpenseSuggestion.date ? ` | ${documentImportExpenseSuggestion.date}` : ""}
                </div>
                <div className="mt-1 text-slate-600">
                  {documentImportExpenseSuggestion.vendor ? `Vendor: ${documentImportExpenseSuggestion.vendor}` : "Vendor not confidently detected yet."}
                  {documentImportExpenseSuggestion.invoiceRef ? ` | Ref: ${documentImportExpenseSuggestion.invoiceRef}` : ""}
                  {documentImportExpenseSuggestion.servicePeriodStart && documentImportExpenseSuggestion.servicePeriodEnd ? ` | Period ${documentImportExpenseSuggestion.servicePeriodStart} to ${documentImportExpenseSuggestion.servicePeriodEnd}` : ""}
                </div>
                <div className="mt-1 text-slate-600">{documentImportExpenseSuggestion.description}</div>
                <div className="mt-1 rounded border border-blue-100 bg-blue-50/70 px-2 py-1 text-blue-800">Next step: review the transaction draft, then save transaction and attach document. The file will not need a second manual attach.</div>
              </div>
            )}
            {documentImportWorkOrderSuggestion && (
              <div>
                <div className="font-medium text-slate-700">Suggested work order draft after import</div>
                <div className="mt-1 text-slate-600">
                  {workOrderSuggestionConfidenceLabel(documentImportWorkOrderSuggestion.confidence)} | {documentImportWorkOrderSuggestion.title}
                  {documentImportWorkOrderSuggestion.unit ? ` | ${formatDocumentUnitLabel(documentImportWorkOrderSuggestion.unit)}` : ""}
                  {documentImportWorkOrderSuggestion.estimatedCost != null ? ` | ${currency(documentImportWorkOrderSuggestion.estimatedCost)}` : ""}
                </div>
                <div className="mt-1 text-slate-600">
                  {documentImportWorkOrderSuggestion.vendor ? `Vendor: ${documentImportWorkOrderSuggestion.vendor}` : "Vendor not confidently detected yet."}
                  {documentImportWorkOrderSuggestion.reportedOn ? ` | Reported: ${documentImportWorkOrderSuggestion.reportedOn}` : ""}
                  {documentImportWorkOrderSuggestion.priority ? ` | Priority: ${documentImportWorkOrderSuggestion.priority}` : ""}
                </div>
                <div className="mt-1 text-slate-600">{documentImportWorkOrderSuggestion.description}</div>
              </div>
            )}
            </div>
            <details className="mt-3 rounded-md border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-900">Tag editor</summary>
              <Label className="mt-3 block">Tags</Label>
              <Input className="mt-1" value={documentImportDraft.tags} onChange={(e) => setDocumentImportDraft((prev) => ({ ...prev, tags: e.target.value }))} placeholder="scan, invoice, vendor" />
            </details>
          </section>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {documentImportExpenseSuggestion ? (
            <Button onClick={() => saveImportedDocument({ reviewExpenseDraft: true })} disabled={documentImportOcrBusy}>
              Save transaction and attach document
            </Button>
          ) : null}
          {documentImportWorkOrderSuggestion ? (
            <Button variant={documentImportExpenseSuggestion ? "secondary" : undefined} onClick={() => saveImportedDocument({ reviewWorkOrderDraft: true })} disabled={documentImportOcrBusy}>
              Save and review work order draft
            </Button>
          ) : null}
          <Button variant={documentImportExpenseSuggestion || documentImportWorkOrderSuggestion ? "secondary" : undefined} onClick={saveImportedDocument} disabled={documentImportOcrBusy}>
            {isPropertyDocumentImport ? "Save property document" : "Save upload only"}
          </Button>
          <Button variant="secondary" onClick={closeDocumentImportDialog}>Cancel</Button>
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
                <DocumentUtilitySectionsPanel sections={selectedDocumentUtilitySections} className="mt-2" currency={currency} onReviewSection={(section) => openExpenseDraftFromUtilitySection(selectedDocument, section)} />
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
