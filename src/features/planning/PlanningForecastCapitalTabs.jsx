import React from "react";

import {
  PlanningCapitalReservePanel,
  PlanningCapitalTargetsPanel,
  PlanningManualCapitalProjectsPanel,
} from "./PlanningCapitalPanels.jsx";
import { PlanningCapitalRunwayPanel } from "./PlanningCapitalRunwayPanel.jsx";
import {
  PlanningForecastMonthlyOutlook,
  PlanningForecastPortfolioSnapshotPanel,
  PlanningForecastSetupPanel,
  PlanningUpcomingChangesPanel,
} from "./PlanningForecastPanels.jsx";

export function PlanningForecastCapitalTabs({
  assumptions,
  buildChartPointX,
  buildChartPolyline,
  capitalChartData,
  capitalMonthlyTarget,
  capitalRunway,
  capitalTargetSections,
  capitalTargets,
  capitalTimeline,
  currency,
  excludedBuildingAssetCount,
  formatPropertyLabel,
  forecastOptions,
  horizonMonths,
  manualProjects,
  mustFundWarnings,
  mutedPanelClass,
  nearTermCost,
  nearTermReserveTarget,
  nearTermTargets,
  nextTarget,
  onAddActionFromCapitalTarget,
  onCreateProjectFromTarget,
  onDeleteProject,
  onForecastOptionsChange,
  onOpenSubtab,
  onProjectDraftChange,
  onProjectEdit,
  onProjectToAction,
  onResetProjectDraft,
  onSaveProject,
  projectDraft,
  projectLinkedAssetOptions,
  projectPropertyId,
  projectUnitOptions,
  properties,
  propertyFilter,
  reserveGap,
  reserveSummary,
  renderField,
  rows,
  scope,
  snapshots,
  TableFrame,
  toPctDisplay,
  upcomingChanges,
}) {
  return (
    <div className={`grid gap-3 ${scope === "forecast" ? "xl:grid-cols-[1.25fr,0.75fr]" : "xl:grid-cols-1"}`}>
      {scope === "forecast" && (
        <PlanningForecastMonthlyOutlook
          rows={rows}
          TableFrame={TableFrame}
          mutedPanelClass={mutedPanelClass}
          currency={currency}
        />
      )}

      <div className="space-y-3">
        {scope === "forecast" && (
          <PlanningForecastSetupPanel
            forecastOptions={forecastOptions}
            onForecastOptionsChange={onForecastOptionsChange}
            onOpenSubtab={onOpenSubtab}
            renderField={renderField}
          />
        )}

        {scope === "forecast" && (
          <PlanningForecastPortfolioSnapshotPanel
            snapshots={snapshots}
            TableFrame={TableFrame}
            mutedPanelClass={mutedPanelClass}
            currency={currency}
            toPctDisplay={toPctDisplay}
          />
        )}

        {scope === "forecast" && <PlanningUpcomingChangesPanel changes={upcomingChanges} />}

        {scope === "capital" && (
          <PlanningCapitalReservePanel
            reserveSummary={reserveSummary}
            assumptions={assumptions}
            nearTermTargets={nearTermTargets}
            nearTermCost={nearTermCost}
            nearTermReserveTarget={nearTermReserveTarget}
            capitalMonthlyTarget={capitalMonthlyTarget}
            reserveGap={reserveGap}
            mustFundWarnings={mustFundWarnings}
            currency={currency}
          />
        )}

        {scope === "capital" && (
          <PlanningCapitalTargetsPanel
            targets={capitalTargets}
            excludedBuildingAssetCount={excludedBuildingAssetCount}
            nextTarget={nextTarget}
            targetSections={capitalTargetSections}
            onAddAction={onAddActionFromCapitalTarget}
            onCreateProject={onCreateProjectFromTarget}
            onEditProject={onProjectEdit}
            currency={currency}
          />
        )}

        {scope === "capital" && (
          <PlanningCapitalRunwayPanel
            buildChartPointX={buildChartPointX}
            buildChartPolyline={buildChartPolyline}
            chartData={capitalChartData}
            currency={currency}
            horizonMonths={horizonMonths}
            monthlyReserve={assumptions.monthlyCapexReserve}
            mutedPanelClass={mutedPanelClass}
            runway={capitalRunway}
            TableFrame={TableFrame}
            timeline={capitalTimeline}
          />
        )}

        {scope === "capital" && (
          <PlanningManualCapitalProjectsPanel
            projects={manualProjects}
            projectPropertyId={projectPropertyId}
            projectDraft={projectDraft}
            projectUnitOptions={projectUnitOptions}
            projectLinkedAssetOptions={projectLinkedAssetOptions}
            properties={properties}
            propertyFilter={propertyFilter}
            renderField={renderField}
            formatPropertyLabel={formatPropertyLabel}
            onProjectDraftChange={onProjectDraftChange}
            onSaveProject={onSaveProject}
            onResetProjectDraft={onResetProjectDraft}
            onAddProjectAction={onProjectToAction}
            onEditProject={onProjectEdit}
            onDeleteProject={onDeleteProject}
            currency={currency}
          />
        )}
      </div>
    </div>
  );
}
