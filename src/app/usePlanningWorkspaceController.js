import { useMemo, useState } from "react";
import { addDaysToIso, isRecord } from "../lib/appSupport.ts";
import { toLocalIsoDate } from "../lib/localDate.ts";
import {
  createPlanningActionId,
  createPlanningScenarioId,
  getPlanningPresetValues,
  normalizePlanningActionItems,
  normalizePlanningAssumptions,
  normalizePlanningDebtPayoffPlan,
  normalizePlanningExitPlan,
  normalizePlanningForecastOptions,
  normalizePlanningGoals,
  normalizePlanningManualProject,
  normalizePlanningManualProjects,
  normalizePlanningRentStrategies,
  normalizePlanningScenario,
  normalizePlanningScenarioEvent,
  normalizePlanningScenarioEvents,
  normalizePlanningScenarioOverrides,
  normalizePlanningTriggers,
  normalizePlanningTurnoverInputs,
} from "../features/planning/planningState.js";

function createBlankPlanningEventDraft(propertyId = "") {
  return {
    id: "",
    propertyId,
    unit: "Shared",
    date: "",
    eventType: "unit_override",
    mode: "rented",
    monthlyRent: "",
    monthlyCapexReserve: "",
    notes: "",
  };
}

function createBlankPlanningProjectDraft(propertyId = "") {
  return {
    id: "",
    propertyId,
    unit: "Shared",
    title: "",
    targetDate: "",
    estimatedCost: "",
    linkedAssetId: "",
    notes: "",
    priority: "medium",
    fundingSource: "tbd",
    scheduleType: "one_time",
    mustFundBy: "",
  };
}

function normalizePlanningProjectDraft(rawDraft) {
  return {
    id: "",
    propertyId: rawDraft?.propertyId ? String(rawDraft.propertyId) : "",
    unit: rawDraft?.unit ? String(rawDraft.unit) : "Shared",
    title: rawDraft?.title ? String(rawDraft.title) : "",
    targetDate: rawDraft?.targetDate ? String(rawDraft.targetDate) : "",
    estimatedCost: rawDraft?.estimatedCost ? String(rawDraft.estimatedCost) : "",
    linkedAssetId: rawDraft?.linkedAssetId ? String(rawDraft.linkedAssetId) : "",
    notes: rawDraft?.notes ? String(rawDraft.notes) : "",
    priority: ["high", "medium", "low"].includes(String(rawDraft?.priority || "")) ? String(rawDraft.priority) : "medium",
    fundingSource: ["reserve", "cash", "financing", "heloc", "tbd"].includes(String(rawDraft?.fundingSource || "")) ? String(rawDraft.fundingSource) : "tbd",
    scheduleType: ["one_time", "phased"].includes(String(rawDraft?.scheduleType || "")) ? String(rawDraft.scheduleType) : "one_time",
    mustFundBy: rawDraft?.mustFundBy ? String(rawDraft.mustFundBy) : "",
  };
}

