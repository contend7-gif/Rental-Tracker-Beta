import type { PlanningProjectionSummary, PlanningCapitalTarget, PlanningMilestone, PlanningDecisionComparison, PlanningRecommendation, PlanningReserveSummary, PlanningGoalStatus, PlanningHealthSummary, PlanningHealthFactor, PlanningAssumptions, PlanningScenarioUnitOverride, PlanningScenarioEvent, PlanningForecastOptions, PlanningExitPlan, PlanningGoalSet, PlanningTriggerSet, PlanningManualCapitalProject, PlanningRentStrategyRow, PlanningTurnoverRow, PlanningAssumptionAuditRow, PlanningTriggerAlert, PlanningRecommendedMove, PlanningReviewInboxItem } from "./types.ts";
import { formatUnitLabel } from "../unitLabels.js";
import { dayDifference, addDays } from "./shared.ts";

export function buildPlanningRecommendations(args: {
  summary: PlanningProjectionSummary;
  reserveGap: number;
  capitalTargets: PlanningCapitalTarget[];
  milestones: PlanningMilestone[];
  decisionComparison: PlanningDecisionComparison;
  horizonMonths?: number;
  projectedCashFlow?: number;
}): PlanningRecommendation[] {
  const recommendations: PlanningRecommendation[] = [];
  const horizonMonths = Math.max(1, Math.round(Number(args.horizonMonths || 12)));
  const projectedCashFlow = Number.isFinite(Number(args.projectedCashFlow))
    ? Number(args.projectedCashFlow || 0)
    : Number(args.summary.firstYearCashFlow || 0);

  if (projectedCashFlow < 0) {
    recommendations.push({
      priority: "high",
      title: "Close the projected cash-flow gap",
      detail: `The current scenario is projecting ${Math.abs(projectedCashFlow).toFixed(0)} of negative cash flow over the next ${horizonMonths} months. Revisit rent, debt load, vacancy, or reserve timing before treating this plan as sustainable.`,
    });
  }

  if (Number(args.reserveGap || 0) > 0) {
    recommendations.push({
      priority: "medium",
      title: "Increase monthly reserve funding",
      detail: `Tracked capital targets suggest about ${Number(args.reserveGap || 0).toFixed(0)} more per month than the current reserve setting. Raising the reserve closes the gap before larger projects arrive.`,
    });
  }

  const nearTermProject = args.capitalTargets.find((target) => target.urgency === "near_term");
  if (nearTermProject) {
    recommendations.push({
      priority: "medium",
      title: `Prepare for ${nearTermProject.description.toLowerCase()}`,
      detail: `${nearTermProject.propertyName} ${formatUnitLabel(nearTermProject.unit)} has a near-term target around ${nearTermProject.targetDate}. The current reserve target for that item is about ${nearTermProject.monthlyReserveTarget.toFixed(0)} per month.`,
    });
  }

  const nextMilestone = args.milestones[0];
  if (nextMilestone) {
    recommendations.push({
      priority: "low",
      title: "Review the next lease or occupancy milestone",
      detail: `${nextMilestone.title} on ${nextMilestone.date}. ${nextMilestone.detail}. Make sure the plan still reflects what you expect to happen on that date.`,
    });
  }

  if (Number(args.decisionComparison.monthlyCashFlowUpside || 0) > 0) {
    recommendations.push({
      priority: "low",
      title: "Compare this plan against a fuller rent roll",
      detail: `A fully rented version of the current scope improves monthly cash flow by about ${Number(args.decisionComparison.monthlyCashFlowUpside || 0).toFixed(0)}. That makes the rent and occupancy assumptions worth pressure-testing.`,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: "low",
      title: "Keep monitoring the current plan",
      detail: "The current planning inputs do not surface an obvious stress point right now. Keep the scenario updated as leases, debt, and capital timing change.",
    });
  }

  const priorityRank = { high: 0, medium: 1, low: 2 };
  return recommendations
    .sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority])
    .slice(0, 5);
}

