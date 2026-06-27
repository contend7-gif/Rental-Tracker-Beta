import React from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PlanningExitTab({
  currency,
  debtPayoff,
  debtPayoffPlan,
  exitAnalysis,
  exitPlan,
  financingComparison,
  onDebtPayoffPlanChange,
  onExitPlanChange,
  renderField,
}) {
  const updateExitPlan = (key, value) => onExitPlanChange((prev) => ({ ...prev, [key]: value }));
  const updatePayoffPlan = (key, value) => onDebtPayoffPlanChange((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <ExitDecisionSummary
        currency={currency}
        debtPayoff={debtPayoff}
        exitAnalysis={exitAnalysis}
        financingComparison={financingComparison}
      />
      <ExitModePanel
        currency={currency}
        exitAnalysis={exitAnalysis}
        exitPlan={exitPlan}
        onUpdateExitPlan={updateExitPlan}
        renderField={renderField}
      />

      <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-none">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900">
          <span>Debt and financing details</span>
          <Badge variant="outline">{debtPayoff.monthsSaved} mo payoff upside</Badge>
        </summary>
        <div className="mt-3 grid gap-3 xl:grid-cols-[1fr,1fr]">
        <DebtPayoffPanel
          currency={currency}
          debtPayoff={debtPayoff}
          debtPayoffPlan={debtPayoffPlan}
          onUpdatePayoffPlan={updatePayoffPlan}
          renderField={renderField}
        />

        <div className="space-y-3">
          <FinancingComparisonPanel
            currency={currency}
            financingComparison={financingComparison}
          />

          <IntelligentExitNotes />
        </div>
        </div>
      </details>
    </>
  );
}

function ExitDecisionSummary({ currency, debtPayoff, exitAnalysis, financingComparison }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Exit read</div>
          <div className="mt-1 text-xs text-slate-500">Choose the operating path first; open debt details only when you want to tune payoff or refinance assumptions.</div>
        </div>
        <Badge variant="secondary">{exitAnalysis.mode === "sell" ? "Sale view" : exitAnalysis.mode === "refi" ? "Refi view" : "Hold view"}</Badge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <ExitSummaryMetric label="Current path" value={exitAnalysis.headline} />
        <ExitSummaryMetric label="Cash-flow change" value={currency(exitAnalysis.monthlyCashFlowChange)} tone={exitAnalysis.monthlyCashFlowChange >= 0 ? "positive" : "negative"} />
        <ExitSummaryMetric label="Net proceeds / equity" value={currency(exitAnalysis.projectedNetProceeds)} />
        <ExitSummaryMetric label="Rate / payoff cue" value={`${financingComparison.weightedCurrentRatePct.toFixed(2)}% | ${debtPayoff.monthsSaved} mo saved`} />
      </div>
    </div>
  );
}