export function usePlanningWorkspaceController({
  assets,
  openConfirmDialog,
  properties,
  propertyFilter,
  setNotice,
  setPropertyFilter,
  setUnitFilter,
  setView,
  units,
}) {
  const currentDateIso = useMemo(() => toLocalIsoDate(), []);
  const [planningAssumptions, setPlanningAssumptions] = useState(() => getPlanningPresetValues("base"));
  const [planningSavedScenarios, setPlanningSavedScenarios] = useState([]);
  const [planningActiveScenarioId, setPlanningActiveScenarioId] = useState("");
  const [planningScenarioNameDraft, setPlanningScenarioNameDraft] = useState("");
  const [planningScenarioNotesDraft, setPlanningScenarioNotesDraft] = useState("");
  const [planningScenarioOverrides, setPlanningScenarioOverrides] = useState([]);
  const [planningScenarioEvents, setPlanningScenarioEvents] = useState([]);
  const [planningSubtab, setPlanningSubtab] = useState("overview");
  const [planningRentStrategies, setPlanningRentStrategies] = useState([]);
  const [planningForecastOptions, setPlanningForecastOptions] = useState(() => normalizePlanningForecastOptions({}));
  const [planningExitPlan, setPlanningExitPlan] = useState(() => normalizePlanningExitPlan({}));
  const [planningGoals, setPlanningGoals] = useState(() => normalizePlanningGoals({}));
  const [planningTriggers, setPlanningTriggers] = useState(() => normalizePlanningTriggers({}));
  const [planningDebtPayoffPlan, setPlanningDebtPayoffPlan] = useState(() => normalizePlanningDebtPayoffPlan({}));
  const [planningBaselineScenarioId, setPlanningBaselineScenarioId] = useState("");
  const [planningActionItems, setPlanningActionItems] = useState([]);
  const [planningManualProjects, setPlanningManualProjects] = useState([]);
  const [planningTurnoverInputs, setPlanningTurnoverInputs] = useState([]);
  const [planningEventDraft, setPlanningEventDraft] = useState(() => createBlankPlanningEventDraft());
  const [planningProjectDraft, setPlanningProjectDraft] = useState(() => createBlankPlanningProjectDraft());

  const planningActiveScenario = useMemo(
    () => planningSavedScenarios.find((scenario) => scenario.id === planningActiveScenarioId) || null,
    [planningSavedScenarios, planningActiveScenarioId],
  );
  const planningBaselineScenario = useMemo(
    () => planningSavedScenarios.find((scenario) => scenario.id === planningBaselineScenarioId) || null,
    [planningSavedScenarios, planningBaselineScenarioId],
  );
  const planningProjectPropertyId = planningProjectDraft.propertyId || (propertyFilter !== "all" ? propertyFilter : properties[0]?.id || "");
  const planningEventPropertyId = planningEventDraft.propertyId || (propertyFilter !== "all" ? propertyFilter : properties[0]?.id || "");
  const planningEventUnitOptions = useMemo(
    () => ["Shared", ...units.filter((unit) => unit.propertyId === planningEventPropertyId).map((unit) => unit.name)],
    [units, planningEventPropertyId],
  );
  const planningProjectUnitOptions = useMemo(
    () => ["Shared", ...units.filter((unit) => unit.propertyId === planningProjectPropertyId).map((unit) => unit.name)],
    [units, planningProjectPropertyId],
  );
  const planningProjectLinkedAssetOptions = useMemo(
    () => assets.filter((asset) => asset.propertyId === planningProjectPropertyId),
    [assets, planningProjectPropertyId],
  );

  const restorePlanningWorkspaceFromBackupData = (rawData) => {
    const data = isRecord(rawData) ? rawData : {};
    const savedScenarios = Array.isArray(data.planningSavedScenarios)
      ? data.planningSavedScenarios.map(normalizePlanningScenario).filter(Boolean)
      : [];
    const requestedActiveId = typeof data.planningActiveScenarioId === "string" ? data.planningActiveScenarioId : "";
    const activeScenario = savedScenarios.find((scenario) => scenario.id === requestedActiveId) || null;
    const restoredAssumptions = isRecord(data.planningAssumptions)
      ? normalizePlanningAssumptions(data.planningAssumptions)
      : activeScenario?.assumptions || getPlanningPresetValues("base");
    const restoredOverrides = Array.isArray(data.planningScenarioOverrides)
      ? normalizePlanningScenarioOverrides(data.planningScenarioOverrides)
      : normalizePlanningScenarioOverrides(activeScenario?.overrides);
    const restoredEvents = Array.isArray(data.planningScenarioEvents)
      ? normalizePlanningScenarioEvents(data.planningScenarioEvents)
      : normalizePlanningScenarioEvents(activeScenario?.events);
    const restoredRentStrategies = Array.isArray(data.planningRentStrategies)
      ? normalizePlanningRentStrategies(data.planningRentStrategies)
      : normalizePlanningRentStrategies(activeScenario?.rentStrategies);
    const restoredForecastOptions = isRecord(data.planningForecastOptions)
      ? normalizePlanningForecastOptions(data.planningForecastOptions)
      : normalizePlanningForecastOptions(activeScenario?.forecastOptions);
    const restoredExitPlan = isRecord(data.planningExitPlan)
      ? normalizePlanningExitPlan(data.planningExitPlan)
      : normalizePlanningExitPlan(activeScenario?.exitPlan);
    const restoredGoals = isRecord(data.planningGoals)
      ? normalizePlanningGoals(data.planningGoals)
      : normalizePlanningGoals(activeScenario?.goals);
    const restoredTriggers = isRecord(data.planningTriggers)
      ? normalizePlanningTriggers(data.planningTriggers)
      : normalizePlanningTriggers(activeScenario?.triggers);
    const restoredDebtPayoffPlan = isRecord(data.planningDebtPayoffPlan)
      ? normalizePlanningDebtPayoffPlan(data.planningDebtPayoffPlan)
      : normalizePlanningDebtPayoffPlan(activeScenario?.debtPayoffPlan);
    const restoredTurnoverInputs = Array.isArray(data.planningTurnoverInputs)
      ? normalizePlanningTurnoverInputs(data.planningTurnoverInputs)
      : normalizePlanningTurnoverInputs(activeScenario?.turnoverInputs);

    setPlanningSavedScenarios(savedScenarios);
    setPlanningActiveScenarioId(activeScenario?.id || "");
    setPlanningBaselineScenarioId(typeof data.planningBaselineScenarioId === "string" ? data.planningBaselineScenarioId : "");
    setPlanningScenarioNameDraft(activeScenario?.name || "");
    setPlanningScenarioNotesDraft(activeScenario?.notes || "");
    setPlanningAssumptions(restoredAssumptions);
    setPlanningScenarioOverrides(restoredOverrides);
    setPlanningScenarioEvents(restoredEvents);
    setPlanningRentStrategies(restoredRentStrategies);
    setPlanningForecastOptions(restoredForecastOptions);
    setPlanningExitPlan(restoredExitPlan);
    setPlanningGoals(restoredGoals);
    setPlanningTriggers(restoredTriggers);
    setPlanningDebtPayoffPlan(restoredDebtPayoffPlan);
    setPlanningTurnoverInputs(restoredTurnoverInputs);
    setPlanningActionItems(normalizePlanningActionItems(data.planningActionItems));
    setPlanningManualProjects(normalizePlanningManualProjects(data.planningManualProjects));
    setPlanningEventDraft(createBlankPlanningEventDraft(activeScenario?.propertyId && activeScenario.propertyId !== "all" ? activeScenario.propertyId : ""));
    setPlanningProjectDraft(normalizePlanningProjectDraft(data.planningProjectDraft));
  };

  const clearPlanningScenarioSelection = () => {
    setPlanningActiveScenarioId("");
    setPlanningScenarioNameDraft("");
    setPlanningScenarioNotesDraft("");
    setPlanningScenarioOverrides([]);
    setPlanningScenarioEvents([]);
    setPlanningRentStrategies([]);
    setPlanningForecastOptions(normalizePlanningForecastOptions({}));
    setPlanningExitPlan(normalizePlanningExitPlan({}));
    setPlanningGoals(normalizePlanningGoals({}));
    setPlanningTriggers(normalizePlanningTriggers({}));
    setPlanningDebtPayoffPlan(normalizePlanningDebtPayoffPlan({}));
    setPlanningTurnoverInputs([]);
  };

  const resetPlanningWorkspace = () => {
    openConfirmDialog({
      title: "Reset working plan?",
      message: "This resets the current Planning workspace to base assumptions and clears active scenario inputs. Saved scenarios, action items, and manual capital projects are kept.",
      confirmLabel: "Reset plan",
      onConfirm: () => {
        setPlanningAssumptions(getPlanningPresetValues("base"));
        clearPlanningScenarioSelection();
        resetPlanningEventDraft();
        resetPlanningProjectDraft();
        setPlanningSubtab("overview");
        setNotice("Working plan reset to base assumptions. Saved scenarios, action items, and manual projects were kept.");
      },
    });
  };

  const buildPlanningScenarioRecord = (name, notes = planningScenarioNotesDraft.trim()) => ({
    id: createPlanningScenarioId(),
    name,
    propertyId: propertyFilter || "all",
    assumptions: normalizePlanningAssumptions(planningAssumptions),
    notes,
    overrides: normalizePlanningScenarioOverrides(planningScenarioOverrides),
    events: normalizePlanningScenarioEvents(planningScenarioEvents),
    rentStrategies: normalizePlanningRentStrategies(planningRentStrategies),
    forecastOptions: normalizePlanningForecastOptions(planningForecastOptions),
    exitPlan: normalizePlanningExitPlan(planningExitPlan),
    goals: normalizePlanningGoals(planningGoals),
    triggers: normalizePlanningTriggers(planningTriggers),
    debtPayoffPlan: normalizePlanningDebtPayoffPlan(planningDebtPayoffPlan),
    turnoverInputs: normalizePlanningTurnoverInputs(planningTurnoverInputs),
    updatedAt: new Date().toISOString(),
  });

  const createUniquePlanningScenarioName = (baseName) => {
    const trimmedBase = String(baseName || "").trim() || "Scenario branch";
    const existingNames = new Set(planningSavedScenarios.map((scenario) => String(scenario.name || "").trim().toLowerCase()));
    if (!existingNames.has(trimmedBase.toLowerCase())) return trimmedBase;
    let index = 2;
    let candidate = `${trimmedBase} ${index}`;
    while (existingNames.has(candidate.toLowerCase())) {
      index += 1;
      candidate = `${trimmedBase} ${index}`;
    }
    return candidate;
  };

  const savePlanningScenarioBranch = () => {
    const branchBase = planningActiveScenario?.name || planningScenarioNameDraft.trim() || "Current workspace";
    const branchName = createUniquePlanningScenarioName(`${branchBase} branch`);
    const branchNotesPrefix = planningActiveScenario?.name
      ? `Branch from ${planningActiveScenario.name} on ${currentDateIso}.`
      : `Branch from current workspace on ${currentDateIso}.`;
    const branchNotesBody = planningScenarioNotesDraft.trim();
    const nextScenario = buildPlanningScenarioRecord(
      branchName,
      branchNotesBody ? `${branchNotesPrefix} ${branchNotesBody}` : branchNotesPrefix,
    );
    setPlanningSavedScenarios((prev) => [nextScenario, ...prev].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
    setPlanningActiveScenarioId(nextScenario.id);
    setPlanningScenarioNameDraft(nextScenario.name);
    setPlanningScenarioNotesDraft(nextScenario.notes || "");
    setNotice(`Planning branch saved: ${nextScenario.name}.`);
  };

  const loadPlanningScenario = (scenario) => {
    if (!scenario) return;
    setPlanningAssumptions(normalizePlanningAssumptions(scenario.assumptions));
    setPlanningActiveScenarioId(scenario.id);
    setPlanningScenarioNameDraft(scenario.name);
    setPlanningScenarioNotesDraft(scenario.notes || "");
    setPlanningScenarioOverrides(normalizePlanningScenarioOverrides(scenario.overrides));
    setPlanningScenarioEvents(normalizePlanningScenarioEvents(scenario.events));
    setPlanningRentStrategies(normalizePlanningRentStrategies(scenario.rentStrategies));
    setPlanningForecastOptions(normalizePlanningForecastOptions(scenario.forecastOptions));
    setPlanningExitPlan(normalizePlanningExitPlan(scenario.exitPlan));
    setPlanningGoals(normalizePlanningGoals(scenario.goals));
    setPlanningTriggers(normalizePlanningTriggers(scenario.triggers));
    setPlanningDebtPayoffPlan(normalizePlanningDebtPayoffPlan(scenario.debtPayoffPlan));
    setPlanningTurnoverInputs(normalizePlanningTurnoverInputs(scenario.turnoverInputs));
    setPropertyFilter(scenario.propertyId || "all");
    setUnitFilter("all");
    setView("planning");
    setNotice(`Loaded planning scenario: ${scenario.name}.`);
  };

  const savePlanningScenarioAsNew = () => {
    const name = planningScenarioNameDraft.trim();
    if (!name) {
      setNotice("Name this planning scenario first.");
      return;
    }
    const nextScenario = buildPlanningScenarioRecord(name);
    setPlanningSavedScenarios((prev) => [nextScenario, ...prev].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
    setPlanningActiveScenarioId(nextScenario.id);
    setPlanningScenarioNameDraft(nextScenario.name);
    setNotice("Planning scenario saved.");
  };

  const updatePlanningScenario = () => {
    if (!planningActiveScenario) {
      setNotice("Load or save a planning scenario first.");
      return;
    }
    const name = planningScenarioNameDraft.trim() || planningActiveScenario.name;
    const updatedScenario = {
      ...planningActiveScenario,
      name,
      propertyId: propertyFilter || "all",
      assumptions: normalizePlanningAssumptions(planningAssumptions),
      notes: planningScenarioNotesDraft.trim(),
      overrides: normalizePlanningScenarioOverrides(planningScenarioOverrides),
      events: normalizePlanningScenarioEvents(planningScenarioEvents),
      rentStrategies: normalizePlanningRentStrategies(planningRentStrategies),
      forecastOptions: normalizePlanningForecastOptions(planningForecastOptions),
      exitPlan: normalizePlanningExitPlan(planningExitPlan),
      goals: normalizePlanningGoals(planningGoals),
      triggers: normalizePlanningTriggers(planningTriggers),
      debtPayoffPlan: normalizePlanningDebtPayoffPlan(planningDebtPayoffPlan),
      turnoverInputs: normalizePlanningTurnoverInputs(planningTurnoverInputs),
      updatedAt: new Date().toISOString(),
    };
    setPlanningSavedScenarios((prev) =>
      prev
        .map((scenario) => (scenario.id === updatedScenario.id ? updatedScenario : scenario))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    );
    setPlanningActiveScenarioId(updatedScenario.id);
    setPlanningScenarioNameDraft(updatedScenario.name);
    setNotice("Planning scenario updated.");
  };

  const deletePlanningScenario = (scenario) => {
    if (!scenario) return;
    openConfirmDialog({
      title: "Delete planning scenario?",
      message: `This will remove the saved scenario "${scenario.name}".`,
      confirmLabel: "Delete scenario",
      onConfirm: () => {
        setPlanningSavedScenarios((prev) => prev.filter((item) => item.id !== scenario.id));
        if (planningActiveScenarioId === scenario.id) {
          clearPlanningScenarioSelection();
        }
        setNotice("Planning scenario deleted.");
      },
    });
  };

  const clonePlanningScenario = (scenario) => {
    if (!scenario) return;
    const clone = {
      ...scenario,
      id: createPlanningScenarioId(),
      name: `${scenario.name} copy`,
      updatedAt: new Date().toISOString(),
    };
    setPlanningSavedScenarios((prev) => [clone, ...prev].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
    setPlanningActiveScenarioId(clone.id);
    setPlanningScenarioNameDraft(clone.name);
    setPlanningScenarioNotesDraft(clone.notes || "");
    setPlanningAssumptions(normalizePlanningAssumptions(clone.assumptions));
    setPlanningScenarioOverrides(normalizePlanningScenarioOverrides(clone.overrides));
    setPlanningScenarioEvents(normalizePlanningScenarioEvents(clone.events));
    setPlanningRentStrategies(normalizePlanningRentStrategies(clone.rentStrategies));
    setPlanningForecastOptions(normalizePlanningForecastOptions(clone.forecastOptions));
    setPlanningExitPlan(normalizePlanningExitPlan(clone.exitPlan));
    setPlanningGoals(normalizePlanningGoals(clone.goals));
    setPlanningTriggers(normalizePlanningTriggers(clone.triggers));
    setPlanningDebtPayoffPlan(normalizePlanningDebtPayoffPlan(clone.debtPayoffPlan));
    setPlanningTurnoverInputs(normalizePlanningTurnoverInputs(clone.turnoverInputs));
    setNotice(`Planning scenario cloned: ${clone.name}.`);
  };

  const setPlanningUnitOverride = (propertyId, unitName, patch) => {
    setPlanningScenarioOverrides((prev) => {
      const current = prev.find((item) => item.propertyId === propertyId && item.unit === unitName) || {
        propertyId,
        unit: unitName,
        mode: "auto",
        monthlyRent: "",
      };
      const next = { ...current, ...patch };
      const filtered = prev.filter((item) => !(item.propertyId === propertyId && item.unit === unitName));
      if (next.mode === "auto" && !String(next.monthlyRent || "").trim()) {
        return filtered;
      }
      return [...filtered, next];
    });
  };

  const getPlanningUnitOverride = (propertyId, unitName) =>
    planningScenarioOverrides.find((item) => item.propertyId === propertyId && item.unit === unitName) || {
      propertyId,
      unit: unitName,
      mode: "auto",
      monthlyRent: "",
    };

  const resetPlanningEventDraft = () => {
    setPlanningEventDraft(createBlankPlanningEventDraft(propertyFilter !== "all" ? propertyFilter : properties[0]?.id || ""));
  };

  const savePlanningScenarioEvent = () => {
    const normalized = normalizePlanningScenarioEvent({
      ...planningEventDraft,
      propertyId: planningEventDraft.propertyId || planningEventPropertyId,
    });
    if (!normalized) {
      setNotice("Event type, property, and effective date are required.");
      return;
    }
    setPlanningScenarioEvents((prev) => {
      const next = prev.some((item) => item.id === normalized.id)
        ? prev.map((item) => (item.id === normalized.id ? normalized : item))
        : [...prev, normalized];
      return normalizePlanningScenarioEvents(next);
    });
    resetPlanningEventDraft();
    setNotice(normalized.id === planningEventDraft.id ? "Scenario event updated." : "Scenario event added.");
  };

  const editPlanningScenarioEvent = (event) => {
    setPlanningEventDraft({
      id: event.id,
      propertyId: event.propertyId,
      unit: event.unit || "Shared",
      date: event.date,
      eventType: event.eventType,
      mode: event.mode || "rented",
      monthlyRent: String(event.monthlyRent ?? ""),
      monthlyCapexReserve: String(event.monthlyCapexReserve ?? ""),
      notes: event.notes || "",
    });
  };

  const deletePlanningScenarioEvent = (event) => {
    openConfirmDialog({
      title: "Delete scenario event?",
      message: `Remove the ${event.eventType === "reserve_change" ? "reserve change" : "unit change"} dated ${event.date}?`,
      confirmLabel: "Delete event",
      onConfirm: () => {
        setPlanningScenarioEvents((prev) => prev.filter((item) => item.id !== event.id));
        if (planningEventDraft.id === event.id) {
          resetPlanningEventDraft();
        }
        setNotice("Scenario event deleted.");
      },
    });
  };

  const setPlanningRentStrategy = (propertyId, unitName, patch) => {
    setPlanningRentStrategies((prev) => {
      const current = prev.find((item) => item.propertyId === propertyId && item.unit === unitName) || {
        propertyId,
        unit: unitName,
        marketRent: "",
        targetRent: "",
        renewalStart: "",
        renewalTermMonths: "12",
        notes: "",
      };
      const next = { ...current, ...patch };
      const filtered = prev.filter((item) => !(item.propertyId === propertyId && item.unit === unitName));
      if (!String(next.marketRent || "").trim() && !String(next.targetRent || "").trim() && !String(next.renewalStart || "").trim() && !String(next.notes || "").trim()) {
        return filtered;
      }
      return [...filtered, next];
    });
  };

  const getPlanningRentStrategy = (propertyId, unitName) =>
    planningRentStrategies.find((item) => item.propertyId === propertyId && item.unit === unitName) || {
      propertyId,
      unit: unitName,
      marketRent: "",
      targetRent: "",
      renewalStart: "",
      renewalTermMonths: "12",
      notes: "",
    };

  const setPlanningTurnoverInput = (propertyId, unitName, patch) => {
    setPlanningTurnoverInputs((prev) => {
      const current = prev.find((item) => item.propertyId === propertyId && item.unit === unitName) || {
        propertyId,
        unit: unitName,
        makeReadyCost: "",
        downtimeDays: "21",
        leasingFeePct: "4",
        concessionWeeks: "0",
        notes: "",
      };
      const next = { ...current, ...patch };
      const filtered = prev.filter((item) => !(item.propertyId === propertyId && item.unit === unitName));
      if (
        !String(next.makeReadyCost || "").trim()
        && !String(next.downtimeDays || "").trim()
        && !String(next.leasingFeePct || "").trim()
        && !String(next.concessionWeeks || "").trim()
        && !String(next.notes || "").trim()
      ) {
        return filtered;
      }
      return [...filtered, next];
    });
  };

  const getPlanningTurnoverInput = (propertyId, unitName) =>
    planningTurnoverInputs.find((item) => item.propertyId === propertyId && item.unit === unitName) || {
      propertyId,
      unit: unitName,
      makeReadyCost: "",
      downtimeDays: "21",
      leasingFeePct: "4",
      concessionWeeks: "0",
      notes: "",
    };

  const addPlanningActionItem = (payload) => {
    const priority = payload.priority || "medium";
    const dueOffsetDays = priority === "high" ? 30 : priority === "medium" ? 60 : 90;
    const dueDate = payload.dueDate || addDaysToIso(currentDateIso, dueOffsetDays) || currentDateIso;
    const sourceKey = payload.sourceKey || "";
    setPlanningActionItems((prev) => {
      const duplicate = prev.find((item) =>
        item.status !== "done" &&
        (
          (sourceKey && item.sourceKey === sourceKey) ||
          (!sourceKey &&
            String(item.title || "").trim().toLowerCase() === String(payload.title || "").trim().toLowerCase() &&
            String(item.sourceType || "") === String(payload.sourceType || "manual") &&
            String(item.propertyId || "") === String(payload.propertyId || "") &&
            String(item.unit || "") === String(payload.unit || ""))
        ),
      );
      if (duplicate) {
        return prev.map((item) => item.id === duplicate.id
          ? {
              ...item,
              priority,
              dueDate: item.dueDate || dueDate,
              notes: item.notes || payload.notes || "",
              sourceKey: item.sourceKey || sourceKey,
            }
          : item);
      }
      return [{
        id: createPlanningActionId(),
        title: payload.title,
        status: "idea",
        priority,
        dueDate,
        notes: payload.notes || "",
        propertyId: payload.propertyId || "",
        unit: payload.unit || "",
        sourceType: payload.sourceType || "manual",
        sourceKey,
      }, ...prev];
    });
  };

  const updatePlanningActionItem = (id, patch) => {
    setPlanningActionItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const deletePlanningActionItem = (item) => {
    openConfirmDialog({
      title: "Delete action item?",
      message: `Remove "${item.title}" from the planning action list?`,
      confirmLabel: "Delete action",
      onConfirm: () => {
        setPlanningActionItems((prev) => prev.filter((entry) => entry.id !== item.id));
        setNotice("Planning action deleted.");
      },
    });
  };

  const addPlanningActionFromCapitalTarget = (target) => {
    addPlanningActionItem({
      title: target.description,
      priority: target.priority || (target.urgency === "near_term" ? "high" : target.urgency === "watchlist" ? "medium" : "low"),
      dueDate: target.mustFundBy || target.targetDate,
      notes: target.notes || "",
      propertyId: target.propertyId,
      unit: target.unit,
      sourceType: target.source === "manual" ? "project" : "recommendation",
    });
    setNotice("Capital target added to the action plan.");
  };

  const savePlanningManualProjectFromTarget = (target) => {
    const normalized = normalizePlanningManualProject({
      propertyId: target.propertyId,
      unit: target.unit || "Shared",
      title: target.description,
      targetDate: target.targetDate,
      estimatedCost: String(Math.round(Number(target.estimatedReplacementCost || 0) * 100) / 100),
      linkedAssetId: target.source === "asset" ? target.assetId : (target.linkedAssetId || ""),
      notes: target.notes || "",
      priority: target.priority || (target.urgency === "near_term" ? "high" : target.urgency === "watchlist" ? "medium" : "low"),
      fundingSource: target.fundingSource || "tbd",
      scheduleType: target.scheduleType || "one_time",
      mustFundBy: target.mustFundBy || "",
    });
    if (!normalized) return false;
    setPlanningManualProjects((prev) => {
      const matchingExisting = prev.find((item) =>
        item.propertyId === normalized.propertyId
        && item.unit === normalized.unit
        && item.title === normalized.title
        && item.targetDate === normalized.targetDate,
      );
      const next = matchingExisting
        ? prev.map((item) => (item.id === matchingExisting.id ? { ...normalized, id: matchingExisting.id } : item))
        : [...prev, normalized];
      return normalizePlanningManualProjects(next);
    });
    setPlanningSubtab("capital");
    setNotice(`Capital project created for ${target.description}.`);
    return true;
  };

  const draftPlanningManualProjectFromTarget = (target) => {
    setPlanningProjectDraft({
      id: "",
      propertyId: target.propertyId,
      unit: target.unit || "Shared",
      title: target.description,
      targetDate: target.targetDate || "",
      estimatedCost: String(Number(target.estimatedReplacementCost || 0) || ""),
      linkedAssetId: target.source === "asset" ? target.assetId : target.linkedAssetId || target.assetId || "",
      notes: target.notes || "",
      priority: target.priority || (target.urgency === "near_term" ? "high" : target.urgency === "watchlist" ? "medium" : "low"),
      fundingSource: target.fundingSource || "tbd",
      scheduleType: target.scheduleType || "one_time",
      mustFundBy: target.mustFundBy || target.targetDate || "",
    });
    setNotice("Capital target loaded into the manual project form.");
  };

  const resetPlanningProjectDraft = () => {
    setPlanningProjectDraft(createBlankPlanningProjectDraft(propertyFilter !== "all" ? propertyFilter : properties[0]?.id || ""));
  };

  const savePlanningManualProject = () => {
    const normalized = normalizePlanningManualProject({
      ...planningProjectDraft,
      propertyId: planningProjectDraft.propertyId || planningProjectPropertyId,
    });
    if (!normalized) {
      setNotice("Project name, property, and target date are required.");
      return;
    }
    setPlanningManualProjects((prev) => {
      const next = prev.some((item) => item.id === normalized.id)
        ? prev.map((item) => (item.id === normalized.id ? normalized : item))
        : [normalized, ...prev];
      return next;
    });
    resetPlanningProjectDraft();
    setNotice(normalized.id === planningProjectDraft.id ? "Capital project updated." : "Capital project added.");
  };

  const editPlanningManualProject = (project) => {
    setPlanningProjectDraft({
      id: project.id,
      propertyId: project.propertyId,
      unit: project.unit,
      title: project.title,
      targetDate: project.targetDate,
      estimatedCost: String(project.estimatedCost || ""),
      linkedAssetId: project.linkedAssetId || "",
      notes: project.notes || "",
      priority: project.priority || "medium",
      fundingSource: project.fundingSource || "tbd",
      scheduleType: project.scheduleType || "one_time",
      mustFundBy: project.mustFundBy || "",
    });
  };

  const deletePlanningManualProject = (project) => {
    openConfirmDialog({
      title: "Delete capital project?",
      message: `This will remove "${project.title}" from the manual capital plan.`,
      confirmLabel: "Delete project",
      onConfirm: () => {
        setPlanningManualProjects((prev) => prev.filter((item) => item.id !== project.id));
        if (planningProjectDraft.id === project.id) {
          resetPlanningProjectDraft();
        }
        setNotice("Capital project deleted.");
      },
    });
  };

  return {
    addPlanningActionFromCapitalTarget,
    addPlanningActionItem,
    clearPlanningScenarioSelection,
    clonePlanningScenario,
    deletePlanningActionItem,
    deletePlanningManualProject,
    deletePlanningScenario,
    deletePlanningScenarioEvent,
    draftPlanningManualProjectFromTarget,
    editPlanningManualProject,
    editPlanningScenarioEvent,
    getPlanningRentStrategy,
    getPlanningTurnoverInput,
    getPlanningUnitOverride,
    loadPlanningScenario,
    planningActionItems,
    planningActiveScenario,
    planningActiveScenarioId,
    planningAssumptions,
    planningBaselineScenario,
    planningBaselineScenarioId,
    planningDebtPayoffPlan,
    planningEventDraft,
    planningEventPropertyId,
    planningEventUnitOptions,
    planningExitPlan,
    planningForecastOptions,
    planningGoals,
    planningManualProjects,
    planningProjectDraft,
    planningProjectLinkedAssetOptions,
    planningProjectPropertyId,
    planningProjectUnitOptions,
    planningRentStrategies,
    planningSavedScenarios,
    planningScenarioEvents,
    planningScenarioNameDraft,
    planningScenarioNotesDraft,
    planningScenarioOverrides,
    planningSubtab,
    planningTriggers,
    planningTurnoverInputs,
    resetPlanningEventDraft,
    resetPlanningProjectDraft,
    resetPlanningWorkspace,
    restorePlanningWorkspaceFromBackupData,
    savePlanningManualProject,
    savePlanningManualProjectFromTarget,
    savePlanningScenarioAsNew,
    savePlanningScenarioBranch,
    savePlanningScenarioEvent,
    setPlanningAssumptions,
    setPlanningBaselineScenarioId,
    setPlanningDebtPayoffPlan,
    setPlanningEventDraft,
    setPlanningExitPlan,
    setPlanningForecastOptions,
    setPlanningGoals,
    setPlanningProjectDraft,
    setPlanningRentStrategy,
    setPlanningScenarioEvents,
    setPlanningScenarioNameDraft,
    setPlanningScenarioNotesDraft,
    setPlanningSubtab,
    setPlanningTriggers,
    setPlanningTurnoverInput,
    setPlanningUnitOverride,
    updatePlanningActionItem,
    updatePlanningScenario,
  };
}