export function buildPlanningHealthSummary(args: {
  today?: string;
  summary: PlanningProjectionSummary;
  reserve: PlanningReserveSummary;
  reserveGap: number;
  milestones?: PlanningMilestone[];
  capitalTargets?: PlanningCapitalTarget[];
  goalStatus?: PlanningGoalStatus[];
  projectedCashFlow?: number;
}): PlanningHealthSummary {
  const factors: PlanningHealthFactor[] = [];
  const projectedCashFlow = Number.isFinite(Number(args.projectedCashFlow))
    ? Number(args.projectedCashFlow || 0)
    : Number(args.summary.firstYearCashFlow || 0);
  const avgMonthlyCashFlow = projectedCashFlow / 12;
  const reserveMonths = Number(args.reserve.firstYearCoverageMonths || 0);
  const dscr = Number(args.summary.adjustedMonthlyDebtService || 0) > 0
    ? Number(args.summary.firstYearNetOperatingIncome || 0) / (Number(args.summary.adjustedMonthlyDebtService || 0) * 12)
    : 0;
  const nextMilestone = (args.milestones || [])[0] || null;
  const nearTermCapital = (args.capitalTargets || []).find((target) => target.urgency === "near_term") || null;
  const offTrackGoalCount = (args.goalStatus || []).filter((row) => row.status === "off_track").length;
  const watchGoalCount = (args.goalStatus || []).filter((row) => row.status === "watch").length;

  if (projectedCashFlow >= 0) {
    factors.push({
      id: "cash_flow",
      label: "Cash flow",
      status: "strong",
      detail: `Projected cash flow is positive over the working horizon, averaging about ${Math.round(avgMonthlyCashFlow)} per month.`,
    });
  } else if (avgMonthlyCashFlow >= -250) {
    factors.push({
      id: "cash_flow",
      label: "Cash flow",
      status: "watch",
      detail: `Projected cash flow is slightly negative at about ${Math.round(avgMonthlyCashFlow)} per month, so vacancy, reserve timing, or rent needs a closer look.`,
    });
  } else {
    factors.push({
      id: "cash_flow",
      label: "Cash flow",
      status: "weak",
      detail: `Projected cash flow is materially negative at about ${Math.round(avgMonthlyCashFlow)} per month.`,
    });
  }

  if (reserveMonths >= 6 && Number(args.reserveGap || 0) <= 0) {
    factors.push({
      id: "reserve",
      label: "Reserve readiness",
      status: "strong",
      detail: `Reserve coverage is about ${reserveMonths.toFixed(1)} months and current funding pace is keeping up with tracked capital targets.`,
    });
  } else if (reserveMonths >= 3 || Number(args.reserveGap || 0) <= 0) {
    factors.push({
      id: "reserve",
      label: "Reserve readiness",
      status: "watch",
      detail: `Reserve coverage is about ${reserveMonths.toFixed(1)} months, with a monthly reserve gap of ${Math.round(Math.max(0, Number(args.reserveGap || 0)))} if tracked targets stay in place.`,
    });
  } else {
    factors.push({
      id: "reserve",
      label: "Reserve readiness",
      status: "weak",
      detail: `Reserve coverage is only about ${reserveMonths.toFixed(1)} months, and tracked projects are running ahead of current reserve funding.`,
    });
  }

  if (dscr >= 1.2) {
    factors.push({
      id: "debt",
      label: "Debt load",
      status: "strong",
      detail: `The current plan covers debt service at about ${dscr.toFixed(2)}x.`,
    });
  } else if (dscr >= 1) {
    factors.push({
      id: "debt",
      label: "Debt load",
      status: "watch",
      detail: `Debt coverage is close at about ${dscr.toFixed(2)}x, so small misses in rent or OpEx would matter.`,
    });
  } else {
    factors.push({
      id: "debt",
      label: "Debt load",
      status: "weak",
      detail: `Debt coverage is under 1.0x at about ${dscr.toFixed(2)}x.`,
    });
  }

  if (nearTermCapital) {
    factors.push({
      id: "capital",
      label: "Capital pressure",
      status: nearTermCapital.monthsRemaining <= 6 ? "weak" : "watch",
      detail: `${nearTermCapital.description} is the next tracked project, due around ${nearTermCapital.targetDate}.`,
    });
  } else {
    factors.push({
      id: "capital",
      label: "Capital pressure",
      status: "strong",
      detail: "No near-term tracked capital project is currently inside the planning horizon.",
    });
  }

  if (nextMilestone) {
    const milestoneDays = args.today ? Math.max(0, dayDifference(args.today, nextMilestone.date)) : 999;
    factors.push({
      id: "lease_cycle",
      label: "Lease cycle",
      status: milestoneDays <= 60 ? "watch" : "strong",
      detail: `${nextMilestone.title} is the next tracked milestone on ${nextMilestone.date}.`,
    });
  } else {
    factors.push({
      id: "lease_cycle",
      label: "Lease cycle",
      status: "strong",
      detail: "No lease or occupancy milestone is currently sitting near the front of the planning horizon.",
    });
  }

  if (offTrackGoalCount > 0) {
    factors.push({
      id: "goals",
      label: "Goal alignment",
      status: "weak",
      detail: `${offTrackGoalCount} planning goal${offTrackGoalCount === 1 ? " is" : "s are"} currently off track.`,
    });
  } else if (watchGoalCount > 0) {
    factors.push({
      id: "goals",
      label: "Goal alignment",
      status: "watch",
      detail: `${watchGoalCount} planning goal${watchGoalCount === 1 ? " is" : "s are"} in watch status.`,
    });
  } else if ((args.goalStatus || []).length > 0) {
    factors.push({
      id: "goals",
      label: "Goal alignment",
      status: "strong",
      detail: "All tracked planning goals are on track.",
    });
  }

  const weakCount = factors.filter((factor) => factor.status === "weak").length;
  const watchCount = factors.filter((factor) => factor.status === "watch").length;
  let score = 100 - (weakCount * 25) - (watchCount * 10);
  if (!Number.isFinite(score)) score = 50;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const status = weakCount > 0 ? "fragile" : watchCount > 1 ? "watch" : "stable";
  const label = status === "fragile" ? "Fragile plan" : status === "watch" ? "Watch list" : "Stable plan";
  const primaryConcern = (factors.find((factor) => factor.status === "weak") || factors.find((factor) => factor.status === "watch") || factors[0])?.detail || "No major stress point surfaced.";

  return {
    score,
    status,
    label,
    primaryConcern,
    factors,
  };
}

