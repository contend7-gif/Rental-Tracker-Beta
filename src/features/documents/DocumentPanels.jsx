import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { documentAiActionLabel } from "../../domain/documentAi.ts";
import { formatDocumentUnitLabel } from "./documentPresentation.js";

export function DocumentExtractedFieldsPanel({ fields, compact = false, className = "", currency }) {
  if (!fields) return null;

  const rows = [
    fields.vendorName || fields.vendorEmail || fields.vendorPhone
      ? {
          label: "Vendor",
          value: [
            fields.vendorName,
            fields.vendorPhone ? `Phone ${fields.vendorPhone}` : "",
            fields.vendorEmail ? `Email ${fields.vendorEmail}` : "",
          ].filter(Boolean).join(" | "),
        }
      : null,
    fields.invoiceRef || fields.invoiceDate || fields.dueDate
      ? {
          label: "Invoice",
          value: [
            fields.invoiceRef ? `Ref ${fields.invoiceRef}` : "",
            fields.invoiceDate ? `Invoice ${fields.invoiceDate}` : "",
            fields.dueDate ? `Due ${fields.dueDate}` : "",
          ].filter(Boolean).join(" | "),
        }
      : null,
    fields.serviceDate || fields.serviceSummary || (fields.servicePeriodStart && fields.servicePeriodEnd)
      ? {
          label: "Service",
          value: [
            fields.serviceDate ? `Date ${fields.serviceDate}` : "",
            fields.servicePeriodStart && fields.servicePeriodEnd ? `Period ${fields.servicePeriodStart} to ${fields.servicePeriodEnd}` : "",
            fields.serviceSummary || "",
          ].filter(Boolean).join(" | "),
        }
      : null,
    fields.propertyAddress || fields.unit
      ? {
          label: "Location",
          value: [
            fields.propertyAddress || "",
            fields.unit ? formatDocumentUnitLabel(fields.unit) : "",
          ].filter(Boolean).join(" | "),
        }
      : null,
    fields.subtotal != null || fields.taxAmount != null || fields.totalAmount != null
      ? {
          label: "Amounts",
          value: [
            fields.subtotal != null ? `Subtotal ${currency(fields.subtotal)}` : "",
            fields.taxAmount != null ? `Tax ${currency(fields.taxAmount)}` : "",
            fields.totalAmount != null ? `Total ${currency(fields.totalAmount)}` : "",
          ].filter(Boolean).join(" | "),
        }
      : null,
  ].filter(Boolean);

  if (rows.length === 0) return null;

  return (
    <div className={`${compact ? "space-y-1.5" : "grid gap-2 sm:grid-cols-2"} ${className}`.trim()}>
      {rows.map((row) => (
        <div key={`${row.label}-${row.value}`} className={compact ? "text-[11px] text-slate-600" : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"}>
          <div className={compact ? "font-medium text-slate-700" : "font-medium uppercase tracking-wide text-slate-500"}>{row.label}</div>
          <div className={compact ? "mt-0.5 text-slate-700" : "mt-1 text-sm text-slate-800"}>{row.value}</div>
        </div>
      ))}
      {fields.sources?.length > 0 && (
        <div className={compact ? "text-[11px] text-slate-500" : "rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 sm:col-span-2"}>
          OCR signals: {fields.sources.join(", ")}
        </div>
      )}
    </div>
  );
}

export function DocumentUtilitySectionsPanel({ sections, compact = false, className = "", currency, onReviewSection = null }) {
  if (!Array.isArray(sections) || sections.length === 0) return null;

  return (
    <div className={`${compact ? "space-y-1.5" : "space-y-2"} ${className}`.trim()}>
      {sections.map((section) => (
        <div key={section.key} className={compact ? "rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] text-slate-700" : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium text-slate-800">{section.address}</div>
            <Badge variant="outline" className={section.external ? "border-amber-300 text-amber-800" : "border-emerald-300 text-emerald-800"}>
              {section.external ? "Outside portfolio" : (section.propertyLabel || "Matched property")}
            </Badge>
          </div>
          <div className="mt-1 text-slate-600">
            {[section.vendor, section.amount != null ? currency(section.amount) : "", section.date || ""].filter(Boolean).join(" | ")}
          </div>
          <div className="mt-1 text-slate-600">
            {[
              section.unit ? formatDocumentUnitLabel(section.unit) : "",
              section.servicePeriodStart && section.servicePeriodEnd ? `Period ${section.servicePeriodStart} to ${section.servicePeriodEnd}` : "",
              section.accountRef ? `Acct ${section.accountRef}` : "",
            ].filter(Boolean).join(" | ")}
          </div>
          {!section.external && onReviewSection ? (
            <div className="mt-2">
              <Button size="sm" variant="secondary" onClick={() => onReviewSection(section)}>
                Review section draft
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function DocumentAiAnalysisPanel({ analysis, compact = false, className = "", currency }) {
  if (!analysis?.summary) return null;

  const detailRows = [
    analysis.vendorName
      ? { label: "Vendor", value: analysis.vendorName }
      : null,
    analysis.documentType || analysis.invoiceRef
      ? {
          label: "Document",
          value: [
            analysis.documentType || "",
            analysis.invoiceRef ? `Ref ${analysis.invoiceRef}` : "",
          ].filter(Boolean).join(" | "),
        }
      : null,
    analysis.invoiceDate || analysis.dueDate
      ? {
          label: "Dates",
          value: [
            analysis.invoiceDate ? `Invoice ${analysis.invoiceDate}` : "",
            analysis.dueDate ? `Due ${analysis.dueDate}` : "",
          ].filter(Boolean).join(" | "),
        }
      : null,
    analysis.totalAmount != null || analysis.propertyAddress || analysis.unit
      ? {
          label: "Context",
          value: [
            analysis.totalAmount != null ? currency(analysis.totalAmount) : "",
            analysis.propertyAddress || "",
            analysis.unit ? formatDocumentUnitLabel(analysis.unit) : "",
          ].filter(Boolean).join(" | "),
        }
      : null,
  ].filter(Boolean);

  return (
    <div className={`${compact ? "space-y-1.5" : "space-y-3"} ${className}`.trim()}>
      <div className={compact ? "text-[11px] text-slate-700" : "rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm text-slate-800"}>
        <div className={compact ? "font-medium text-slate-800" : "font-medium uppercase tracking-wide text-slate-500"}>Summary</div>
        <div className={compact ? "mt-0.5" : "mt-1"}>{analysis.summary}</div>
      </div>
      {analysis.suggestedAction ? (
        <div className={compact ? "text-[11px] text-slate-700" : "rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm text-slate-800"}>
          <div className={compact ? "font-medium text-slate-800" : "font-medium uppercase tracking-wide text-slate-500"}>Suggested next step</div>
          <div className={compact ? "mt-0.5" : "mt-1"}>{documentAiActionLabel(analysis.suggestedAction)}</div>
          {analysis.suggestedActionReason ? <div className="mt-1 text-xs text-slate-600">{analysis.suggestedActionReason}</div> : null}
        </div>
      ) : null}
      {detailRows.length > 0 ? (
        <div className={compact ? "space-y-1.5" : "grid gap-2 sm:grid-cols-2"}>
          {detailRows.map((row) => (
            <div key={`${row.label}-${row.value}`} className={compact ? "text-[11px] text-slate-600" : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"}>
              <div className={compact ? "font-medium text-slate-700" : "font-medium uppercase tracking-wide text-slate-500"}>{row.label}</div>
              <div className={compact ? "mt-0.5 text-slate-700" : "mt-1 text-sm text-slate-800"}>{row.value}</div>
            </div>
          ))}
        </div>
      ) : null}
      {analysis.serviceSummary ? (
        <div className={compact ? "text-[11px] text-slate-600" : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"}>
          <div className={compact ? "font-medium text-slate-700" : "font-medium uppercase tracking-wide text-slate-500"}>Service summary</div>
          <div className={compact ? "mt-0.5 text-slate-700" : "mt-1 text-sm text-slate-800"}>{analysis.serviceSummary}</div>
        </div>
      ) : null}
      {analysis.actionItems?.length > 0 ? (
        <div className={compact ? "text-[11px] text-slate-600" : "rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"}>
          <div className={compact ? "font-medium text-slate-700" : "font-medium uppercase tracking-wide text-slate-500"}>Action items</div>
          <ul className={compact ? "mt-1 space-y-1" : "mt-2 space-y-1"}>
            {analysis.actionItems.map((item) => (
              <li key={item} className="list-inside list-disc">{item}</li>
            ))}
          </ul>
          {analysis.model ? <div className="mt-2 text-[10px] text-slate-500">AI model: {analysis.model}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
