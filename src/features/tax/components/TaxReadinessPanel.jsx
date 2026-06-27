import React from "react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";

export function TaxReadinessPanel({ taxReadinessSummary, taxReportingSummary, navigateWithDashboardContext }) {
  return (
    <div id="tax-readiness" className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-900">{taxReadinessSummary?.label || "Ready for Tax Center"}</div>
          <div className="mt-1 text-sm text-slate-600">
            {taxReportingSummary?.readiness?.helperText || "Source records are ready for Tax Center review."}
          </div>
        </div>
        <Badge variant={taxReadinessSummary?.status === "ready" ? "outline" : "secondary"} className={taxReadinessSummary?.status === "ready" ? "!bg-emerald-50 !text-emerald-700" : "!bg-amber-100 !text-amber-800"}>
          {taxReportingSummary?.readiness?.label || "Reviewed source records"}
        </Badge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(taxReadinessSummary?.sections || []).map((section) => (
          <div key={`tax-center-readiness-${section.key}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">{section.label}</div>
                <div className="text-xs text-slate-500">{section.reviewCount > 0 ? `${section.reviewCount} review item${section.reviewCount === 1 ? "" : "s"}` : "Ready"}</div>
              </div>
              <Badge variant={section.status === "ready" ? "outline" : "secondary"} className={section.status === "ready" ? "!bg-emerald-50 !text-emerald-700" : "!bg-amber-100 !text-amber-800"}>
                {section.status === "ready" ? "Ready" : "Needs review"}
              </Badge>
            </div>
            <div className="mt-1 line-clamp-2 text-xs text-slate-500">{section.helperText}</div>
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => navigateWithDashboardContext?.(section.targetView)}>
              {section.primaryActionLabel}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