export function buildPlanningAssumptionAudit(args: {
  scopeLabel: string;
  scenarioLabel: string;
  baselineLabel?: string;
  assumptions: PlanningAssumptions;
  overrides?: PlanningScenarioUnitOverride[];
  events?: PlanningScenarioEvent[];
  forecastOptions?: PlanningForecastOptions;
  exitPlan?: PlanningExitPlan;
  goals?: PlanningGoalSet;
  triggers?: PlanningTriggerSet;
  manualProjects?: PlanningManualCapitalProject[];
  capitalTargets?: PlanningCapitalTarget[];
  rentStrategyRows?: PlanningRentStrategyRow[];
  turnoverRows?: PlanningTurnoverRow[];
}): PlanningAssumptionAuditRow[] {
  const goals = args.goals || {};
  const triggers = args.triggers || {};
  const forecastOptions = args.forecastOptions || {};
  const exitPlan = args.exitPlan || { mode: "hold" };
  const goalCount = Object.values(goals).filter((value) => Number(value || 0) > 0).length;
  const triggerCount = Object.values(triggers).filter((value) => Number(value || 0) > 0).length;
  const overrides = args.overrides || [];
  const events = args.events || [];
  const manualProjects = args.manualProjects || [];
  const capitalTargets = args.capitalTargets || [];
  const pricedUnits = (args.rentStrategyRows || []).filter((row) => Number(row.targetRent || row.marketRent || 0) > 0).length;
  const turnoverPlans = (args.turnoverRows || []).filter((row) =>
    Number(row.makeReadyCost || 0) > 0
    || Number(row.downtimeDays || 0) > 0
    || Number(row.leasingFeePct || 0) > 0
    || Number(row.concessionWeeks || 0) > 0,
  ).length;

  const rows: PlanningAssumptionAuditRow[] = [
    { category: "Context", label: "Scope", value: args.scopeLabel },
    { category: "Context", label: "Scenario", value: args.scenarioLabel, note: args.baselineLabel ? `Baseline ${args.baselineLabel}` : "" },
    { category: "Model", label: "Forecast horizon", value: `${args.assumptions.horizonMonths} months` },
    { category: "Model", label: "Rent growth", value: `${args.assumptions.annualRentGrowthPct}% / yr` },
    { category: "Model", label: "OpEx growth", value: `${args.assumptions.annualExpenseGrowthPct}% / yr` },
    { category: "Model", label: "Value growth", value: `${args.assumptions.annualValueGrowthPct}% / yr` },
    { category: "Model", label: "Vacancy / credit loss", value: `${args.assumptions.vacancyRatePct}%` },
    { category: "Model", label: "Monthly CapEx reserve", value: `${Math.round(Number(args.assumptions.monthlyCapexReserve || 0))}` },
    { category: "Model", label: "Included utilities / mo", value: Number(args.assumptions.includedUtilitiesMonthly || 0) > 0 ? `${Math.round(Number(args.assumptions.includedUtilitiesMonthly || 0))}` : "Auto" },
    {
      category: "Forecast",
      label: "Rent forecast mode",
      value: forecastOptions.assumeRerentAfterTurnover ? "Assume re-rent after turnover" : "Only signed leases",
      note: forecastOptions.assumeRerentAfterTurnover ? `Rent source ${forecastOptions.rerentRentSource || "target"} | term ${Number(forecastOptions.rerentTermMonths || 12)} mo` : "",
    },
    { category: "Scenario", label: "Unit overrides", value: `${overrides.length}`, note: overrides.length ? `${overrides.filter((row) => row.mode !== "auto").length} active override${overrides.filter((row) => row.mode !== "auto").length === 1 ? "" : "s"}` : "No planning-only overrides" },
    { category: "Scenario", label: "Timeline events", value: `${events.length}`, note: events.length ? `${events.filter((event) => event.eventType === "unit_override").length} occupancy/rent event${events.filter((event) => event.eventType === "unit_override").length === 1 ? "" : "s"}` : "No dated scenario events" },
    { category: "Scenario", label: "Rent strategies", value: `${pricedUnits} priced unit${pricedUnits === 1 ? "" : "s"}` },
    { category: "Scenario", label: "Turnover assumptions", value: `${turnoverPlans} unit${turnoverPlans === 1 ? "" : "s"}`, note: turnoverPlans ? "Make-ready / downtime / concessions are feeding forecast assumptions." : "No explicit turnover costs yet" },
    { category: "Guardrails", label: "Goals tracked", value: `${goalCount}` },
    { category: "Guardrails", label: "Triggers enabled", value: `${triggerCount}` },
    {
      category: "Exit",
      label: "Exit mode",
      value: exitPlan.mode === "sell" ? "Sell" : exitPlan.mode === "refi" ? "Refi" : "Hold",
      note: exitPlan.mode === "sell"
        ? `${exitPlan.taxTreatment === "exchange_1031" ? "1031 exchange" : "Taxable sale"}`
        : exitPlan.mode === "refi"
          ? `${Number(exitPlan.targetRatePct || 0).toFixed(2)}% | ${Math.max(1, Number(exitPlan.termYears || 30))} years`
          : "No structural exit overlay",
    },
    { category: "Capital", label: "Manual projects", value: `${manualProjects.length}` },
    { category: "Capital", label: "Tracked capital targets", value: `${capitalTargets.length}` },
  ];

  return rows;
}

