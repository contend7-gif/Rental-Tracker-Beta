import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Boxes,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  FileWarning,
  Link2,
  Pencil,
  ReceiptText,
} from "lucide-react";
import { getAssetReadiness, getAssetReviewIssues } from "./assetReview.js";
import {
  assetSourceTransactionIds,
  buildAssetReviewGroups,
  buildAssetSummary,
  getAssetSourceStatus,
} from "./assetWorkspacePresentation.js";

const MONEY_STAT_CLASS = "rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm";

function compactCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "$0";
  const absolute = Math.abs(number);
  if (absolute >= 1000000) {
    return `${number < 0 ? "-" : ""}$${(absolute / 1000000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`;
  }
  return `${number < 0 ? "-" : ""}$${Math.round(absolute).toLocaleString()}`;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatScope(asset) {
  const unit = String(asset?.unit || "Shared").trim();
  if (!unit || unit === "Shared") return "Shared";
  return unit;
}

function sourceStatusClass(status) {
  if (status.key === "missing_source" && status.tone === "warning") return "!border-amber-200 !bg-amber-50 !text-amber-800";
  if (status.key === "missing_source") return "!border-slate-200 !bg-slate-100 !text-slate-600";
  return "!border-emerald-200 !bg-emerald-50 !text-emerald-700";
}

function reviewGroupClass(group) {
  if (group.key === "ready_assets") return "text-emerald-700";
  return group.count > 0 ? "text-amber-700" : "text-emerald-700";
}

function needsReviewHelper({ calculationIssueCount, missingSourceCount, needsReviewCount }) {
  if (!needsReviewCount) return "0 calculation warnings";
  if (missingSourceCount && !calculationIssueCount) return pluralize(missingSourceCount, "documentation issue");
  if (calculationIssueCount && !missingSourceCount) return pluralize(calculationIssueCount, "calculation warning");
  if (missingSourceCount && calculationIssueCount) {
    return `${pluralize(missingSourceCount, "source issue")} + ${pluralize(calculationIssueCount, "calculation warning")}`;
  }
  return pluralize(needsReviewCount, "review item");
}

function SummaryCard({ icon: Icon, label, value, helper, accent = "teal" }) {
  const accentClass = accent === "amber"
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : accent === "slate"
      ? "border-slate-200 bg-slate-50 text-slate-600"
      : "border-teal-200 bg-teal-50 text-teal-700";
  return (
    <div className={MONEY_STAT_CLASS}>
      <div className="flex items-start gap-2.5">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${accentClass}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</div>
          <div className="mt-1 whitespace-nowrap text-base font-semibold leading-tight text-slate-950 tabular-nums 2xl:text-lg" title={typeof value === "string" ? value : undefined}>{value}</div>
          {helper ? <div className="mt-1 text-xs leading-snug text-slate-500">{helper}</div> : null}
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, helper }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-semibold leading-tight text-slate-950" title={String(value ?? "")}>{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{label}</div>
      {helper ? <div className="mt-0.5 truncate text-xs text-slate-400" title={helper}>{helper}</div> : null}
    </div>
  );
}

function SourceDetailButton({ children, onClick }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-teal-700 hover:border-teal-200 hover:bg-teal-50"
      onClick={onClick}
    >
      {children}
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}

