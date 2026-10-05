import { FileText, MoreHorizontal } from "lucide-react";
import { Button } from "../../components/ui/button";
import { AuditReadinessBadge } from "../shared/AuditReadinessBadge.jsx";
import {
  buildLinkedRecordSummary,
  formatDocumentDate,
  formatDocumentScope,
} from "./documentPresentation.js";
import {
  documentWorkflowStatusLabel,
  getDocumentPrimaryAction,
  getDocumentReviewSummary,
  getDocumentSecondaryActions,
  getDocumentWorkflowStatus,
} from "./documentWorkflow.js";

const STATUS_BADGE_CLASS = {
  needs_review: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50",
  needs_ocr: "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-50",
  needs_expense_review: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50",
  needs_work_order_review: "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-50",
  needs_attachment: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50",
  reviewed: "border-slate-200 bg-white text-slate-700 hover:bg-white",
  supporting_only: "border-slate-200 bg-white text-slate-700 hover:bg-white",
};

export function DocumentCard({
  document,
  context,
  onPrimaryAction,
  onReview,
  onSecondaryAction,
  ownershipLabel,
  propertyLabel,
}) {
  const status = getDocumentWorkflowStatus(document, context);
  const primaryAction = getDocumentPrimaryAction(document, context);
  const secondaryActions = getDocumentSecondaryActions(document, context).filter((action) => action.key !== primaryAction.key);
  const documentDate = formatDocumentDate(document);
  const linkedSummary = buildLinkedRecordSummary(document, {
    currency: context.currency,
    getDocumentLinkedWorkOrder: context.getDocumentLinkedWorkOrder,
    leaseById: context.leaseById,
    transactionById: context.transactionById,
  });
  const warnings = context.getDocumentQualityWarnings?.(document) || [];
  const extracted = document.ocrStatus === "completed" || Boolean(document.extractedText);
  const extractionLabel = extracted ? "Text extracted" : document.ocrStatus === "pending" ? "OCR pending" : "Needs text";
  const typeLabel = document.type || "File";
  const reviewSummary = warnings.length > 0
    ? warnings[0].detail
    : linkedSummary?.label
      ? ""
      : getDocumentReviewSummary(document, context);

  return (
    <div role="group" aria-label={`Document ${document.name}`} className="rt-document-row rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition hover:border-teal-200 hover:bg-teal-50/30">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,.9fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-2 text-slate-900">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600">
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <button type="button" className="rt-row-title block max-w-full truncate text-left hover:text-teal-700" title={document.name} onClick={() => onReview(document)}>{document.name}</button>
              <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">{typeLabel} | {formatDocumentScope(document, propertyLabel)} | {documentDate}</div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <AuditReadinessBadge
              status={status === "reviewed" || status === "supporting_only" ? { key: "ready", label: documentWorkflowStatusLabel(status) } : { key: "needs_review", label: documentWorkflowStatusLabel(status) }}
              className={STATUS_BADGE_CLASS[status] || ""}
            />
            {warnings.length > 0 ? <span className="text-xs text-amber-700">{warnings.length} check{warnings.length === 1 ? "" : "s"}</span> : null}
          </div>
        </div>

        <div className="min-w-0 text-xs text-slate-600">
          <div className="font-medium text-slate-800">Record support</div>
          <div className="mt-0.5 line-clamp-2">{linkedSummary?.label || ownershipLabel || "No linked record yet"}</div>
        </div>

        <p className="line-clamp-2 text-xs leading-5 text-slate-600">{reviewSummary || (extracted ? "Searchable text available" : extractionLabel)}</p>

        <div className="flex items-center gap-2 lg:justify-end">
          <Button size="sm" className="whitespace-nowrap" onClick={() => onPrimaryAction(document, primaryAction)}>
            {primaryAction.label}
          </Button>
          {secondaryActions.length > 0 ? (
            <details className="relative">
              <summary aria-label={`More actions for ${document.name}`} className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" title="More actions">
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </summary>
              <div className="absolute right-0 z-20 mt-1 min-w-44 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                {secondaryActions.map((action) => (
                  <button
                    key={`${document.id}-${action.key}`}
                    type="button"
                    className={`block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-50 ${action.key === "remove" ? "text-red-700" : "text-slate-700"}`}
                    onClick={() => onSecondaryAction(document, action)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}
