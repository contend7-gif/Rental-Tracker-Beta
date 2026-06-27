import React from "react";

import { Badge } from "@/components/ui/badge";

const EMPTY_CAPITAL_CHART_DATA = {
  rows: [],
  contributionLine: "",
  dueLine: "",
  gapLine: "",
  gapAxisY: 66,
  cumulativeLatestContribution: 0,
  cumulativeLatestDue: 0,
  latestGap: 0,
  gapMin: 0,
  gapMax: 1,
};

export function PlanningCapitalRunwayPanel({
  buildChartPointX,
  buildChartPolyline,
  chartData,
  currency,
  horizonMonths,
  monthlyReserve,
  mutedPanelClass,
  runway,
  TableFrame,
  timeline,
}) {
  const safeChartData = chartData?.rows ? chartData : EMPTY_CAPITAL_CHART_DATA;

  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-3 shadow-none">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">Funding runway</div>
          <div className="mt-1 text-xs text-slate-500">Reserve contributions vs capital due dates.</div>
        </div>
        <Badge variant={runway.firstShortfall ? "destructive" : "secondary"}>
          {runway.firstShortfall ? `Shortfall by ${runway.firstShortfall.label}` : "No shortfall in horizon"}
        </Badge>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <RunwayMetric
          detail={`${runway.monthsWithNeed} month${runway.monthsWithNeed === 1 ? "" : "s"} with tracked due costs.`}
          label="Horizon capital need"
          value={currency(runway.totalNeed)}
        />
        <RunwayMetric
          detail={`At ${currency(Number(monthlyReserve || 0))} per month across ${horizonMonths} months.`}
          label="Horizon reserve funding"
          value={currency(runway.totalContribution)}
        />
        <RunwayStatusCard runway={runway} />
        <WorstGapCard currency={currency} runway={runway} />
      </div>

      <RunwayNextStep currency={currency} monthlyReserve={monthlyReserve} runway={runway} />

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <ReserveVsDueChart
          buildChartPointX={buildChartPointX}
          chartData={safeChartData}
          currency={currency}
        />
        <MonthlyFundingBars
          buildChartPointX={buildChartPointX}
          chartData={safeChartData}
          currency={currency}
          monthlyReserve={monthlyReserve}
        />
        <RunwayGapChart
          buildChartPointX={buildChartPointX}
          buildChartPolyline={buildChartPolyline}
          chartData={safeChartData}
          currency={currency}
          runway={runway}
        />
      </div>

      <RunwayTimelineTable
        currency={currency}
        mutedPanelClass={mutedPanelClass}
        runway={runway}
        TableFrame={TableFrame}
        timeline={timeline}
      />
    </div>
  );
}

