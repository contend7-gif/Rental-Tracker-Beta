import { useMemo } from "react";
import {
  addDaysToIso,
  buildPrintableStatementHtml,
  buildStatementBranding,
  escapeHtml,
} from "../lib/appSupport.ts";
import { buildPlanningReviewInbox } from "../domain/planning.ts";
import { formatUnitLabel } from "../domain/unitLabels.js";
import {
  normalizePlanningForecastOptions,
  normalizePlanningGoals,
  normalizePlanningTriggers,
} from "../features/planning/planningState.js";

export function usePlanningWorkspaceNarrative({
  appSettings,
  currency,
  formatPropertyLabel,
  isPlanningActive,
  isHistoricalDashboard,
  planningActionItems,
  planningActiveScenario,
  planningAssumptions,
  planningAssumptionAuditRows,
  planningBaselineScenario,
  planningCapitalMonthlyTarget,
  planningCapitalTargetsMerged,
  planningDataConfidence,
  planningDecisionDashboard,
  planningExitPlan,
  planningGoalStatus,
  planningGoals,
  planningHealthSummary,
  planningHorizonDisplayMetrics,
  planningHorizonMonths,
  planningHorizonShortLabel,
  planningManualProjects,
  planningMilestones,
  planningNextCapitalTarget,
  planningRecommendedMoves,
  planningRecommendations,
  planningReserveGap,
  planningRentStrategyPricedUnitCount,
  planningRows,
  planningScenarioDiffRows,
  planningScenarioEvents,
  planningScenarioIsDirty,
  planningScenarioNotesDraft,
  planningScenarioOverrides,
  planningScopeLabel,
  planningScenarioComparisonsExtended,
  planningSubtab,
  planningSummary,
  planningTriggerAlerts,
  planningTriggers,
  planningForecastOptions,
  todayIso,
}) {
  const dashboardPlanningWatch = useMemo(() => {
    const topTrigger = planningTriggerAlerts[0] || null;
    const topMove = planningRecommendedMoves[0] || null;
    const nextCapital = planningNextCapitalTarget || null;
    const dueActionItems = planningActionItems.filter((item) => item.status !== "done" && item.dueDate && item.dueDate <= addDaysToIso(todayIso, 30));
    const rows = [];
    if (topMove) {
      rows.push({
        id: `move-${topMove.id}`,
        tone: topMove.priority === "high" ? "high" : topMove.priority === "medium" ? "medium" : "low",
        title: topMove.title,
        detail: topMove.detail,
      });
    }
    if (topTrigger) {
      rows.push({
        id: `trigger-${topTrigger.id}`,
        tone: topTrigger.priority === "high" ? "high" : topTrigger.priority === "medium" ? "medium" : "low",
        title: topTrigger.title,
        detail: topTrigger.detail,
      });
    }
    if (nextCapital) {
      rows.push({
        id: `capital-${nextCapital.description}-${nextCapital.targetDate}`,
        tone: nextCapital.urgency === "near_term" ? "high" : nextCapital.urgency === "watchlist" ? "medium" : "low",
        title: `Capital target: ${nextCapital.description}`,
        detail: `${nextCapital.propertyName} | Target ${nextCapital.targetDate} | ${currency(nextCapital.estimatedReplacementCost)} est. cost.`,
      });
    }
    if (dueActionItems[0]) {
      rows.push({
        id: `action-${dueActionItems[0].id}`,
        tone: dueActionItems[0].priority === "high" ? "high" : dueActionItems[0].priority === "medium" ? "medium" : "low",
        title: `Action due soon: ${dueActionItems[0].title}`,
        detail: `Due ${dueActionItems[0].dueDate}${dueActionItems[0].notes ? ` | ${dueActionItems[0].notes}` : ""}`,
      });
    }
    return {
      health: planningDecisionDashboard.health,
      confidence: planningDecisionDashboard.confidence,
      nextMove: topMove,
      currentDateOnly: isHistoricalDashboard,
      rows: rows
        .filter((row, index, list) => list.findIndex((candidate) => candidate.title === row.title) === index)
        .slice(0, 3),
      dueActionItems: dueActionItems.length,
    };
  }, [planningTriggerAlerts, planningRecommendedMoves, planningNextCapitalTarget, planningActionItems, todayIso, planningDecisionDashboard, isHistoricalDashboard, currency]);

  const planningReviewInbox = useMemo(
    () =>
      buildPlanningReviewInbox({
        today: todayIso,
        horizonMonths: planningHorizonMonths,
        activeScenario: planningActiveScenario ? { name: planningActiveScenario.name, updatedAt: planningActiveScenario.updatedAt } : null,
        scenarioIsDirty: planningScenarioIsDirty,
        forecastOptions: normalizePlanningForecastOptions(planningForecastOptions),
        milestones: planningMilestones,
        capitalTargets: planningCapitalTargetsMerged,
        triggerAlerts: planningTriggerAlerts,
        recommendedMoves: planningRecommendedMoves,
        actionItems: planningActionItems,
        confidence: planningDataConfidence,
        goalCount: Object.values(normalizePlanningGoals(planningGoals)).filter((value) => Number(value || 0) > 0).length,
        triggerCount: Object.values(normalizePlanningTriggers(planningTriggers)).filter((value) => Number(value || 0) > 0).length,
      }),
    [todayIso, planningHorizonMonths, planningActiveScenario, planningScenarioIsDirty, planningForecastOptions, planningMilestones, planningCapitalTargetsMerged, planningTriggerAlerts, planningRecommendedMoves, planningActionItems, planningDataConfidence, planningGoals, planningTriggers],
  );

  const planningOpenActionItems = useMemo(
    () => planningActionItems.filter((item) => item.status !== "done"),
    [planningActionItems],
  );

  const planningSubtabGuide = useMemo(() => {
    const guides = {
      overview: {
        title: "Executive read",
        detail: "Headline metrics and plan health.",
        badge: planningDecisionDashboard.health.label,
      },
      actions: {
        title: "Work queue",
        detail: "Review items and action tasks.",
        badge: `${planningReviewInbox.length + planningOpenActionItems.length} open`,
      },
      insights: {
        title: "Insights",
        detail: "Unit economics, goals, triggers, and comparisons.",
        badge: `${planningTriggerAlerts.length + planningGoalStatus.length} signals`,
      },
      scenarios: {
        title: "Scenario builder",
        detail: "Dated future changes.",
        badge: `${planningScenarioEvents.length} events`,
      },
      rent: {
        title: "Rent and turnover strategy",
        detail: "Target rents, downtime, and make-ready costs.",
        badge: `${planningRentStrategyPricedUnitCount} priced`,
      },
      exit: {
        title: "Hold, refinance, or sell",
        detail: "Debt payoff, sale proceeds, and tax estimate.",
        badge: planningExitPlan.mode,
      },
      forecast: {
        title: "Month-by-month forecast",
        detail: "Rent, debt, reserves, and equity by month.",
        badge: `${planningRows.length} months`,
      },
      capital: {
        title: "Capital and reserve planning",
        detail: "Replacement targets and manual projects.",
        badge: `${planningCapitalTargetsMerged.length + planningManualProjects.length} targets`,
      },
    };
    return guides[planningSubtab] || guides.overview;
  }, [
    planningCapitalTargetsMerged.length,
    planningDecisionDashboard.health.label,
    planningExitPlan.mode,
    planningGoalStatus.length,
    planningManualProjects.length,
    planningOpenActionItems.length,
    planningRentStrategyPricedUnitCount,
    planningReviewInbox.length,
    planningRows.length,
    planningScenarioEvents.length,
    planningSubtab,
    planningTriggerAlerts.length,
  ]);

  const planningOverviewJumpCards = useMemo(() => {
    const dueSoonCount = planningReviewInbox.filter((item) => item.dueDate && item.dueDate <= addDaysToIso(todayIso, 45)).length;
    const cashFlowGap = Math.min(0, Number(planningHorizonDisplayMetrics.cashFlow || 0));
    return [
      {
        id: "actions",
        title: "Actions queue",
        value: `${planningReviewInbox.length + planningOpenActionItems.length}`,
        detail: dueSoonCount > 0 ? `${dueSoonCount} due soon or time-sensitive.` : "Review inbox and task list.",
        subtab: "actions",
        tone: dueSoonCount > 0 ? "warn" : "neutral",
      },
      {
        id: "insights",
        title: "Signals to inspect",
        value: `${planningTriggerAlerts.length + planningGoalStatus.length}`,
        detail: "Goals, triggers, tax, and comparison views.",
        subtab: "insights",
        tone: planningTriggerAlerts.some((item) => item.priority === "high") ? "risk" : "neutral",
      },
      {
        id: "forecast",
        title: "Forecast gap",
        value: cashFlowGap < 0 ? currency(cashFlowGap) : currency(planningHorizonDisplayMetrics.cashFlow),
        detail: cashFlowGap < 0 ? `Negative over the next ${planningHorizonShortLabel}.` : `Positive over the next ${planningHorizonShortLabel}.`,
        subtab: "forecast",
        tone: cashFlowGap < 0 ? "risk" : "good",
      },
      {
        id: "capital",
        title: "Next capital target",
        value: planningNextCapitalTarget ? currency(planningNextCapitalTarget.estimatedReplacementCost) : "None",
        detail: planningNextCapitalTarget ? `${planningNextCapitalTarget.description} on ${planningNextCapitalTarget.targetDate}.` : "No tracked capital target is inside the plan.",
        subtab: "capital",
        tone: planningNextCapitalTarget?.urgency === "near_term" ? "risk" : planningNextCapitalTarget?.urgency === "watchlist" ? "warn" : "neutral",
      },
    ];
  }, [planningGoalStatus.length, planningHorizonDisplayMetrics.cashFlow, planningHorizonShortLabel, planningNextCapitalTarget, planningOpenActionItems.length, planningReviewInbox, planningTriggerAlerts, todayIso, currency]);

  const planningMemoText = useMemo(() => {
    if (!isPlanningActive) return "";
    const lines = [
      `Planning memo - ${planningScopeLabel}`,
      `Prepared: ${todayIso}`,
      `Scenario: ${planningActiveScenario?.name || "Current workspace"}`,
      `Plan health: ${planningHealthSummary.label} (${planningHealthSummary.score}/100)`,
      `Confidence: ${planningDataConfidence.label}`,
      "",
      "Headline metrics",
      `- ${planningHorizonShortLabel} NOI: ${currency(planningHorizonDisplayMetrics.netOperatingIncome)}`,
      `- ${planningHorizonShortLabel} cash flow: ${currency(planningHorizonDisplayMetrics.cashFlow)}`,
      `- Horizon-end equity: ${currency(planningSummary.horizonEndingEquity)}`,
      `- Monthly reserve target in scenario: ${currency(Number(planningAssumptions.monthlyCapexReserve || 0))}`,
      `- Asset-based reserve target: ${currency(planningCapitalMonthlyTarget)}`,
      `- Primary concern: ${planningHealthSummary.primaryConcern}`,
      "",
      "Recommended actions",
    ];

    planningRecommendations.forEach((item) => {
      lines.push(`- [${item.priority.toUpperCase()}] ${item.title}: ${item.detail}`);
    });

    lines.push("");
    lines.push("Recommended moves");
    planningRecommendedMoves.forEach((item) => {
      lines.push(`- [${item.priority.toUpperCase()}] ${item.title}: ${item.detail} | Next move: ${item.actionLabel}`);
    });

    lines.push("");
    lines.push("Scenario compare narrative");
    if (planningScenarioDiffRows.length === 0) {
      lines.push(`- Current workspace is materially aligned with ${planningBaselineScenario?.name || "the base preset"} right now.`);
    } else {
      planningScenarioDiffRows.slice(0, 6).forEach((row) => {
        lines.push(`- ${row.field}: ${row.baselineValue} -> ${row.scenarioValue}`);
      });
    }

    lines.push("");
    lines.push("Assumption audit");
    planningAssumptionAuditRows.forEach((row) => {
      lines.push(`- ${row.category} | ${row.label}: ${row.value}${row.note ? ` (${row.note})` : ""}`);
    });

    lines.push("");
    lines.push("Scenario notes");
    lines.push(planningScenarioNotesDraft.trim() || "None.");
    lines.push("");
    lines.push("Unit overrides");
    if (planningScenarioOverrides.length === 0) {
      lines.push("- None.");
    } else {
      planningScenarioOverrides.forEach((item) => {
        lines.push(`- ${formatPropertyLabel(item.propertyId)} | ${formatUnitLabel(item.unit)}: ${item.mode}${item.mode === "rented" && item.monthlyRent ? ` at ${currency(Number(item.monthlyRent || 0))}` : ""}`);
      });
    }

    lines.push("");
    lines.push("Capital targets");
    if (planningCapitalTargetsMerged.length === 0) {
      lines.push("- None.");
    } else {
      planningCapitalTargetsMerged.slice(0, 8).forEach((target) => {
        lines.push(`- ${target.description} | ${target.propertyName} | ${formatUnitLabel(target.unit)} | ${target.targetDate} | ${currency(target.estimatedReplacementCost)} | Reserve ${currency(target.monthlyReserveTarget)}/mo`);
      });
    }

    return lines.join("\n");
  }, [
    planningScopeLabel,
    todayIso,
    planningActiveScenario,
    planningHealthSummary,
    planningDataConfidence,
    planningSummary,
    planningHorizonShortLabel,
    planningHorizonDisplayMetrics.netOperatingIncome,
    planningHorizonDisplayMetrics.cashFlow,
    planningAssumptions.monthlyCapexReserve,
    planningCapitalMonthlyTarget,
    planningScenarioDiffRows,
    planningBaselineScenario,
    planningAssumptionAuditRows,
    planningRecommendedMoves,
    planningRecommendations,
    planningScenarioNotesDraft,
    planningScenarioOverrides,
    planningCapitalTargetsMerged,
    currency,
    formatPropertyLabel,
    isPlanningActive,
  ]);

  const planningMemoHtml = useMemo(() => {
    if (!isPlanningActive) return "";
    const recommendationHtml = planningRecommendations
      .map((item) => `<div class="detail-item"><div class="detail-label">${escapeHtml(item.priority.toUpperCase())}</div><div class="detail-value"><strong>${escapeHtml(item.title)}</strong><br />${escapeHtml(item.detail)}</div></div>`)
      .join("");
    const overrideHtml = planningScenarioOverrides.length === 0
      ? '<div class="muted-copy">No planning-only unit overrides are active.</div>'
      : `<div class="pill-row">${planningScenarioOverrides
        .map((item) => `<span class="pill">${escapeHtml(`${formatPropertyLabel(item.propertyId)} | ${formatUnitLabel(item.unit)} | ${item.mode}${item.mode === "rented" && item.monthlyRent ? ` | ${currency(Number(item.monthlyRent || 0))}` : ""}`)}</span>`)
        .join("")}</div>`;
    const capitalRowsHtml = planningCapitalTargetsMerged.length === 0
      ? '<div class="muted-copy">No capital targets are available yet.</div>'
      : `<div class="table-wrap"><table><thead><tr><th>Project</th><th>Property</th><th>Target date</th><th class="num">Est. cost</th><th class="num">Reserve / mo</th></tr></thead><tbody>${planningCapitalTargetsMerged.slice(0, 10).map((target) => `<tr><td>${escapeHtml(target.description)}</td><td>${escapeHtml(`${target.propertyName} | ${formatUnitLabel(target.unit)}`)}</td><td>${escapeHtml(target.targetDate)}</td><td class="num">${escapeHtml(currency(target.estimatedReplacementCost))}</td><td class="num">${escapeHtml(currency(target.monthlyReserveTarget))}</td></tr>`).join("")}</tbody></table></div>`;
    const compareRowsHtml = planningScenarioComparisonsExtended
      .map((scenario) => `<tr><td>${escapeHtml(scenario.label)}</td><td>${escapeHtml(scenario.scopeLabel)}</td><td class="num">${escapeHtml(currency(scenario.summary.firstYearNetOperatingIncome))}</td><td class="num">${escapeHtml(currency(scenario.summary.firstYearCashFlow))}</td><td class="num">${escapeHtml(currency(scenario.summary.horizonEndingEquity))}</td></tr>`)
      .join("");
    const recommendedMovesHtml = planningRecommendedMoves
      .map((item) => `<div class="detail-item"><div class="detail-label">${escapeHtml(item.actionLabel)}</div><div class="detail-value"><strong>${escapeHtml(item.title)}</strong><br />${escapeHtml(item.detail)}</div></div>`)
      .join("");
    const assumptionsAuditHtml = `<div class="table-wrap"><table><thead><tr><th>Category</th><th>Assumption</th><th>Value</th><th>Note</th></tr></thead><tbody>${planningAssumptionAuditRows.map((row) => `<tr><td>${escapeHtml(row.category)}</td><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.value)}</td><td>${escapeHtml(row.note || "")}</td></tr>`).join("")}</tbody></table></div>`;
    const narrativeCompareHtml = planningScenarioDiffRows.length === 0
      ? `<div class="note-box">${escapeHtml(`Current workspace is materially aligned with ${planningBaselineScenario?.name || "the base preset"} right now.`)}</div>`
      : `<div class="detail-grid">${planningScenarioDiffRows.slice(0, 8).map((row) => `<div class="detail-item"><div class="detail-label">${escapeHtml(row.field)}</div><div class="detail-value">${escapeHtml(`${row.baselineValue} -> ${row.scenarioValue}`)}</div></div>`).join("")}</div>`;

    return buildPrintableStatementHtml({
      title: `Planning memo - ${planningScopeLabel}`,
      subtitle: `${planningActiveScenario?.name || "Current workspace"} | ${todayIso}`,
      branding: buildStatementBranding(appSettings),
      bannerText: planningHealthSummary.primaryConcern || planningRecommendations[0]?.title || "Planning summary",
      summaryCards: [
        { label: `${planningHorizonShortLabel} NOI`, value: currency(planningHorizonDisplayMetrics.netOperatingIncome) },
        { label: `${planningHorizonShortLabel} cash flow`, value: currency(planningHorizonDisplayMetrics.cashFlow) },
        { label: "End equity", value: currency(planningSummary.horizonEndingEquity) },
        { label: "Reserve gap", value: currency(planningReserveGap), subtext: `Asset-based target ${currency(planningCapitalMonthlyTarget)}/mo` },
      ],
      sections: [
        {
          title: "Recommended actions",
          description: "Priority-ranked next steps for the current planning setup.",
          contentHtml: recommendationHtml ? `<div class="detail-grid">${recommendationHtml}</div>` : '<div class="muted-copy">No recommendations available.</div>',
        },
        {
          title: "Recommended moves",
          description: "Scenario changes to test.",
          contentHtml: recommendedMovesHtml ? `<div class="detail-grid">${recommendedMovesHtml}</div>` : '<div class="muted-copy">No additional moves suggested.</div>',
        },
        {
          title: "Scenario compare narrative",
          description: "Current plan against the selected baseline.",
          contentHtml: narrativeCompareHtml,
        },
        {
          title: "Assumption audit",
          description: "The live assumptions, overrides, and guardrails currently feeding the plan.",
          contentHtml: assumptionsAuditHtml,
        },
        {
          title: "Scenario notes",
          description: "Context for why this planning version exists.",
          contentHtml: `<div class="note-box">${escapeHtml(planningScenarioNotesDraft.trim() || "No scenario notes.")}</div>`,
        },
        {
          title: "Scenario overrides",
          description: "Planning-only occupancy and rent changes that do not alter live leases.",
          contentHtml: overrideHtml,
        },
        {
          title: "Capital targets",
          description: "Asset-based and manual projects folded into the reserve plan.",
          contentHtml: capitalRowsHtml,
        },
        {
          title: "Scenario comparison",
          description: "Current workspace against the selected saved scenario and base preset.",
          contentHtml: `<div class="table-wrap"><table><thead><tr><th>Scenario</th><th>Scope</th><th class="num">Year-1 NOI</th><th class="num">Year-1 cash flow</th><th class="num">End equity</th></tr></thead><tbody>${compareRowsHtml}</tbody></table></div>`,
        },
      ],
      footerNote: "Generated from Rental Tracker Planning.",
    });
  }, [
    planningRecommendations,
    planningRecommendedMoves,
    planningAssumptionAuditRows,
    planningScenarioDiffRows,
    planningBaselineScenario,
    planningScenarioOverrides,
    planningCapitalTargetsMerged,
    planningScenarioComparisonsExtended,
    planningScopeLabel,
    planningActiveScenario,
    todayIso,
    appSettings,
    planningHealthSummary,
    planningSummary,
    planningHorizonShortLabel,
    planningHorizonDisplayMetrics.netOperatingIncome,
    planningHorizonDisplayMetrics.cashFlow,
    planningReserveGap,
    planningCapitalMonthlyTarget,
    planningScenarioNotesDraft,
    currency,
    formatPropertyLabel,
    isPlanningActive,
  ]);

  return {
    dashboardPlanningWatch,
    planningMemoHtml,
    planningMemoText,
    planningOpenActionItems,
    planningOverviewJumpCards,
    planningReviewInbox,
    planningSubtabGuide,
  };
}