export function buildPlanningRecommendedMoves(args: {
  summary: PlanningProjectionSummary;
  reserveGap: number;
  milestones?: PlanningMilestone[];
  triggerAlerts?: PlanningTriggerAlert[];
  turnoverRows?: PlanningTurnoverRow[];
  decisionComparison: PlanningDecisionComparison;
  horizonMonths?: number;
  projectedCashFlow?: number;
}): PlanningRecommendedMove[] {
  const horizonMonths = Math.max(1, Math.round(Number(args.horizonMonths || 12)));
  const projectedCashFlow = Number.isFinite(Number(args.projectedCashFlow))
    ? Number(args.projectedCashFlow || 0)
    : Number(args.summary.firstYearCashFlow || 0);
  const moves: PlanningRecommendedMove[] = [];
  const nextMilestone = (args.milestones || [])[0] || null;
  const turnoverCandidate = (args.turnoverRows || []).find((row) => row.nextTurnoverDate);

  if (projectedCashFlow < 0) {
    moves.push({
      id: "cash-flow-gap",
      priority: "high",
      title: "Raise cash flow before treating this as the working plan",
      detail: `Projected cash flow is negative over the next ${horizonMonths} months. Pressure-test rent timing, vacancy, debt load, or reserve pacing before locking this in.`,
      actionLabel: "Test a stronger cash-flow scenario",
    });
  }

  if (Number(args.reserveGap || 0) > 0) {
    moves.push({
      id: "reserve-gap",
      priority: "medium",
      title: "Increase reserve funding to match tracked capital pressure",
      detail: `Tracked capital targets are asking for about ${Math.round(Number(args.reserveGap || 0))} more per month than the current reserve setting.`,
      actionLabel: "Raise monthly reserve target",
    });
  }

  if (Number(args.decisionComparison.monthlyCashFlowUpside || 0) > 0) {
    moves.push({
      id: "rent-roll-upside",
      priority: "medium",
      title: "Model the fuller rent roll explicitly",
      detail: `A fuller rent roll improves monthly cash flow by about ${Math.round(Number(args.decisionComparison.monthlyCashFlowUpside || 0))}. Turn that upside into a dated scenario instead of leaving it as a thought experiment.`,
      actionLabel: "Add a re-rent or occupancy event",
    });
  }

  if (turnoverCandidate && turnoverCandidate.nextTurnoverDate) {
    moves.push({
      id: "turnover-plan",
      priority: "medium",
      title: `Prepare for ${formatUnitLabel(turnoverCandidate.unit)} turnover`,
      detail: `${turnoverCandidate.propertyName} ${formatUnitLabel(turnoverCandidate.unit)} turns over on ${turnoverCandidate.nextTurnoverDate}. Capturing downtime, concessions, and target rent will make the forecast more trustworthy.`,
      actionLabel: "Set turnover assumptions",
    });
  }

  if (nextMilestone) {
    moves.push({
      id: "next-milestone",
      priority: "low",
      title: "Convert the next milestone into a dated scenario event",
      detail: `${nextMilestone.title} is coming on ${nextMilestone.date}. Dated scenario events make the forecast read more like a real operating plan.`,
      actionLabel: "Add a timeline event",
    });
  }

  const triggerAlert = (args.triggerAlerts || [])[0];
  if (triggerAlert) {
    moves.push({
      id: `trigger-${triggerAlert.id}`,
      priority: triggerAlert.priority,
      title: `Resolve the trigger: ${triggerAlert.title}`,
      detail: triggerAlert.detail,
      actionLabel: "Tune the trigger or the plan",
    });
  }

  const priorityRank = { high: 0, medium: 1, low: 2 };
  return moves
    .sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority])
    .slice(0, 6);
}

