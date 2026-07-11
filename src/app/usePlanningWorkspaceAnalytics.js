import { useMemo } from "react";
import {
  buildChartAxisY,
  buildChartPolyline,
  formatStatementMonthLabel,
} from "../lib/appSupport.ts";
import {
  buildPlanningProjection,
  buildPlanningScenarioDiff,
  buildPlanningScenarioRange,
  buildPlanningSensitivity,
} from "../domain/planning.ts";
import { monthKey } from "./dateHelpers.js";
import {
  getPlanningPresetValues,
  normalizePlanningAssumptions,
  normalizePlanningDebtPayoffPlan,
  normalizePlanningForecastOptions,
  normalizePlanningGoals,
  normalizePlanningRentStrategies,
  normalizePlanningScenarioEvents,
  normalizePlanningScenarioOverrides,
  normalizePlanningTurnoverInputs,
} from "../features/planning/planningState.js";
import { formatUnitLabel } from "../domain/unitLabels.js";

function toProjectionAssumptions(assumptions) {
  return {
    horizonMonths: Number(assumptions?.horizonMonths || 24),
    annualRentGrowthPct: Number(assumptions?.annualRentGrowthPct || 0) / 100,
    annualExpenseGrowthPct: Number(assumptions?.annualExpenseGrowthPct || 0) / 100,
    annualValueGrowthPct: Number(assumptions?.annualValueGrowthPct || 0) / 100,
    vacancyRatePct: Number(assumptions?.vacancyRatePct || 0) / 100,
    monthlyCapexReserve: Number(assumptions?.monthlyCapexReserve || 0),
    includedUtilitiesMonthly: Number(assumptions?.includedUtilitiesMonthly || 0),
  };
}

function toProjectionScenarioOverrides(overrides) {
  return normalizePlanningScenarioOverrides(overrides).map((override) => ({
    propertyId: override.propertyId,
    unit: override.unit,
    mode: override.mode,
    monthlyRent: Number(override.monthlyRent || 0),
  }));
}

function toProjectionScenarioEvents(events) {
  return normalizePlanningScenarioEvents(events).map((event) => ({
    id: event.id,
    propertyId: event.propertyId,
    unit: event.unit || "Shared",
    date: event.date,
    eventType: event.eventType,
    mode: event.mode,
    monthlyRent: Number(event.monthlyRent || 0),
    monthlyCapexReserve: Number(event.monthlyCapexReserve || 0),
    notes: event.notes || "",
  }));
}

function toProjectionRentStrategies(strategies) {
  return normalizePlanningRentStrategies(strategies).map((strategy) => ({
    propertyId: strategy.propertyId,
    unit: strategy.unit,
    marketRent: Number(strategy.marketRent || 0),
    targetRent: Number(strategy.targetRent || 0),
    renewalStart: strategy.renewalStart || "",
    renewalTermMonths: Number(strategy.renewalTermMonths || 12),
    notes: strategy.notes || "",
  }));
}

function toProjectionTurnoverInputs(turnoverInputs) {
  return normalizePlanningTurnoverInputs(turnoverInputs).map((plan) => ({
    propertyId: plan.propertyId,
    unit: plan.unit,
    makeReadyCost: Number(plan.makeReadyCost || 0),
    downtimeDays: Number(plan.downtimeDays || 0),
    leasingFeePct: Number(plan.leasingFeePct || 0),
    concessionWeeks: Number(plan.concessionWeeks || 0),
    notes: plan.notes || "",
  }));
}

function toProjectionForecastOptions(forecastOptions) {
  const normalized = normalizePlanningForecastOptions(forecastOptions);
  return {
    assumeRerentAfterTurnover: normalized.assumeRerentAfterTurnover,
    rerentRentSource: normalized.rerentRentSource,
    rerentTermMonths: Number(normalized.rerentTermMonths || 12),
  };
}

