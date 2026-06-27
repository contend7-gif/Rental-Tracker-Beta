import { useMemo } from "react";
import { Building2, CalendarDays, DollarSign, Landmark, Receipt, Wallet } from "lucide-react";
import { currency } from "../domain/accounting.ts";

function calculateAllocatedUnitTaxSummaryNet(summary, unit, sharedAllocationWeight = 0) {
  const selectedUnit = String(unit || "");
  const weight = Math.max(0, Math.min(1, Number(sharedAllocationWeight) || 0));
  return (summary?.lineDefs || []).reduce((net, line) => {
    const amount = (summary?.details?.[line.key] || []).reduce((sum, row) => {
      const rowUnit = String(row?.unit || "Shared");
      const value = Number(row?.deductibleAmount || 0);
      if (rowUnit === selectedUnit) return sum + value;
      if (rowUnit === "Shared") return sum + (value * weight);
      return sum;
    }, 0);
    return line.type === "income" ? net + amount : net - amount;
  }, 0);
}

export function resolveDashboardScheduleE({ dashboardUnitAllocationWeight, taxReportingSummary, taxSnapshot, unitFilter }) {
  if (unitFilter !== "all" && unitFilter !== "Shared") {
    const incomeRows = taxReportingSummary?.details?.rentalIncome || [];
    const directIncomeTotal = incomeRows
      .filter((row) => String(row?.unit || "Shared") !== "Shared")
      .reduce((sum, row) => sum + Number(row?.deductibleAmount || 0), 0);
    const selectedIncome = incomeRows
      .filter((row) => String(row?.unit || "Shared") === unitFilter)
      .reduce((sum, row) => sum + Number(row?.deductibleAmount || 0), 0);
    if (directIncomeTotal > 0 && Number.isFinite(Number(taxReportingSummary?.netRentalIncomeLoss))) {
      return Number(taxReportingSummary.netRentalIncomeLoss) * (selectedIncome / directIncomeTotal);
    }
    const sharedWeight = dashboardUnitAllocationWeight ?? 0;
    return calculateAllocatedUnitTaxSummaryNet(taxReportingSummary, unitFilter, sharedWeight);
  }
  if (Number.isFinite(Number(taxReportingSummary?.netRentalIncomeLoss))) return Number(taxReportingSummary.netRentalIncomeLoss);
  return Number(taxSnapshot.metrics.scheduleE || 0);
}

export function useDashboardStatCards({
  dashboardCardSettings,
  dashboardTransactionCount,
  dashboardUnitAllocationWeight,
  deductibleExpensesTrend,
  grossRentTrend,
  metrics,
  taxReportingSummary,
  taxSnapshot,
  unitFilter,
}) {
  const taxCenterScheduleE = resolveDashboardScheduleE({ dashboardUnitAllocationWeight, taxReportingSummary, taxSnapshot, unitFilter });

  return useMemo(
    () =>
      buildDashboardStatCards({
        dashboardCardSettings,
        dashboardTransactionCount,
        deductibleExpensesTrend,
        grossRentTrend,
        metrics,
        taxCenterScheduleE,
        taxSnapshot,
      }),
    [
      dashboardCardSettings,
      dashboardTransactionCount,
      dashboardUnitAllocationWeight,
      deductibleExpensesTrend,
      grossRentTrend,
      metrics.mortgagePaid,
      taxCenterScheduleE,
      taxSnapshot.metrics.depreciation,
      taxSnapshot.metrics.deductibleLoanInterest,
      taxSnapshot.metrics.grossRent,
      taxSnapshot.metrics.opExp,
      unitFilter,
    ],
  );
}

export function buildDashboardStatCards({
  dashboardCardSettings,
  dashboardTransactionCount,
  deductibleExpensesTrend,
  grossRentTrend,
  metrics,
  taxCenterScheduleE,
  taxSnapshot,
}) {
  return [
    { id: "grossRent", title: "Gross Rent YTD", value: currency(taxSnapshot.metrics.grossRent), subtitle: `${dashboardTransactionCount} entries in scope`, trend: grossRentTrend, icon: DollarSign, nextView: "ledger" },
    { id: "deductibleExpenses", title: "Deductible Expenses", value: currency(taxSnapshot.metrics.opExp), subtitle: "Tax-center adjusted", trend: deductibleExpensesTrend, icon: Wallet, nextView: "ledger" },
    { id: "mortgageInterest", title: "Mortgage Interest", value: currency(taxSnapshot.metrics.deductibleLoanInterest), subtitle: "Deductible only", icon: Landmark, nextView: "loans" },
    { id: "mortgagePaid", title: "Mortgage Paid", value: currency(metrics.mortgagePaid), subtitle: "P&I + escrow + extra", icon: Building2, nextView: "loans" },
    { id: "depreciation", title: "Depreciation", value: currency(taxSnapshot.metrics.depreciation), subtitle: "Current-year estimate", icon: CalendarDays, nextView: "assets" },
    { id: "scheduleE", title: "Estimated Schedule E", value: currency(taxCenterScheduleE), subtitle: "Tax Center estimate", icon: Receipt, nextView: "tax" },
  ].filter((card) => (dashboardCardSettings?.[card.id] ?? true));
}
