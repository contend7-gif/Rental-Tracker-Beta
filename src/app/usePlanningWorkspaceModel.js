import { useMemo } from "react";
import { formatStatementMonthLabel } from "../lib/appSupport.ts";
import {
  buildPlanningAssumptionAudit,
  buildPlanningCapitalTargets,
  buildPlanningDebtPayoffAnalysis,
  buildPlanningDecisionComparison,
  buildPlanningExitAnalysis,
  buildPlanningFinancingComparison,
  buildPlanningGoalStatus,
  buildPlanningHealthSummary,
  buildPlanningManualCapitalTargets,
  buildPlanningMilestones,
  buildPlanningProjection,
  buildPlanningPropertySnapshots,
  buildPlanningRecommendedMoves,
  buildPlanningRecommendations,
  buildPlanningRentStrategy,
  buildPlanningReserveSummary,
  buildPlanningTaxProjection,
  buildPlanningTriggerAlerts,
  buildPlanningTurnoverPlanner,
} from "../domain/planning.ts";
import { addMonths } from "./dateHelpers.js";
import {
  getPlanningPresetValues,
  normalizePlanningAssumptions,
  normalizePlanningDebtPayoffPlan,
  normalizePlanningExitPlan,
  normalizePlanningForecastOptions,
  normalizePlanningGoals,
  normalizePlanningRentStrategies,
  normalizePlanningScenarioEvents,
  normalizePlanningScenarioOverrides,
  normalizePlanningTriggers,
  normalizePlanningTurnoverInputs,
  planningAssumptionsMatch,
  planningForecastOptionsMatch,
} from "../features/planning/planningState.js";

const toPlanningRentStrategyInputs = (strategies) =>
  strategies.map((strategy) => ({
    propertyId: strategy.propertyId,
    unit: strategy.unit,
    marketRent: Number(strategy.marketRent || 0),
    targetRent: Number(strategy.targetRent || 0),
    renewalStart: strategy.renewalStart || "",
    renewalTermMonths: Number(strategy.renewalTermMonths || 12),
    notes: strategy.notes || "",
  }));

const toPlanningTurnoverInputs = (plans) =>
  plans.map((plan) => ({
    propertyId: plan.propertyId,
    unit: plan.unit,
    makeReadyCost: Number(plan.makeReadyCost || 0),
    downtimeDays: Number(plan.downtimeDays || 0),
    leasingFeePct: Number(plan.leasingFeePct || 0),
    concessionWeeks: Number(plan.concessionWeeks || 0),
    notes: plan.notes || "",
  }));

