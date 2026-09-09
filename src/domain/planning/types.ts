

export type PlanningAssumptions = {
  horizonMonths: number;
  annualRentGrowthPct: number;
  annualExpenseGrowthPct: number;
  annualValueGrowthPct: number;
  vacancyRatePct: number;
  monthlyCapexReserve: number;
  includedUtilitiesMonthly?: number;
};

export type PlanningForecastOptions = {
  assumeRerentAfterTurnover?: boolean;
  rerentRentSource?: "target" | "market" | "current";
  rerentTermMonths?: number;
};

export type PlanningScenarioUnitOverride = {
  propertyId: string;
  unit: string;
  mode: "auto" | "rented" | "owner" | "vacant";
  monthlyRent?: number;
};

export type PlanningScenarioEvent = {
  id: string;
  propertyId: string;
  unit?: string;
  date: string;
  eventType: "unit_override" | "reserve_change";
  mode?: "rented" | "owner" | "vacant";
  monthlyRent?: number;
  monthlyCapexReserve?: number;
  notes?: string;
};

export type PlanningProjectionRow = {
  month: string;
  scheduledRent: number;
  vacancyLoss: number;
  effectiveRent: number;
  operatingExpenses: number;
  utilityIncludedAdjustment: number;
  netOperatingIncome: number;
  debtService: number;
  capexReserve: number;
  cashFlow: number;
  projectedValue: number;
  projectedLoanBalance: number;
  projectedEquity: number;
  driverLabel?: string;
  driverDetail?: string;
};

export type PlanningProjectionSummary = {
  currentMarketValue: number;
  currentLoanBalance: number;
  currentEquity: number;
  currentMonthlyRent: number;
  trailingMonthlyOperatingExpenses: number;
  fullMonthlyDebtService: number;
  adjustedMonthlyDebtService: number;
  currentRentalUsePct: number;
  firstYearEffectiveRent: number;
  firstYearNetOperatingIncome: number;
  firstYearCashFlow: number;
  horizonEndingValue: number;
  horizonEndingLoanBalance: number;
  horizonEndingEquity: number;
};

export type PlanningProjectionResult = {
  rows: PlanningProjectionRow[];
  summary: PlanningProjectionSummary;
};

export type PlanningPropertySnapshot = {
  propertyId: string;
  propertyName: string;
  currentMarketValue: number;
  currentLoanBalance: number;
  currentEquity: number;
  currentMonthlyRent: number;
  adjustedMonthlyDebtService: number;
  currentRentalUsePct: number;
};

export type PlanningMilestone = {
  propertyId: string;
  propertyName: string;
  date: string;
  title: string;
  detail: string;
};

export type PlanningDecisionComparison = {
  currentMonthlyRent: number;
  fullRentalMonthlyRent: number;
  monthlyRentUpside: number;
  currentMonthlyCashFlow: number;
  fullRentalMonthlyCashFlow: number;
  monthlyCashFlowUpside: number;
  currentDebtService: number;
  fullDebtService: number;
  rentableUnitCount: number;
  upsideUnits: Array<{
    propertyId: string;
    unit: string;
    monthlyRent: number;
  }>;
};

export type PlanningReserveSummary = {
  monthlyCarryCost: number;
  annualReserveContribution: number;
  firstYearReserveContribution: number;
  horizonReserveContribution: number;
  sixMonthCushionTarget: number;
  firstYearCoverageMonths: number;
};

export type PlanningCapitalTarget = {
  source: "asset" | "manual";
  assetId: string;
  propertyId: string;
  propertyName: string;
  unit: string;
  description: string;
  assetType: string;
  placedInService: string;
  targetDate: string;
  monthsRemaining: number;
  yearsRemaining: number;
  estimatedReplacementCost: number;
  monthlyReserveTarget: number;
  urgency: "near_term" | "watchlist" | "long_range";
  notes?: string;
  linkedAssetId?: string;
  priority?: "high" | "medium" | "low";
  fundingSource?: "reserve" | "cash" | "financing" | "heloc" | "tbd";
  scheduleType?: "one_time" | "phased";
  mustFundBy?: string;
};

export type PlanningManualCapitalProject = {
  id: string;
  propertyId: string;
  unit: string;
  title: string;
  targetDate: string;
  estimatedCost: number;
  linkedAssetId?: string;
  notes?: string;
  priority?: "high" | "medium" | "low";
  fundingSource?: "reserve" | "cash" | "financing" | "heloc" | "tbd";
  scheduleType?: "one_time" | "phased";
  mustFundBy?: string;
};

export type PlanningRecommendation = {
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
};

export type PlanningRentStrategyInput = {
  propertyId: string;
  unit: string;
  marketRent?: number;
  targetRent?: number;
  renewalStart?: string;
  renewalTermMonths?: number;
  notes?: string;
};

export type PlanningRentStrategyRow = {
  propertyId: string;
  propertyName: string;
  unit: string;
  currentStatus: string;
  currentRent: number;
  marketRent: number;
  targetRent: number;
  suggestedIncrease: number;
  suggestedIncreasePct: number;
  annualizedUpside: number;
  renewalStart: string;
  renewalTermMonths: number;
  notes: string;
};

export type PlanningRentStrategySummary = {
  pricedUnitCount: number;
  totalAnnualUpside: number;
  averageIncreasePct: number;
};