function buildScenarioProjection({
  scenario,
  todayIso,
  properties,
  activeTx,
  leases,
  loans,
  usePeriods,
  units,
}) {
  return buildPlanningProjection({
    today: todayIso,
    propertyId: scenario.propertyId === "all" ? undefined : scenario.propertyId,
    properties,
    transactions: activeTx,
    leases,
    loans,
    usePeriods,
    units,
    assumptions: toProjectionAssumptions(scenario.assumptions),
    scenarioOverrides: toProjectionScenarioOverrides(scenario.overrides),
    scenarioEvents: toProjectionScenarioEvents(scenario.events),
    rentStrategies: toProjectionRentStrategies(scenario.rentStrategies),
    turnoverInputs: toProjectionTurnoverInputs(scenario.turnoverInputs),
    forecastOptions: toProjectionForecastOptions(scenario.forecastOptions),
  });
}

export function usePlanningWorkspaceAnalytics({
  activeTx,
  currency,
  formatPropertyLabel,
  isPlanningActive,
  leases,
  loans,
  planningActiveScenario,
  planningAssumptions,
  planningBaselineScenario,
  planningCapitalTargetsMerged,
  planningCapitalTimeline,
  planningDataConfidence,
  planningDebtPayoffPlan,
  planningForecastOptionInputs,
  planningForecastOptions,
  planningGoals,
  planningHealthSummary,
  planningHorizonMonths,
  planningMilestones,
  planningProjection,
  planningRecommendedMoves,
  planningRentStrategies,
  planningRows,
  planningScenarioEvents,
  planningScenarioNotesDraft,
  planningScenarioOverrides,
  planningScopeLabel,
  planningSummary,
  planningTurnoverInputs,
  properties,
  propertyFilter,
  todayIso,
  units,
  usePeriods,
}) {
  const planningScenarioComparisons = useMemo(
    () => {
      if (!isPlanningActive) return [];
      return [
        { key: "conservative", label: "Conservative" },
        { key: "base", label: "Base" },
        { key: "growth", label: "Growth" },
      ].map((preset) => ({
        ...preset,
        projection: buildPlanningProjection({
          today: todayIso,
          propertyId: propertyFilter === "all" ? undefined : propertyFilter,
          properties,
          transactions: activeTx,
          leases,
          loans,
          usePeriods,
          units,
          assumptions: toProjectionAssumptions(getPlanningPresetValues(preset.key)),
          scenarioOverrides: [],
          scenarioEvents: [],
          rentStrategies: toProjectionRentStrategies(planningRentStrategies),
          turnoverInputs: toProjectionTurnoverInputs(planningTurnoverInputs),
          forecastOptions: planningForecastOptionInputs,
        }),
      }));
    },
    [todayIso, propertyFilter, properties, activeTx, leases, loans, usePeriods, units, planningRentStrategies, planningTurnoverInputs, planningForecastOptionInputs, isPlanningActive],
  );

  const planningSensitivityRows = useMemo(
    () => {
      if (!isPlanningActive) return [];
      return buildPlanningSensitivity({
        today: todayIso,
        propertyId: propertyFilter === "all" ? undefined : propertyFilter,
        properties,
        transactions: activeTx,
        leases,
        loans,
        usePeriods,
        units,
        assumptions: normalizePlanningAssumptions(planningAssumptions),
        scenarioOverrides: toProjectionScenarioOverrides(planningScenarioOverrides),
        scenarioEvents: toProjectionScenarioEvents(planningScenarioEvents),
        rentStrategies: toProjectionRentStrategies(planningRentStrategies),
        turnoverInputs: toProjectionTurnoverInputs(planningTurnoverInputs),
        forecastOptions: planningForecastOptionInputs,
      });
    },
    [
      todayIso,
      propertyFilter,
      properties,
      activeTx,
      leases,
      loans,
      usePeriods,
      units,
      planningAssumptions,
      planningScenarioOverrides,
      planningScenarioEvents,
      planningRentStrategies,
      planningTurnoverInputs,
      planningForecastOptionInputs,
      isPlanningActive,
    ],
  );

  const planningScenarioComparisonsExtended = useMemo(() => {
    if (!isPlanningActive) return [];
    const rows = [
      {
        key: "current",
        label: "Current workspace",
        scopeLabel: planningScopeLabel,
        projection: planningProjection,
        rows: planningRows,
        summary: planningSummary,
        assumptions: normalizePlanningAssumptions(planningAssumptions),
        notes: planningScenarioNotesDraft.trim(),
        events: normalizePlanningScenarioEvents(planningScenarioEvents),
        goals: normalizePlanningGoals(planningGoals),
        debtPayoffPlan: normalizePlanningDebtPayoffPlan(planningDebtPayoffPlan),
        forecastOptions: normalizePlanningForecastOptions(planningForecastOptions),
      },
    ];

    if (planningActiveScenario) {
      const scenarioProjection = buildScenarioProjection({
        scenario: planningActiveScenario,
        todayIso,
        properties,
        activeTx,
        leases,
        loans,
        usePeriods,
        units,
      });
      rows.push({
        key: "saved",
        label: planningActiveScenario.name,
        scopeLabel: formatPropertyLabel(planningActiveScenario.propertyId || "all"),
        projection: scenarioProjection,
        rows: scenarioProjection.rows,
        summary: scenarioProjection.summary,
        assumptions: planningActiveScenario.assumptions,
        notes: planningActiveScenario.notes || "",
        events: normalizePlanningScenarioEvents(planningActiveScenario.events),
        goals: normalizePlanningGoals(planningActiveScenario.goals),
        debtPayoffPlan: normalizePlanningDebtPayoffPlan(planningActiveScenario.debtPayoffPlan),
        forecastOptions: normalizePlanningForecastOptions(planningActiveScenario.forecastOptions),
      });
    }

    const baseAssumptions = getPlanningPresetValues("base");
    const baseProjection = buildPlanningProjection({
      today: todayIso,
      propertyId: propertyFilter === "all" ? undefined : propertyFilter,
      properties,
      transactions: activeTx,
      leases,
      loans,
      usePeriods,
      units,
      assumptions: toProjectionAssumptions(baseAssumptions),
      rentStrategies: toProjectionRentStrategies(planningRentStrategies),
      turnoverInputs: toProjectionTurnoverInputs(planningTurnoverInputs),
      forecastOptions: planningForecastOptionInputs,
    });
    rows.push({
      key: "base",
      label: "Base preset",
      scopeLabel: planningScopeLabel,
      projection: baseProjection,
      rows: baseProjection.rows,
      summary: baseProjection.summary,
      assumptions: baseAssumptions,
      notes: "",
      events: [],
      goals: normalizePlanningGoals({}),
      debtPayoffPlan: normalizePlanningDebtPayoffPlan({}),
      forecastOptions: normalizePlanningForecastOptions(planningForecastOptions),
    });

    return rows;
  }, [
    planningActiveScenario,
    planningScopeLabel,
    planningProjection,
    planningRows,
    planningSummary,
    planningAssumptions,
    planningScenarioNotesDraft,
    planningScenarioEvents,
    planningGoals,
    planningDebtPayoffPlan,
    planningForecastOptions,
    todayIso,
    propertyFilter,
    properties,
    activeTx,
    leases,
    loans,
    usePeriods,
    units,
    planningRentStrategies,
    planningTurnoverInputs,
    planningForecastOptionInputs,
    formatPropertyLabel,
    isPlanningActive,
  ]);

  const planningOutcomeHighlights = useMemo(() => {
    const scenarios = planningScenarioComparisonsExtended;
    if (!scenarios.length) return [];
    const bestCashFlow = scenarios.reduce((best, item) => (item.summary.firstYearCashFlow > best.summary.firstYearCashFlow ? item : best), scenarios[0]);
    const bestEquity = scenarios.reduce((best, item) => (item.summary.horizonEndingEquity > best.summary.horizonEndingEquity ? item : best), scenarios[0]);
    const lowestReserve = scenarios.reduce((best, item) => (Number(item.assumptions.monthlyCapexReserve || 0) < Number(best.assumptions.monthlyCapexReserve || 0) ? item : best), scenarios[0]);
    const highestNoi = scenarios.reduce((best, item) => (item.summary.firstYearNetOperatingIncome > best.summary.firstYearNetOperatingIncome ? item : best), scenarios[0]);
    return [
      { label: "Best cash flow", scenario: bestCashFlow.label, value: currency(bestCashFlow.summary.firstYearCashFlow), tone: bestCashFlow.summary.firstYearCashFlow >= 0 ? "positive" : "negative" },
      { label: "Best NOI", scenario: highestNoi.label, value: currency(highestNoi.summary.firstYearNetOperatingIncome), tone: "neutral" },
      { label: "Highest equity", scenario: bestEquity.label, value: currency(bestEquity.summary.horizonEndingEquity), tone: "neutral" },
      { label: "Leanest reserve", scenario: lowestReserve.label, value: currency(Number(lowestReserve.assumptions.monthlyCapexReserve || 0)), tone: "neutral" },
    ];
  }, [planningScenarioComparisonsExtended, currency]);

  const planningScenarioRange = useMemo(
    () => {
      if (!isPlanningActive) return [];
      return buildPlanningScenarioRange({
        scenarios: planningScenarioComparisons.map((scenario) => ({
          key: scenario.key,
          label: scenario.label,
          summary: scenario.projection.summary,
        })),
      });
    },
    [planningScenarioComparisons, isPlanningActive],
  );

  const planningScenarioDiffRows = useMemo(() => {
    if (!isPlanningActive) return [];
    const baselineAssumptions = planningBaselineScenario?.assumptions || getPlanningPresetValues("base");
    const baselineSummary = planningBaselineScenario
      ? buildScenarioProjection({
        scenario: planningBaselineScenario,
        todayIso,
        properties,
        activeTx,
        leases,
        loans,
        usePeriods,
        units,
      }).summary
      : planningScenarioComparisons.find((scenario) => scenario.key === "base")?.projection.summary || planningSummary;
    return buildPlanningScenarioDiff({
      baselineLabel: planningBaselineScenario?.name || "Base preset",
      scenarioLabel: planningActiveScenario?.name || "Current workspace",
      baseline: {
        assumptions: baselineAssumptions,
        summary: baselineSummary,
        overrides: planningBaselineScenario?.overrides || [],
        events: planningBaselineScenario?.events || [],
        goals: planningBaselineScenario?.goals || {},
        debtPayoffPlan: planningBaselineScenario?.debtPayoffPlan || {},
      },
      scenario: {
        assumptions: normalizePlanningAssumptions(planningAssumptions),
        summary: planningSummary,
        overrides: normalizePlanningScenarioOverrides(planningScenarioOverrides),
        events: normalizePlanningScenarioEvents(planningScenarioEvents),
        goals: normalizePlanningGoals(planningGoals),
        debtPayoffPlan: normalizePlanningDebtPayoffPlan(planningDebtPayoffPlan),
      },
    });
  }, [
    planningBaselineScenario,
    planningActiveScenario,
    planningAssumptions,
    planningSummary,
    planningScenarioOverrides,
    planningScenarioEvents,
    planningGoals,
    planningDebtPayoffPlan,
    planningScenarioComparisons,
    todayIso,
    properties,
    activeTx,
    leases,
    loans,
    usePeriods,
    units,
    isPlanningActive,
  ]);

  const planningScenarioTimelineRows = useMemo(() => {
    const compareRows = planningScenarioComparisonsExtended.slice(0, 3);
    if (!compareRows.length) return [];
    const monthKeys = Array.from(
      new Set(compareRows.flatMap((scenario) => (scenario.rows || []).slice(0, Math.min(planningHorizonMonths, 12)).map((row) => row.month))),
    ).sort();
    return monthKeys.map((month) => {
      const cells = compareRows.map((scenario) => {
        const row = (scenario.rows || []).find((item) => item.month === month);
        return {
          key: scenario.key,
          label: scenario.label,
          effectiveRent: Number(row?.effectiveRent || 0),
          cashFlow: Number(row?.cashFlow || 0),
          driverLabel: row?.driverLabel || "",
        };
      });
      const cashFlows = cells.map((cell) => cell.cashFlow);
      const maxCashFlow = Math.max(...cashFlows);
      const minCashFlow = Math.min(...cashFlows);
      return {
        month,
        deltaCashFlow: Math.round((maxCashFlow - minCashFlow) * 100) / 100,
        cells,
      };
    });
  }, [planningScenarioComparisonsExtended, planningHorizonMonths]);

  const planningScenarioChartData = useMemo(() => {
    const palette = ["#2563eb", "#059669", "#dc2626"];
    const scenarios = planningScenarioComparisonsExtended.slice(0, 3).map((scenario, index) => ({
      key: scenario.key,
      label: scenario.label,
      color: palette[index] || "#475569",
      rows: (scenario.rows || []).slice(0, Math.min(planningHorizonMonths, 12)),
    }));
    const metrics = [
      { key: "cashFlow", label: "Monthly cash flow", accessor: (row) => Number(row?.cashFlow || 0), format: currency },
      { key: "effectiveRent", label: "Effective rent", accessor: (row) => Number(row?.effectiveRent || 0), format: currency },
      { key: "equity", label: "Equity", accessor: (row) => Number(row?.projectedEquity || 0), format: currency },
    ];
    return metrics.map((metric) => {
      const allValues = scenarios.flatMap((scenario) => scenario.rows.map(metric.accessor));
      const min = allValues.length ? Math.min(...allValues) : 0;
      const max = allValues.length ? Math.max(...allValues) : 0;
      return {
        key: metric.key,
        label: metric.label,
        min,
        max,
        format: metric.format,
        axisY: buildChartAxisY(min, max),
        scenarios: scenarios.map((scenario) => {
          const values = scenario.rows.map(metric.accessor);
          return {
            key: scenario.key,
            label: scenario.label,
            color: scenario.color,
            values,
            latestValue: values.length ? values[values.length - 1] : 0,
            points: buildChartPolyline(values, min, max),
          };
        }),
      };
    });
  }, [planningScenarioComparisonsExtended, planningHorizonMonths, currency]);

  const planningScenarioTimelineVisual = useMemo(() => {
    const months = (planningRows || []).slice(0, Math.min(planningHorizonMonths, 12)).map((row) => row.month);
    const monthIndexMap = new Map(months.map((month, index) => [month, index]));
    const laneMap = { Scenario: 28, Milestone: 64, Capital: 100 };
    const rawItems = [
      ...normalizePlanningScenarioEvents(planningScenarioEvents).map((event) => ({
        id: `scenario-${event.id}`,
        date: event.date,
        month: monthKey(event.date),
        category: "Scenario",
        color: "#2563eb",
        title: event.eventType === "reserve_change"
          ? `Reserve ${currency(Number(event.monthlyCapexReserve || 0))}/mo`
          : `${formatPropertyLabel(event.propertyId)} | ${formatUnitLabel(event.unit)} -> ${event.mode === "rented" ? "Rented" : event.mode === "owner" ? "Owner" : "Vacant"}`,
        detail: event.notes || event.date,
      })),
      ...planningMilestones.map((milestone) => ({
        id: `milestone-${milestone.propertyId}-${milestone.date}-${milestone.title}`,
        date: milestone.date,
        month: monthKey(milestone.date),
        category: "Milestone",
        color: "#8b5cf6",
        title: milestone.title,
        detail: milestone.detail,
      })),
      ...planningCapitalTargetsMerged
        .filter((target) => Number(target.monthsRemaining || 999) <= Math.min(planningHorizonMonths, 12))
        .map((target) => ({
          id: `capital-${target.source}-${target.assetId}-${target.targetDate}`,
          date: target.targetDate,
          month: monthKey(target.targetDate),
          category: "Capital",
          color: target.urgency === "near_term" ? "#dc2626" : target.urgency === "watchlist" ? "#d97706" : "#0f766e",
          title: `${target.description} ${currency(target.estimatedReplacementCost)}`,
          detail: `${target.propertyName} | ${formatUnitLabel(target.unit)}`,
        })),
    ]
      .filter((item) => monthIndexMap.has(item.month))
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(0, 12)
      .map((item) => {
        const index = monthIndexMap.get(item.month) ?? 0;
        return {
          ...item,
          xPct: months.length <= 1 ? 0 : (index / Math.max(1, months.length - 1)) * 100,
          y: laneMap[item.category] || 28,
        };
      });
    return {
      months,
      labels: months.map((month) => formatStatementMonthLabel(month)),
      items: rawItems,
      lanes: [
        { label: "Scenario", y: laneMap.Scenario, color: "#2563eb" },
        { label: "Milestone", y: laneMap.Milestone, color: "#8b5cf6" },
        { label: "Capital", y: laneMap.Capital, color: "#d97706" },
      ],
    };
  }, [planningRows, planningHorizonMonths, planningScenarioEvents, planningMilestones, planningCapitalTargetsMerged, currency, formatPropertyLabel]);

  const planningCapitalChartData = useMemo(() => {
    const rows = planningCapitalTimeline.slice(0, Math.min(planningCapitalTimeline.length, 24));
    const contributionValues = rows.map((row) => Number(row.cumulativeContribution || 0));
    const dueValues = rows.map((row) => Number(row.cumulativeNeed || 0));
    const gapValues = rows.map((row) => Number(row.cumulativeGap || 0));
    const cumulativeMax = Math.max(1, ...contributionValues, ...dueValues);
    const gapMin = Math.min(0, ...gapValues);
    const gapMax = Math.max(0, ...gapValues, 1);
    return {
      rows,
      cumulativeMax,
      gapMin,
      gapMax,
      contributionLine: buildChartPolyline(contributionValues, 0, cumulativeMax, 320, 132, 14),
      dueLine: buildChartPolyline(dueValues, 0, cumulativeMax, 320, 132, 14),
      gapLine: buildChartPolyline(gapValues, gapMin, gapMax, 320, 132, 14),
      gapAxisY: buildChartAxisY(gapMin, gapMax, 320, 132, 14),
      cumulativeLatestContribution: contributionValues.length ? contributionValues[contributionValues.length - 1] : 0,
      cumulativeLatestDue: dueValues.length ? dueValues[dueValues.length - 1] : 0,
      latestGap: gapValues.length ? gapValues[gapValues.length - 1] : 0,
    };
  }, [planningCapitalTimeline]);

  const planningDecisionDashboard = useMemo(() => {
    const nextMove = planningRecommendedMoves[0] || null;
    const strongestSensitivity = planningSensitivityRows[0] || null;
    return {
      nextMove,
      strongestSensitivity,
      health: planningHealthSummary,
      confidence: planningDataConfidence,
    };
  }, [planningRecommendedMoves, planningSensitivityRows, planningHealthSummary, planningDataConfidence]);

  return {
    planningCapitalChartData,
    planningDecisionDashboard,
    planningOutcomeHighlights,
    planningScenarioChartData,
    planningScenarioComparisons,
    planningScenarioComparisonsExtended,
    planningScenarioDiffRows,
    planningScenarioRange,
    planningScenarioTimelineRows,
    planningScenarioTimelineVisual,
    planningSensitivityRows,
  };
}