function RunwayNextStep({ currency, monthlyReserve, runway }) {
  const noTrackedNeed = Number(runway.totalNeed || 0) <= 0;
  const shortfall = Boolean(runway.firstShortfall);
  const detail = noTrackedNeed
    ? "No capital needs are scheduled in this horizon yet. Add replacement dates to assets or manual capital projects to turn this into a true runway check."
    : shortfall
      ? `Raise the reserve pace above ${currency(Number(monthlyReserve || 0))}/mo or move funding ahead of ${runway.firstShortfall.label}.`
      : "Tracked capital timing is covered. Keep reserve pace and due dates current as projects firm up.";
  const toneClass = noTrackedNeed
    ? "border-blue-200 bg-blue-50/70 text-blue-900"
    : shortfall
      ? "border-rose-200 bg-rose-50/70 text-rose-900"
      : "border-emerald-200 bg-emerald-50/70 text-emerald-900";

  return (
    <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${toneClass}`}>
      <span className="font-semibold">{noTrackedNeed ? "Needs capital inputs" : shortfall ? "Funding gap" : "Runway covered"}</span>
      <span className="ml-2 text-xs">{detail}</span>
    </div>
  );
}

function RunwayMetric({ detail, label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function RunwayStatusCard({ runway }) {
  return (
    <div className={`rounded-lg border p-3 ${runway.firstShortfall ? "border-rose-200 bg-rose-50/70" : "border-emerald-200 bg-emerald-50/70"}`}>
      <div className={`text-xs uppercase tracking-wide ${runway.firstShortfall ? "text-rose-700" : "text-emerald-700"}`}>Runway status</div>
      <div className={`mt-1 text-base font-semibold ${runway.firstShortfall ? "text-rose-900" : "text-emerald-900"}`}>
        {runway.firstShortfall ? runway.firstShortfall.label : "Covered"}
      </div>
      <div className={`mt-1 text-xs ${runway.firstShortfall ? "text-rose-900/80" : "text-emerald-900/80"}`}>
        {runway.firstShortfall ? "Reserve contributions fall behind tracked due costs in this month." : "Current reserve pace covers tracked capital timing inside the selected horizon."}
      </div>
    </div>
  );
}

function WorstGapCard({ currency, runway }) {
  return (
    <div className={`rounded-lg border p-3 ${runway.worstGap < 0 ? "border-amber-200 bg-amber-50/70" : "border-slate-200 bg-slate-50/80"}`}>
      <div className={`text-xs uppercase tracking-wide ${runway.worstGap < 0 ? "text-amber-700" : "text-slate-500"}`}>Worst cumulative gap</div>
      <div className={`mt-1 text-base font-semibold ${runway.worstGap < 0 ? "text-amber-900" : "text-slate-900"}`}>
        {currency(Math.abs(runway.worstGap))}{runway.worstGap < 0 ? " short" : " ahead"}
      </div>
      <div className={`mt-1 text-xs ${runway.worstGap < 0 ? "text-amber-900/80" : "text-slate-500"}`}>Compared with cumulative tracked capital costs inside the planning horizon.</div>
    </div>
  );
}

function ReserveVsDueChart({ buildChartPointX, chartData, currency }) {
  const dueRows = chartData.rows.filter((item) => Number(item.dueThisMonth || 0) > 0);
  const maxDueThisMonth = Math.max(1, ...dueRows.map((item) => Number(item.dueThisMonth || 0)));
  const hasDueCosts = dueRows.length > 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div className="text-sm font-semibold text-slate-900">Reserve vs due</div>
      <div className="mt-1 text-xs text-slate-500">Cumulative reserve vs due costs.</div>
      <div className="mt-3">
        <svg viewBox="0 0 320 132" className="h-40 w-full">
          <line x1="14" x2="306" y1="118" y2="118" stroke="#cbd5e1" strokeWidth="1" />
          {!hasDueCosts && (
            <>
              <rect x="22" y="18" width="276" height="50" rx="10" fill="#f8fafc" stroke="#e2e8f0" />
              <text x="160" y="39" textAnchor="middle" className="fill-slate-500 text-[11px]">No capital due dates in this horizon</text>
              <text x="160" y="56" textAnchor="middle" className="fill-slate-400 text-[10px]">Add replacement dates or manual projects.</text>
            </>
          )}
          {dueRows.map((row) => {
            const index = chartData.rows.findIndex((item) => item.month === row.month);
            const x = buildChartPointX(index, chartData.rows.length, 320, 14);
            const barHeight = (Number(row.dueThisMonth || 0) / maxDueThisMonth) * 52;
            return <rect key={`capital-runway-bar-${row.month}`} x={x - 4} y={118 - barHeight} width="8" height={barHeight} rx="2" fill="#fecaca" opacity="0.7" />;
          })}
          <polyline fill="none" stroke="#059669" strokeWidth="2.5" points={chartData.contributionLine} />
          <polyline fill="none" stroke="#dc2626" strokeWidth="2.5" points={chartData.dueLine} />
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />Reserve {currency(chartData.cumulativeLatestContribution)}</div>
        <div className="flex items-center gap-2 text-slate-600"><span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-600" />Due {currency(chartData.cumulativeLatestDue)}</div>
        <div className="flex items-center gap-2 text-slate-600"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-200" />Due-month bars</div>
      </div>
    </div>
  );
}

function MonthlyFundingBars({ buildChartPointX, chartData, currency, monthlyReserve }) {
  const rows = chartData.rows;
  const maxMonthlyValue = Math.max(1, Number(monthlyReserve || 0), ...rows.map((item) => Number(item.dueThisMonth || 0)));
  const activeDueRows = rows.filter((item) => Number(item.dueThisMonth || 0) > 0);
  const peakDue = activeDueRows.slice().sort((left, right) => Number(right.dueThisMonth || 0) - Number(left.dueThisMonth || 0))[0];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Monthly need vs reserve</div>
          <div className="mt-1 text-xs text-slate-500">Monthly contribution compared with due costs by month.</div>
        </div>
        <Badge variant={peakDue ? "secondary" : "outline"}>
          {peakDue ? `Peak due ${peakDue.label}` : "No due months"}
        </Badge>
      </div>
      <div className="mt-3">
        <svg viewBox="0 0 320 132" className="h-40 w-full">
          <line x1="14" x2="306" y1="118" y2="118" stroke="#cbd5e1" strokeWidth="1" />
          {rows.map((row, index) => {
            const x = buildChartPointX(index, rows.length, 320, 14);
            const reserveHeight = (Number(monthlyReserve || 0) / maxMonthlyValue) * 70;
            const dueHeight = (Number(row.dueThisMonth || 0) / maxMonthlyValue) * 70;
            return (
              <g key={`monthly-funding-${row.month}`}>
                <rect x={x - 6} y={118 - reserveHeight} width="5" height={reserveHeight} rx="1.5" fill="#059669" opacity="0.75" />
                <rect x={x + 1} y={118 - dueHeight} width="5" height={dueHeight} rx="1.5" fill="#dc2626" opacity={dueHeight > 0 ? "0.8" : "0.18"} />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600" />Reserve / mo {currency(Number(monthlyReserve || 0))}</div>
        <div className="flex items-center gap-2 text-slate-600"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-600" />Due months {activeDueRows.length}</div>
        <div className="text-slate-500">{peakDue ? `Peak due ${currency(peakDue.dueThisMonth)}` : "No tracked due costs yet"}</div>
      </div>
    </div>
  );
}

function RunwayGapChart({ buildChartPointX, buildChartPolyline, chartData, currency, runway }) {
  const gapIsShort = Number(chartData.latestGap || 0) < 0 || Boolean(runway.firstShortfall);
  const gapStroke = gapIsShort ? "#dc2626" : "#2563eb";

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div className="text-sm font-semibold text-slate-900">Runway gap</div>
      <div className="mt-1 text-xs text-slate-500">Positive is ahead; negative is short.</div>
      <div className="mt-3">
        <svg viewBox="0 0 320 132" className="h-40 w-full">
          {chartData.gapAxisY != null ? <line x1="14" x2="306" y1={chartData.gapAxisY} y2={chartData.gapAxisY} stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth="1" /> : null}
          <polyline fill="none" stroke={gapStroke} strokeWidth="2.5" points={chartData.gapLine} />
          {runway.firstShortfall ? (() => {
            const shortfallIndex = chartData.rows.findIndex((row) => row.month === runway.firstShortfall?.month);
            if (shortfallIndex < 0) return null;
            const x = buildChartPointX(shortfallIndex, chartData.rows.length, 320, 14);
            const shortfallRow = chartData.rows[shortfallIndex];
            const shortfallY = buildChartPolyline([Number(shortfallRow?.cumulativeGap || 0)], chartData.gapMin, chartData.gapMax, 320, 132, 14)
              .split(",")[1];
            return <circle cx={x} cy={Number(shortfallY || chartData.gapAxisY || 66)} r="4.5" fill="#dc2626" />;
          })() : null}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600"><span className={`inline-block h-2.5 w-2.5 rounded-full ${gapIsShort ? "bg-rose-600" : "bg-blue-600"}`} />Latest gap {currency(chartData.latestGap)}</div>
        <div className="text-slate-500">{runway.firstShortfall ? `First shortfall ${runway.firstShortfall.label}` : "No shortfall in horizon"}</div>
      </div>
    </div>
  );
}

function RunwayTimelineTable({ currency, mutedPanelClass, runway, TableFrame, timeline }) {
  const mobileCards = timeline.filter((item) => item.targetCount > 0 || item.month === runway.firstShortfall?.month).map((item) => (
    <div key={`planning-capital-timeline-card-${item.month}`} className={mutedPanelClass}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-slate-900">{item.label}</div>
        <div className={`text-sm font-semibold ${item.cumulativeGap >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{currency(item.cumulativeGap)}</div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div>Due: <span className="font-medium text-slate-900">{currency(item.dueThisMonth)}</span></div>
        <div>Targets: <span className="font-medium text-slate-900">{item.targetCount}</span></div>
        <div>Cumulative reserve: <span className="font-medium text-slate-900">{currency(item.cumulativeContribution)}</span></div>
        <div>Cumulative due: <span className="font-medium text-slate-900">{currency(item.cumulativeNeed)}</span></div>
      </div>
      {item.targets.length > 0 ? (
        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600">
          {item.targets.slice(0, 2).map((target) => (
            <div key={`planning-capital-mobile-target-${item.month}-${target.assetId}`} className="mt-1 first:mt-0">
              <span className="font-medium text-slate-900">{target.description}</span> {currency(target.estimatedReplacementCost)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  ));

  return (
    <TableFrame
      className="mt-3"
      minWidthClass="min-w-[920px]"
      hint="Swipe to compare reserve buildup against projected capital due dates month by month."
      mobileCards={mobileCards}
    >
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-2 py-1 text-left">Month</th>
            <th className="px-2 py-1 text-right">Targets</th>
            <th className="px-2 py-1 text-right">Due this month</th>
            <th className="px-2 py-1 text-right">Cumulative reserve</th>
            <th className="px-2 py-1 text-right">Cumulative due</th>
            <th className="px-2 py-1 text-right">Gap</th>
            <th className="px-2 py-1 text-left">Notes</th>
          </tr>
        </thead>
        <tbody>
          {timeline.map((item) => (
            <tr key={`planning-capital-timeline-row-${item.month}`} className="border-t border-slate-100">
              <td className="px-2 py-1">{item.label}</td>
              <td className="px-2 py-1 text-right">{item.targetCount}</td>
              <td className="px-2 py-1 text-right">{currency(item.dueThisMonth)}</td>
              <td className="px-2 py-1 text-right">{currency(item.cumulativeContribution)}</td>
              <td className="px-2 py-1 text-right">{currency(item.cumulativeNeed)}</td>
              <td className={`px-2 py-1 text-right font-medium ${item.cumulativeGap >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{currency(item.cumulativeGap)}</td>
              <td className="px-2 py-1 align-top">
                {item.targets.length > 0 ? (
                  <div className="space-y-1">
                    {item.targets.slice(0, 2).map((target) => (
                      <div key={`planning-capital-timeline-target-${item.month}-${target.assetId}`} className="text-slate-600">
                        <span className="font-medium text-slate-900">{target.description}</span> {currency(target.estimatedReplacementCost)}
                      </div>
                    ))}
                    {item.targets.length > 2 ? <div className="text-slate-500">+{item.targets.length - 2} more</div> : null}
                  </div>
                ) : (
                  <span className="text-slate-400">No tracked due costs</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}
