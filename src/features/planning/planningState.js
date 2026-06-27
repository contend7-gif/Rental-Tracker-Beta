function isRecord(value) {
  return Boolean(value) && typeof value === "object";
}

export const PLANNING_PRESET_VALUES = {
  conservative: {
    horizonMonths: "24",
    annualRentGrowthPct: "2",
    annualExpenseGrowthPct: "3.5",
    annualValueGrowthPct: "2",
    vacancyRatePct: "8",
    monthlyCapexReserve: "350",
    includedUtilitiesMonthly: "",
  },
  base: {
    horizonMonths: "24",
    annualRentGrowthPct: "3",
    annualExpenseGrowthPct: "2.5",
    annualValueGrowthPct: "3",
    vacancyRatePct: "5",
    monthlyCapexReserve: "250",
    includedUtilitiesMonthly: "",
  },
  growth: {
    horizonMonths: "36",
    annualRentGrowthPct: "4.5",
    annualExpenseGrowthPct: "2.5",
    annualValueGrowthPct: "4",
    vacancyRatePct: "3",
    monthlyCapexReserve: "250",
    includedUtilitiesMonthly: "",
  },
};

export function getPlanningPresetValues(name = "base") {
  return { ...(PLANNING_PRESET_VALUES[name] || PLANNING_PRESET_VALUES.base) };
}

export function normalizePlanningAssumptions(raw) {
  const fallback = getPlanningPresetValues("base");
  const data = isRecord(raw) ? raw : {};
  const normalizedHorizon = String(data.horizonMonths ?? fallback.horizonMonths);
  return {
    horizonMonths: ["12", "24", "36"].includes(normalizedHorizon) ? normalizedHorizon : fallback.horizonMonths,
    annualRentGrowthPct: String(data.annualRentGrowthPct ?? fallback.annualRentGrowthPct),
    annualExpenseGrowthPct: String(data.annualExpenseGrowthPct ?? fallback.annualExpenseGrowthPct),
    annualValueGrowthPct: String(data.annualValueGrowthPct ?? fallback.annualValueGrowthPct),
    vacancyRatePct: String(data.vacancyRatePct ?? fallback.vacancyRatePct),
    monthlyCapexReserve: String(data.monthlyCapexReserve ?? fallback.monthlyCapexReserve),
    includedUtilitiesMonthly: String(data.includedUtilitiesMonthly ?? fallback.includedUtilitiesMonthly),
  };
}

export function planningAssumptionsMatch(left, right) {
  const normalizedLeft = normalizePlanningAssumptions(left);
  const normalizedRight = normalizePlanningAssumptions(right);
  return (
    normalizedLeft.horizonMonths === normalizedRight.horizonMonths &&
    normalizedLeft.annualRentGrowthPct === normalizedRight.annualRentGrowthPct &&
    normalizedLeft.annualExpenseGrowthPct === normalizedRight.annualExpenseGrowthPct &&
    normalizedLeft.annualValueGrowthPct === normalizedRight.annualValueGrowthPct &&
    normalizedLeft.vacancyRatePct === normalizedRight.vacancyRatePct &&
    normalizedLeft.monthlyCapexReserve === normalizedRight.monthlyCapexReserve &&
    normalizedLeft.includedUtilitiesMonthly === normalizedRight.includedUtilitiesMonthly
  );
}