export function buildPlanningTriggerAlerts(args: {
  today: string;
  summary: PlanningProjectionSummary;
  reserve: PlanningReserveSummary;
  milestones: PlanningMilestone[];
  capitalTargets: PlanningCapitalTarget[];
  triggers?: PlanningTriggerSet;
}): PlanningTriggerAlert[] {
  const triggers = args.triggers || {};
  const alerts: PlanningTriggerAlert[] = [];
  const avgMonthlyCashFlow = Number(args.summary.firstYearCashFlow || 0) / 12;
  const reserveMonths = Number(args.reserve.firstYearCoverageMonths || 0);

  if (Number.isFinite(Number(triggers.minMonthlyCashFlow)) && Number(triggers.minMonthlyCashFlow) > 0 && avgMonthlyCashFlow < Number(triggers.minMonthlyCashFlow)) {
    alerts.push({
      id: "minMonthlyCashFlow",
      priority: avgMonthlyCashFlow < 0 ? "high" : "medium",
      title: "Cash-flow trigger fired",
      detail: `Average monthly cash flow is running about ${Math.round(avgMonthlyCashFlow)} against a trigger floor of ${Math.round(Number(triggers.minMonthlyCashFlow || 0))}.`,
    });
  }

  if (Number.isFinite(Number(triggers.minReserveMonths)) && Number(triggers.minReserveMonths) > 0 && reserveMonths < Number(triggers.minReserveMonths)) {
    alerts.push({
      id: "minReserveMonths",
      priority: reserveMonths < Number(triggers.minReserveMonths || 0) * 0.75 ? "high" : "medium",
      title: "Reserve coverage trigger fired",
      detail: `Reserve coverage is about ${reserveMonths.toFixed(1)} months versus a target floor of ${Number(triggers.minReserveMonths || 0).toFixed(1)} months.`,
    });
  }

  if (Number.isFinite(Number(triggers.leaseRolloverDays)) && Number(triggers.leaseRolloverDays) > 0) {
    const leaseMilestone = args.milestones.find((milestone) => milestone.title.includes("Lease ends") && dayDifference(args.today, milestone.date) >= 0 && dayDifference(args.today, milestone.date) <= Number(triggers.leaseRolloverDays || 0));
    if (leaseMilestone) {
      alerts.push({
        id: "leaseRolloverDays",
        priority: "medium",
        title: "Lease rollover trigger fired",
        detail: `${leaseMilestone.title} is within ${Math.max(0, dayDifference(args.today, leaseMilestone.date))} days. ${leaseMilestone.detail}.`,
      });
    }
  }

  if (Number.isFinite(Number(triggers.capexWarningMonths)) && Number(triggers.capexWarningMonths) > 0) {
    const capitalTarget = args.capitalTargets.find((target) => Number(target.monthsRemaining || 999) <= Number(triggers.capexWarningMonths || 0));
    if (capitalTarget) {
      alerts.push({
        id: "capexWarningMonths",
        priority: capitalTarget.urgency === "near_term" ? "high" : "medium",
        title: "Capital timing trigger fired",
        detail: `${capitalTarget.description} for ${capitalTarget.propertyName} ${formatUnitLabel(capitalTarget.unit)} is due in about ${capitalTarget.monthsRemaining} months, with roughly ${Math.round(capitalTarget.monthlyReserveTarget)} per month needed.`,
      });
    }
  }

  const priorityRank = { high: 0, medium: 1, low: 2 };
  return alerts.sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority]);
}

