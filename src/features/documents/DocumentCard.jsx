import { FileText, MoreHorizontal } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { AuditReadinessBadge } from "../shared/AuditReadinessBadge.jsx";
import {
  buildLinkedRecordSummary,
  formatDocumentDate,
  formatDocumentScope,
  isSupportingOnlyDocument,
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
  const supportingOnly = isSupportingOnlyDocument(document);
  const linked = Boolean(linkedSummary && linkedSummary.kind !== "supporting");
  const extracted = document.ocrStatus === "completed" || Boolean(document.extractedText);
  const extractionLabel = extracted ? "Text extracted" : document.ocrStatus === "pending" ? "OCR pending" : "Needs text";
  const typeLabel = document.type || "File";
  const reviewSummary = warnings.length > 0
    ? warnings[0].detail
    : linkedSummary?.label
      ? ""
      : getDocumentReviewSummary(document, context);

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(12rem,.75fr)_minmax(14rem,.85fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-2 text-slate-900">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600">
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="rt-row-title truncate">{document.name}</div>
              <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">{typeLabel} | {formatDocumentScope(document, propertyLabel)} | {documentDate}</div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {linked ? <Badge variant="secondary" className="border-teal-200 bg-teal-50 text-teal-800">Linked</Badge> : null}
            {supportingOnly ? <Badge variant="secondary">Supporting only</Badge> : null}
            {extracted ? <Badge variant="secondary">Text extracted</Badge> : null}
            <AuditReadinessBadge
              status={status === "reviewed" || status === "supporting_only" ? { key: "ready", label: documentWorkflowStatusLabel(status) } : { key: "needs_review", label: documentWorkflowStatusLabel(status) }}
              className={STATUS_BADGE_CLASS[status] || ""}
            />
            {!extracted ? <Badge variant="secondary">{extractionLabel}</Badge> : null}
          </div>
        </div>

        <div className="min-w-0 text-xs text-slate-600">
          <div className="font-medium text-slate-800">Record support</div>
          <div className="mt-0.5 line-clamp-2">{linkedSummary?.label || ownershipLabel || "No linked record yet"}</div>
        </div>

        <p className="line-clamp-2 text-xs leading-5 text-slate-600">{reviewSummary || "Record support is linked and ready to inspect from details."}</p>

        <div className="flex items-center gap-2 lg:justify-end">
          <Button size="sm" className="whitespace-nowrap" onClick={() => onPrimaryAction(document, primaryAction)}>
            {primaryAction.label}
          </Button>
          {secondaryActions.length > 0 ? (
            <details className="relative">
              <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" title="More actions">
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