export function createPlanningScenarioId() {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createPlanningProjectId() {
  return `cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createPlanningActionId() {
  return `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createPlanningEventId() {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizePlanningScenarioOverrides(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => isRecord(item) && item.propertyId && item.unit)
    .map((item) => ({
      propertyId: String(item.propertyId),
      unit: String(item.unit),
      mode: ["auto", "rented", "owner", "vacant"].includes(String(item.mode || "")) ? String(item.mode) : "auto",
      monthlyRent: String(item.monthlyRent ?? ""),
    }));
}

export function normalizePlanningManualProject(raw) {
  if (!isRecord(raw)) return null;
  const title = String(raw.title || "").trim();
  const propertyId = String(raw.propertyId || "").trim();
  const targetDate = String(raw.targetDate || "").trim();
  if (!title || !propertyId || !targetDate) return null;
  return {
    id: String(raw.id || createPlanningProjectId()),
    propertyId,
    unit: String(raw.unit || "Shared"),
    title,
    targetDate,
    estimatedCost: String(raw.estimatedCost ?? ""),
    linkedAssetId: String(raw.linkedAssetId || ""),
    notes: String(raw.notes || "").trim(),
    priority: ["high", "medium", "low"].includes(String(raw.priority || "")) ? String(raw.priority) : "medium",
    fundingSource: ["reserve", "cash", "financing", "heloc", "tbd"].includes(String(raw.fundingSource || "")) ? String(raw.fundingSource) : "tbd",
    scheduleType: ["one_time", "phased"].includes(String(raw.scheduleType || "")) ? String(raw.scheduleType) : "one_time",
    mustFundBy: String(raw.mustFundBy || "").trim(),
  };
}

export function normalizePlanningManualProjects(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizePlanningManualProject).filter(Boolean);
}

export function normalizePlanningScenarioEvent(raw) {
  if (!isRecord(raw) || !raw.propertyId || !raw.date || !raw.eventType) return null;
  if (!["unit_override", "reserve_change"].includes(String(raw.eventType))) return null;
  return {
    id: String(raw.id || createPlanningEventId()),
    propertyId: String(raw.propertyId),
    unit: String(raw.unit || "Shared"),
    date: String(raw.date || ""),
    eventType: String(raw.eventType),
    mode: ["rented", "owner", "vacant"].includes(String(raw.mode || "")) ? String(raw.mode) : "rented",
    monthlyRent: String(raw.monthlyRent ?? ""),
    monthlyCapexReserve: String(raw.monthlyCapexReserve ?? ""),
    notes: String(raw.notes || "").trim(),
  };
}

export function normalizePlanningScenarioEvents(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizePlanningScenarioEvent)
    .filter(Boolean)
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function normalizePlanningGoals(raw) {
  const data = isRecord(raw) ? raw : {};
  return {
    minMonthlyCashFlow: String(data.minMonthlyCashFlow ?? ""),
    minAnnualCashFlow: String(data.minAnnualCashFlow ?? ""),
    minReserveMonths: String(data.minReserveMonths ?? ""),
    minEndingEquity: String(data.minEndingEquity ?? ""),
    maxLtvPct: String(data.maxLtvPct ?? ""),
    minDscr: String(data.minDscr ?? ""),
  };
}

export function normalizePlanningTriggers(raw) {
  const data = isRecord(raw) ? raw : {};
  return {
    minMonthlyCashFlow: String(data.minMonthlyCashFlow ?? ""),
    minReserveMonths: String(data.minReserveMonths ?? ""),
    leaseRolloverDays: String(data.leaseRolloverDays ?? "60"),
    capexWarningMonths: String(data.capexWarningMonths ?? "6"),
  };
}

export function normalizePlanningDebtPayoffPlan(raw) {
  const data = isRecord(raw) ? raw : {};
  return {
    extraPrincipalMonthly: String(data.extraPrincipalMonthly ?? ""),
    lumpSumAmount: String(data.lumpSumAmount ?? ""),
    lumpSumDate: String(data.lumpSumDate || ""),
  };
}

export function normalizePlanningForecastOptions(raw) {
  const data = isRecord(raw) ? raw : {};
  return {
    assumeRerentAfterTurnover: data.assumeRerentAfterTurnover !== false,
    rerentRentSource: ["target", "market", "current"].includes(String(data.rerentRentSource || "")) ? String(data.rerentRentSource) : "target",
    rerentTermMonths: String(data.rerentTermMonths ?? "12"),
  };
}

export function planningForecastOptionsMatch(left, right) {
  const normalizedLeft = normalizePlanningForecastOptions(left);
  const normalizedRight = normalizePlanningForecastOptions(right);
  return (
    normalizedLeft.assumeRerentAfterTurnover === normalizedRight.assumeRerentAfterTurnover &&
    normalizedLeft.rerentRentSource === normalizedRight.rerentRentSource &&
    normalizedLeft.rerentTermMonths === normalizedRight.rerentTermMonths
  );
}

export function normalizePlanningScenario(raw) {
  if (!isRecord(raw)) return null;
  const name = String(raw.name || "").trim();
  if (!name) return null;
  return {
    id: String(raw.id || createPlanningScenarioId()),
    name,
    propertyId: raw.propertyId ? String(raw.propertyId) : "all",
    assumptions: normalizePlanningAssumptions(raw.assumptions),
    notes: String(raw.notes || "").trim(),
    overrides: normalizePlanningScenarioOverrides(raw.overrides),
    events: normalizePlanningScenarioEvents(raw.events),
    rentStrategies: normalizePlanningRentStrategies(raw.rentStrategies),
    forecastOptions: normalizePlanningForecastOptions(raw.forecastOptions),
    exitPlan: normalizePlanningExitPlan(raw.exitPlan),
    goals: normalizePlanningGoals(raw.goals),
    triggers: normalizePlanningTriggers(raw.triggers),
    debtPayoffPlan: normalizePlanningDebtPayoffPlan(raw.debtPayoffPlan),
    turnoverInputs: normalizePlanningTurnoverInputs(raw.turnoverInputs),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
}

export function normalizePlanningRentStrategy(raw) {
  if (!isRecord(raw) || !raw.propertyId || !raw.unit) return null;
  return {
    propertyId: String(raw.propertyId),
    unit: String(raw.unit),
    marketRent: String(raw.marketRent ?? ""),
    targetRent: String(raw.targetRent ?? ""),
    renewalStart: String(raw.renewalStart || ""),
    renewalTermMonths: String(raw.renewalTermMonths ?? "12"),
    notes: String(raw.notes || "").trim(),
  };
}

export function normalizePlanningRentStrategies(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizePlanningRentStrategy).filter(Boolean);
}

export function normalizePlanningTurnoverInput(raw) {
  if (!isRecord(raw) || !raw.propertyId || !raw.unit) return null;
  return {
    propertyId: String(raw.propertyId),
    unit: String(raw.unit),
    makeReadyCost: String(raw.makeReadyCost ?? ""),
    downtimeDays: String(raw.downtimeDays ?? "21"),
    leasingFeePct: String(raw.leasingFeePct ?? "4"),
    concessionWeeks: String(raw.concessionWeeks ?? "0"),
    notes: String(raw.notes || "").trim(),
  };
}

export function normalizePlanningTurnoverInputs(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizePlanningTurnoverInput).filter(Boolean);
}