export function buildPlanningReviewInbox(args: {
  today: string;
  horizonMonths?: number;
  activeScenario?: { name?: string; updatedAt?: string } | null;
  scenarioIsDirty?: boolean;
  forecastOptions?: PlanningForecastOptions;
  milestones?: PlanningMilestone[];
  capitalTargets?: PlanningCapitalTarget[];
  triggerAlerts?: PlanningTriggerAlert[];
  recommendedMoves?: PlanningRecommendedMove[];
  actionItems?: Array<{
    id: string;
    title: string;
    notes?: string;
    status?: string;
    priority?: "high" | "medium" | "low";
    dueDate?: string;
  }>;
  confidence?: { label?: string; detail?: string } | null;
  goalCount?: number;
  triggerCount?: number;
}): PlanningReviewInboxItem[] {
  const today = String(args.today || "").slice(0, 10);
  const horizonMonths = Math.max(1, Math.round(Number(args.horizonMonths || 12)));
  const milestones = args.milestones || [];
  const capitalTargets = args.capitalTargets || [];
  const triggerAlerts = args.triggerAlerts || [];
  const recommendedMoves = args.recommendedMoves || [];
  const actionItems = args.actionItems || [];
  const items: PlanningReviewInboxItem[] = [];
  const addItem = (item?: PlanningReviewInboxItem | null) => {
    if (!item) return;
    if (items.some((existing) => existing.title === item.title && existing.dueDate === item.dueDate)) return;
    items.push(item);
  };

  const openActionItems = actionItems.filter((item) => item.status !== "done");
  const overdueAction = openActionItems.find((item) => item.dueDate && item.dueDate < today);
  const dueSoonAction = openActionItems.find((item) => item.dueDate && item.dueDate >= today && item.dueDate <= addDays(today, 21));
  if (overdueAction) {
    addItem({
      id: `action-overdue-${overdueAction.id}`,
      category: "action",
      priority: overdueAction.priority || "high",
      title: `Action overdue: ${overdueAction.title}`,
      detail: `This action item was due ${overdueAction.dueDate}.${overdueAction.notes ? ` ${overdueAction.notes}` : ""}`,
      actionLabel: "Update or complete the action",
      dueDate: overdueAction.dueDate,
    });
  } else if (dueSoonAction) {
    addItem({
      id: `action-soon-${dueSoonAction.id}`,
      category: "action",
      priority: dueSoonAction.priority || "medium",
      title: `Action due soon: ${dueSoonAction.title}`,
      detail: `This action item is due ${dueSoonAction.dueDate}.${dueSoonAction.notes ? ` ${dueSoonAction.notes}` : ""}`,
      actionLabel: "Review the due-soon action",
      dueDate: dueSoonAction.dueDate,
    });
  }

  if (args.scenarioIsDirty) {
    addItem({
      id: "scenario-unsaved",
      category: "scenario",
      priority: "medium",
      title: "Save or branch the current scenario edits",
      detail: "The current planning workspace has unsaved changes, so this version can drift away from the named scenario you started from.",
      actionLabel: "Save branch or update the scenario",
    });
  } else if (args.activeScenario?.updatedAt) {
    const updatedDate = String(args.activeScenario.updatedAt).slice(0, 10);
    const daysSinceUpdate = dayDifference(updatedDate, today);
    if (daysSinceUpdate >= 45) {
      addItem({
        id: "scenario-stale",
        category: "scenario",
        priority: daysSinceUpdate >= 90 ? "medium" : "low",
        title: "Refresh the saved scenario assumptions",
        detail: `${args.activeScenario.name || "This scenario"} has not been updated since ${updatedDate}. Recheck rent, reserve, and exit assumptions before treating it as current.`,
        actionLabel: "Review and refresh the scenario",
        dueDate: updatedDate,
      });
    }
  }

  const nextMilestone = milestones[0] || null;
  if (nextMilestone) {
    const milestoneDays = Math.max(0, dayDifference(today, nextMilestone.date));
    addItem({
      id: `milestone-${nextMilestone.propertyId}-${nextMilestone.date}`,
      category: "decision",
      priority: milestoneDays <= 30 ? "high" : milestoneDays <= 60 ? "medium" : "low",
      title: `Upcoming decision: ${nextMilestone.title}`,
      detail: `${nextMilestone.detail} This lands on ${nextMilestone.date}, about ${milestoneDays} day${milestoneDays === 1 ? "" : "s"} out.`,
      actionLabel: "Convert this milestone into a scenario decision",
      dueDate: nextMilestone.date,
    });

    if (!args.forecastOptions?.assumeRerentAfterTurnover && nextMilestone.title.includes("Lease ends") && milestoneDays <= horizonMonths * 31) {
      addItem({
        id: `forecast-cliff-${nextMilestone.propertyId}-${nextMilestone.date}`,
        category: "decision",
        priority: milestoneDays <= 60 ? "medium" : "low",
        title: "Decide what happens after the signed leases end",
        detail: "Forecast is set to signed leases only, so rent can fall to zero after the next lease end unless you add a scenario event or assumed re-rent path.",
        actionLabel: "Choose a post-lease forecast path",
        dueDate: nextMilestone.date,
      });
    }
  }

  const nextCapital = capitalTargets[0] || null;
  if (nextCapital && Number(nextCapital.monthsRemaining || 999) <= 18) {
    addItem({
      id: `capital-${nextCapital.assetId || nextCapital.description}-${nextCapital.targetDate}`,
      category: "capital",
      priority: nextCapital.urgency === "near_term" ? "high" : "medium",
      title: `Fund the next capital target: ${nextCapital.description}`,
      detail: `${nextCapital.propertyName} | ${formatUnitLabel(nextCapital.unit)} is due ${nextCapital.targetDate} with about ${Math.round(Number(nextCapital.monthlyReserveTarget || 0))}/mo implied reserve pressure.`,
      actionLabel: "Plan or fund the capital target",
      dueDate: nextCapital.mustFundBy || nextCapital.targetDate,
    });
  }

  triggerAlerts.slice(0, 2).forEach((alert) => {
    addItem({
      id: `trigger-${alert.id}`,
      category: "trigger",
      priority: alert.priority,
      title: alert.title,
      detail: alert.detail,
      actionLabel: "Tune the trigger or the plan",
    });
  });

  if ((args.confidence?.label || "").toLowerCase() !== "high confidence") {
    addItem({
      id: "data-confidence",
      category: "data",
      priority: "low",
      title: "Tighten the planning inputs before treating this as final",
      detail: args.confidence?.detail || "Some planning assumptions are still approximate, so this forecast is better as a draft than a locked plan.",
      actionLabel: "Review the assumptions audit",
    });
  }

  if (Number(args.goalCount || 0) === 0 && Number(args.triggerCount || 0) === 0) {
    addItem({
      id: "guardrails",
      category: "data",
      priority: "low",
      title: "Add at least one planning guardrail",
      detail: "No goals or triggers are set yet, so the plan has no explicit line for what counts as acceptable cash flow, reserve coverage, or rollover timing.",
      actionLabel: "Set goals or triggers",
    });
  }

  recommendedMoves.slice(0, 2).forEach((move) => {
    addItem({
      id: `move-${move.id}`,
      category: "decision",
      priority: move.priority,
      title: move.title,
      detail: move.detail,
      actionLabel: move.actionLabel,
    });
  });

  const priorityRank = { high: 0, medium: 1, low: 2 };
  return items
    .sort((left, right) => {
      const priorityCompare = priorityRank[left.priority] - priorityRank[right.priority];
      if (priorityCompare !== 0) return priorityCompare;
      if (left.dueDate && right.dueDate) return left.dueDate.localeCompare(right.dueDate);
      if (left.dueDate) return -1;
      if (right.dueDate) return 1;
      return left.title.localeCompare(right.title);
    })
    .slice(0, 8);
}

