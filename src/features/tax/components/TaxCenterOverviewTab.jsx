import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Info,
  Landmark,
  Pencil,
  Printer,
  ReceiptText,
} from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { readinessCounts, supportBuckets as buildSupportBuckets } from "../taxPresentation.js";

const SUMMARY_TILE_CLASS = "rounded-lg border border-slate-200 bg-white px-3 py-3";
const SECTION_CLASS = "rounded-xl border border-slate-200 bg-white";
const SOFT_SECTION_CLASS = "rounded-xl border border-slate-200 bg-slate-50/70";
const IRS_SCHEDULE_E_URL = "https://www.irs.gov/instructions/i1040se";
const IRS_PASSIVE_ACTIVITY_URL = "https://www.irs.gov/publications/p925";

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function sectionCount(taxReadinessSummary, key) {
  return Number((taxReadinessSummary?.sections || []).find((section) => section.key === key)?.reviewCount || 0);
}

function moneyTone(value) {
  return Number(value || 0) < 0 ? "text-rose-700" : "text-slate-900";
}

function readinessTone(status) {
  if (status === "complete") return "text-emerald-700";
  if (status === "recommended") return "text-amber-700";
  return "text-rose-700";
}

function readinessIcon(status) {
  if (status === "complete") return CheckCircle2;
  return AlertTriangle;
}

function buildChecklistItems({ supportBuckets, taxPacketSummary, taxReadinessSummary }) {
  const expenseSupportCount = supportBuckets.find((bucket) => bucket.key === "expense")?.rows.length || 0;
  const loanSupportCount = supportBuckets.find((bucket) => bucket.key === "loan")?.rows.length || 0;
  const assetSupportCount = supportBuckets.find((bucket) => bucket.key === "asset")?.rows.length || 0;
  const tenantLedgerCount = sectionCount(taxReadinessSummary, "tenantLedger");
  const loanReviewCount = sectionCount(taxReadinessSummary, "loans");
  const assetReviewCount = sectionCount(taxReadinessSummary, "assets");
  const occupancyCount = sectionCount(taxReadinessSummary, "occupancy");
  const propertyCount = sectionCount(taxReadinessSummary, "property");
  const documentChecklist = taxPacketSummary?.documentChecklist || {};

  return [
    {
      key: "tenant-ledger",
      label: "Tenant ledger posting",
      helper: tenantLedgerCount > 0 ? "Action needed" : "Complete",
      status: tenantLedgerCount > 0 ? "action" : "complete",
      action: { kind: "view", target: "leaseHistory" },
    },
    {
      key: "loans",
      label: "Loan & escrow review",
      helper: loanReviewCount + loanSupportCount > 0 ? "Action needed" : "Complete",
      status: loanReviewCount + loanSupportCount > 0 ? "action" : "complete",
      action: { kind: "tab", target: "loans" },
    },
    {
      key: "receipts",
      label: "Expense receipts",
      helper: expenseSupportCount > 0 ? "Review recommended" : "Complete",
      status: expenseSupportCount > 0 ? "recommended" : "complete",
      action: { kind: "view", target: "review" },
    },
    {
      key: "depreciation",
      label: "Depreciation setup",
      helper: assetReviewCount + assetSupportCount > 0 ? "Review recommended" : "Complete",
      status: assetReviewCount + assetSupportCount > 0 ? "recommended" : "complete",
      action: { kind: "tab", target: "depreciation" },
    },
    {
      key: "property",
      label: "Property data",
      helper: propertyCount > 0 ? "Action needed" : "Complete",
      status: propertyCount > 0 ? "action" : "complete",
      action: { kind: "view", target: "properties" },
    },
    {
      key: "occupancy",
      label: "Occupancy & owner use",
      helper: occupancyCount > 0 || documentChecklist.rentIncomeSupportWarnings?.length > 0 ? "Review recommended" : "Complete",
      status: occupancyCount > 0 || documentChecklist.rentIncomeSupportWarnings?.length > 0 ? "recommended" : "complete",
      action: { kind: "view", target: "leaseHistory" },
    },
  ];
}