export function usePlanningWorkspaceModel({
  activeTx,
  assets,
  formatPropertyLabel,
  leases,
  loans,
  planningActiveScenario,
  planningAssumptions,
  planningBaselineScenario,
  planningDebtPayoffPlan,
  planningExitPlan,
  planningForecastOptions,
  planningGoals,
  planningManualProjects,
  planningRentStrategies,
  planningScenarioEvents,
  planningScenarioNameDraft,
  planningScenarioNotesDraft,
  planningScenarioOverrides,
  planningTriggers,
  planningTurnoverInputs,
  properties,
  propertyFilter,
  setPlanningAssumptions,
  todayIso,
  unitFilter,
  units,
  usePeriods,
}) {
  const planningForecastOptionInputs = useMemo(
    () => ({
      assumeRerentAfterTurnover: planningForecastOptions.assumeRerentAfterTurnover,
      rerentRentSource: planningForecastOptions.rerentRentSource,
      rerentTermMonths: Number(planningForecastOptions.rerentTermMonths || 12),
    }),
    [planningForecastOptions],
  );

  const planningScenarioOverrideInputs = useMemo(
    () => planningScenarioOverrides.map((override) => ({
      propertyId: override.propertyId,
      unit: override.unit,
      mode: override.mode,
      monthlyRent: Number(override.monthlyRent || 0),
    })),
    [planningScenarioOverrides],
  );

  const planningScenarioEventInputs = useMemo(
    () => planningScenarioEvents.map((event) => ({
      id: event.id,
      propertyId: event.propertyId,
      unit: event.unit || "Shared",
      date: event.date,
      eventType: event.eventType,
      mode: event.mode,
      monthlyRent: Number(event.monthlyRent || 0),
      monthlyCapexReserve: Number(event.monthlyCapexReserve || 0),
      notes: event.notes || "",
    })),
    [planningScenarioEvents],
  );

  const planningRentStrategyInputs = useMemo(
    () => toPlanningRentStrategyInputs(planningRentStrategies),
    [planningRentStrategies],
  );

  const planningTurnoverPlanInputs = useMemo(
    () => toPlanningTurnoverInputs(planningTurnoverInputs),
    [planningTurnoverInputs],
  );

  const planningProjection = useMemo(
    () =>
      buildPlanningProjection({
        today: todayIso,
        propertyId: propertyFilter === "all" ? undefined : propertyFilter,
        properties,
        transactions: activeTx,
        leases,
        loans,
        usePeriods,
        units,
        assumptions: {
          horizonMonths: Number(planningAssumptions.horizonMonths || 24),
          annualRentGrowthPct: Number(planningAssumptions.annualRentGrowthPct || 0) / 100,
          annualExpenseGrowthPct: Number(planningAssumptions.annualExpenseGrowthPct || 0) / 100,
          annualValueGrowthPct: Number(planningAssumptions.annualValueGrowthPct || 0) / 100,
          vacancyRatePct: Number(planningAssumptions.vacancyRatePct || 0) / 100,
          monthlyCapexReserve: Number(planningAssumptions.monthlyCapexReserve || 0),
          includedUtilitiesMonthly: Number(planningAssumptions.includedUtilitiesMonthly || 0),
        },
        scenarioOverrides: planningScenarioOverrideInputs,
        scenarioEvents: planningScenarioEventInputs,
        rentStrategies: planningRentStrategyInputs,
        turnoverInputs: planningTurnoverPlanInputs,
        forecastOptions: planningForecastOptionInputs,
      }),
    [
      todayIso,
      propertyFilter,
      properties,
      activeTx,
      leases,
      loans,
      usePeriods,
      units,
      planningAssumptions.horizonMonths,
      planningAssumptions.annualRentGrowthPct,
      planningAssumptions.annualExpenseGrowthPct,
      planningAssumptions.annualValueGrowthPct,
      planningAssumptions.vacancyRatePct,
      planningAssumptions.monthlyCapexReserve,
      planningAssumptions.includedUtilitiesMonthly,
      planningScenarioOverrideInputs,
      planningScenarioEventInputs,
      planningRentStrategyInputs,
      planningTurnoverPlanInputs,
      planningForecastOptionInputs,
    ],
  );

  const planningSummary = planningProjection.summary;
  const planningRows = planningProjection.rows;
  const planningHorizonMonths = Math.max(1, Math.round(Number(planningAssumptions.horizonMonths || 12)));
  const planningHorizonShortLabel = `${planningHorizonMonths}-mo`;
  const planningHorizonDisplayMetrics = useMemo(() => {
    const totals = planningRows.reduce((sum, row) => ({
      effectiveRent: sum.effectiveRent + Number(row.effectiveRent || 0),
      netOperatingIncome: sum.netOperatingIncome + Number(row.netOperatingIncome || 0),
      cashFlow: sum.cashFlow + Number(row.cashFlow || 0),
    }), {
      effectiveRent: 0,
      netOperatingIncome: 0,
      cashFlow: 0,
    });
    return {
      effectiveRent: Math.round(totals.effectiveRent * 100) / 100,
      netOperatingIncome: Math.round(totals.netOperatingIncome * 100) / 100,
      cashFlow: Math.round(totals.cashFlow * 100) / 100,
    };
  }, [planningRows]);

  const planningScopeLabel = propertyFilter === "all" ? "Portfolio" : formatPropertyLabel(propertyFilter);
  const planningUnitFilterIgnored = unitFilter !== "all";

  const planningPropertySnapshots = useMemo(
    () =>
      buildPlanningPropertySnapshots({
        today: todayIso,
        properties,
        leases,
        loans,
        usePeriods,
        units,
        propertyId: propertyFilter === "all" ? undefined : propertyFilter,
        scenarioOverrides: planningScenarioOverrideInputs,
      }),
    [todayIso, properties, leases, loans, usePeriods, units, propertyFilter, planningScenarioOverrideInputs],
  );

  const planningMilestones = useMemo(
    () =>
      buildPlanningMilestones({
        today: todayIso,
        properties,
        leases,
        usePeriods,
        units,
        propertyId: propertyFilter === "all" ? undefined : propertyFilter,
        horizonMonths: Number(planningAssumptions.horizonMonths || 24),
        scenarioOverrides: planningScenarioOverrideInputs,
        scenarioEvents: planningScenarioEventInputs,
        rentStrategies: planningRentStrategyInputs,
        turnoverInputs: planningTurnoverPlanInputs,
        forecastOptions: planningForecastOptionInputs,
      }),
    [todayIso, properties, leases, usePeriods, units, propertyFilter, planningAssumptions.horizonMonths, planningScenarioOverrideInputs, planningScenarioEventInputs, planningRentStrategyInputs, planningTurnoverPlanInputs, planningForecastOptionInputs],
  );

  const planningForecastSignals = useMemo(
    () =>
      planningRows
        .filter((row) => row.driverLabel && row.driverLabel !== "Signed leases + assumptions")
        .map((row) => ({
          key: `forecast-${row.month}-${row.driverLabel}`,
          date: `${row.month}-01`,
          badge: row.month,
          title: row.driverLabel,
          detail: row.driverDetail || "",
          source: "forecast",
        }))
        .slice(0, 8),
    [planningRows],
  );

  const planningUpcomingChanges = useMemo(() => {
    const milestoneItems = planningMilestones.map((milestone) => ({
      key: `milestone-${milestone.propertyId}-${milestone.date}-${milestone.title}`,
      date: milestone.date,
      badge: milestone.date,
      title: milestone.title,
      detail: `${milestone.propertyName} | ${milestone.detail}`,
      source: "tracked",
    }));
    const combined = [...planningForecastSignals, ...milestoneItems]
      .sort((left, right) => left.date.localeCompare(right.date))
      .filter((item, index, items) => items.findIndex((candidate) => candidate.title === item.title && candidate.date === item.date) === index);
    return combined.slice(0, 10);
  }, [planningForecastSignals, planningMilestones]);

  const applyPlanningPreset = (preset) => {
    setPlanningAssumptions(getPlanningPresetValues(preset));
  };

  const planningDecisionComparison = useMemo(
    () =>
      buildPlanningDecisionComparison({
        today: todayIso,
        propertyId: propertyFilter === "all" ? undefined : propertyFilter,
        units,
        leases,
        loans,
        usePeriods,
        transactions: activeTx,
        vacancyRatePct: Number(planningAssumptions.vacancyRatePct || 0) / 100,
        monthlyCapexReserve: Number(planningAssumptions.monthlyCapexReserve || 0),
        scenarioOverrides: planningScenarioOverrideInputs,
      }),
    [
      todayIso,
      propertyFilter,
      units,
      leases,
      loans,
      usePeriods,
      activeTx,
      planningAssumptions.vacancyRatePct,
      planningAssumptions.monthlyCapexReserve,
      planningScenarioOverrideInputs,
    ],
  );

  const planningRentStrategy = useMemo(
    () =>
      buildPlanningRentStrategy({
        today: todayIso,
        properties,
        units,
        leases,
        propertyId: propertyFilter === "all" ? undefined : propertyFilter,
        scenarioOverrides: planningScenarioOverrideInputs,
        strategies: planningRentStrategyInputs,
      }),
    [todayIso, properties, units, leases, propertyFilter, planningScenarioOverrideInputs, planningRentStrategyInputs],
  );

  const planningTurnoverPlanner = useMemo(
    () =>
      buildPlanningTurnoverPlanner({
        today: todayIso,
        propertyId: propertyFilter === "all" ? undefined : propertyFilter,
        properties,
        units,
        leases,
        strategies: planningRentStrategyInputs,
        plans: planningTurnoverPlanInputs,
      }),
    [todayIso, propertyFilter, properties, units, leases, planningRentStrategyInputs, planningTurnoverPlanInputs],
  );

  const planningExitAnalysis = useMemo(
    () =>
      buildPlanningExitAnalysis({
        today: todayIso,
        summary: planningSummary,
        plan: {
          mode: planningExitPlan.mode,
          taxTreatment: planningExitPlan.taxTreatment,
          targetRatePct: Number(planningExitPlan.targetRatePct || 0),
          termYears: Number(planningExitPlan.termYears || 30),
          cashOutAmount: Number(planningExitPlan.cashOutAmount || 0),
          saleDate: planningExitPlan.saleDate || "",
          sellingCostsPct: Number(planningExitPlan.sellingCostsPct || 0) / 100,
        },
        loans,
        propertyId: propertyFilter === "all" ? undefined : propertyFilter,
        properties,
        assets,
        usePeriods,
        leases,
        units,
        annualValueGrowthPct: Number(planningAssumptions.annualValueGrowthPct || 0) / 100,
      }),
    [todayIso, planningSummary, planningExitPlan, loans, propertyFilter, properties, assets, usePeriods, leases, units, planningAssumptions.annualValueGrowthPct],
  );

  const planningReserveSummary = useMemo(
    () =>
      buildPlanningReserveSummary({
        summary: planningSummary,
        horizonMonths: Number(planningAssumptions.horizonMonths || 12),
        monthlyCapexReserve: Number(planningAssumptions.monthlyCapexReserve || 0),
      }),
    [planningSummary, planningAssumptions.horizonMonths, planningAssumptions.monthlyCapexReserve],
  );

  const planningGoalStatus = useMemo(
    () =>
      buildPlanningGoalStatus({
        summary: planningSummary,
        reserve: planningReserveSummary,
        goals: {
          minMonthlyCashFlow: Number(planningGoals.minMonthlyCashFlow || 0),
          minAnnualCashFlow: Number(planningGoals.minAnnualCashFlow || 0),
          minReserveMonths: Number(planningGoals.minReserveMonths || 0),
          minEndingEquity: Number(planningGoals.minEndingEquity || 0),
          maxLtvPct: Number(planningGoals.maxLtvPct || 0) / 100,
          minDscr: Number(planningGoals.minDscr || 0),
        },
      }),
    [planningSummary, planningReserveSummary, planningGoals],
  );

  const planningDebtPayoff = useMemo(
    () =>
      buildPlanningDebtPayoffAnalysis({
        today: todayIso,
        loans,
        propertyId: propertyFilter === "all" ? undefined : propertyFilter,
        plan: {
          extraPrincipalMonthly: Number(planningDebtPayoffPlan.extraPrincipalMonthly || 0),
          lumpSumAmount: Number(planningDebtPayoffPlan.lumpSumAmount || 0),
          lumpSumDate: planningDebtPayoffPlan.lumpSumDate || "",
        },
      }),
    [todayIso, loans, propertyFilter, planningDebtPayoffPlan],
  );

  const planningFinancingComparison = useMemo(
    () =>
      buildPlanningFinancingComparison({
        today: todayIso,
        loans,
        propertyId: propertyFilter === "all" ? undefined : propertyFilter,
        summary: planningSummary,
        exitPlan: {
          mode: planningExitPlan.mode,
          taxTreatment: planningExitPlan.taxTreatment,
          targetRatePct: Number(planningExitPlan.targetRatePct || 0),
          termYears: Number(planningExitPlan.termYears || 30),
          cashOutAmount: Number(planningExitPlan.cashOutAmount || 0),
          saleDate: planningExitPlan.saleDate || "",
          sellingCostsPct: Number(planningExitPlan.sellingCostsPct || 0) / 100,
        },
        debtPayoffPlan: {
          extraPrincipalMonthly: Number(planningDebtPayoffPlan.extraPrincipalMonthly || 0),
          lumpSumAmount: Number(planningDebtPayoffPlan.lumpSumAmount || 0),
          lumpSumDate: planningDebtPayoffPlan.lumpSumDate || "",
        },
      }),
    [todayIso, loans, propertyFilter, planningSummary, planningExitPlan, planningDebtPayoffPlan],
  );

  const planningTaxProjection = useMemo(
    () =>
      buildPlanningTaxProjection({
        today: todayIso,
        rows: planningRows,
        loans,
        assets,
        usePeriods,
        leases,
        units,
        propertyId: propertyFilter === "all" ? undefined : propertyFilter,
        scenarioOverrides: planningScenarioOverrideInputs,
        scenarioEvents: planningScenarioEventInputs,
      }),
    [todayIso, planningRows, loans, assets, usePeriods, leases, units, propertyFilter, planningScenarioOverrideInputs, planningScenarioEventInputs],
  );

  const planningCapitalTargets = useMemo(
    () =>
      buildPlanningCapitalTargets({
        today: todayIso,
        properties,
        assets,
        propertyId: propertyFilter === "all" ? undefined : propertyFilter,
        annualExpenseGrowthPct: Number(planningAssumptions.annualExpenseGrowthPct || 0) / 100,
      }),
    [todayIso, properties, assets, propertyFilter, planningAssumptions.annualExpenseGrowthPct],
  );

  const planningExcludedBuildingAssetCount = useMemo(
    () =>
      assets.filter((asset) =>
        String(asset.type || "") === "Residential Building"
        && (propertyFilter === "all" || asset.propertyId === propertyFilter),
      ).length,
    [assets, propertyFilter],
  );

  const planningManualCapitalTargets = useMemo(
    () =>
      buildPlanningManualCapitalTargets({
        today: todayIso,
        properties,
        projects: planningManualProjects.map((project) => ({
          id: project.id,
          propertyId: project.propertyId,
          unit: project.unit,
          title: project.title,
          targetDate: project.targetDate,
          estimatedCost: Number(project.estimatedCost || 0),
          linkedAssetId: project.linkedAssetId || "",
          notes: project.notes || "",
          priority: project.priority || "medium",
          fundingSource: project.fundingSource || "tbd",
          scheduleType: project.scheduleType || "one_time",
          mustFundBy: project.mustFundBy || "",
        })),
        propertyId: propertyFilter === "all" ? undefined : propertyFilter,
      }),
    [todayIso, properties, planningManualProjects, propertyFilter],
  );

  const planningCapitalTargetsMerged = useMemo(() => {
    const overriddenAssetIds = new Set(
      planningManualCapitalTargets.map((target) => target.linkedAssetId).filter(Boolean),
    );
    return [...planningManualCapitalTargets, ...planningCapitalTargets.filter((target) => !overriddenAssetIds.has(target.assetId))]
      .sort((left, right) => {
        if (left.monthsRemaining !== right.monthsRemaining) return left.monthsRemaining - right.monthsRemaining;
        return right.monthlyReserveTarget - left.monthlyReserveTarget;
      });
  }, [planningManualCapitalTargets, planningCapitalTargets]);

  const planningCapitalMonthlyTarget = useMemo(
    () => planningCapitalTargetsMerged.reduce((sum, item) => sum + Number(item.monthlyReserveTarget || 0), 0),
    [planningCapitalTargetsMerged],
  );

  const planningCapitalTargetSections = useMemo(
    () =>
      ["near_term", "watchlist", "long_range"].map((urgency) => ({
        urgency,
        label: urgency === "near_term" ? "Near term" : urgency === "watchlist" ? "Watchlist" : "Long range",
        items: planningCapitalTargetsMerged.filter((target) => target.urgency === urgency),
      })),
    [planningCapitalTargetsMerged],
  );

  const planningNearTermCapitalTargets = useMemo(
    () => planningCapitalTargetsMerged.filter((target) => target.monthsRemaining <= 12),
    [planningCapitalTargetsMerged],
  );

  const planningNearTermCapitalCost = useMemo(
    () => planningNearTermCapitalTargets.reduce((sum, target) => sum + Number(target.estimatedReplacementCost || 0), 0),
    [planningNearTermCapitalTargets],
  );

  const planningNearTermReserveTarget = useMemo(
    () => planningNearTermCapitalTargets.reduce((sum, target) => sum + Number(target.monthlyReserveTarget || 0), 0),
    [planningNearTermCapitalTargets],
  );

  const planningNextCapitalTarget = planningCapitalTargetsMerged[0] || null;
  const planningCapitalTimeline = useMemo(() => {
    const horizonMonths = Math.max(1, Math.round(Number(planningAssumptions.horizonMonths || 12)));
    const monthlyContribution = Number(planningAssumptions.monthlyCapexReserve || 0);
    const byMonth = new Map();
    planningCapitalTargetsMerged.forEach((target) => {
      const dueDate = String(target.mustFundBy || target.targetDate || "");
      const month = dueDate.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) return;
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month).push(target);
    });
    let cumulativeContribution = 0;
    let cumulativeNeed = 0;
    return Array.from({ length: horizonMonths }, (_, index) => {
      const month = addMonths(todayIso, index).slice(0, 7);
      const targets = byMonth.get(month) || [];
      const dueThisMonth = targets.reduce((sum, target) => sum + Number(target.estimatedReplacementCost || 0), 0);
      cumulativeContribution += monthlyContribution;
      cumulativeNeed += dueThisMonth;
      return {
        month,
        label: formatStatementMonthLabel(month),
        targets,
        targetCount: targets.length,
        dueThisMonth: Math.round(dueThisMonth * 100) / 100,
        cumulativeContribution: Math.round(cumulativeContribution * 100) / 100,
        cumulativeNeed: Math.round(cumulativeNeed * 100) / 100,
        cumulativeGap: Math.round((cumulativeContribution - cumulativeNeed) * 100) / 100,
      };
    });
  }, [planningAssumptions.horizonMonths, planningAssumptions.monthlyCapexReserve, planningCapitalTargetsMerged, todayIso]);

  const planningCapitalRunway = useMemo(() => {
    const monthsWithNeed = planningCapitalTimeline.filter((item) => item.dueThisMonth > 0);
    const firstShortfall = monthsWithNeed.find((item) => item.cumulativeGap < 0) || null;
    const worstGap = planningCapitalTimeline.reduce((min, item) => Math.min(min, item.cumulativeGap), 0);
    const totalNeed = planningCapitalTimeline.reduce((sum, item) => sum + item.dueThisMonth, 0);
    const totalContribution = planningCapitalTimeline.length * Number(planningAssumptions.monthlyCapexReserve || 0);
    return {
      totalNeed: Math.round(totalNeed * 100) / 100,
      totalContribution: Math.round(totalContribution * 100) / 100,
      firstShortfall,
      worstGap: Math.round(worstGap * 100) / 100,
      monthsWithNeed: monthsWithNeed.length,
    };
  }, [planningCapitalTimeline, planningAssumptions.monthlyCapexReserve]);

  const planningReserveGap = Math.round((planningCapitalMonthlyTarget - Number(planningAssumptions.monthlyCapexReserve || 0)) * 100) / 100;

  const planningTriggerAlerts = useMemo(
    () =>
      buildPlanningTriggerAlerts({
        today: todayIso,
        summary: planningSummary,
        reserve: planningReserveSummary,
        milestones: planningMilestones,
        capitalTargets: planningCapitalTargetsMerged,
        triggers: {
          minMonthlyCashFlow: Number(planningTriggers.minMonthlyCashFlow || 0),
          minReserveMonths: Number(planningTriggers.minReserveMonths || 0),
          leaseRolloverDays: Number(planningTriggers.leaseRolloverDays || 0),
          capexWarningMonths: Number(planningTriggers.capexWarningMonths || 0),
        },
      }),
    [todayIso, planningSummary, planningReserveSummary, planningMilestones, planningCapitalTargetsMerged, planningTriggers],
  );

  const planningRecommendations = useMemo(
    () =>
      buildPlanningRecommendations({
        summary: planningSummary,
        reserveGap: planningReserveGap,
        capitalTargets: planningCapitalTargetsMerged,
        milestones: planningMilestones,
        decisionComparison: planningDecisionComparison,
        horizonMonths: planningHorizonMonths,
        projectedCashFlow: planningHorizonDisplayMetrics.cashFlow,
      }),
    [planningSummary, planningReserveGap, planningCapitalTargetsMerged, planningMilestones, planningDecisionComparison, planningHorizonMonths, planningHorizonDisplayMetrics.cashFlow],
  );

  const planningMustFundWarnings = useMemo(
    () =>
      planningCapitalTargetsMerged
        .filter((target) => target.mustFundBy && target.mustFundBy >= todayIso)
        .map((target) => ({
          ...target,
          fundingMonthsRemaining: Math.max(0, Math.round((new Date(`${target.mustFundBy}T00:00:00Z`) - new Date(`${todayIso}T00:00:00Z`)) / (1000 * 60 * 60 * 24 * 30.4375))),
        }))
        .filter((target) => target.fundingMonthsRemaining <= 12)
        .sort((left, right) => left.fundingMonthsRemaining - right.fundingMonthsRemaining),
    [planningCapitalTargetsMerged, todayIso],
  );

  const planningHealthSummary = useMemo(
    () =>
      buildPlanningHealthSummary({
        today: todayIso,
        summary: planningSummary,
        reserve: planningReserveSummary,
        reserveGap: planningReserveGap,
        milestones: planningMilestones,
        capitalTargets: planningCapitalTargetsMerged,
        goalStatus: planningGoalStatus,
        projectedCashFlow: planningHorizonDisplayMetrics.cashFlow,
      }),
    [todayIso, planningSummary, planningReserveSummary, planningReserveGap, planningMilestones, planningCapitalTargetsMerged, planningGoalStatus, planningHorizonDisplayMetrics.cashFlow],
  );

  const planningRecommendedMoves = useMemo(
    () =>
      buildPlanningRecommendedMoves({
        summary: planningSummary,
        reserveGap: planningReserveGap,
        milestones: planningMilestones,
        triggerAlerts: planningTriggerAlerts,
        turnoverRows: planningTurnoverPlanner.rows,
        decisionComparison: planningDecisionComparison,
        horizonMonths: planningHorizonMonths,
        projectedCashFlow: planningHorizonDisplayMetrics.cashFlow,
      }),
    [planningSummary, planningReserveGap, planningMilestones, planningTriggerAlerts, planningTurnoverPlanner.rows, planningDecisionComparison, planningHorizonMonths, planningHorizonDisplayMetrics.cashFlow],
  );

  const planningAssumptionAuditRows = useMemo(
    () =>
      buildPlanningAssumptionAudit({
        scopeLabel: planningScopeLabel,
        scenarioLabel: planningActiveScenario?.name || "Current workspace",
        baselineLabel: planningBaselineScenario?.name || "Base preset",
        assumptions: normalizePlanningAssumptions(planningAssumptions),
        overrides: normalizePlanningScenarioOverrides(planningScenarioOverrides),
        events: normalizePlanningScenarioEvents(planningScenarioEvents),
        forecastOptions: normalizePlanningForecastOptions(planningForecastOptions),
        exitPlan: normalizePlanningExitPlan(planningExitPlan),
        goals: normalizePlanningGoals(planningGoals),
        triggers: normalizePlanningTriggers(planningTriggers),
        manualProjects: planningManualProjects,
        capitalTargets: planningCapitalTargetsMerged,
        rentStrategyRows: planningRentStrategy.rows,
        turnoverRows: planningTurnoverPlanner.rows,
      }),
    [planningScopeLabel, planningActiveScenario, planningBaselineScenario, planningAssumptions, planningScenarioOverrides, planningScenarioEvents, planningForecastOptions, planningExitPlan, planningGoals, planningTriggers, planningManualProjects, planningCapitalTargetsMerged, planningRentStrategy.rows, planningTurnoverPlanner.rows],
  );

  const planningScenarioIsDirty = useMemo(
    () =>
      Boolean(
        planningActiveScenario &&
        (
          planningActiveScenario.propertyId !== (propertyFilter || "all") ||
          planningActiveScenario.name !== (planningScenarioNameDraft.trim() || planningActiveScenario.name) ||
          (planningActiveScenario.notes || "") !== planningScenarioNotesDraft.trim() ||
          JSON.stringify(normalizePlanningScenarioOverrides(planningActiveScenario.overrides)) !== JSON.stringify(normalizePlanningScenarioOverrides(planningScenarioOverrides)) ||
          JSON.stringify(normalizePlanningScenarioEvents(planningActiveScenario.events)) !== JSON.stringify(normalizePlanningScenarioEvents(planningScenarioEvents)) ||
          JSON.stringify(normalizePlanningRentStrategies(planningActiveScenario.rentStrategies)) !== JSON.stringify(normalizePlanningRentStrategies(planningRentStrategies)) ||
          !planningForecastOptionsMatch(planningActiveScenario.forecastOptions, planningForecastOptions) ||
          JSON.stringify(normalizePlanningExitPlan(planningActiveScenario.exitPlan)) !== JSON.stringify(normalizePlanningExitPlan(planningExitPlan)) ||
          JSON.stringify(normalizePlanningGoals(planningActiveScenario.goals)) !== JSON.stringify(normalizePlanningGoals(planningGoals)) ||
          JSON.stringify(normalizePlanningTriggers(planningActiveScenario.triggers)) !== JSON.stringify(normalizePlanningTriggers(planningTriggers)) ||
          JSON.stringify(normalizePlanningDebtPayoffPlan(planningActiveScenario.debtPayoffPlan)) !== JSON.stringify(normalizePlanningDebtPayoffPlan(planningDebtPayoffPlan)) ||
          JSON.stringify(normalizePlanningTurnoverInputs(planningActiveScenario.turnoverInputs)) !== JSON.stringify(normalizePlanningTurnoverInputs(planningTurnoverInputs)) ||
          !planningAssumptionsMatch(planningActiveScenario.assumptions, planningAssumptions)
        ),
      ),
    [planningActiveScenario, propertyFilter, planningAssumptions, planningScenarioNameDraft, planningScenarioNotesDraft, planningScenarioOverrides, planningScenarioEvents, planningRentStrategies, planningForecastOptions, planningExitPlan, planningGoals, planningTriggers, planningDebtPayoffPlan, planningTurnoverInputs],
  );

  const planningScopeUnits = useMemo(
    () => units.filter((unit) => unit.name !== "Shared" && (propertyFilter === "all" || unit.propertyId === propertyFilter)),
    [units, propertyFilter],
  );

  const planningUnitEconomicsRows = useMemo(
    () =>
      planningScopeUnits.map((unit) => {
        const rentRow = planningRentStrategy.rows.find((row) => row.propertyId === unit.propertyId && row.unit === unit.name);
        const turnoverRow = planningTurnoverPlanner.rows.find((row) => row.propertyId === unit.propertyId && row.unit === unit.name);
        const override = planningScenarioOverrides.find((item) => item.propertyId === unit.propertyId && item.unit === unit.name) || {
          propertyId: unit.propertyId,
          unit: unit.name,
          mode: "auto",
          monthlyRent: "",
        };
        const plannedStatus = override.mode === "auto"
          ? (rentRow?.currentStatus || unit.status)
          : override.mode === "rented"
            ? "Planning rental"
            : override.mode === "owner"
              ? "Planning owner-occupied"
              : "Planning vacant";
        const plannedRent = override.mode === "rented"
          ? Number(override.monthlyRent || rentRow?.targetRent || rentRow?.marketRent || rentRow?.currentRent || 0)
          : override.mode === "vacant" || override.mode === "owner"
            ? 0
            : Number(rentRow?.targetRent || rentRow?.marketRent || rentRow?.currentRent || 0);
        return {
          key: `${unit.propertyId}-${unit.name}`,
          propertyId: unit.propertyId,
          unit: unit.name,
          propertyName: formatPropertyLabel(unit.propertyId),
          currentStatus: rentRow?.currentStatus || unit.status,
          plannedStatus,
          currentRent: Number(rentRow?.currentRent || 0),
          plannedRent,
          annualUpside: Number(rentRow?.annualizedUpside || 0),
          nextTurnoverDate: turnoverRow?.nextTurnoverDate || "",
          recoveryMonths: Number(turnoverRow?.recoveryMonths || 0),
          turnoverCost: Number(turnoverRow?.totalTurnoverCost || 0),
        };
      }),
    [planningScopeUnits, planningRentStrategy.rows, planningTurnoverPlanner.rows, planningScenarioOverrides],
  );

  const planningDataConfidence = useMemo(() => {
    const pricedUnits = planningRentStrategy.summary.pricedUnitCount;
    const unitCount = Math.max(1, planningScopeUnits.length);
    const coverageRatio = pricedUnits / unitCount;
    const signals = {
      strategyCoverage: coverageRatio >= 0.75 ? 2 : coverageRatio > 0 ? 1 : 0,
      turnoverCoverage: planningTurnoverPlanner.rows.some((row) => row.nextTurnoverDate || row.totalTurnoverCost > 0) ? 1 : 0,
      eventDepth: planningScenarioEventInputs.length > 0 ? 1 : 0,
      capitalDepth: planningCapitalTargetsMerged.length > 0 || planningManualProjects.length > 0 ? 1 : 0,
      guardrails: planningGoalStatus.length > 0 || planningTriggerAlerts.length > 0 ? 1 : 0,
    };
    const score = Object.values(signals).reduce((sum, value) => sum + value, 0);
    const label = score >= 5 ? "Grounded" : score >= 3 ? "Moderate" : "Light";
    const detail = score >= 5
      ? "This scenario is supported by rent, turnover, capital, and guardrail inputs."
      : score >= 3
        ? "The plan is directionally useful, but a few assumptions are still thin."
        : "This plan is still being driven mostly by defaults and live data rather than explicit planning inputs.";
    return { score, label, detail };
  }, [planningRentStrategy.summary.pricedUnitCount, planningScopeUnits.length, planningTurnoverPlanner.rows, planningScenarioEventInputs.length, planningCapitalTargetsMerged.length, planningManualProjects.length, planningGoalStatus.length, planningTriggerAlerts.length]);

  return {
    applyPlanningPreset,
    planningAssumptionAuditRows,
    planningCapitalMonthlyTarget,
    planningCapitalRunway,
    planningCapitalTargetSections,
    planningCapitalTargetsMerged,
    planningCapitalTimeline,
    planningDataConfidence,
    planningDebtPayoff,
    planningDecisionComparison,
    planningExcludedBuildingAssetCount,
    planningExitAnalysis,
    planningFinancingComparison,
    planningForecastOptionInputs,
    planningGoalStatus,
    planningHealthSummary,
    planningHorizonDisplayMetrics,
    planningHorizonMonths,
    planningHorizonShortLabel,
    planningMilestones,
    planningMustFundWarnings,
    planningNearTermCapitalCost,
    planningNearTermCapitalTargets,
    planningNearTermReserveTarget,
    planningNextCapitalTarget,
    planningProjection,
    planningPropertySnapshots,
    planningRecommendations,
    planningRecommendedMoves,
    planningRentStrategy,
    planningReserveGap,
    planningReserveSummary,
    planningRows,
    planningScenarioEventInputs,
    planningScenarioIsDirty,
    planningScenarioOverrideInputs,
    planningScopeLabel,
    planningScopeUnits,
    planningSummary,
    planningTaxProjection,
    planningTriggerAlerts,
    planningTurnoverPlanner,
    planningUnitEconomicsRows,
    planningUnitFilterIgnored,
    planningUpcomingChanges,
  };
}
