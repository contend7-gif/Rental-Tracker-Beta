import { addDaysToIso } from "../lib/appSupport.ts";
import { formatUnitLabel } from "../domain/unitLabels.js";
import {
  normalizePlanningScenarioEvent,
  normalizePlanningScenarioEvents,
} from "../features/planning/planningState.js";

export function usePlanningWorkspaceActions({
  currency,
  draftPlanningManualProjectFromTarget,
  getPlanningTurnoverInput,
  planningAssumptions,
  planningCapitalMonthlyTarget,
  planningDecisionComparison,
  planningMilestones,
  planningNextCapitalTarget,
  planningRecommendedMoves,
  planningRentStrategy,
  planningTurnoverPlanner,
  planningUnitEconomicsRows,
  properties,
  propertyFilter,
  resetPlanningEventDraft,
  savePlanningManualProjectFromTarget,
  setNotice,
  setPlanningAssumptions,
  setPlanningEventDraft,
  setPlanningScenarioEvents,
  setPlanningSubtab,
  todayIso,
}) {
  const prefillPlanningScenarioEventDraft = (patch, noticeText = "") => {
    const propertyId = patch.propertyId || (propertyFilter !== "all" ? propertyFilter : properties[0]?.id || "");
    setPlanningSubtab("scenarios");
    setPlanningEventDraft((prev) => ({
      id: "",
      propertyId,
      unit: patch.eventType === "reserve_change" ? "Shared" : (patch.unit || prev.unit || "Shared"),
      date: patch.date || prev.date || todayIso,
      eventType: patch.eventType || prev.eventType || "unit_override",
      mode: patch.mode || prev.mode || "rented",
      monthlyRent: patch.monthlyRent ?? (patch.mode === "rented" ? prev.monthlyRent : ""),
      monthlyCapexReserve: patch.monthlyCapexReserve ?? (patch.eventType === "reserve_change" ? prev.monthlyCapexReserve : ""),
      notes: patch.notes ?? prev.notes ?? "",
    }));
    if (noticeText) {
      setNotice(noticeText);
    }
  };

  const applyPlanningScenarioEventPatch = (patch, noticeText = "Scenario event applied.") => {
    const normalized = normalizePlanningScenarioEvent({
      ...patch,
      propertyId: patch.propertyId || (propertyFilter !== "all" ? propertyFilter : properties[0]?.id || ""),
    });
    if (!normalized) {
      prefillPlanningScenarioEventDraft(patch, noticeText);
      return false;
    }
    setPlanningScenarioEvents((prev) => {
      const matchingExisting = prev.find((item) =>
        item.eventType === normalized.eventType &&
        item.propertyId === normalized.propertyId &&
        String(item.unit || "Shared") === String(normalized.unit || "Shared") &&
        item.date === normalized.date,
      );
      const next = matchingExisting
        ? prev.map((item) => (item.id === matchingExisting.id ? { ...normalized, id: matchingExisting.id } : item))
        : [...prev, normalized];
      return normalizePlanningScenarioEvents(next);
    });
    resetPlanningEventDraft();
    setPlanningSubtab("scenarios");
    setNotice(noticeText);
    return true;
  };

  const getPlanningScenarioTemplateCandidate = (templateKey) => {
    const rentCandidate = (planningDecisionComparison.upsideUnits || [])[0] || null;
    const turnoverCandidate = (planningTurnoverPlanner.rows || []).find((row) => row.nextTurnoverDate) || null;
    const ownerCandidate = planningUnitEconomicsRows.find((row) => /owner/i.test(String(row.currentStatus || "")) || /owner/i.test(String(row.plannedStatus || ""))) || null;
    const renewalCandidate = planningRentStrategy.rows.find((row) => row.renewalStart || row.targetRent || row.marketRent) || null;
    if (templateKey === "owner_move_out") return ownerCandidate || rentCandidate || turnoverCandidate || renewalCandidate || null;
    if (templateKey === "renew_target") return renewalCandidate || turnoverCandidate || rentCandidate || null;
    if (templateKey === "start_vacancy") return turnoverCandidate || renewalCandidate || rentCandidate || null;
    return rentCandidate || turnoverCandidate || ownerCandidate || renewalCandidate || null;
  };

  const buildPlanningScenarioTemplatePatch = (templateKey) => {
    const candidate = getPlanningScenarioTemplateCandidate(templateKey);
    const propertyId = candidate?.propertyId || (propertyFilter !== "all" ? propertyFilter : properties[0]?.id || "");
    const unit = candidate?.unit || "Shared";
    const unitStrategy = planningRentStrategy.rows.find((row) => row.propertyId === propertyId && row.unit === unit) || null;
    const turnoverRow = planningTurnoverPlanner.rows.find((row) => row.propertyId === propertyId && row.unit === unit) || null;
    const defaultRent = Number(
      unitStrategy?.targetRent
      || unitStrategy?.marketRent
      || candidate?.plannedRent
      || candidate?.monthlyRent
      || unitStrategy?.currentRent
      || 0,
    );
    const turnoverDowntimeDays = Math.max(1, Number(turnoverRow?.downtimeDays || getPlanningTurnoverInput(propertyId, unit).downtimeDays || 21));
    const turnoverDate = turnoverRow?.nextTurnoverDate || unitStrategy?.renewalStart || "";
    if (templateKey === "reserve_increase") {
      const nextReserve = Math.max(
        Number(planningCapitalMonthlyTarget || 0),
        Number(planningAssumptions.monthlyCapexReserve || 0),
      );
      return {
        patch: {
          propertyId,
          unit: "Shared",
          date: todayIso,
          eventType: "reserve_change",
          monthlyCapexReserve: String(Math.round(nextReserve * 100) / 100),
          notes: "Template: raise reserve to match tracked capital pressure.",
        },
        notice: "Reserve-increase template loaded into the scenario event form.",
      };
    }
    if (templateKey === "start_vacancy") {
      return {
        patch: {
          propertyId,
          unit,
          date: turnoverDate || todayIso,
          eventType: "unit_override",
          mode: "vacant",
          monthlyRent: "",
          notes: `Template: planning vacancy for ${formatUnitLabel(unit)}.`,
        },
        notice: `Vacancy template loaded for ${formatUnitLabel(unit)}.`,
      };
    }
    if (templateKey === "renew_target") {
      return {
        patch: {
          propertyId,
          unit,
          date: unitStrategy?.renewalStart || turnoverDate || todayIso,
          eventType: "unit_override",
          mode: "rented",
          monthlyRent: defaultRent ? String(defaultRent) : "",
          notes: `Template: renew ${formatUnitLabel(unit)}${defaultRent ? ` at ${currency(defaultRent)}` : ""}.`,
        },
        notice: `Renewal template loaded for ${formatUnitLabel(unit)}.`,
      };
    }
    if (templateKey === "owner_move_out") {
      return {
        patch: {
          propertyId,
          unit,
          date: turnoverDate || addDaysToIso(todayIso, 30) || todayIso,
          eventType: "unit_override",
          mode: "rented",
          monthlyRent: defaultRent ? String(defaultRent) : "",
          notes: `Template: owner move-out / re-rent for ${formatUnitLabel(unit)}.`,
        },
        notice: `Owner move-out template loaded for ${formatUnitLabel(unit)}.`,
      };
    }
    return {
      patch: {
        propertyId,
        unit,
        date: turnoverDate ? addDaysToIso(turnoverDate, turnoverDowntimeDays) || turnoverDate : todayIso,
        eventType: "unit_override",
        mode: "rented",
        monthlyRent: defaultRent ? String(defaultRent) : "",
        notes: `Template: planning re-rent for ${formatUnitLabel(unit)}.`,
      },
      notice: `Re-rent template loaded for ${formatUnitLabel(unit)}.`,
    };
  };

  const applyPlanningScenarioTemplate = (templateKey) => {
    const { patch, notice } = buildPlanningScenarioTemplatePatch(templateKey);
    prefillPlanningScenarioEventDraft(patch, notice);
  };

  const applyPlanningScenarioTemplateDirect = (templateKey) => {
    const { patch, notice } = buildPlanningScenarioTemplatePatch(templateKey);
    return applyPlanningScenarioEventPatch(patch, notice.replace("loaded into the scenario event form", "applied to this scenario").replace("loaded for", "applied for"));
  };

  const applyPlanningRecommendedMove = (move) => {
    if (!move) return;
    if (move.id === "reserve-gap") {
      const nextReserve = String(Math.round(Number(planningCapitalMonthlyTarget || 0) * 100) / 100);
      setPlanningAssumptions((prev) => ({ ...prev, monthlyCapexReserve: nextReserve }));
      setPlanningSubtab("scenarios");
      setNotice(`Monthly reserve target raised to ${currency(Number(nextReserve || 0))} for this scenario.`);
      return;
    }
    if (move.id === "rent-roll-upside") {
      applyPlanningScenarioTemplateDirect("re_rent");
      return;
    }
    if (move.id === "turnover-plan") {
      const turnoverCandidate = (planningTurnoverPlanner.rows || []).find((row) => row.nextTurnoverDate) || null;
      if (turnoverCandidate) {
        applyPlanningScenarioEventPatch({
          propertyId: turnoverCandidate.propertyId,
          unit: turnoverCandidate.unit,
          date: turnoverCandidate.nextTurnoverDate,
          eventType: "unit_override",
          mode: "vacant",
          monthlyRent: "",
          notes: `Template: turnover begins for ${formatUnitLabel(turnoverCandidate.unit)}.`,
        }, `Turnover event applied for ${formatUnitLabel(turnoverCandidate.unit)}. Use Rent planning to tune downtime and concessions.`);
        return;
      }
    }
    if (move.id === "next-milestone") {
      const nextMilestone = planningMilestones[0] || null;
      if (nextMilestone) {
        const milestoneUnitMatch = String(nextMilestone.title || "").match(/Unit\s+(.+)$/i);
        const sharedMilestoneMatch = String(nextMilestone.title || "").match(/\bShared$/i);
        applyPlanningScenarioEventPatch({
          propertyId: nextMilestone.propertyId,
          unit: milestoneUnitMatch?.[1] || (sharedMilestoneMatch ? "Shared" : "Shared"),
          date: nextMilestone.date,
          eventType: "unit_override",
          mode: String(nextMilestone.title || "").includes("Lease ends") ? "vacant" : "rented",
          monthlyRent: "",
          notes: `Template from milestone: ${nextMilestone.title}.`,
        }, "Next milestone converted into a dated scenario event.");
        return;
      }
    }
    if (move.id === "cash-flow-gap") {
      const hasUpsideUnit = (planningDecisionComparison.upsideUnits || []).length > 0;
      if (hasUpsideUnit) {
        applyPlanningScenarioTemplateDirect("re_rent");
        return;
      }
      setPlanningSubtab("scenarios");
      setNotice("Opened Scenarios so you can test a stronger cash-flow plan.");
      return;
    }
    if (move.id === "trigger-capexWarningMonths" && planningNextCapitalTarget) {
      draftPlanningManualProjectFromTarget(planningNextCapitalTarget);
      setPlanningSubtab("capital");
      setNotice("Drafted a capital project from the next tracked target.");
      return;
    }
    if (String(move.id || "").startsWith("trigger-")) {
      setPlanningSubtab("insights");
      setNotice("Opened the trigger/guardrail view so you can tune the plan or the threshold.");
      return;
    }
    setPlanningSubtab("scenarios");
    setNotice("Opened the scenario editor for the suggested move.");
  };

  const openPlanningReviewInboxItem = (item) => {
    if (!item) return;
    if (String(item.id || "").startsWith("move-")) {
      const moveId = String(item.id).replace(/^move-/, "");
      const matchedMove = planningRecommendedMoves.find((move) => move.id === moveId);
      if (matchedMove) {
        applyPlanningRecommendedMove(matchedMove);
        return;
      }
    }
    if (item.category === "capital") {
      if (planningNextCapitalTarget) {
        savePlanningManualProjectFromTarget(planningNextCapitalTarget);
      } else {
        setPlanningSubtab("capital");
        setNotice("Opened Capital so you can plan or fund the next project.");
      }
      return;
    }
    if (item.category === "action") {
      setPlanningSubtab("actions");
      setNotice("Opened the action plan so you can update the due item.");
      return;
    }
    if (item.category === "scenario" || item.category === "decision") {
      setPlanningSubtab("scenarios");
      setNotice("Opened Scenarios so you can update the assumption behind this review item.");
      return;
    }
    if (item.category === "data") {
      setPlanningSubtab("insights");
      setNotice("Opened Insights so you can tighten the planning assumptions.");
      return;
    }
    setPlanningSubtab("actions");
    setNotice("Opened Planning review details.");
  };

  return {
    applyPlanningRecommendedMove,
    applyPlanningScenarioTemplate,
    openPlanningReviewInboxItem,
  };
}