function buildNextActions({ counts, supportBuckets, taxReadinessSummary }) {
  const actions = [];
  if (counts.blockingIssues > 0) {
    actions.push({ key: "review", title: "Open Work Queue", helper: `Resolve ${pluralize(counts.blockingIssues, "blocking issue")}`, action: { kind: "view", target: "review" } });
  }
  const loanCount = sectionCount(taxReadinessSummary, "loans") + (supportBuckets.find((bucket) => bucket.key === "loan")?.rows.length || 0);
  if (loanCount > 0) {
    actions.push({ key: "loans", title: "Review loan & escrow", helper: "Verify 1098 and escrow items", action: { kind: "tab", target: "loans" } });
  }
  const expenseCount = supportBuckets.find((bucket) => bucket.key === "expense")?.rows.length || 0;
  if (expenseCount > 0) {
    actions.push({ key: "receipts", title: "Review expense receipts", helper: `${pluralize(expenseCount, "expense item")} need support`, action: { kind: "view", target: "review" } });
  }
  if (actions.length === 0) {
    actions.push({ key: "packet", title: "Review tax packet", helper: "Confirm handoff details", action: { kind: "tab", target: "packet" } });
  }
  return actions.slice(0, 3);
}

function MetricTile({ label, helper, value, tone = "text-slate-900" }) {
  return (
    <div className={SUMMARY_TILE_CLASS}>
      <div className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">{label}</div>
      <div className={`mt-1 text-base font-semibold ${tone}`}>{value}</div>
      {helper ? <div className="mt-0.5 text-xs text-slate-500">{helper}</div> : null}
    </div>
  );
}

function SupportRow({ bucket, onAction }) {
  const count = bucket.rows.length;
  const Icon = bucket.key === "loan" ? Landmark : bucket.key === "rent" ? ClipboardCheck : bucket.key === "asset" ? FileText : ReceiptText;
  return (
    <button type="button" className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2" onClick={() => onAction?.(supportActionForBucket(bucket))}>
      <div className="flex min-w-0 items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-800">{bucket.label}</div>
          <div className="truncate text-xs text-slate-500">
            {count > 0 ? bucket.rows[0]?.description || bucket.rows[0]?.label || "Review source support" : "No open support items"}
          </div>
        </div>
      </div>
      <Badge variant="secondary" className={count > 0 ? "!bg-amber-100 !text-amber-800" : "!bg-emerald-50 !text-emerald-700"}>
        {count > 0 ? count : "OK"}
      </Badge>
    </button>
  );
}

function supportActionForBucket(bucket) {
  if (bucket.key === "loan") return { kind: "tab", target: "loans" };
  if (bucket.key === "asset") return { kind: "tab", target: "depreciation" };
  if (bucket.key === "rent") return { kind: "view", target: "leaseHistory" };
  return { kind: "view", target: "review" };
}

