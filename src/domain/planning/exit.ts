import type { PlanningProjectionSummary, PlanningExitPlan, PlanningExitAnalysis } from "./types.ts";
import { type Loan, type Property, type Asset, type UsePeriod, type Lease, type Unit, getPropertyCostBasis } from "../../models.ts";
import { matchesPropertyScope, amortizedPayment, clampPct, monthDifference } from "./shared.ts";
import { projectLoanBalancesToDate } from "./financing.ts";
import { adjustedAssetDepreciationThroughDate } from "./tax.ts";

export function buildPlanningExitAnalysis(args: {
  today: string;
  summary: PlanningProjectionSummary;
  plan: PlanningExitPlan;
  loans?: Loan[];
  propertyId?: string;
  properties?: Property[];
  assets?: Asset[];
  usePeriods?: UsePeriod[];
  leases?: Lease[];
  units?: Unit[];
  annualValueGrowthPct?: number;
}): PlanningExitAnalysis {
  const mode = args.plan.mode || "hold";
  const taxTreatment = args.plan.taxTreatment === "exchange_1031" ? "exchange_1031" : "taxable_sale";
  const scopePropertyId = args.propertyId === "all" ? undefined : args.propertyId;
  const scopedProperties = (args.properties || []).filter((property) => matchesPropertyScope(property.id, scopePropertyId));
  const scopedAssets = (args.assets || []).filter((asset) => matchesPropertyScope(asset.propertyId, scopePropertyId));
  const currentCarryCostsMonthly = (args.loans || [])
    .filter((loan) => matchesPropertyScope(loan.propertyId, scopePropertyId))
    .reduce((sum, loan) => sum + Number(loan.scheduledEscrow || 0) + Number(loan.scheduledMortgageInsurance || 0), 0);
  if (mode === "refi") {
    const newBalance = Math.max(0, Number(args.summary.currentLoanBalance || 0) + Number(args.plan.cashOutAmount || 0));
    const projectedFullMonthlyDebtService = amortizedPayment(newBalance, Number(args.plan.targetRatePct || 0), Number(args.plan.termYears || 30))
      + currentCarryCostsMonthly;
    const projectedMonthlyDebtService = projectedFullMonthlyDebtService * clampPct(Number(args.summary.currentRentalUsePct || 1));
    const monthlyCashFlowChange = Number(args.summary.adjustedMonthlyDebtService || 0) - projectedMonthlyDebtService;
    return {
      mode,
      taxTreatment,
      currentEquity: Math.round(Number(args.summary.currentEquity || 0) * 100) / 100,
      currentAdjustedDebtService: Math.round(Number(args.summary.adjustedMonthlyDebtService || 0) * 100) / 100,
      projectedMonthlyDebtService: Math.round(projectedMonthlyDebtService * 100) / 100,
      monthlyCashFlowChange: Math.round(monthlyCashFlowChange * 100) / 100,
      projectedSaleValue: Math.round(Number(args.summary.currentMarketValue || 0) * 100) / 100,
      projectedLoanPayoff: Math.round(Number(args.summary.currentLoanBalance || 0) * 100) / 100,
      projectedNetProceeds: Math.round(Math.max(0, Number(args.plan.cashOutAmount || 0)) * 100) / 100,
      projectedSaleCosts: 0,
      roughTaxBasis: 0,
      roughAccumulatedDepreciation: 0,
      roughTaxableGain: 0,
      roughDepreciationRecapture: 0,
      roughCapitalGain: 0,
      roughTaxEstimate: 0,
      roughAfterTaxProceeds: Math.round(Math.max(0, Number(args.plan.cashOutAmount || 0)) * 100) / 100,
      monthsToExit: 0,
      headline: `Refi could shift rental-share debt service to about $${Math.round(projectedMonthlyDebtService)} per month.`,
    };
  }

  if (mode === "sell") {
    const saleDate = args.plan.saleDate || args.today;
    const monthsToExit = Math.max(0, monthDifference(args.today, saleDate));
    const annualValueGrowthPct = clampPct(Number(args.annualValueGrowthPct || 0));
    const projectedSaleValue = Math.max(
      0,
      Number(args.summary.currentMarketValue || 0) * Math.pow(1 + annualValueGrowthPct, monthsToExit / 12),
    );
    const projectedLoanPayoff = Math.max(0, projectLoanBalancesToDate({
      today: args.today,
      targetDate: saleDate,
      loans: args.loans || [],
      propertyId: scopePropertyId,
    }));
    const saleCosts = Math.max(0, projectedSaleValue * clampPct(Number(args.plan.sellingCostsPct || 0)));
    const netProceeds = Math.max(0, projectedSaleValue - saleCosts - projectedLoanPayoff);
    const landBasis = scopedProperties.reduce((sum, property) => {
      const costBasis = getPropertyCostBasis(property);
      return costBasis.ok ? sum + costBasis.landValue : sum;
    }, 0);
    const depreciableBasis = scopedAssets.reduce((sum, asset) => sum + Math.max(0, Number(asset.basis || asset.cost || 0)), 0);
    const accumulatedDepreciation = scopedAssets.reduce((sum, asset) => sum + adjustedAssetDepreciationThroughDate({
      asset,
      date: saleDate,
      usePeriods: args.usePeriods || [],
      leases: args.leases || [],
      units: args.units || [],
    }), 0);
    const roughTaxBasis = Math.max(0, landBasis + depreciableBasis - accumulatedDepreciation);
    const amountRealized = Math.max(0, projectedSaleValue - saleCosts);
    const roughTaxableGain = Math.max(0, amountRealized - roughTaxBasis);
    const roughDepreciationRecapture = Math.max(0, Math.min(accumulatedDepreciation, roughTaxableGain));
    const roughCapitalGain = Math.max(0, roughTaxableGain - roughDepreciationRecapture);
    const roughTaxEstimate = Math.max(0, (roughDepreciationRecapture * 0.25) + (roughCapitalGain * 0.15));
    const roughAfterTaxProceeds = taxTreatment === "exchange_1031"
      ? Math.max(0, netProceeds)
      : Math.max(0, netProceeds - roughTaxEstimate);
    return {
      mode,
      taxTreatment,
      currentEquity: Math.round(Number(args.summary.currentEquity || 0) * 100) / 100,
      currentAdjustedDebtService: Math.round(Number(args.summary.adjustedMonthlyDebtService || 0) * 100) / 100,
      projectedMonthlyDebtService: 0,
      monthlyCashFlowChange: Math.round(Number(args.summary.adjustedMonthlyDebtService || 0) * 100) / 100,
      projectedSaleValue: Math.round(projectedSaleValue * 100) / 100,
      projectedLoanPayoff: Math.round(projectedLoanPayoff * 100) / 100,
      projectedNetProceeds: Math.round(netProceeds * 100) / 100,
      projectedSaleCosts: Math.round(saleCosts * 100) / 100,
      roughTaxBasis: Math.round(roughTaxBasis * 100) / 100,
      roughAccumulatedDepreciation: Math.round(accumulatedDepreciation * 100) / 100,
      roughTaxableGain: Math.round(roughTaxableGain * 100) / 100,
      roughDepreciationRecapture: Math.round(roughDepreciationRecapture * 100) / 100,
      roughCapitalGain: Math.round(roughCapitalGain * 100) / 100,
      roughTaxEstimate: Math.round(roughTaxEstimate * 100) / 100,
      roughAfterTaxProceeds: Math.round(roughAfterTaxProceeds * 100) / 100,
      monthsToExit,
      headline: taxTreatment === "exchange_1031"
        ? `Estimated exchange equity after debt and selling costs is about $${Math.round(netProceeds)}, with roughly $${Math.round(roughTaxEstimate)} of tax potentially deferred in a 1031 path.`
        : `Estimated net proceeds after debt and selling costs are about $${Math.round(netProceeds)}, or roughly $${Math.round(roughAfterTaxProceeds)} after a conservative tax haircut.`,
    };
  }

  return {
    mode: "hold",
    taxTreatment,
    currentEquity: Math.round(Number(args.summary.currentEquity || 0) * 100) / 100,
    currentAdjustedDebtService: Math.round(Number(args.summary.adjustedMonthlyDebtService || 0) * 100) / 100,
    projectedMonthlyDebtService: Math.round(Number(args.summary.adjustedMonthlyDebtService || 0) * 100) / 100,
    monthlyCashFlowChange: 0,
    projectedSaleValue: Math.round(Number(args.summary.currentMarketValue || 0) * 100) / 100,
    projectedLoanPayoff: Math.round(Number(args.summary.currentLoanBalance || 0) * 100) / 100,
    projectedNetProceeds: Math.round(Number(args.summary.horizonEndingEquity || args.summary.currentEquity || 0) * 100) / 100,
    projectedSaleCosts: 0,
    roughTaxBasis: 0,
    roughAccumulatedDepreciation: 0,
    roughTaxableGain: 0,
    roughDepreciationRecapture: 0,
    roughCapitalGain: 0,
    roughTaxEstimate: 0,
    roughAfterTaxProceeds: Math.round(Number(args.summary.horizonEndingEquity || args.summary.currentEquity || 0) * 100) / 100,
    monthsToExit: 0,
    headline: `Hold mode keeps the focus on cash flow and growing equity to about $${Math.round(Number(args.summary.horizonEndingEquity || 0))}.`,
  };
}