export function buildPlanningGoalStatus(args: {
  summary: PlanningProjectionSummary;
  reserve: PlanningReserveSummary;
  goals?: PlanningGoalSet;
}): PlanningGoalStatus[] {
  const goals = args.goals || {};
  const rows: PlanningGoalStatus[] = [];
  const addRow = (row?: PlanningGoalStatus | null) => {
    if (row) rows.push(row);
  };
  const statusForMinimum = (actual: number, target: number) => {
    if (actual >= target) return "on_track" as const;
    if (actual >= target * 0.9) return "watch" as const;
    return "off_track" as const;
  };
  const statusForMaximum = (actual: number, target: number) => {
    if (actual <= target) return "on_track" as const;
    if (actual <= target * 1.1) return "watch" as const;
    return "off_track" as const;
  };

  const monthlyCashFlow = Number(args.summary.firstYearCashFlow || 0) / 12;
  const annualCashFlow = Number(args.summary.firstYearCashFlow || 0);
  const endingEquity = Number(args.summary.horizonEndingEquity || 0);
  const reserveMonths = Number(args.reserve.firstYearCoverageMonths || 0);
  const ltv = Number(args.summary.currentMarketValue || 0) > 0
    ? Number(args.summary.currentLoanBalance || 0) / Number(args.summary.currentMarketValue || 0)
    : 0;
  const dscr = Number(args.summary.adjustedMonthlyDebtService || 0) > 0
    ? Number(args.summary.firstYearNetOperatingIncome || 0) / (Number(args.summary.adjustedMonthlyDebtService || 0) * 12)
    : 0;

  if (Number.isFinite(Number(goals.minMonthlyCashFlow)) && Number(goals.minMonthlyCashFlow) > 0) {
    addRow({
      id: "minMonthlyCashFlow",
      label: "Monthly cash flow",
      targetLabel: `>= ${Math.round(Number(goals.minMonthlyCashFlow || 0))}`,
      actualLabel: Math.round(monthlyCashFlow).toString(),
      status: statusForMinimum(monthlyCashFlow, Number(goals.minMonthlyCashFlow || 0)),
    });
  }
  if (Number.isFinite(Number(goals.minAnnualCashFlow)) && Number(goals.minAnnualCashFlow) > 0) {
    addRow({
      id: "minAnnualCashFlow",
      label: "Year-1 cash flow",
      targetLabel: `>= ${Math.round(Number(goals.minAnnualCashFlow || 0))}`,
      actualLabel: Math.round(annualCashFlow).toString(),
      status: statusForMinimum(annualCashFlow, Number(goals.minAnnualCashFlow || 0)),
    });
  }
  if (Number.isFinite(Number(goals.minReserveMonths)) && Number(goals.minReserveMonths) > 0) {
    addRow({
      id: "minReserveMonths",
      label: "Reserve coverage",
      targetLabel: `>= ${Number(goals.minReserveMonths || 0).toFixed(1)} mo`,
      actualLabel: `${reserveMonths.toFixed(1)} mo`,
      status: statusForMinimum(reserveMonths, Number(goals.minReserveMonths || 0)),
    });
  }
  if (Number.isFinite(Number(goals.minEndingEquity)) && Number(goals.minEndingEquity) > 0) {
    addRow({
      id: "minEndingEquity",
      label: "Horizon-end equity",
      targetLabel: `>= ${Math.round(Number(goals.minEndingEquity || 0))}`,
      actualLabel: Math.round(endingEquity).toString(),
      status: statusForMinimum(endingEquity, Number(goals.minEndingEquity || 0)),
    });
  }
  if (Number.isFinite(Number(goals.maxLtvPct)) && Number(goals.maxLtvPct) > 0) {
    addRow({
      id: "maxLtvPct",
      label: "Current LTV",
      targetLabel: `<= ${Math.round(Number(goals.maxLtvPct || 0) * 100)}%`,
      actualLabel: `${Math.round(ltv * 100)}%`,
      status: statusForMaximum(ltv, Number(goals.maxLtvPct || 0)),
    });
  }
  if (Number.isFinite(Number(goals.minDscr)) && Number(goals.minDscr) > 0) {
    addRow({
      id: "minDscr",
      label: "Debt-service coverage",
      targetLabel: `>= ${Number(goals.minDscr || 0).toFixed(2)}x`,
      actualLabel: `${dscr.toFixed(2)}x`,
      status: statusForMinimum(dscr, Number(goals.minDscr || 0)),
    });
  }

  return rows;
}
