import type { PlanningAssumptions, PlanningProjectionSummary, PlanningReserveSummary, PlanningProjectionRow } from "./types.ts";
import { csvCell } from "./shared.ts";

export function planningProjectionCsv(args: {
  scopeLabel: string;
  generatedAt?: string;
  assumptions: PlanningAssumptions;
  summary: PlanningProjectionSummary;
  reserve: PlanningReserveSummary;
  rows: PlanningProjectionRow[];
}) {
  const horizonLabel = `${args.assumptions.horizonMonths}-mo`;
  const horizonTotals = args.rows.reduce((sum, row) => ({
    effectiveRent: sum.effectiveRent + Number(row.effectiveRent || 0),
    netOperatingIncome: sum.netOperatingIncome + Number(row.netOperatingIncome || 0),
    cashFlow: sum.cashFlow + Number(row.cashFlow || 0),
  }), {
    effectiveRent: 0,
    netOperatingIncome: 0,
    cashFlow: 0,
  });
  const lines = [
    ["Planning report", args.scopeLabel, args.generatedAt || ""].map(csvCell).join(","),
    ["Assumption", "Value"].map(csvCell).join(","),
    ["Forecast horizon (months)", args.assumptions.horizonMonths].map(csvCell).join(","),
    ["Annual rent growth %", args.assumptions.annualRentGrowthPct].map(csvCell).join(","),
    ["Annual OpEx growth %", args.assumptions.annualExpenseGrowthPct].map(csvCell).join(","),
    ["Annual value growth %", args.assumptions.annualValueGrowthPct].map(csvCell).join(","),
    ["Vacancy / credit loss %", args.assumptions.vacancyRatePct].map(csvCell).join(","),
    ["Monthly CapEx reserve", args.assumptions.monthlyCapexReserve].map(csvCell).join(","),
    ["Included utilities / mo", args.assumptions.includedUtilitiesMonthly || 0].map(csvCell).join(","),
    "",
    ["Summary metric", "Value"].map(csvCell).join(","),
    ["Current monthly rent", args.summary.currentMonthlyRent].map(csvCell).join(","),
    ["Trailing monthly OpEx", args.summary.trailingMonthlyOperatingExpenses].map(csvCell).join(","),
    ["Adjusted monthly debt service", args.summary.adjustedMonthlyDebtService].map(csvCell).join(","),
    ["Current rental use %", args.summary.currentRentalUsePct].map(csvCell).join(","),
    [`Next ${horizonLabel} effective rent`, Math.round(horizonTotals.effectiveRent * 100) / 100].map(csvCell).join(","),
    [`Next ${horizonLabel} NOI`, Math.round(horizonTotals.netOperatingIncome * 100) / 100].map(csvCell).join(","),
    [`Next ${horizonLabel} cash flow`, Math.round(horizonTotals.cashFlow * 100) / 100].map(csvCell).join(","),
    ["Horizon-end equity", args.summary.horizonEndingEquity].map(csvCell).join(","),
    ["6-mo cushion target", args.reserve.sixMonthCushionTarget].map(csvCell).join(","),
    ["First-year reserve contribution", args.reserve.firstYearReserveContribution].map(csvCell).join(","),
    "",
    [
      "Month",
      "Scheduled rent",
      "Vacancy loss",
      "Effective rent",
      "OpEx",
      "Utilities-included adjustment",
      "NOI",
      "Debt service",
      "CapEx reserve",
      "Cash flow",
      "Projected value",
      "Projected loan balance",
      "Projected equity",
      "Driver",
      "Driver detail",
    ].map(csvCell).join(","),
    ...args.rows.map((row) =>
      [
        row.month,
        row.scheduledRent,
        row.vacancyLoss,
        row.effectiveRent,
        row.operatingExpenses,
        row.utilityIncludedAdjustment,
        row.netOperatingIncome,
        row.debtService,
        row.capexReserve,
        row.cashFlow,
        row.projectedValue,
        row.projectedLoanBalance,
        row.projectedEquity,
        row.driverLabel || "",
        row.driverDetail || "",
      ].map(csvCell).join(","),
    ),
  ];

  return lines.join("\n");
}
