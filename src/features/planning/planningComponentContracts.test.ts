import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("capital planning wrapper forwards project edit handler to every project edit surface", () => {
  const source = readFileSync(new URL("./PlanningForecastCapitalTabs.jsx", import.meta.url), "utf8");

  assert.match(
    source,
    /<PlanningCapitalTargetsPanel[\s\S]*?onEditProject=\{onProjectEdit\}/,
    "capital target Edit project buttons should use the workspace project edit handler",
  );
  assert.match(
    source,
    /<PlanningManualCapitalProjectsPanel[\s\S]*?onEditProject=\{onProjectEdit\}/,
    "manual project Edit buttons should use the workspace project edit handler",
  );
  assert.doesNotMatch(source, /onEditProject=\{onEditProject\}/);
});

test("planning workspace can edit manual targets that are linked to an asset", () => {
  const source = readFileSync(new URL("./PlanningWorkspace.jsx", import.meta.url), "utf8");

  assert.match(
    source,
    /item\.linkedAssetId\s*&&\s*\(item\.linkedAssetId === target\.assetId \|\| item\.linkedAssetId === target\.linkedAssetId\)/,
    "manual project target editing should resolve by project id or linked asset id",
  );
});

test("overview add-task action opens the action plan after creating a task", () => {
  const source = readFileSync(new URL("./PlanningOverviewTab.jsx", import.meta.url), "utf8");

  assert.match(
    source,
    /onMoveAdded\?\.\(\);\s*onOpenSubtab\("actions"\);/,
    "Overview Add task should route to the Action plan so the new task is visible",
  );
});

test("app workspace props forward planning action creation into PlanningWorkspace", () => {
  const source = readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");

  assert.match(
    source,
    /planningActionItems,\s*addPlanningActionItem,\s*planningActiveScenario,/,
    "PlanningWorkspace needs addPlanningActionItem so Overview and Action Plan Add buttons can create tasks",
  );
});

test("action plan tab shows saved action items before recommendation cards", () => {
  const source = readFileSync(new URL("./PlanningActionsTab.jsx", import.meta.url), "utf8");

  assert.ok(
    source.indexOf(">Action plan<") > -1 &&
      source.indexOf(">Recommended actions<") > source.indexOf(">Action plan<"),
    "Action plan list should appear before recommendation buttons that add to it",
  );
});

test("recommended move rows keep apply add-task and expand controls wired", () => {
  const source = readFileSync(new URL("./PlanningSharedPanels.jsx", import.meta.url), "utf8");

  assert.match(source, /onClick=\{\(\) => onApplyMove\(item\)\}/, "Apply move buttons should call the provided move handler");
  assert.match(source, /onClick=\{\(\) => onAddMove\(item\)\}/, "Add task buttons should create an action-plan task");
  assert.match(source, /Add task/, "Recommendation rows should distinguish adding a task from applying a move");
  assert.match(source, /aria-expanded=\{expanded\}/, "Move detail chevrons should expose expandable state");
});

test("rent planning labels owner-occupied target rent as hypothetical", () => {
  const source = readFileSync(new URL("./PlanningRentTab.jsx", import.meta.url), "utf8");

  assert.match(source, /Owner-occupied hypothetical/, "Owner-occupied rent upside should be explicitly labeled");
  assert.match(source, /Not in the current rent roll unless converted to a rental or scenario override/, "Owner-occupied upside should not read as live rent-roll upside");
  assert.match(source, /row\.nextTurnoverDate === "2026-08-09"/, "Unit 616 lease end milestone should remain prominent and dated");
});

test("planning surfaces use shared unit labels and signed rent wording", () => {
  const domainSource = readFileSync(new URL("../../domain/planning.ts", import.meta.url), "utf8");
  const overviewSource = readFileSync(new URL("./PlanningOverviewTab.jsx", import.meta.url), "utf8");
  const sharedSource = readFileSync(new URL("./PlanningSharedPanels.jsx", import.meta.url), "utf8");
  const rentSource = readFileSync(new URL("./PlanningRentTab.jsx", import.meta.url), "utf8");

  assert.match(domainSource, /formatUnitLabel\(lease\.unit\)/, "Planning milestones should not prepend Unit manually");
  assert.match(domainSource, /Prepare for \$\{formatUnitLabel\(turnoverCandidate\.unit\)\} turnover/, "Turnover recommendations should use stable-plan wording and clean unit labels");
  assert.match(overviewSource, /Signed rent roll now/, "Overview should distinguish signed rent from modeled rent");
  assert.match(overviewSource, /Change vs current:/, "Current vs planned delta should be explicitly labeled");
  assert.match(sharedSource, /Signed current rent roll/, "Detailed metrics should distinguish signed current rent");
  assert.match(rentSource, /formatUnitLabel\(row\.unit\)/, "Rent tab unit labels should use the shared formatter");
});