function ExitSummaryMetric({ label, tone = "neutral", value }) {
  const valueClass = tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-rose-700" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

function ExitModePanel({ currency, exitAnalysis, exitPlan, onUpdateExitPlan, renderField }) {
  return (
    <div className="mt-3 self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Hold / refi / sell</div>
          <div className="mt-1 text-xs text-slate-500">Hold, refinance, or sale comparison.</div>
        </div>
        <Badge variant="secondary">{exitPlan.mode.charAt(0).toUpperCase() + exitPlan.mode.slice(1)}</Badge>
      </div>
      <div className={`mt-3 grid gap-2 ${exitPlan.mode === "refi" ? "md:grid-cols-4" : exitPlan.mode === "sell" ? "md:grid-cols-4" : "md:grid-cols-[minmax(220px,320px),1fr]"}`}>
        {renderField(
          "Mode",
          <Select value={exitPlan.mode} onValueChange={(value) => onUpdateExitPlan("mode", value)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hold">Hold</SelectItem>
              <SelectItem value="refi">Refi</SelectItem>
              <SelectItem value="sell">Sell</SelectItem>
            </SelectContent>
          </Select>,
        )}
        {exitPlan.mode === "refi" && renderField("Target rate %", <Input className="mt-1" type="number" step="0.01" value={exitPlan.targetRatePct} onChange={(e) => onUpdateExitPlan("targetRatePct", e.target.value)} />)}
        {exitPlan.mode === "refi" && renderField("Term years", <Input className="mt-1" type="number" step="1" value={exitPlan.termYears} onChange={(e) => onUpdateExitPlan("termYears", e.target.value)} />)}
        {exitPlan.mode === "refi" && renderField("Cash out", <Input className="mt-1" type="number" step="0.01" value={exitPlan.cashOutAmount} onChange={(e) => onUpdateExitPlan("cashOutAmount", e.target.value)} />)}
        {exitPlan.mode === "sell" && renderField(
          "Tax treatment",
          <Select value={exitPlan.taxTreatment} onValueChange={(value) => onUpdateExitPlan("taxTreatment", value)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="taxable_sale">Taxable sale</SelectItem>
              <SelectItem value="exchange_1031">1031 exchange</SelectItem>
            </SelectContent>
          </Select>,
        )}
        {exitPlan.mode === "sell" && renderField("Sale date", <Input className="mt-1" type="date" value={exitPlan.saleDate} onChange={(e) => onUpdateExitPlan("saleDate", e.target.value)} />)}
        {exitPlan.mode === "sell" && renderField("Selling costs %", <Input className="mt-1" type="number" step="0.1" value={exitPlan.sellingCostsPct} onChange={(e) => onUpdateExitPlan("sellingCostsPct", e.target.value)} />)}
        {exitPlan.mode === "hold" && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-600">
            Hold mode keeps the current financing in place and focuses this tab on the baseline debt, payoff, and equity path.
          </div>
        )}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ExitMetric label="Headline" value={exitAnalysis.headline} valueClass="text-sm font-semibold text-slate-900" />
        <ExitMetric label="Projected rental-share debt service" value={currency(exitAnalysis.projectedMonthlyDebtService)} />
        <ExitMetric
          label="Cash-flow change"
          value={currency(exitAnalysis.monthlyCashFlowChange)}
          valueClass={`text-base font-semibold ${exitAnalysis.monthlyCashFlowChange >= 0 ? "text-emerald-700" : "text-rose-700"}`}
        />
        <ExitMetric
          label={exitAnalysis.mode === "sell" ? "Estimated net proceeds" : exitAnalysis.mode === "refi" ? "Cash out / proceeds" : "Horizon-end equity"}
          value={currency(exitAnalysis.projectedNetProceeds)}
        />
      </div>
    </div>
  );
}

function ExitMetric({ label, value, valueClass = "text-base font-semibold text-slate-900" }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 ${valueClass}`}>{value}</div>
    </div>
  );
}

function DebtPayoffPanel({ currency, debtPayoff, debtPayoffPlan, onUpdatePayoffPlan, renderField }) {
  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Debt payoff planner</div>
          <div className="mt-1 text-xs text-slate-500">Extra-principal and lump-sum tests.</div>
        </div>
        <Badge variant="secondary">{debtPayoff.monthsSaved} mo saved</Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {renderField("Extra principal / mo", <Input className="mt-1" type="number" step="0.01" value={debtPayoffPlan.extraPrincipalMonthly} onChange={(e) => onUpdatePayoffPlan("extraPrincipalMonthly", e.target.value)} />)}
        {renderField("Lump sum", <Input className="mt-1" type="number" step="0.01" value={debtPayoffPlan.lumpSumAmount} onChange={(e) => onUpdatePayoffPlan("lumpSumAmount", e.target.value)} />)}
        {renderField("Lump-sum date", <Input className="mt-1" type="date" value={debtPayoffPlan.lumpSumDate} onChange={(e) => onUpdatePayoffPlan("lumpSumDate", e.target.value)} />)}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Current payoff</div>
          <div className="mt-1 text-base font-semibold text-slate-900">{debtPayoff.currentMonthsToPayoff} months</div>
          <div className="mt-1 text-xs text-slate-500">Interest remaining {currency(debtPayoff.currentInterestRemaining)}</div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3">
          <div className="text-xs uppercase tracking-wide text-blue-700">Accelerated payoff</div>
          <div className="mt-1 text-base font-semibold text-blue-900">{debtPayoff.acceleratedMonthsToPayoff} months</div>
          <div className="mt-1 text-xs text-blue-900/80">Projected payoff {debtPayoff.projectedPayoffDate || "n/a"}</div>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <PayoffMetric label="Months saved" value={debtPayoff.monthsSaved} />
        <PayoffMetric label="Interest saved" value={currency(debtPayoff.interestSaved)} />
        <PayoffMetric label="Extra outlay / mo" value={currency(debtPayoff.monthlyExtraOutlay)} tone="neutral" />
      </div>
    </div>
  );
}

function PayoffMetric({ label, tone = "positive", value }) {
  const className = tone === "positive"
    ? "rounded-lg border border-emerald-200 bg-emerald-50/70 p-3"
    : "rounded-lg border border-slate-200 bg-slate-50/80 p-3";
  const labelClass = tone === "positive" ? "text-emerald-700" : "text-slate-500";
  const valueClass = tone === "positive" ? "text-emerald-900" : "text-slate-900";
  return (
    <div className={className}>
      <div className={`text-xs uppercase tracking-wide ${labelClass}`}>{label}</div>
      <div className={`mt-1 text-base font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

function FinancingComparisonPanel({ currency, financingComparison }) {
  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Financing comparison</div>
          <div className="mt-1 text-xs text-slate-500">Current, refi, and payoff paths.</div>
        </div>
        <Badge variant="outline">Current rate {financingComparison.weightedCurrentRatePct.toFixed(2)}%</Badge>
      </div>
      <div className="mt-3 grid gap-3">
        {financingComparison.rows.map((row) => (
          <div key={`planning-financing-${row.id}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">{row.label}</div>
                <div className="mt-1 text-xs text-slate-500">{row.note}</div>
              </div>
              <Badge variant={row.cashFlowImpact > 0 ? "secondary" : row.cashFlowImpact < 0 ? "destructive" : "outline"}>
                {row.cashFlowImpact > 0 ? `+${currency(row.cashFlowImpact)}/mo` : row.cashFlowImpact < 0 ? `${currency(row.cashFlowImpact)}/mo` : "No change"}
              </Badge>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2 xl:grid-cols-4">
              <FinancingMetric label="Planning outlay" value={currency(row.planningMonthlyOutlay)} />
              <FinancingMetric label="Full loan payment" value={currency(row.fullMonthlyOutlay)} />
              <FinancingMetric label="Payoff" value={`${row.payoffMonths} mo`} />
              <FinancingMetric label="Loan interest left" value={currency(row.interestRemaining)} />
            </div>
            <div className="mt-2 grid gap-2 text-xs text-slate-600">
              <FinancingMetric label="Payoff date" value={row.payoffDate || "n/a"} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinancingMetric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      {label} <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function IntelligentExitNotes() {
  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="font-medium text-slate-900">Intelligent planning notes</div>
      <div className="mt-2 space-y-2 text-xs text-slate-600">
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
          Dated occupancy, rent, and reserve changes live in Scenarios.
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
          Refi, payoff, and sale math live here.
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
          Payoff uses current balances, scheduled P&I, and extra-principal assumptions.
        </div>
      </div>
    </div>
  );
}
