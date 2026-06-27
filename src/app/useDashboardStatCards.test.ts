import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardStatCards, resolveDashboardScheduleE } from "./useDashboardStatCards.js";

test("dashboard Schedule E card uses Tax Center net rental income/loss", () => {
  const cards = buildDashboardStatCards({
    dashboardCardSettings: {},
    dashboardTransactionCount: 2,
    deductibleExpensesTrend: null,
    grossRentTrend: null,
    metrics: { mortgagePaid: 1200 },
    taxCenterScheduleE: 750,
    taxSnapshot: {
      metrics: {
        grossRent: 2000,
        opExp: 100,
        deductibleLoanInterest: 300,
        depreciation: 50,
        scheduleE: 1000,
      },
    },
  });

  const scheduleECard = cards.find((card) => card.id === "scheduleE");
  assert.equal(scheduleECard?.value, "$750.00");
  assert.equal(scheduleECard?.subtitle, "Tax Center estimate");
});

test("dashboard Schedule E allocates shared Tax Center details to the selected unit", () => {
  const value = resolveDashboardScheduleE({
    dashboardUnitAllocationWeight: 0.5,
    unitFilter: "Unit B",
    taxReportingSummary: {
      lineDefs: [
        { key: "rentalIncome", type: "income" },
        { key: "repairs", type: "expense" },
        { key: "mortgageInterest", type: "expense" },
      ],
      details: {
        rentalIncome: [{ unit: "Unit B", deductibleAmount: 12000 }],
        repairs: [{ unit: "Unit B", deductibleAmount: 300 }],
        mortgageInterest: [{ unit: "Shared", deductibleAmount: 4000 }],
      },
      netRentalIncomeLoss: 9700,
    },
    taxSnapshot: { metrics: { scheduleE: 1000 } },
  });

  assert.equal(value, 9700);
});