test("planning recommendation task creation is idempotent by source key", () => {
  const controllerSource = readFileSync(new URL("../../app/usePlanningWorkspaceController.js", import.meta.url), "utf8");
  const overviewSource = readFileSync(new URL("./PlanningOverviewTab.jsx", import.meta.url), "utf8");

  assert.match(overviewSource, /sourceKey: item\.id \? `recommended-move:\$\{item\.id\}` : ""/, "Recommended move tasks should carry a stable source key");
  assert.match(controllerSource, /item\.sourceKey === sourceKey/, "Adding the same recommendation task twice should reuse the existing action item");
});

test("forecast tab summarizes rows while preserving the monthly table", () => {
  const source = readFileSync(new URL("./PlanningForecastPanels.jsx", import.meta.url), "utf8");

  assert.match(source, /Worst month/, "Forecast summary should include the worst month");
  assert.match(source, /Avg monthly cash flow/, "Forecast summary should include average monthly cash flow");
  assert.match(source, /<th className="sticky left-0 bg-slate-50 px-2 py-1 text-left">Month<\/th>/, "Forecast table should keep the month column readable while scrolling");
  assert.match(source, /<th className="px-2 py-1 text-right">Cash flow<\/th>/, "Forecast table should preserve the cash-flow column");
});

test("planning tools lead with summaries and hide deep diagnostics", () => {
  const workspaceSource = readFileSync(new URL("./PlanningWorkspace.jsx", import.meta.url), "utf8");
  const scenariosSource = readFileSync(new URL("./PlanningScenariosTab.jsx", import.meta.url), "utf8");
  const insightsSource = readFileSync(new URL("./PlanningInsightsTab.jsx", import.meta.url), "utf8");
  const exitSource = readFileSync(new URL("./PlanningExitTab.jsx", import.meta.url), "utf8");

  assert.match(workspaceSource, /Planning tools/, "Planning tool destinations should read as optional tools");
  assert.match(scenariosSource, /ScenarioCommandSummary/, "Scenarios should start with a concise command summary");
  assert.match(scenariosSource, /Assumption audit and charts/, "Dense scenario audit material should live in a drill-down");
  assert.match(insightsSource, /PlanningInsightsBrief/, "Insights should start with a concise readout");
  assert.match(insightsSource, /Unit and decision diagnostics/, "Detailed unit math should be grouped behind diagnostics");
  assert.match(exitSource, /ExitDecisionSummary/, "Exit should start with a decision summary");
  assert.match(exitSource, /Debt and financing details/, "Debt payoff and financing math should be grouped behind a drill-down");
});

test("planning empty states use calm maintenance language", () => {
  const sharedSource = readFileSync(new URL("./PlanningSharedPanels.jsx", import.meta.url), "utf8");
  const actionsSource = readFileSync(new URL("./PlanningActionsTab.jsx", import.meta.url), "utf8");
  const insightsSource = readFileSync(new URL("./PlanningInsightsPanels.jsx", import.meta.url), "utf8");
  const forecastSource = readFileSync(new URL("./PlanningForecastPanels.jsx", import.meta.url), "utf8");
  const eventsSource = readFileSync(new URL("./ScenarioEvents.jsx", import.meta.url), "utf8");
  const savedSource = readFileSync(new URL("./ScenarioSaved.jsx", import.meta.url), "utf8");

  assert.match(sharedSource, /No urgent moves right now/, "Recommended moves empty state should not sound alarmed");
  assert.match(sharedSource, /Planning review is clear/, "Review inbox empty state should read as clear");
  assert.match(actionsSource, /No planning tasks yet/, "Action plan empty state should explain the routine next step");
  assert.match(insightsSource, /Triggers are quiet/, "Trigger empty state should read as stable");
  assert.match(forecastSource, /No tracked lease or forecast changes/, "Forecast empty state should read as informational");
  assert.match(eventsSource, /No dated scenario events yet/, "Scenario event empty state should guide the next useful action");
  assert.match(savedSource, /Save a branch once this working plan becomes a version/, "Saved scenarios empty state should explain when to save");
});
