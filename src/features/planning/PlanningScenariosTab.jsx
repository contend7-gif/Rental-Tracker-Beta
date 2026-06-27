import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  PlanningSavedScenariosPanel,
  PlanningScenarioAssumptions,
  PlanningScenarioAuditNarrative,
  PlanningScenarioComparePanel,
  PlanningScenarioProbabilityPanel,
  PlanningScenarioQuickActions,
  PlanningScenarioTimelineComparePanel,
  PlanningScenarioTimelineEventsPanel,
  PlanningScenarioUnitOverrides,
} from "./PlanningScenarioPanels.jsx";
import { PlanningScenarioCharts } from "./PlanningSharedPanels.jsx";
import { normalizePlanningScenarioEvents } from "./planningState.js";

export function PlanningScenariosTab({
  activeScenario,
  assumptions,
  assumptionAuditRows,
  baselineScenario,
  baselineScenarioId,
  buildChartPointX,
  chartData,
  comparisons,
  countScenarioEvents,
  currency,
  decisionDashboard,
  diffRows,
  eventDraft,
  eventPropertyId,
  eventUnitOptions,
  events,
  formatDateTime,
  formatPropertyLabel,
  getUnitOverride,
  horizonMonths,
  isDirty,
  nameDraft,
  notesDraft,
  onApplyPreset,
  onApplyTemplate,
  onAssumptionsChange,
  onClearSelection,
  onClone,
  onDelete,
  onDeleteEvent,
  onEditEvent,
  onEventDraftChange,
  onLoad,
  onResetEventDraft,
  onSaveAsNew,
  onSaveBranch,
  onSaveEvent,
  onSetBaseline,
  onSetUnitOverride,
  onUpdateSelected,
  onNameDraftChange,
  onNotesDraftChange,
  properties,
  range,
  renderField,
  savedScenarios,
  sensitivityRows,
  TableFrame,
  timelineRows,
  timelineVisual,
  units,
}) {
  const baselineName = baselineScenario?.name || "Base preset";
  const shortHorizon = Math.min(horizonMonths, 12);
  const eventCount = normalizePlanningScenarioEvents(events).length;
  const diffCount = diffRows.length;

  return (
    <>
      <ScenarioCommandSummary
        activeScenario={activeScenario}
        baselineName={baselineName}
        diffCount={diffCount}
        eventCount={eventCount}
        isDirty={isDirty}
        range={range}
        savedCount={savedScenarios.length}
        currency={currency}
      />
      <PlanningScenarioQuickActions
        onApplyPreset={onApplyPreset}
        onApplyTemplate={onApplyTemplate}
      />
      <div className="mt-3 grid gap-3 xl:grid-cols-[1.1fr,0.9fr]">
        <PlanningScenarioTimelineEventsPanel
          events={events}
          eventDraft={eventDraft}
          eventPropertyId={eventPropertyId}
          properties={properties}
          eventUnitOptions={eventUnitOptions}
          timelineVisual={timelineVisual}
          horizonMonths={shortHorizon}
          onEventDraftChange={onEventDraftChange}
          onSaveEvent={onSaveEvent}
          onResetEventDraft={onResetEventDraft}
          onEditEvent={onEditEvent}
          onDeleteEvent={onDeleteEvent}
          renderField={renderField}
          formatPropertyLabel={formatPropertyLabel}
          currency={currency}
          buildChartPointX={buildChartPointX}
        />
        <PlanningScenarioProbabilityPanel
          range={range}
          diffRows={diffRows}
          baselineName={baselineName}
          currency={currency}
        />
      </div>
      <PlanningScenarioTimelineComparePanel
        rows={timelineRows}
        comparisons={comparisons}
        dashboard={decisionDashboard}
        sensitivityRows={sensitivityRows}
        months={shortHorizon}
        TableFrame={TableFrame}
        currency={currency}
      />
      <PlanningDrilldown title="Saved scenario versions" meta={`${savedScenarios.length} saved`} defaultOpen={Boolean(activeScenario) || isDirty}>
        <PlanningSavedScenariosPanel
          activeScenario={activeScenario}
          isDirty={isDirty}
          nameDraft={nameDraft}
          notesDraft={notesDraft}
          savedScenarios={savedScenarios}
          baselineScenarioId={baselineScenarioId}
          onNameDraftChange={onNameDraftChange}
          onNotesDraftChange={onNotesDraftChange}
          onSaveAsNew={onSaveAsNew}
          onSaveBranch={onSaveBranch}
          onUpdateSelected={onUpdateSelected}
          onClearSelection={onClearSelection}
          onSetBaseline={onSetBaseline}
          onLoad={onLoad}
          onClone={onClone}
          onDelete={onDelete}
          formatPropertyLabel={formatPropertyLabel}
          formatDateTime={formatDateTime}
          countScenarioEvents={countScenarioEvents}
          currency={currency}
        />
      </PlanningDrilldown>
      <PlanningDrilldown title="Assumption audit and charts" meta={`${assumptionAuditRows.length} inputs`}>
        <PlanningScenarioAuditNarrative
          auditRows={assumptionAuditRows}
          diffRows={diffRows}
          baselineName={baselineName}
        />
        <PlanningScenarioComparePanel
          scenarios={comparisons}
          TableFrame={TableFrame}
          currency={currency}
        />
        <PlanningScenarioCharts charts={chartData} months={shortHorizon} />
      </PlanningDrilldown>
      <PlanningDrilldown title="Unit overrides and global assumptions" meta={`${units.length} units`}>
        <PlanningScenarioUnitOverrides
          units={units}
          getUnitOverride={getUnitOverride}
          onSetUnitOverride={onSetUnitOverride}
          renderField={renderField}
          formatPropertyLabel={formatPropertyLabel}
        />
        <PlanningScenarioAssumptions
          assumptions={assumptions}
          onAssumptionsChange={onAssumptionsChange}
          renderField={renderField}
        />
      </PlanningDrilldown>
    </>
  );
}

function ScenarioCommandSummary({ activeScenario, baselineName, diffCount, eventCount, isDirty, range, savedCount, currency }) {
  const activeLabel = activeScenario?.name || "Scratchpad";
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Scenario workspace</div>
          <div className="mt-1 text-xs text-slate-500">Use this when the plan needs dated changes, a saved branch, or a stress-tested range.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={isDirty ? "secondary" : "outline"}>{isDirty ? "Unsaved changes" : activeLabel}</Badge>
          <Badge variant="outline">Baseline {baselineName}</Badge>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <ScenarioSummaryMetric label="Dated events" value={eventCount} note="Timeline drivers" />
        <ScenarioSummaryMetric label="Baseline changes" value={diffCount} note="Inputs changed" />
        <ScenarioSummaryMetric label="Saved versions" value={savedCount} note="Branches available" />
        <ScenarioSummaryMetric label="Cash-flow band" value={`${currency(range.downsideCashFlow)} to ${currency(range.upsideCashFlow)}`} note="12-mo range" tone={range.baseCashFlow >= 0 ? "positive" : "negative"} />
      </div>
    </div>
  );
}

function ScenarioSummaryMetric({ label, note, tone = "neutral", value }) {
  const valueClass = tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-rose-700" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-base font-semibold ${valueClass}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{note}</div>
    </div>
  );
}

function PlanningDrilldown({ children, defaultOpen = false, meta, title }) {
  return (
    <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-none" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900">
        <span>{title}</span>
        <Badge variant="outline">{meta}</Badge>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