export type PlanningExitPlan = {
  mode: "hold" | "refi" | "sell";
  taxTreatment?: "taxable_sale" | "exchange_1031";
  targetRatePct?: number;
  termYears?: number;
  cashOutAmount?: number;
  saleDate?: string;
  sellingCostsPct?: number;
};

export type PlanningExitAnalysis = {
  mode: "hold" | "refi" | "sell";
  taxTreatment: "taxable_sale" | "exchange_1031";
  currentEquity: number;
  currentAdjustedDebtService: number;
  projectedMonthlyDebtService: number;
  monthlyCashFlowChange: number;
  projectedSaleValue: number;
  projectedLoanPayoff: number;
  projectedNetProceeds: number;
  projectedSaleCosts: number;
  roughTaxBasis: number;
  roughAccumulatedDepreciation: number;
  roughTaxableGain: number;
  roughDepreciationRecapture: number;
  roughCapitalGain: number;
  roughTaxEstimate: number;
  roughAfterTaxProceeds: number;
  monthsToExit: number;
  headline: string;
};

export type PlanningGoalSet = {
  minMonthlyCashFlow?: number;
  minAnnualCashFlow?: number;
  minReserveMonths?: number;
  minEndingEquity?: number;
  maxLtvPct?: number;
  minDscr?: number;
};

export type PlanningTriggerSet = {
  minMonthlyCashFlow?: number;
  minReserveMonths?: number;
  leaseRolloverDays?: number;
  capexWarningMonths?: number;
};

export type PlanningTriggerAlert = {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
};

export type PlanningGoalStatus = {
  id: string;
  label: string;
  targetLabel: string;
  actualLabel: string;
  status: "on_track" | "watch" | "off_track";
};

export type PlanningDebtPayoffPlan = {
  extraPrincipalMonthly?: number;
  lumpSumAmount?: number;
  lumpSumDate?: string;
};

export type PlanningDebtPayoffAnalysis = {
  currentMonthsToPayoff: number;
  acceleratedMonthsToPayoff: number;
  monthsSaved: number;
  currentInterestRemaining: number;
  acceleratedInterestRemaining: number;
  interestSaved: number;
  projectedPayoffDate: string;
  monthlyExtraOutlay: number;
};

export type PlanningFinancingComparisonRow = {
  id: "current" | "refi" | "accelerated";
  label: string;
  fullMonthlyOutlay: number;
  planningMonthlyOutlay: number;
  payoffMonths: number;
  payoffDate: string;
  interestRemaining: number;
  cashFlowImpact: number;
  note: string;
};

export type PlanningFinancingComparison = {
  weightedCurrentRatePct: number;
  currentLoanBalance: number;
  rows: PlanningFinancingComparisonRow[];
};

export type PlanningTaxProjection = {
  grossRent: number;
  operatingExpenses: number;
  mortgageInterest: number;
  depreciation: number;
  projectedScheduleE: number;
  projectedTaxableIncome: number;
  note: string;
};

export type PlanningTurnoverInput = {
  propertyId: string;
  unit: string;
  makeReadyCost?: number;
  downtimeDays?: number;
  leasingFeePct?: number;
  concessionWeeks?: number;
  notes?: string;
};

export type PlanningTurnoverRow = {
  propertyId: string;
  propertyName: string;
  unit: string;
  monthlyRent: number;
  nextTurnoverDate: string;
  monthsUntilTurnover: number;
  makeReadyCost: number;
  downtimeDays: number;
  leasingFeePct: number;
  concessionWeeks: number;
  lostRent: number;
  leasingFeeCost: number;
  concessionCost: number;
  totalTurnoverCost: number;
  recoveryMonths: number;
  notes: string;
};

export type PlanningTurnoverSummary = {
  pricedUnitCount: number;
  totalProjectedCost: number;
  averageDowntimeDays: number;
  soonestTurnoverDate: string;
};

export type PlanningScenarioDiffRow = {
  field: string;
  baselineValue: string;
  scenarioValue: string;
};

export type PlanningScenarioRange = {
  downsideCashFlow: number;
  baseCashFlow: number;
  upsideCashFlow: number;
  downsideNoi: number;
  baseNoi: number;
  upsideNoi: number;
  downsideEquity: number;
  baseEquity: number;
  upsideEquity: number;
};

export type PlanningHealthFactor = {
  id: string;
  label: string;
  status: "strong" | "watch" | "weak";
  detail: string;
};

export type PlanningHealthSummary = {
  score: number;
  status: "stable" | "watch" | "fragile";
  label: string;
  primaryConcern: string;
  factors: PlanningHealthFactor[];
};

export type PlanningAssumptionAuditRow = {
  category: string;
  label: string;
  value: string;
  note?: string;
};

export type PlanningRecommendedMove = {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
  actionLabel: string;
};

export type PlanningSensitivityRow = {
  id: string;
  label: string;
  adjustmentLabel: string;
  direction: "positive" | "negative";
  deltaCashFlow: number;
  deltaNoi: number;
  deltaEquity: number;
  note: string;
};

export type PlanningReviewInboxItem = {
  id: string;
  category: "scenario" | "decision" | "trigger" | "action" | "capital" | "data";
  priority: "high" | "medium" | "low";
  title: string;
  detail: string;
  actionLabel: string;
  dueDate?: string;
};


export type PlanningForecastRerentAssumption = {
  propertyId: string;
  unit: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  downtimeDays: number;
  priorLeaseEnd: string;
  sourceLabel: string;
};