function AssetDetails({
  adjustedAssetDepreciationForYear,
  asset,
  assetIssues,
  assetSchedule,
  currency,
  leases,
  normalizeBonusRate,
  openAssetSourceTransaction,
  openAssetSourceWorkOrder,
  openReviewCenter,
  selectedYearNum,
  sourceStatus,
  transactionById,
  units,
  usePeriods,
  workOrderById,
}) {
  const sourceTransactionIds = assetSourceTransactionIds(asset);
  const sourceWorkOrder = asset.sourceWorkOrderId ? workOrderById?.[asset.sourceWorkOrderId] : null;
  const sourceDocumentIds = Array.isArray(asset.sourceDocumentIds) ? asset.sourceDocumentIds.filter(Boolean).map(String) : [];
  const sourceRecordCount = sourceTransactionIds.length + (asset.sourceWorkOrderId ? 1 : 0) + sourceDocumentIds.length;
  const previewStartYear = Math.max(1900, selectedYearNum - 2);
  const schedule = assetSchedule(asset, previewStartYear, 6).map((row) => ({
    ...row,
    depreciation: adjustedAssetDepreciationForYear({ asset, year: row.year, usePeriods, leases, units }),
  }));
  const selectedYearDepreciation = schedule.find((row) => row.year === selectedYearNum)?.depreciation
    ?? adjustedAssetDepreciationForYear({ asset, year: selectedYearNum, usePeriods, leases, units });
  const bonusRate = normalizeBonusRate(asset.bonusRate);
  const hasBonus = asset.bonusElected === true || asset.bonusElected === "Yes";

  return (
    <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-4">
      <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">Selected-year depreciation</div>
              <div className="mt-1 text-lg font-semibold leading-tight text-slate-950">{currency(selectedYearDepreciation)}</div>
              <div className="mt-1 text-xs text-slate-500">{selectedYearNum} adjusted for rental-use history where applicable.</div>
            </div>
            <Badge variant="secondary">{schedule.length} year preview</Badge>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[420px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 text-left">Year</th>
                  <th className="py-2 text-right">Depreciation</th>
                  <th className="py-2 text-right">Context</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <tr key={row.year} className={row.year === selectedYearNum ? "bg-teal-50/70" : ""}>
                    <td className="py-2 font-medium text-slate-800">{row.year}</td>
                    <td className="py-2 text-right text-slate-900">{currency(row.depreciation)}</td>
                    <td className="py-2 text-right text-xs text-slate-500">{row.year === selectedYearNum ? "Selected year" : row.year < selectedYearNum ? "Prior" : "Future"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-sm font-semibold text-slate-900">Basis and tax treatment</div>
            <div className="mt-1 text-xs text-slate-500">Depreciable basis excludes land and other nondepreciable amounts.</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-xs text-slate-500">Cost</div>
                <div className="font-medium">{currency(asset.cost)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Depreciable basis</div>
                <div className="font-medium">{currency(asset.basis)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Land allocation</div>
                <div className="font-medium">{asset.type === "Residential Building" ? currency(asset.landValue || 0) : "Not applicable"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Bonus election</div>
                <div className="font-medium">{hasBonus ? `${Math.round(bonusRate * 100)}% elected` : "No bonus election"}</div>
              </div>
            </div>
            {asset.assetReviewNotes ? <div className="mt-2 text-xs text-slate-500">Notes: {asset.assetReviewNotes}</div> : null}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-sm font-semibold text-slate-900">{sourceRecordCount === 1 ? "Source record" : "Source records"}</div>
            {sourceRecordCount > 1 ? <div className="mt-1 text-xs text-slate-500">{sourceRecordCount} source records linked</div> : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {sourceTransactionIds.length ? sourceTransactionIds.map((sourceId) => {
                const transaction = transactionById?.[sourceId];
                const label = transaction
                  ? `${transaction.date || "No date"} | ${transaction.description || transaction.vendor || transaction.category || "Transaction"}`
                  : `Missing transaction ${sourceId}`;
                return (
                  <SourceDetailButton key={`${asset.id}-source-${sourceId}`} onClick={(event) => { event.stopPropagation(); openAssetSourceTransaction(sourceId); }}>
                    {label}
                  </SourceDetailButton>
                );
              }) : null}
              {asset.sourceWorkOrderId ? (
                <SourceDetailButton onClick={(event) => { event.stopPropagation(); openAssetSourceWorkOrder(asset.sourceWorkOrderId); }}>
                  {sourceWorkOrder ? `${sourceWorkOrder.reportedOn || sourceWorkOrder.completedAt || "No date"} | ${sourceWorkOrder.title}` : `Missing work order ${asset.sourceWorkOrderId}`}
                </SourceDetailButton>
              ) : null}
              {sourceDocumentIds.map((documentId) => (
                <span key={`${asset.id}-source-document-${documentId}`} className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
                  Document support {documentId}
                </span>
              ))}
              {!sourceRecordCount ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm text-amber-700">Source documentation is missing.</div>
                  <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={(event) => { event.stopPropagation(); openReviewCenter?.(); }}>
                    Link source record
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-sm font-semibold text-slate-900">Review issues</div>
            {assetIssues.length ? (
              <div className="mt-2 space-y-2">
                {assetIssues.map((issue) => (
                  <div key={`${asset.id}-detail-${issue.key}`} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                    <div className="font-semibold">{issue.label}</div>
                    {issue.help ? <div className="mt-0.5 text-amber-800">{issue.help}</div> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm text-emerald-700">
                No depreciation calculation issues.
                {sourceStatus?.key === "missing_source" ? <span className="block text-amber-700">Link a source record for documentation support.</span> : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AssetRollRow({
  adjustedAssetDepreciationForYear,
  asset,
  assetIssues,
  assetReadiness,
  assetSchedule,
  currency,
  isExpanded,
  leases,
  normalizeBonusRate,
  onToggle,
  openAssetEditor,
  openAssetSourceTransaction,
  openAssetSourceWorkOrder,
  openReviewCenter,
  prefetchAssetEditorDialog,
  property,
  selectedYearNum,
  sourceStatus,
  transactionById,
  units,
  usePeriods,
  workOrderById,
}) {
  const currentYearDep = adjustedAssetDepreciationForYear({ asset, year: selectedYearNum, usePeriods, leases, units });
  const readinessStatus = assetReadiness.key === "not_current_year" ? { key: "optional", label: assetReadiness.label } : assetReadiness;
  const statusAccent = assetIssues.length ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-white";

  return (
    <div className={`overflow-hidden border ${statusAccent}`}>
      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(18rem,1.05fr)_minmax(0,1.9fr)_auto] lg:items-center">
        <div className="min-w-0">
          <button
            type="button"
            className="flex min-w-0 items-center gap-2 text-left"
            onClick={onToggle}
            onMouseEnter={prefetchAssetEditorDialog}
            onFocus={prefetchAssetEditorDialog}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />}
            <span className="min-w-0">
              <span className="rt-row-title block truncate" title={asset.description}>{asset.description || "Untitled asset"}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{property?.name || "Unassigned property"} | {formatScope(asset)}</span>
            </span>
          </button>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniMetric label="Asset type" value={asset.type || "Asset"} helper={`Placed ${formatDate(asset.placedInService)}`} />
          <MiniMetric label="Cost" value={currency(asset.cost)} />
          <MiniMetric label="Depreciable basis" value={currency(asset.basis)} helper={asset.type === "Residential Building" ? `Land ${currency(asset.landValue || 0)}` : `${asset.life || "-"} yr life`} />
          <MiniMetric label="Current-year depreciation" value={currency(currentYearDep)} />
          <div className="flex flex-wrap gap-1 sm:col-span-2 xl:col-span-4">
            <Badge variant="outline" className={assetReadiness.key === "ready" ? "!border-emerald-200 !bg-emerald-50 !text-emerald-700" : "!border-amber-200 !bg-amber-50 !text-amber-800"}>
              {assetReadiness.key === "ready" ? "Tax ready" : assetReadiness.label}
            </Badge>
            <Badge variant="outline" className={sourceStatusClass(sourceStatus)}>{sourceStatus.key === "missing_source" ? "Source missing" : sourceStatus.label}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={onToggle}>
            {isExpanded ? "Hide details" : "View details"}
          </Button>
          <Button
            size="sm"
            className="whitespace-nowrap"
            onClick={(event) => { event.stopPropagation(); openAssetEditor(asset); }}
            onMouseEnter={prefetchAssetEditorDialog}
            onFocus={prefetchAssetEditorDialog}
            onTouchStart={prefetchAssetEditorDialog}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>
      {isExpanded ? (
        <AssetDetails
          adjustedAssetDepreciationForYear={adjustedAssetDepreciationForYear}
          asset={asset}
          assetIssues={assetIssues}
          assetSchedule={assetSchedule}
          currency={currency}
          leases={leases}
          normalizeBonusRate={normalizeBonusRate}
          openAssetSourceTransaction={openAssetSourceTransaction}
          openAssetSourceWorkOrder={openAssetSourceWorkOrder}
          openReviewCenter={openReviewCenter}
          selectedYearNum={selectedYearNum}
          sourceStatus={sourceStatus}
          transactionById={transactionById}
          units={units}
          usePeriods={usePeriods}
          workOrderById={workOrderById}
        />
      ) : null}
    </div>
  );
}

export function AssetsWorkspace({
  adjustedAssetDepreciationForYear,
  assetListForView,
  assetReviewInbox,
  assetSchedule,
  currency,
  leases,
  normalizeBonusRate,
  openAssetEditor,
  openAssetSourceTransaction,
  openAssetSourceWorkOrder,
  openReviewCenter,
  prefetchAssetEditorDialog,
  properties,
  propertyFilter,
  transactionById,
  units,
  usePeriods,
  yearFilter,
  workOrderById,
}) {
  const [expandedAssetIds, setExpandedAssetIds] = useState(() => new Set());
  const [autoExpandedAssetId, setAutoExpandedAssetId] = useState("");
  const selectedYearNum = Number(yearFilter);
  const visibleProperties = propertyFilter === "all"
    ? properties
    : properties.filter((property) => property.id === propertyFilter);
  const propertyById = useMemo(() => Object.fromEntries((properties || []).map((property) => [property.id, property])), [properties]);
  const reviewContext = useMemo(() => ({
    transactions: Object.values(transactionById || {}),
    properties,
    units,
    leases,
    usePeriods,
    yearFilter,
  }), [leases, properties, transactionById, units, usePeriods, yearFilter]);
  const assetRows = useMemo(() => (assetListForView || []).map((asset) => {
    const issues = getAssetReviewIssues(asset, reviewContext);
    return {
      asset,
      issues,
      readiness: getAssetReadiness(asset, reviewContext),
      sourceStatus: getAssetSourceStatus(asset, { transactionById, workOrderById }),
    };
  }), [assetListForView, reviewContext, transactionById, workOrderById]);
  const summary = useMemo(() => buildAssetSummary({
    adjustedAssetDepreciationForYear,
    assets: assetListForView || [],
    leases,
    reviewContext,
    transactionById,
    units,
    usePeriods,
    workOrderById,
    year: selectedYearNum,
  }), [adjustedAssetDepreciationForYear, assetListForView, leases, reviewContext, selectedYearNum, transactionById, units, usePeriods, workOrderById]);
  const reviewGroups = useMemo(() => buildAssetReviewGroups({
    assetReviewInbox,
    assets: assetListForView || [],
    transactionById,
    workOrderById,
  }), [assetListForView, assetReviewInbox, transactionById, workOrderById]);
  const missingSourceCount = reviewGroups.find((group) => group.key === "missing_sources")?.count || 0;
  const calculationIssueCount = reviewGroups.find((group) => group.key === "asset_warnings")?.count || 0;
  const needsReviewSummary = needsReviewHelper({
    calculationIssueCount,
    missingSourceCount,
    needsReviewCount: summary.needsReviewCount,
  });
  const assetCleanupCount = (assetReviewInbox?.transactionCandidates?.length || 0) + (assetReviewInbox?.assetRecords?.length || 0) + missingSourceCount;
  const initialExpandedAssetId = useMemo(() => {
    const issueRow = assetRows.find((row) => row.issues.length > 0 || row.sourceStatus.key === "missing_source");
    return (issueRow || assetRows[0])?.asset?.id || "";
  }, [assetRows]);
  const assetRowsByPropertyId = useMemo(() => {
    const rowsByProperty = new Map();
    assetRows.forEach((row) => {
      const propertyRows = rowsByProperty.get(row.asset.propertyId) || [];
      propertyRows.push(row);
      rowsByProperty.set(row.asset.propertyId, propertyRows);
    });
    return rowsByProperty;
  }, [assetRows]);

  useEffect(() => {
    if (!initialExpandedAssetId || autoExpandedAssetId === initialExpandedAssetId) return;
    setAutoExpandedAssetId(initialExpandedAssetId);
    setExpandedAssetIds(new Set([initialExpandedAssetId]));
  }, [autoExpandedAssetId, initialExpandedAssetId]);

  const toggleAsset = (assetId) => {
    setExpandedAssetIds((current) => {
      if (current.has(assetId)) return new Set();
      return new Set([assetId]);
    });
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden shadow-none">
        <CardContent className="space-y-3 !p-4">
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            <SummaryCard icon={Boxes} label="Total asset cost" value={compactCurrency(summary.totalCost)} helper="Selected scope" />
            <SummaryCard icon={ReceiptText} label="Depreciable basis" value={compactCurrency(summary.totalBasis)} helper="Cost less land/nondepreciable amounts" />
            <SummaryCard icon={CalendarDays} label={`${selectedYearNum} depreciation`} value={compactCurrency(summary.selectedYearDepreciation)} helper="Adjusted for rental use" />
            <SummaryCard icon={Boxes} label="Asset count" value={summary.assetCount} helper="Depreciation records" accent="slate" />
            <SummaryCard
              icon={FileWarning}
              label="Needs review"
              value={summary.needsReviewCount}
              helper={needsReviewSummary}
              accent={summary.needsReviewCount ? "amber" : "teal"}
            />
            <SummaryCard icon={Link2} label="Source-linked" value={`${summary.sourceLinkedCount} of ${summary.assetCount}`} helper="Assets with source support" />
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">Asset review status</div>
                  <div className="mt-1 text-xs text-slate-600">Calculation issues and missing source documentation stay actionable in Review Center.</div>
                </div>
              </div>
              <div className="text-right">
              <div className="text-base font-semibold text-slate-950">{assetCleanupCount}</div>
              <div className="text-xs text-slate-500">{assetCleanupCount ? "cleanup items" : "calculation issues"}</div>
            </div>
            <Button size="sm" variant={assetCleanupCount > 0 ? "default" : "secondary"} onClick={openReviewCenter}>
              Open Review Center
            </Button>
          </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {reviewGroups.map((group) => (
                <div key={group.key} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                  <span className="text-xs text-slate-700">{group.label}</span>
                  <span className={`text-xs font-semibold ${reviewGroupClass(group)}`}>{group.key === "ready_assets" ? group.count : group.count || group.status}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden shadow-none">
        <CardHeader className="border-b border-slate-200 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Depreciation asset roll</CardTitle>
            </div>
            <Badge variant="secondary">{assetRows.length} assets in scope</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {visibleProperties.map((property) => {
            const propertyRows = assetRowsByPropertyId.get(property.id) || [];
            const showPropertyGroup = propertyFilter === "all";
            return (
              <div key={property.id} className="border-b border-slate-200 last:border-b-0">
                {showPropertyGroup ? (
                  <div className="flex items-center justify-between bg-slate-50/80 px-4 py-2">
                    <div>
                      <div className="font-semibold text-slate-900">{property.name}</div>
                      <div className="text-xs text-slate-500">{property.address}</div>
                    </div>
                    <Badge variant="secondary">{propertyRows.length} assets</Badge>
                  </div>
                ) : null}
                {propertyRows.length ? (
                  <div className="divide-y divide-slate-200">
                    {propertyRows.map(({ asset, issues, readiness, sourceStatus }) => (
                      <AssetRollRow
                        key={asset.id}
                        adjustedAssetDepreciationForYear={adjustedAssetDepreciationForYear}
                        asset={asset}
                        assetIssues={issues}
                        assetReadiness={readiness}
                        assetSchedule={assetSchedule}
                        currency={currency}
                        isExpanded={expandedAssetIds.has(asset.id)}
                        leases={leases}
                        normalizeBonusRate={normalizeBonusRate}
                        onToggle={() => toggleAsset(asset.id)}
                        openAssetEditor={openAssetEditor}
                        openAssetSourceTransaction={openAssetSourceTransaction}
                        openAssetSourceWorkOrder={openAssetSourceWorkOrder}
                        openReviewCenter={openReviewCenter}
                        prefetchAssetEditorDialog={prefetchAssetEditorDialog}
                        property={propertyById[asset.propertyId]}
                        selectedYearNum={selectedYearNum}
                        sourceStatus={sourceStatus}
                        transactionById={transactionById}
                        units={units}
                        usePeriods={usePeriods}
                        workOrderById={workOrderById}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-sm text-slate-500">No depreciation assets yet. Add a building basis or capital improvement.</div>
                )}
              </div>
            );
          })}
          {!visibleProperties.length ? (
            <div className="px-4 py-6 text-sm text-slate-500">No property is available for this asset scope.</div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
