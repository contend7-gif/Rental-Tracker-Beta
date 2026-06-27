import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, Building2 } from "lucide-react";
import { getPropertyPurchaseValueSupport } from "../properties/propertyOperations.js";

function Metric({ label, value, emphasis = false }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase text-slate-400">{label}</div>
      <div className={emphasis ? "mt-0.5 text-base font-semibold text-slate-950" : "mt-0.5 text-sm font-medium text-slate-800"}>{value}</div>
    </div>
  );
}

export function LoanPropertySummaryPanel({
  balanceByPropertyId = {},
  currency,
  loanPropertySummaries,
  openPropertyValuation,
}) {
  if (!loanPropertySummaries.length) return null;

  return (
    <Card className="h-full shadow-none">
      <CardHeader className="border-b border-slate-200 py-3">
        <div className="flex items-start gap-2">
          <Building2 className="mt-0.5 h-4 w-4 text-teal-700" aria-hidden="true" />
          <div>
            <CardTitle className="text-base">Property debt summary</CardTitle>
            <p className="mt-1 text-xs text-slate-500">Leverage using values supported in Properties.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="divide-y divide-slate-100 p-0">
        {loanPropertySummaries.map((summary) => {
          const displayedBalance = balanceByPropertyId[summary.property.id] ?? Number(summary.totalBalance || 0);
          const purchaseSupport = getPropertyPurchaseValueSupport(summary.property);
          const purchasePrice = Number(purchaseSupport.value || 0);
          const currentValue = Number(summary.estimatedCurrentValue || 0);
          const ltvVsPurchase = purchasePrice > 0 ? (displayedBalance / purchasePrice) * 100 : null;
          const ltvVsCurrentValue = currentValue > 0 ? (displayedBalance / currentValue) * 100 : null;

          return (
            <div key={`loan-property-${summary.property.id}`} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">{summary.property.name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{summary.loanCount} loan{summary.loanCount === 1 ? "" : "s"}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => openPropertyValuation?.(summary.property.id)}>
                  Update in Properties <ArrowUpRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                <Metric label="Total balance" value={currency(displayedBalance)} emphasis />
                <Metric label="Monthly outlay" value={currency(summary.totalScheduledOutlay)} emphasis />
                <Metric label="Purchase value" value={purchasePrice > 0 ? currency(purchasePrice) : "Not set"} />
                <Metric label="Current estimate" value={currentValue > 0 ? currency(currentValue) : "Not set"} />
                <Metric label="LTV vs purchase" value={ltvVsPurchase == null ? "Not available" : `${ltvVsPurchase.toFixed(1)}%`} />
                <Metric label="LTV vs current" value={ltvVsCurrentValue == null ? "Not available" : `${ltvVsCurrentValue.toFixed(1)}%`} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