export function TaxCenterOverviewTab({
  currency,
  exportTaxDetailCsv,
  goToTab,
  navigateWithDashboardContext,
  printTaxPacket,
  taxPacketSummary,
  taxReadinessSummary,
  taxReportingSummary,
  taxSnapshot,
}) {
  const totals = taxReportingSummary?.totals || {};
  const details = taxReportingSummary?.details || {};
  const openItems = taxPacketSummary?.openItems || [];
  const counts = readinessCounts({ taxPacketSummary, taxReadinessSummary, taxReportingSummary });
  const hasOpenReviewWork = counts.blockingIssues > 0 || counts.sourceWarnings > 0 || counts.supportWarnings > 0;
  const supportBuckets = buildSupportBuckets(taxPacketSummary?.documentChecklist || {});
  const checklistItems = buildChecklistItems({ supportBuckets, taxPacketSummary, taxReadinessSummary });
  const completeCount = checklistItems.filter((item) => item.status === "complete").length;
  const completionPct = Math.round((completeCount / Math.max(1, checklistItems.length)) * 100);
  const topBlockingItems = openItems.slice(0, 2);
  const nextActions = buildNextActions({ counts, supportBuckets, taxReadinessSummary });
  const scheduleEBeforeCarryover = Number(taxReportingSummary?.netRentalIncomeLoss || 0);
  const passiveLossCarryover = Number(taxSnapshot?.metrics?.carryoverLoss || 0);
  const scheduleEAfterCarryover = scheduleEBeforeCarryover - passiveLossCarryover;
  const expenseRowCount = Object.entries(details)
    .filter(([key]) => !["rentalIncome", "otherIncome", "depreciation", "mortgageInterest"].includes(key))
    .reduce((sum, [, rows]) => sum + rows.length, 0);
  const loanCount = (details.mortgageInterest || []).filter((row) => row.sourceType === "loan" || row.sourceType === "loan_review").length;
  const runAction = (action) => {
    if (!action) return;
    if (action.kind === "tab") {
      goToTab(action.target);
      return;
    }
    if (action.kind === "external") {
      window.open(action.target, "_blank", "noopener,noreferrer");
      return;
    }
    navigateWithDashboardContext(action.target);
  };
  const runOpenItemAction = (item) => {
    if (item?.targetView === "loans") {
      goToTab("loans");
      return;
    }
    if (item?.targetView) {
      navigateWithDashboardContext(item.targetView);
      return;
    }
    navigateWithDashboardContext("review");
  };

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_1.8fr]">
            <div className="flex min-w-0 gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-white text-amber-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase text-slate-600">Tax package status</div>
                <div className="mt-0.5 text-lg font-semibold leading-tight text-amber-700">{counts.packageStatus}</div>
                <div className="mt-1 text-sm text-slate-600">
                  {counts.blockingIssues > 0 ? "Resolve blocking issues to finalize your tax package." : "Review warnings before sending the package."}
                </div>
                {hasOpenReviewWork ? (
                  <Button size="sm" variant="secondary" className="mt-3 gap-2" onClick={() => navigateWithDashboardContext("review")}>
                    <ClipboardCheck className="h-4 w-4" />
                    Open Work Queue
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-3">
              <div className="border-slate-200 sm:border-l sm:pl-4">
                <div className="text-lg font-semibold leading-tight text-rose-700">{counts.blockingIssues}</div>
                <div className="mt-1 text-sm font-medium text-slate-900">Blocking issues</div>
                <div className="text-xs text-slate-500">Must resolve</div>
              </div>
              <div className="border-slate-200 sm:border-l sm:pl-4">
                <div className="text-lg font-semibold leading-tight text-amber-600">{counts.sourceWarnings}</div>
                <div className="mt-1 text-sm font-medium text-slate-900">Source warnings</div>
                <div className="text-xs text-slate-500">Review recommended</div>
              </div>
              <div className="border-slate-200 sm:border-l sm:pl-4">
                <div className="text-lg font-semibold leading-tight text-amber-600">{counts.supportWarnings}</div>
                <div className="mt-1 text-sm font-medium text-slate-900">Support warnings</div>
                <div className="text-xs text-slate-500">May not be required</div>
              </div>
            </div>
          </div>
        </div>

        <div className={`${SECTION_CLASS} p-4`}>
          <div className="text-base font-semibold text-slate-900">Schedule E summary (computed)</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MetricTile label="Rental income" value={currency(totals.rentalIncome || 0)} helper={`${(details.rentalIncome || []).length} source rows`} tone="text-emerald-700" />
            <MetricTile label="Other income" value={currency(totals.otherIncome || 0)} helper={`${(details.otherIncome || []).length} source rows`} />
            <MetricTile label="Total expenses" value={currency(taxReportingSummary?.totalExpenses || 0)} helper={`${expenseRowCount} source rows`} tone="text-rose-700" />
            <MetricTile label="Depreciation" value={currency(totals.depreciation || 0)} helper={`${(details.depreciation || []).length} assets`} tone="text-rose-700" />
            <MetricTile label="Mortgage interest" value={currency(totals.mortgageInterest || 0)} helper={`${loanCount} loan${loanCount === 1 ? "" : "s"}`} />
            <MetricTile label="Net rental income / (loss)" value={currency(scheduleEBeforeCarryover)} helper="Before passive limitation" tone={moneyTone(scheduleEBeforeCarryover)} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-sm font-medium text-slate-900">
              Net before passive limitation <span className={`ml-3 font-semibold ${moneyTone(scheduleEBeforeCarryover)}`}>{currency(scheduleEBeforeCarryover)}</span>
            </div>
            <div className="min-w-[14rem] flex-1 text-sm text-blue-700">Passive activity loss rules may limit your ability to deduct this loss.</div>
            <Button size="sm" variant="secondary" onClick={() => runAction({ kind: "external", target: IRS_PASSIVE_ACTIVITY_URL })}>View IRS Pub. 925</Button>
          </div>
          {passiveLossCarryover > 0 ? (
            <div className="mt-2 text-xs text-slate-500">After current carryover setting: {currency(scheduleEAfterCarryover)}</div>
          ) : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className={SECTION_CLASS}>
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="font-semibold text-slate-900">Top blocking issues</div>
                <Badge variant="secondary" className={counts.blockingIssues > 0 ? "!bg-rose-100 !text-rose-700" : "!bg-emerald-50 !text-emerald-700"}>{counts.blockingIssues}</Badge>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {topBlockingItems.length === 0 ? (
                <div className="px-4 py-4 text-sm text-slate-500">No blocking issues in this tax view.</div>
              ) : (
                topBlockingItems.map((item, index) => (
                  <div key={item.key || item.label} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 gap-3">
                      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rose-100 text-xs font-semibold text-rose-700">{index + 1}</div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{item.label}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {item.reviewCount > 1 ? `${pluralize(item.reviewCount, "entry", "entries")} need review` : item.helperText || "Review required"}
                        </div>
                        {item.helperText ? <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">{item.helperText}</div> : null}
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => runOpenItemAction(item)}>Review</Button>
                  </div>
                ))
              )}
            </div>
            {counts.blockingIssues > 0 ? (
              <button type="button" className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-blue-700 hover:text-blue-800" onClick={() => navigateWithDashboardContext("review")}>
                View all blocking issues
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className={`${SECTION_CLASS} p-4`}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-slate-900">Support & source summary</div>
              <Info className="h-4 w-4 text-slate-500" />
            </div>
            <div className="mt-3 space-y-1">
              {supportBuckets.map((bucket) => (
                <SupportRow key={bucket.key} bucket={bucket} onAction={runAction} />
              ))}
            </div>
            <button type="button" className="mt-3 flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800" onClick={() => goToTab("packet")}>
              View all source warnings
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 lg:grid-cols-2">
          <div>
            <div className="font-semibold text-slate-900">Exports & handoff</div>
            <div className="mt-1 text-sm text-slate-600">Prepare your tax package for your CPA or tax preparer.</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" className="gap-2" onClick={printTaxPacket}>
                <Printer className="h-4 w-4" />
                Print Tax Packet
              </Button>
              <Button size="sm" variant="secondary" className="gap-2" onClick={exportTaxDetailCsv}>
                <Download className="h-4 w-4" />
                Export detail CSV
              </Button>
              <Button size="sm" variant="secondary" className="gap-2" onClick={() => goToTab("packet")}>
                <ArrowRight className="h-4 w-4" />
                Go to Tax Packet
              </Button>
            </div>
          </div>
          <div>
            <div className="font-semibold text-slate-900">Notes for preparer (optional)</div>
            <div className="mt-1 text-sm text-slate-600">Add notes about overrides, special situations, or items to review.</div>
            <Button size="sm" variant="secondary" className="mt-3 gap-2" onClick={() => goToTab("tools")}>
              <Pencil className="h-4 w-4" />
              Add notes
            </Button>
          </div>
        </div>
      </div>

      <aside className="space-y-3">
        <div className={`${SOFT_SECTION_CLASS} p-4`}>
          <div className="text-base font-semibold text-slate-900">Readiness checklist</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button type="button" className="text-xs font-medium text-blue-700 hover:text-blue-800" onClick={() => runAction({ kind: "external", target: IRS_SCHEDULE_E_URL })}>
              IRS Schedule E instructions
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {checklistItems.map((item) => {
              const Icon = readinessIcon(item.status);
              return (
                <button key={item.key} type="button" className="flex w-full gap-3 rounded-lg text-left transition hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2" onClick={() => runAction(item.action)}>
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${readinessTone(item.status)}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                    <div className={`text-xs ${readinessTone(item.status)}`}>{item.helper}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
            <span>{completeCount} of {checklistItems.length} complete</span>
            <span>{completionPct}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${completionPct}%` }} />
          </div>
        </div>

        <div className={`${SOFT_SECTION_CLASS} p-4`}>
          <div className="font-semibold text-slate-900">Next best actions</div>
          <div className="mt-3 space-y-3">
            {nextActions.map((action, index) => (
              <button key={action.key} type="button" className="flex w-full gap-3 rounded-lg text-left transition hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2" onClick={() => runAction(action.action)}>
                <div className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-slate-300 bg-white text-xs font-medium text-slate-700">{index + 1}</div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900">{action.title}</div>
                  <div className="text-xs text-slate-500">{action.helper}</div>
                </div>
              </button>
            ))}
          </div>
          {hasOpenReviewWork ? (
            <button type="button" className="mt-4 flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800" onClick={() => navigateWithDashboardContext("review")}>
              View all open checks
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
