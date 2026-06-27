import React from "react";
import { Badge } from "@/components/ui/badge";

import {
  DecisionComparePanel,
  GuardrailsPanel,
  PlanningInsightsNotes,
  ScenarioPresetComparePanel,
  TaxAwareOutlookPanel,
  UnitEconomicsPanel,
} from "./PlanningInsightsPanels.jsx";

export function PlanningInsightsTab({
  currency,
  decisionComparison,
  exitAnalysis,
  formatPropertyLabel,
  goalStatus,
  goals,
  horizonDisplayMetrics,
  horizonMonths,
  onApplyPreset,
  onGoalsChange,
  onTriggersChange,
  outcomeHighlights,
  renderField,
  scenarioComparisons,
  scopeLabel,
  taxProjection,
  triggerAlerts,
  triggers,
  unitEconomicsRows,
}) {
  const updateGoal = (key, value) => onGoalsChange((prev) => ({ ...prev, [key]: value }));
  const updateTrigger = (key, value) => onTriggersChange((prev) => ({ ...prev, [key]: value }));
  const offTrackGoals = goalStatus.filter((row) => row.status === "off_track").length;
  const watchGoals = goalStatus.filter((row) => row.status === "watch").length;

  return (
    <>
      <PlanningInsightsBrief
        alertCount={triggerAlerts.length}
        cashFlow={horizonDisplayMetrics.cashFlow}
        horizonMonths={horizonMonths}
        offTrackGoals={offTrackGoals}
        scheduleE={taxProjection.projectedScheduleE}
        watchGoals={watchGoals}
        currency={currency}
      />

      <div className="mt-3">
        <ScenarioPresetComparePanel
          currency={currency}
          onApplyPreset={onApplyPreset}
          outcomeHighlights={outcomeHighlights}
          scenarioComparisons={scenarioComparisons}
          scopeLabel={scopeLabel}
        />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.35fr,0.65fr]">
        <GuardrailsPanel
          goalStatus={goalStatus}
          goals={goals}
          onUpdateGoal={updateGoal}
          onUpdateTrigger={updateTrigger}
          renderField={renderField}
          triggerAlerts={triggerAlerts}
          triggers={triggers}
        />
        <TaxAwareOutlookPanel
          currency={currency}
          exitAnalysis={exitAnalysis}
          taxProjection={taxProjection}
        />
      </div>

      <PlanningInsightsDrilldown title="Unit and decision diagnostics" meta={`${unitEconomicsRows.length} units`}>
        <UnitEconomicsPanel
          currency={currency}
          rows={unitEconomicsRows}
        />
        <DecisionComparePanel
          currency={currency}
          decisionComparison={decisionComparison}
          formatPropertyLabel={formatPropertyLabel}
        />
        <PlanningInsightsNotes
          horizonCashFlow={horizonDisplayMetrics.cashFlow}
          horizonMonths={horizonMonths}
        />
      </PlanningInsightsDrilldown>
    </>
  );
}

function PlanningInsightsBrief({ alertCount, cashFlow, currency, horizonMonths, offTrackGoals, scheduleE, watchGoals }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Insights read</div>
          <div className="mt-1 text-xs text-slate-500">Use this tab to tune guardrails, compare presets, and spot tax or unit-level pressure.</div>
        </div>
        <Badge variant={alertCount || offTrackGoals ? "secondary" : "outline"}>
          {alertCount || offTrackGoals ? "Review needed" : "No urgent alerts"}
        </Badge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <InsightMetric label={`${horizonMonths}-mo cash flow`} value={currency(cashFlow)} tone={cashFlow >= 0 ? "positive" : "negative"} />
        <InsightMetric label="Goals to watch" value={watchGoals + offTrackGoals} note={`${offTrackGoals} off track`} tone={offTrackGoals ? "negative" : watchGoals ? "watch" : "neutral"} />
        <InsightMetric label="Trigger alerts" value={alertCount} tone={alertCount ? "watch" : "neutral"} />
        <InsightMetric label="Projected Schedule E" value={currency(scheduleE)} tone={scheduleE >= 0 ? "positive" : "watch"} />
      </div>
    </div>
  );
}

function InsightMetric({ label, note, tone = "neutral", value }) {
  const valueClass = tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-rose-700" : tone === "watch" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-base font-semibold ${valueClass}`}>{value}</div>
      {note ? <div className="mt-1 text-xs text-slate-500">{note}</div> : null}
    </div>
  );
}

function PlanningInsightsDrilldown({ children, meta, title }) {
  return (
    <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900">
        <span>{title}</span>
        <Badge variant="outline">{meta}</Badge>
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}
