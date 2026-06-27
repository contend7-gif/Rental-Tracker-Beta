import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { getPlanningPresetValues } from "./planningState.js";
import { formatUnitLabel } from "../../domain/unitLabels.js";

export function UnitEconomicsPanel({ currency, rows }) {
  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Unit economics</div>
          <div className="mt-1 text-xs text-slate-500">Per-unit planning view.</div>
        </div>
        <Badge variant="secondary">{rows.length} units</Badge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-xs text-slate-500">No rentable units are available in this scope yet.</div>
        ) : (
          rows.map((row) => (
            <div key={`planning-unit-economics-${row.key}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{row.propertyName} | {formatUnitLabel(row.unit)}</div>
                  <div className="mt-1 text-xs text-slate-500">Live {row.currentStatus} | Planned {row.plannedStatus}</div>
                </div>
                <Badge variant="outline">{currency(row.plannedRent)}/mo</Badge>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-white p-2">Current rent <span className="font-medium text-slate-900">{currency(row.currentRent)}</span></div>
                <div className="rounded-lg border border-slate-200 bg-white p-2">Planned rent <span className="font-medium text-slate-900">{currency(row.plannedRent)}</span></div>
                <div className="rounded-lg border border-slate-200 bg-white p-2">Annual upside <span className="font-medium text-slate-900">{currency(row.annualUpside)}</span></div>
                <div className="rounded-lg border border-slate-200 bg-white p-2">Turnover cost <span className="font-medium text-slate-900">{currency(row.turnoverCost)}</span></div>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {row.nextTurnoverDate
                  ? `Next turnover ${row.nextTurnoverDate} | Recovery ${row.recoveryMonths.toFixed(1)} mo`
                  : "No turnover date modeled right now."}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function ScenarioPresetComparePanel({ currency, onApplyPreset, outcomeHighlights, scenarioComparisons, scopeLabel }) {
  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Scenario compare</div>
          <div className="mt-1 text-xs text-slate-500">Built-in planning presets.</div>
        </div>
        <Badge variant="secondary">{scopeLabel}</Badge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {scenarioComparisons.map((scenario) => {
          const preset = getPlanningPresetValues(scenario.key);
          return (
            <div key={`planning-scenario-${scenario.key}`} className={`rounded-xl border p-3 ${scenario.key === "base" ? "border-blue-200 bg-blue-50/50" : "border-slate-200 bg-slate-50/70"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">{scenario.label}</div>
                <Button size="sm" variant="secondary" className="h-7" onClick={() => onApplyPreset(scenario.key)}>Use</Button>
              </div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <div className="flex items-center justify-between gap-2">
                  <span>12-mo cash flow</span>
                  <span className={`font-semibold ${scenario.projection.summary.firstYearCashFlow >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{currency(scenario.projection.summary.firstYearCashFlow)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>12-mo NOI</span>
                  <span className="font-semibold text-slate-900">{currency(scenario.projection.summary.firstYearNetOperatingIncome)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>End equity</span>
                  <span className="font-semibold text-slate-900">{currency(scenario.projection.summary.horizonEndingEquity)}</span>
                </div>
                <div className="pt-1 text-[11px] text-slate-500">
                  Horizon {preset.horizonMonths} mo | Vacancy {preset.vacancyRatePct}% | Reserve {currency(Number(preset.monthlyCapexReserve || 0))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {outcomeHighlights.map((item) => (
          <div key={`planning-outcome-${item.label}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">{item.label}</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{item.value}</div>
            <div className="mt-1 text-xs text-slate-500">{item.scenario}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PortfolioGoalsPanel({ goalStatus, goals, onUpdateGoal, renderField }) {
  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Portfolio goals</div>
          <div className="mt-1 text-xs text-slate-500">Tracked planning targets.</div>
        </div>
        <Badge variant="secondary">{goalStatus.length} tracked</Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {renderField("Min monthly cash flow", <Input className="mt-1" type="number" step="0.01" value={goals.minMonthlyCashFlow} onChange={(e) => onUpdateGoal("minMonthlyCashFlow", e.target.value)} />)}
        {renderField("Min 12-mo cash flow", <Input className="mt-1" type="number" step="0.01" value={goals.minAnnualCashFlow} onChange={(e) => onUpdateGoal("minAnnualCashFlow", e.target.value)} />)}
        {renderField("Min reserve months", <Input className="mt-1" type="number" step="0.1" value={goals.minReserveMonths} onChange={(e) => onUpdateGoal("minReserveMonths", e.target.value)} />)}
        {renderField("Min end equity", <Input className="mt-1" type="number" step="0.01" value={goals.minEndingEquity} onChange={(e) => onUpdateGoal("minEndingEquity", e.target.value)} />)}
        {renderField("Max LTV %", <Input className="mt-1" type="number" step="0.1" value={goals.maxLtvPct} onChange={(e) => onUpdateGoal("maxLtvPct", e.target.value)} />)}
        {renderField("Min DSCR", <Input className="mt-1" type="number" step="0.01" value={goals.minDscr} onChange={(e) => onUpdateGoal("minDscr", e.target.value)} />)}
      </div>
      <div className="mt-3 space-y-2">
        {goalStatus.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-xs text-slate-500">Add at least one target to turn this into an on-track / watch / off-track scorecard.</div>
        ) : (
          goalStatus.map((row) => (
            <div key={`planning-goal-${row.id}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-slate-900">{row.label}</div>
                  <div className="mt-1 text-xs text-slate-500">Target {row.targetLabel} | Actual {row.actualLabel}</div>
                </div>
                <Badge variant={row.status === "off_track" ? "destructive" : row.status === "watch" ? "secondary" : "outline"}>
                  {row.status === "off_track" ? "Off track" : row.status === "watch" ? "Watch" : "On track"}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function TriggerPlanningPanel({ onUpdateTrigger, renderField, triggerAlerts, triggers }) {
  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Trigger-based planning</div>
          <div className="mt-1 text-xs text-slate-500">Cash-flow, reserve, lease, and CapEx alerts.</div>
        </div>
        <Badge variant={triggerAlerts.length ? "secondary" : "outline"}>{triggerAlerts.length} alerts</Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {renderField("Min monthly cash flow", <Input className="mt-1" type="number" step="0.01" value={triggers.minMonthlyCashFlow} onChange={(e) => onUpdateTrigger("minMonthlyCashFlow", e.target.value)} />)}
        {renderField("Min reserve months", <Input className="mt-1" type="number" step="0.1" value={triggers.minReserveMonths} onChange={(e) => onUpdateTrigger("minReserveMonths", e.target.value)} />)}
        {renderField("Lease rollover days", <Input className="mt-1" type="number" step="1" value={triggers.leaseRolloverDays} onChange={(e) => onUpdateTrigger("leaseRolloverDays", e.target.value)} />)}
        {renderField("CapEx warning months", <Input className="mt-1" type="number" step="1" value={triggers.capexWarningMonths} onChange={(e) => onUpdateTrigger("capexWarningMonths", e.target.value)} />)}
      </div>
      <div className="mt-3 space-y-2">
        {triggerAlerts.length === 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2 text-xs text-emerald-900">Triggers are quiet at the current thresholds. Recheck after rent, reserve, or horizon changes.</div>
        ) : (
          triggerAlerts.map((alert) => (
            <div key={`planning-trigger-${alert.id}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-slate-900">{alert.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{alert.detail}</div>
                </div>
                <Badge variant={alert.priority === "high" ? "destructive" : alert.priority === "medium" ? "secondary" : "outline"}>{alert.priority}</Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function GuardrailsPanel({
  goalStatus,
  goals,
  onUpdateGoal,
  onUpdateTrigger,
  renderField,
  triggerAlerts,
  triggers,
}) {
  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Guardrails</div>
          <div className="mt-1 text-xs text-slate-500">Portfolio goals and alert thresholds.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{goalStatus.length} goals</Badge>
          <Badge variant={triggerAlerts.length ? "secondary" : "outline"}>{triggerAlerts.length} alerts</Badge>
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Goals</div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {renderField("Min monthly cash flow", <Input className="mt-1" type="number" step="0.01" value={goals.minMonthlyCashFlow} onChange={(e) => onUpdateGoal("minMonthlyCashFlow", e.target.value)} />)}
            {renderField("Min 12-mo cash flow", <Input className="mt-1" type="number" step="0.01" value={goals.minAnnualCashFlow} onChange={(e) => onUpdateGoal("minAnnualCashFlow", e.target.value)} />)}
            {renderField("Min reserve months", <Input className="mt-1" type="number" step="0.1" value={goals.minReserveMonths} onChange={(e) => onUpdateGoal("minReserveMonths", e.target.value)} />)}
            {renderField("Max LTV %", <Input className="mt-1" type="number" step="0.1" value={goals.maxLtvPct} onChange={(e) => onUpdateGoal("maxLtvPct", e.target.value)} />)}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alerts</div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {renderField("Alert below monthly cash flow", <Input className="mt-1" type="number" step="0.01" value={triggers.minMonthlyCashFlow} onChange={(e) => onUpdateTrigger("minMonthlyCashFlow", e.target.value)} />)}
            {renderField("Alert below reserve months", <Input className="mt-1" type="number" step="0.1" value={triggers.minReserveMonths} onChange={(e) => onUpdateTrigger("minReserveMonths", e.target.value)} />)}
            {renderField("Lease rollover days", <Input className="mt-1" type="number" step="1" value={triggers.leaseRolloverDays} onChange={(e) => onUpdateTrigger("leaseRolloverDays", e.target.value)} />)}
            {renderField("CapEx warning months", <Input className="mt-1" type="number" step="1" value={triggers.capexWarningMonths} onChange={(e) => onUpdateTrigger("capexWarningMonths", e.target.value)} />)}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div className="space-y-2">
          {goalStatus.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-xs text-slate-500">Add at least one goal to turn this into an on-track / watch / off-track scorecard.</div>
          ) : (
            goalStatus.map((row) => (
              <div key={`planning-guardrail-goal-${row.id}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{row.label}</div>
                    <div className="mt-1 text-xs text-slate-500">Target {row.targetLabel} | Actual {row.actualLabel}</div>
                  </div>
                  <Badge variant={row.status === "off_track" ? "destructive" : row.status === "watch" ? "secondary" : "outline"}>
                    {row.status === "off_track" ? "Off track" : row.status === "watch" ? "Watch" : "On track"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2">
          {triggerAlerts.length === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2 text-xs text-emerald-900">Triggers are quiet at the current thresholds. Recheck after rent, reserve, or horizon changes.</div>
          ) : (
            triggerAlerts.map((alert) => (
              <div key={`planning-guardrail-trigger-${alert.id}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{alert.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{alert.detail}</div>
                  </div>
                  <Badge variant={alert.priority === "high" ? "destructive" : alert.priority === "medium" ? "secondary" : "outline"}>{alert.priority}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function TaxMetric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function SaleWaterfallRow({ label, strong = false, tone = "default", value }) {
  const toneClass = tone === "negative" ? "text-rose-700" : tone === "positive" ? "text-emerald-800" : "";
  const borderClass = tone === "positive" ? "border-emerald-300 bg-emerald-50/80" : strong ? "border-amber-300 bg-white" : "border-amber-200/70 bg-white/70";
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${borderClass}`}>
      <span>{label}</span>
      <span className={`font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}

function TaxBasisRow({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      {label} <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function SaleTaxOutlook({ currency, exitAnalysis }) {
  return (
    <div className="mt-3 grid gap-3 xl:grid-cols-[1.1fr,0.9fr]">
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
        <div className="text-sm font-semibold text-amber-900">Sale proceeds waterfall</div>
        <div className="mt-2 grid gap-2 text-sm text-amber-950/90">
          <SaleWaterfallRow label="Estimated sale value" value={currency(exitAnalysis.projectedSaleValue)} />
          <SaleWaterfallRow label="Selling costs" value={`-${currency(exitAnalysis.projectedSaleCosts)}`} tone="negative" />
          <SaleWaterfallRow label="Projected loan payoff at sale" value={`-${currency(exitAnalysis.projectedLoanPayoff)}`} tone="negative" />
          <SaleWaterfallRow label="Net proceeds before tax" value={currency(exitAnalysis.projectedNetProceeds)} strong />
          <SaleWaterfallRow
            label={exitAnalysis.taxTreatment === "exchange_1031" ? "Rough deferred tax" : "Rough tax estimate"}
            value={`-${currency(exitAnalysis.roughTaxEstimate)}`}
            tone="negative"
          />
          <SaleWaterfallRow
            label={exitAnalysis.taxTreatment === "exchange_1031" ? "Exchange equity after costs" : "Rough after-tax proceeds"}
            value={currency(exitAnalysis.roughAfterTaxProceeds)}
            tone="positive"
            strong
          />
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
        <div className="text-sm font-semibold text-slate-900">{exitAnalysis.taxTreatment === "exchange_1031" ? "Rough 1031 exchange view" : "Rough tax-aware sale view"}</div>
        <div className="mt-2 grid gap-2 text-xs text-slate-600">
          <TaxBasisRow label="Adjusted tax basis" value={currency(exitAnalysis.roughTaxBasis)} />
          <TaxBasisRow label="Accumulated depreciation" value={currency(exitAnalysis.roughAccumulatedDepreciation)} />
          <TaxBasisRow label="Rough taxable gain" value={currency(exitAnalysis.roughTaxableGain)} />
          <TaxBasisRow label="Depreciation recapture bucket" value={currency(exitAnalysis.roughDepreciationRecapture)} />
          <TaxBasisRow label="Residual capital gain bucket" value={currency(exitAnalysis.roughCapitalGain)} />
          <TaxBasisRow label="Months to exit" value={exitAnalysis.monthsToExit} />
        </div>
        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-500">
          {exitAnalysis.taxTreatment === "exchange_1031"
            ? "This is a rough 1031 planning estimate, not exchange or tax advice. It treats the rough federal sale tax as deferred rather than currently due and does not model boot, replacement-property debt rules, identification timing, or state treatment."
            : "This is a conservative planning estimate, not a tax filing result. It uses tracked depreciable basis and depreciation, a projected loan payoff at the selected sale date, and rough federal gain buckets."}
        </div>
      </div>
    </div>
  );
}

export function TaxAwareOutlookPanel({ currency, exitAnalysis, taxProjection }) {
  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Tax-aware outlook</div>
          <div className="mt-1 text-xs text-slate-500">Rough next-12-month planning forecast.</div>
        </div>
        <Badge variant="outline">Forecast only</Badge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <TaxMetric label="Projected gross rent" value={currency(taxProjection.grossRent)} />
        <TaxMetric label="Projected OpEx" value={currency(taxProjection.operatingExpenses)} />
        <TaxMetric label="Projected mortgage interest" value={currency(taxProjection.mortgageInterest)} />
        <TaxMetric label="Projected depreciation" value={currency(taxProjection.depreciation)} />
      </div>
      <div className={`mt-3 rounded-lg border p-3 ${taxProjection.projectedScheduleE >= 0 ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/70"}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className={`text-sm font-semibold ${taxProjection.projectedScheduleE >= 0 ? "text-emerald-900" : "text-amber-900"}`}>Projected Schedule E</div>
            <div className={`mt-1 text-xs ${taxProjection.projectedScheduleE >= 0 ? "text-emerald-900/80" : "text-amber-900/80"}`}>{taxProjection.note}</div>
            <div className={`mt-1 text-xs ${taxProjection.projectedScheduleE >= 0 ? "text-emerald-900/80" : "text-amber-900/80"}`}>Tax Center remains the supported filing/review view.</div>
          </div>
          <div className={`text-base font-semibold ${taxProjection.projectedScheduleE >= 0 ? "text-emerald-900" : "text-amber-900"}`}>{currency(taxProjection.projectedScheduleE)}</div>
        </div>
      </div>
      {exitAnalysis.mode === "sell" && <SaleTaxOutlook currency={currency} exitAnalysis={exitAnalysis} />}
    </div>
  );
}

function DecisionScenarioCard({ currency, debtService, monthlyCashFlow, monthlyRent, title, tone = "neutral" }) {
  return (
    <div className={`rounded-xl border p-3 ${tone === "blue" ? "border-blue-200 bg-blue-50/50" : "border-slate-200 bg-slate-50/70"}`}>
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-2 space-y-1 text-xs text-slate-600">
        <DecisionMetric label="Monthly rent" value={currency(monthlyRent)} />
        <DecisionMetric label="Debt service" value={currency(debtService)} />
        <DecisionMetric
          label="Monthly cash flow"
          value={currency(monthlyCashFlow)}
          valueClass={monthlyCashFlow >= 0 ? "text-emerald-700" : "text-rose-700"}
        />
      </div>
    </div>
  );
}

function DecisionMetric({ label, value, valueClass = "text-slate-900" }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className={`font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}

export function DecisionComparePanel({ currency, decisionComparison, formatPropertyLabel }) {
  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Decision compare</div>
          <div className="mt-1 text-xs text-slate-500">Current mixed-use vs fully rented.</div>
        </div>
        <Badge variant="secondary">{decisionComparison.rentableUnitCount} units priced</Badge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <DecisionScenarioCard
          currency={currency}
          debtService={decisionComparison.currentDebtService}
          monthlyCashFlow={decisionComparison.currentMonthlyCashFlow}
          monthlyRent={decisionComparison.currentMonthlyRent}
          title="Current setup"
        />
        <DecisionScenarioCard
          currency={currency}
          debtService={decisionComparison.fullDebtService}
          monthlyCashFlow={decisionComparison.fullRentalMonthlyCashFlow}
          monthlyRent={decisionComparison.fullRentalMonthlyRent}
          tone="blue"
          title="If fully rented"
        />
      </div>
      <div className={`mt-3 rounded-xl border p-3 ${decisionComparison.monthlyCashFlowUpside >= 0 ? "border-emerald-200 bg-emerald-50/70" : "border-rose-200 bg-rose-50/70"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className={`text-sm font-semibold ${decisionComparison.monthlyCashFlowUpside >= 0 ? "text-emerald-900" : "text-rose-900"}`}>
              Monthly cash-flow change
            </div>
            <div className={`mt-1 text-xs ${decisionComparison.monthlyCashFlowUpside >= 0 ? "text-emerald-900/80" : "text-rose-900/80"}`}>
              Rent upside {currency(decisionComparison.monthlyRentUpside)} | Annualized cash-flow change {currency(decisionComparison.monthlyCashFlowUpside * 12)}
            </div>
          </div>
          <div className={`text-base font-semibold ${decisionComparison.monthlyCashFlowUpside >= 0 ? "text-emerald-900" : "text-rose-900"}`}>
            {currency(decisionComparison.monthlyCashFlowUpside)}
          </div>
        </div>
        {decisionComparison.upsideUnits.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {decisionComparison.upsideUnits.map((unit) => (
              <Badge key={`planning-upside-unit-${unit.propertyId}-${unit.unit}`} variant="outline">
                {formatPropertyLabel(unit.propertyId)} | {formatUnitLabel(unit.unit)} | {currency(unit.monthlyRent)}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function PlanningInsightsNotes({ horizonCashFlow, horizonMonths }) {
  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="font-medium text-slate-900">Planning notes</div>
      <div className="mt-2 space-y-2 text-xs text-slate-600">
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
          Current values use each property&apos;s saved current value when available, with purchase price as the fallback.
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
          Debt service follows current and future mixed-use rental share, so owner-occupancy changes flow into the forecast automatically.
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2">
          Future rent is driven by signed leases first. Growth and vacancy assumptions then adjust that baseline rather than replacing it.
        </div>
        <div className={`rounded-lg border p-2 ${horizonCashFlow >= 0 ? "border-emerald-200 bg-emerald-50/70 text-emerald-900" : "border-rose-200 bg-rose-50/70 text-rose-900"}`}>
          {horizonCashFlow >= 0
            ? `Positive cash flow over ${horizonMonths} months.`
            : `Negative cash flow over ${horizonMonths} months.`}
        </div>
      </div>
    </div>
  );
}