export function normalizePlanningExitPlan(raw) {
  const data = isRecord(raw) ? raw : {};
  return {
    mode: ["hold", "refi", "sell"].includes(String(data.mode || "")) ? String(data.mode) : "hold",
    taxTreatment: ["taxable_sale", "exchange_1031"].includes(String(data.taxTreatment || "")) ? String(data.taxTreatment) : "taxable_sale",
    targetRatePct: String(data.targetRatePct ?? "5.75"),
    termYears: String(data.termYears ?? "30"),
    cashOutAmount: String(data.cashOutAmount ?? "0"),
    saleDate: String(data.saleDate || ""),
    sellingCostsPct: String(data.sellingCostsPct ?? "8"),
  };
}

export function normalizePlanningActionItem(raw) {
  if (!isRecord(raw) || !raw.title) return null;
  return {
    id: String(raw.id || createPlanningActionId()),
    title: String(raw.title).trim(),
    status: ["idea", "in_progress", "done"].includes(String(raw.status || "")) ? String(raw.status) : "idea",
    priority: ["high", "medium", "low"].includes(String(raw.priority || "")) ? String(raw.priority) : "medium",
    dueDate: String(raw.dueDate || ""),
    notes: String(raw.notes || "").trim(),
    propertyId: String(raw.propertyId || ""),
    unit: String(raw.unit || ""),
    sourceType: ["recommendation", "project", "manual"].includes(String(raw.sourceType || "")) ? String(raw.sourceType) : "manual",
    sourceKey: String(raw.sourceKey || ""),
  };
}

export function normalizePlanningActionItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizePlanningActionItem).filter(Boolean);
}
