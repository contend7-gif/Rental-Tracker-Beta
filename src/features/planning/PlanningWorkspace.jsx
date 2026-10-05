import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileText, MoreHorizontal, RotateCcw, GitBranch, Lightbulb, Landmark } from "lucide-react";
import { PlanningActionsTab } from "./PlanningActionsTab.jsx";
import { PlanningExitTab } from "./PlanningExitTab.jsx";
import { PlanningForecastCapitalTabs } from "./PlanningForecastCapitalTabs.jsx";
import { PlanningInsightsTab } from "./PlanningInsightsTab.jsx";
import { PlanningOverviewTab } from "./PlanningOverviewTab.jsx";
import { PlanningRentTab } from "./PlanningRentTab.jsx";
import { PlanningScenariosTab } from "./PlanningScenariosTab.jsx";
import { PlanningView, PlanningHorizonControl } from "./PlanningView.jsx";
import { normalizePlanningScenarioEvents } from "./planningState.js";
import { ResponsiveTableFrame } from "../shared/uiHelpers.jsx";
import { selectableProperties } from "../../domain/propertyLifecycle.js";
import { formatUnitLabel } from "../../domain/unitLabels.js";

const PRIMARY_PLANNING_TABS = [
  { key: "overview", label: "Overview" },
  { key: "actions", label: "Action plan" },
  { key: "rent", label: "Rent" },
  { key: "forecast", label: "Forecast" },
  { key: "capital", label: "Capital" },
];

const PLANNING_TOOL_TABS = [
  { key: "scenarios", label: "Scenarios", detail: "Dated changes and saved branches.", icon: GitBranch, tone: "border-purple-200 bg-purple-50 text-purple-700" },
  { key: "insights", label: "Insights", detail: "Guardrails, tax read, and unit economics.", icon: Lightbulb, tone: "border-amber-200 bg-amber-50 text-amber-700" },
  { key: "exit", label: "Exit / refinance", detail: "Hold, refi, sell, and payoff math.", icon: Landmark, tone: "border-sky-200 bg-sky-50 text-sky-700" },
];

export function PlanningWorkspace({
  addPlanningActionFromCapitalTarget,
  addPlanningActionItem,
  applyPlanningPreset,
  applyPlanningRecommendedMove,
  applyPlanningScenarioTemplate,
  buildChartPointX,
  buildChartPolyline,
  clearPlanningScenarioSelection,
  clonePlanningScenario,
  copyPlanningMemo,
  currency,
  deletePlanningActionItem,
  deletePlanningManualProject,
  deletePlanningScenario,
  deletePlanningScenarioEvent,
  editPlanningManualProject,
  editPlanningScenarioEvent,
  exportPlanningMemoPdf,
  exportPlanningMemoText,
  exportPlanningReport,
  formatDateTime,
  formatPropertyLabel,
  getPlanningRentStrategy,
  getPlanningTurnoverInput,
  getPlanningUnitOverride,
  loadPlanningScenario,
  openPlanningReviewInboxItem,
  planningActionItems,
  planningActiveScenario,
  planningAssumptionAuditRows,
  planningAssumptions,
  planningBaselineScenario,
  planningBaselineScenarioId,
  planningCapitalChartData,
  planningCapitalMonthlyTarget,
  planningCapitalRunway,
  planningCapitalTargetSections,
  planningCapitalTargetsMerged,
  planningCapitalTimeline,
  planningDecisionComparison,
  planningDecisionDashboard,
  planningDebtPayoff,
  planningDebtPayoffPlan,
  planningEventDraft,
  planningEventPropertyId,
  planningEventUnitOptions,
  planningExcludedBuildingAssetCount,
  planningExitAnalysis,
  planningExitPlan,
  planningFinancingComparison,
  planningForecastOptions,
  planningGoalStatus,
  planningGoals,
  planningHorizonDisplayMetrics,
  planningHorizonMonths,
  planningHorizonShortLabel,
  planningManualProjects,
  planningMemoText,
  planningMustFundWarnings,
  planningNearTermCapitalCost,
  planningNearTermCapitalTargets,
  planningNearTermReserveTarget,
  planningNextCapitalTarget,
  planningOutcomeHighlights,
  planningOverviewJumpCards,
  planningProjectDraft,
  planningProjectLinkedAssetOptions,
  planningProjectPropertyId,
  planningProjectUnitOptions,
  planningPropertySnapshots,
  planningRecommendations,
  planningRecommendedMoves,
  planningRentStrategy,
  planningReserveGap,
  planningReserveSummary,
  planningReviewInbox,
  planningRows,
  planningSavedScenarios,
  planningScenarioChartData,
  planningScenarioComparisons,
  planningScenarioComparisonsExtended,
  planningScenarioDiffRows,
  planningScenarioEvents,
  planningScenarioIsDirty,
  planningScenarioNameDraft,
  planningScenarioNotesDraft,
  planningScenarioRange,
  planningScenarioTimelineRows,
  planningScenarioTimelineVisual,
  planningScopeLabel,
  planningScopeUnits,
  planningSensitivityRows,
  planningSubtab,
  planningSubtabGuide,
  planningSummary,
  planningTaxProjection,
  planningTriggers,
  planningTriggerAlerts,
  planningTurnoverPlanner,
  planningUnitEconomicsRows,
  planningUnitFilterIgnored,
  planningUpcomingChanges,
  printPlanningMemo,
  properties,
  propertyFilter,
  renderField,
  resetPlanningEventDraft,
  resetPlanningProjectDraft,
  resetPlanningWorkspace,
  savePlanningManualProject,
  savePlanningManualProjectFromTarget,
  savePlanningScenarioAsNew,
  savePlanningScenarioBranch,
  savePlanningScenarioEvent,
  setNotice,
  setPlanningAssumptions,
  setPlanningBaselineScenarioId,
  setPlanningDebtPayoffPlan,
  setPlanningEventDraft,
  setPlanningExitPlan,
  setPlanningForecastOptions,
  setPlanningGoals,
  setPlanningProjectDraft,
  setPlanningRentStrategy,
  setPlanningScenarioNameDraft,
  setPlanningScenarioNotesDraft,
  setPlanningSubtab,
  setPlanningTriggers,
  setPlanningTurnoverInput,
  setPlanningUnitOverride,
  toPctDisplay,
  todayIso,
  updatePlanningActionItem,
  updatePlanningScenario,
  workspaceMutedPanelClass,
  workspaceStatTileClass,
}) {
  const activeToolTab = PLANNING_TOOL_TABS.find((tab) => tab.key === planningSubtab);
  const setPrimaryPlanningTab = (value) => {
    if (value) setPlanningSubtab(value);
  };

  return (
    <PlanningView
      assumptions={planningAssumptions}
      onAssumptionsChange={setPlanningAssumptions}
      scopeLabel={planningScopeLabel}
    >
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-base font-semibold text-slate-900">Working plan</div>
            <Badge variant="secondary">{planningScopeLabel}</Badge>
            <Badge variant="outline">Starts {todayIso}</Badge>
          </div>
          <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
            <PlanningHorizonControl assumptions={planningAssumptions} onAssumptionsChange={setPlanningAssumptions} />
            <Button size="sm" variant="secondary" className="gap-2" onClick={copyPlanningMemo}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              Copy memo
            </Button>
            <Button size="sm" variant="secondary" className="gap-2" onClick={exportPlanningReport}>
              <Download className="h-4 w-4" aria-hidden="true" />
              CSV
            </Button>
            <Button size="sm" variant="secondary" className="gap-2" onClick={resetPlanningWorkspace}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reset
            </Button>
            <details className="relative">
              <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-none transition hover:bg-slate-50">
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                More
              </summary>
              <div className="absolute right-0 z-20 mt-2 grid w-48 gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                <Button size="sm" variant="ghost" className="justify-start" onClick={exportPlanningMemoText}>Export memo TXT</Button>
                <Button size="sm" variant="ghost" className="justify-start" onClick={exportPlanningMemoPdf}>Memo PDF</Button>
                <Button size="sm" variant="ghost" className="justify-start" onClick={printPlanningMemo}>Print memo</Button>
              </div>
            </details>
          </div>
        </div>
        {planningUnitFilterIgnored && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Planning is property and portfolio level for now, so the current unit filter is ignored in this workspace.
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/80 p-1.5">
          <Tabs value={activeToolTab ? "" : planningSubtab} onValueChange={setPrimaryPlanningTab}>
            <TabsList className="h-auto flex-wrap justify-start !border-0 !bg-transparent !p-0">
              {PRIMARY_PLANNING_TABS.map((tab) => (
                <TabsTrigger key={`planning-primary-${tab.key}`} value={tab.key} className={planningSubtab === tab.key ? "!rounded-md !bg-teal-700 !px-3 !py-2 !text-white" : "!rounded-md !px-3 !py-2"}>{tab.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Planning tools">
            {PLANNING_TOOL_TABS.map((tab) => {
              const Icon = tab.icon;
              const selected = planningSubtab === tab.key;
              return <button key={tab.key} type="button" aria-pressed={selected} title={tab.detail}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs font-semibold transition focus-visible:outline-teal-600 ${selected ? "border-teal-700 bg-teal-700 text-white" : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-teal-800"}`}
                onClick={() => setPlanningSubtab(tab.key)}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />{tab.label}
              </button>;
            })}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 py-1">
          <p className="text-xs text-slate-500"><span className="font-semibold text-slate-700">{planningSubtabGuide.title}</span> · {planningSubtabGuide.detail}</p>
          <Badge variant="outline">{planningSubtabGuide.badge}</Badge>
        </div>
        {planningSubtab === "scenarios" && (
          <PlanningScenariosTab
            activeScenario={planningActiveScenario}
            assumptions={planningAssumptions}
            assumptionAuditRows={planningAssumptionAuditRows}
            baselineScenario={planningBaselineScenario}
            baselineScenarioId={planningBaselineScenarioId}
            buildChartPointX={buildChartPointX}
            chartData={planningScenarioChartData}
            comparisons={planningScenarioComparisonsExtended}
            countScenarioEvents={(events) => normalizePlanningScenarioEvents(events).length}
            currency={currency}
            decisionDashboard={planningDecisionDashboard}
            diffRows={planningScenarioDiffRows}
            eventDraft={planningEventDraft}
            eventPropertyId={planningEventPropertyId}
            eventUnitOptions={planningEventUnitOptions}
            events={planningScenarioEvents}
            formatDateTime={formatDateTime}
            formatPropertyLabel={formatPropertyLabel}
            getUnitOverride={getPlanningUnitOverride}
            horizonMonths={planningHorizonMonths}
            isDirty={planningScenarioIsDirty}
            nameDraft={planningScenarioNameDraft}
            notesDraft={planningScenarioNotesDraft}
            onApplyPreset={applyPlanningPreset}
            onApplyTemplate={applyPlanningScenarioTemplate}
            onAssumptionsChange={setPlanningAssumptions}
            onClearSelection={clearPlanningScenarioSelection}
            onClone={clonePlanningScenario}
            onDelete={deletePlanningScenario}
            onDeleteEvent={deletePlanningScenarioEvent}
            onEditEvent={editPlanningScenarioEvent}
            onEventDraftChange={setPlanningEventDraft}
            onLoad={loadPlanningScenario}
            onNameDraftChange={setPlanningScenarioNameDraft}
            onNotesDraftChange={setPlanningScenarioNotesDraft}
            onResetEventDraft={resetPlanningEventDraft}
            onSaveAsNew={savePlanningScenarioAsNew}
            onSaveBranch={savePlanningScenarioBranch}
            onSaveEvent={savePlanningScenarioEvent}
            onSetBaseline={setPlanningBaselineScenarioId}
            onSetUnitOverride={setPlanningUnitOverride}
            onUpdateSelected={updatePlanningScenario}
            properties={selectableProperties(properties, planningProjectPropertyId)}
            range={planningScenarioRange}
            renderField={renderField}
            savedScenarios={planningSavedScenarios}
            sensitivityRows={planningSensitivityRows}
            TableFrame={ResponsiveTableFrame}
            units={planningScopeUnits}
            timelineRows={planningScenarioTimelineRows}
            timelineVisual={planningScenarioTimelineVisual}
          />
        )}
        {planningSubtab === "rent" && (
          <PlanningRentTab
            rentStrategy={planningRentStrategy}
            turnoverPlanner={planningTurnoverPlanner}
            getRentStrategy={getPlanningRentStrategy}
            getTurnoverInput={getPlanningTurnoverInput}
            onApplyTargetRent={(row) => {
              setPlanningUnitOverride(row.propertyId, row.unit, {
                mode: "rented",
                monthlyRent: String(row.targetRent || row.marketRent || row.currentRent || ""),
              });
              setNotice(`Applied target rent for ${formatUnitLabel(row.unit)} to the planning override.`);
            }}
            onUpdateRentStrategy={setPlanningRentStrategy}
            onUpdateTurnoverInput={setPlanningTurnoverInput}
            renderField={renderField}
            currency={currency}
            toPctDisplay={toPctDisplay}
          />
        )}
      </div>

      {planningSubtab === "overview" && (
        <PlanningOverviewTab
          currency={currency}
          dashboard={planningDecisionDashboard}
          horizonMetrics={planningHorizonDisplayMetrics}
          horizonMonths={planningHorizonMonths}
          horizonShortLabel={planningHorizonShortLabel}
          jumpCards={planningOverviewJumpCards}
          monthlyCapexReserve={planningAssumptions.monthlyCapexReserve}
          onAddActionItem={addPlanningActionItem}
          onApplyMove={applyPlanningRecommendedMove}
          onMoveAdded={() => setNotice("Recommended move added to the action plan.")}
          onOpenSubtab={setPlanningSubtab}
          planningRows={planningRows}
          propertyFilter={propertyFilter}
          recommendedMoves={planningRecommendedMoves}
          statTileClass={workspaceStatTileClass}
          summary={planningSummary}
          toPctDisplay={toPctDisplay}
        />
      )}

      {planningSubtab === "actions" && (
        <PlanningActionsTab
          actionItems={planningActionItems}
          memoText={planningMemoText}
          onAddActionItem={addPlanningActionItem}
          onDeleteActionItem={deletePlanningActionItem}
          onOpenReviewItem={openPlanningReviewInboxItem}
          onRecommendationAdded={() => setNotice("Recommendation added to the action plan.")}
          onUpdateActionItem={updatePlanningActionItem}
          propertyFilter={propertyFilter}
          recommendations={planningRecommendations}
          renderField={renderField}
          reviewItems={planningReviewInbox}
        />
      )}

      {planningSubtab === "insights" && (
        <PlanningInsightsTab
          currency={currency}
          decisionComparison={planningDecisionComparison}
          exitAnalysis={planningExitAnalysis}
          formatPropertyLabel={formatPropertyLabel}
          goals={planningGoals}
          goalStatus={planningGoalStatus}
          horizonDisplayMetrics={planningHorizonDisplayMetrics}
          horizonMonths={planningHorizonMonths}
          onApplyPreset={applyPlanningPreset}
          onGoalsChange={setPlanningGoals}
          onTriggersChange={setPlanningTriggers}
          outcomeHighlights={planningOutcomeHighlights}
          renderField={renderField}
          scenarioComparisons={planningScenarioComparisons}
          scopeLabel={planningScopeLabel}
          taxProjection={planningTaxProjection}
          triggerAlerts={planningTriggerAlerts}
          triggers={planningTriggers}
          unitEconomicsRows={planningUnitEconomicsRows}
        />
      )}

      {planningSubtab === "exit" && (
        <PlanningExitTab
          currency={currency}
          debtPayoff={planningDebtPayoff}
          debtPayoffPlan={planningDebtPayoffPlan}
          exitAnalysis={planningExitAnalysis}
          exitPlan={planningExitPlan}
          financingComparison={planningFinancingComparison}
          onDebtPayoffPlanChange={setPlanningDebtPayoffPlan}
          onExitPlanChange={setPlanningExitPlan}
          renderField={renderField}
        />
      )}

      {(planningSubtab === "forecast" || planningSubtab === "capital") && (
        <PlanningForecastCapitalTabs
          assumptions={planningAssumptions}
          buildChartPointX={buildChartPointX}
          buildChartPolyline={buildChartPolyline}
          capitalChartData={planningCapitalChartData}
          capitalMonthlyTarget={planningCapitalMonthlyTarget}
          capitalRunway={planningCapitalRunway}
          capitalTargetSections={planningCapitalTargetSections}
          capitalTargets={planningCapitalTargetsMerged}
          capitalTimeline={planningCapitalTimeline}
          currency={currency}
          excludedBuildingAssetCount={planningExcludedBuildingAssetCount}
          formatPropertyLabel={formatPropertyLabel}
          forecastOptions={planningForecastOptions}
          horizonMonths={planningHorizonMonths}
          manualProjects={planningManualProjects}
          mustFundWarnings={planningMustFundWarnings}
          mutedPanelClass={workspaceMutedPanelClass}
          nearTermCost={planningNearTermCapitalCost}
          nearTermReserveTarget={planningNearTermReserveTarget}
          nearTermTargets={planningNearTermCapitalTargets}
          nextTarget={planningNextCapitalTarget}
          onAddActionFromCapitalTarget={addPlanningActionFromCapitalTarget}
          onCreateProjectFromTarget={savePlanningManualProjectFromTarget}
          onDeleteProject={deletePlanningManualProject}
          onForecastOptionsChange={setPlanningForecastOptions}
          onOpenSubtab={setPlanningSubtab}
          onProjectDraftChange={setPlanningProjectDraft}
          onProjectEdit={(target) => {
            const project = planningManualProjects.find((item) =>
              item.id === target.assetId ||
              item.id === target.linkedAssetId ||
              (item.linkedAssetId && (item.linkedAssetId === target.assetId || item.linkedAssetId === target.linkedAssetId)),
            );
            if (project) editPlanningManualProject(project);
          }}
          onProjectToAction={(project) => {
            addPlanningActionItem({
              title: project.title,
              priority: project.priority || "medium",
              dueDate: project.mustFundBy || project.targetDate,
              notes: project.notes || "",
              propertyId: project.propertyId,
              unit: project.unit,
              sourceType: "project",
            });
            setNotice("Project added to the action plan.");
          }}
          onResetProjectDraft={resetPlanningProjectDraft}
          onSaveProject={savePlanningManualProject}
          projectDraft={planningProjectDraft}
          projectLinkedAssetOptions={planningProjectLinkedAssetOptions}
          projectPropertyId={planningProjectPropertyId}
          projectUnitOptions={planningProjectUnitOptions}
          properties={selectableProperties(properties, planningEventPropertyId)}
          propertyFilter={propertyFilter}
          reserveGap={planningReserveGap}
          reserveSummary={planningReserveSummary}
          renderField={renderField}
          rows={planningRows}
          scope={planningSubtab}
          snapshots={planningPropertySnapshots}
          TableFrame={ResponsiveTableFrame}
          toPctDisplay={toPctDisplay}
          upcomingChanges={planningUpcomingChanges}
        />
      )}
    </PlanningView>
  );
}
