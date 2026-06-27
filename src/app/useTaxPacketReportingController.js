import { useMemo } from "react";
import { buildTaxLineDetailsCsvRows, buildTaxPacketSummary, buildTaxSummary } from "../features/tax/taxSummary.js";
import { scheduleEFormFdf, scheduleEFriendlyCsv, scheduleEWorksheetPages } from "../domain/reporting.ts";

function buildScheduleEPropertyWorksheet({ properties = [], propertyFilter, propertyNameById = {}, taxReportingSummary = {}, taxSnapshot = {} }) {
  const detailRows = Object.values(taxReportingSummary?.details || {}).flat();
  const propertyIds = propertyFilter === "all"
    ? Array.from(new Set(detailRows.map((row) => row.propertyId).filter(Boolean)))
    : [propertyFilter].filter(Boolean);
  const selectedProperties = taxSnapshot?.selectedProperties || [];
  const useDayRows = taxSnapshot?.useDays?.rows || [];
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const columns = propertyIds.map((propertyId, index) => {
    const property = selectedProperties.find((item) => item.id === propertyId) || properties.find((item) => item.id === propertyId) || {};
    const propertyName = property.name || propertyNameById[propertyId] || propertyId;
    const useRows = useDayRows.filter((row) => row.propertyId === propertyId || row.propertyName === propertyName);
    return {
      label: alphabet[index] || `AA${index - alphabet.length + 1}`,
      propertyName,
      address: property.address || "",
      fairRentalDays: useRows.reduce((sum, row) => sum + Number(row.fairRentalDays || 0), 0),
      personalUseDays: useRows.reduce((sum, row) => sum + Number(row.personalUseDays || 0), 0),
      propertyId,
    };
  });
  const isSinglePropertyWorksheet = columns.length === 1;
  const rowBelongsToColumn = (row, propertyId) =>
    row.propertyId === propertyId ||
    (propertyId === "all" && (!row.propertyId || row.propertyId === "all")) ||
    (isSinglePropertyWorksheet && (!row.propertyId || row.propertyId === "all"));
  const amountFor = (lineKey, propertyId) => (taxReportingSummary?.details?.[lineKey] || [])
    .filter((row) => rowBelongsToColumn(row, propertyId))
    .reduce((sum, row) => sum + Number(row.deductibleAmount || 0), 0);
  const lineRows = (taxReportingSummary?.lineDefs || []).map((line) => ({
    line: line.line,
    label: line.label,
    type: line.type,
    values: columns.map((column) => amountFor(line.key, column.propertyId)),
    total: Number(taxReportingSummary?.totals?.[line.key] || 0),
  }));
  const expenseRows = lineRows.filter((row) => row.type === "expense");
  const totalExpenseValues = columns.map((_, index) => expenseRows.reduce((sum, row) => sum + Number(row.values[index] || 0), 0));
  const netValues = columns.map((_, index) => (
    lineRows.filter((row) => row.type === "income").reduce((sum, row) => sum + Number(row.values[index] || 0), 0) -
    totalExpenseValues[index]
  ));
  return {
    columns,
    rows: [
      ...lineRows,
      { line: "20", label: "Total expenses. Add lines 5 through 19", type: "expense-total", values: totalExpenseValues, total: Number(taxReportingSummary?.totalExpenses || 0) },
      { line: "21", label: "Income or (loss). Subtract line 20 from lines 3 and 4", type: "net", values: netValues, total: Number(taxReportingSummary?.netRentalIncomeLoss || 0) },
    ],
  };
}

export function useTaxPacketReportingController({
  activeTx,
  adjustedAssetDepreciationForYear,
  assets,
  currency,
  documents,
  downloadTextAsFile,
  effectiveLoanPaymentDeductibleInterest,
  effectiveLoanPaymentRentalUsePct,
  effectiveTransactionDeductibleAmount,
  escapeHtml,
  formatPropertyLabel,
  formatUnitLabel,
  leases,
  loanPayments,
  loans,
  printHtmlDocument,
  properties,
  propertyFilter,
  propertyNameById,
  sanitizeFileNamePart,
  taxFiledAmountOverrides,
  taxReadinessSummary,
  taxSnapshot,
  tenantLedgerEntries,
  unitFilter,
  units,
  usePeriods,
  yearFilter,
}) {
  const taxReportingArgs = useMemo(() => ({
    transactions: activeTx,
    loanPayments,
    loans,
    assets,
    documents,
    tenantLedgerEntries,
    yearFilter,
    propertyFilter,
    taxReadinessSummary,
    filedAmounts: taxFiledAmountOverrides[`${yearFilter}|${propertyFilter === "all" ? "all" : propertyFilter}`] || {},
    escrowEstimateSupport: taxSnapshot?.filedAmountOverrides || {},
    effectiveTransactionDeductibleAmount,
    effectiveLoanPaymentDeductibleInterest,
    effectiveLoanPaymentRentalUsePct,
    assetDepreciationForYear: (asset, year) => adjustedAssetDepreciationForYear({ asset, year, usePeriods, leases, units }),
  }), [activeTx, loanPayments, loans, assets, documents, tenantLedgerEntries, yearFilter, propertyFilter, taxReadinessSummary, taxFiledAmountOverrides, taxSnapshot?.filedAmountOverrides, usePeriods, leases, units, adjustedAssetDepreciationForYear, effectiveLoanPaymentDeductibleInterest, effectiveLoanPaymentRentalUsePct, effectiveTransactionDeductibleAmount]);

  const taxReportingSummary = useMemo(
    () => buildTaxSummary(taxReportingArgs),
    [taxReportingArgs],
  );

  const taxPacketSummary = useMemo(
    () => buildTaxPacketSummary(taxReportingArgs),
    [taxReportingArgs],
  );

  const exportTaxDetailCsv = () => {
    const csv = buildTaxLineDetailsCsvRows(taxReportingSummary);
    const scope = sanitizeFileNamePart(propertyFilter === "all" ? "all-properties" : propertyFilter);
    downloadTextAsFile(csv, `tax-line-details-${yearFilter}-${scope}.csv`, "text/csv;charset=utf-8");
  };

  const scheduleEPropertyWorksheet = useMemo(
    () => buildScheduleEPropertyWorksheet({ properties, propertyFilter, propertyNameById, taxReportingSummary, taxSnapshot }),
    [properties, propertyFilter, propertyNameById, taxReportingSummary, taxSnapshot],
  );

  const exportScheduleEReport = () => {
    const sourceRowCount = Object.values(taxReportingSummary?.details || {}).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
    const rows = (taxReportingSummary?.lineDefs || []).map((line) => ({
      id: line.key,
      label: `Line ${line.line} - ${line.label}`,
      total: Number(taxReportingSummary?.totals?.[line.key] || 0),
      sourceNote: `${(taxReportingSummary?.details?.[line.key] || []).length} source row${(taxReportingSummary?.details?.[line.key] || []).length === 1 ? "" : "s"}`,
    }));
    const csv = scheduleEFriendlyCsv({
      year: yearFilter,
      propertyLabel: formatPropertyLabel(propertyFilter),
      unitLabel: formatUnitLabel(unitFilter),
      rows,
      metrics: {
        grossRent: Number(taxReportingSummary?.totalIncome || 0),
        opExp: Number(taxReportingSummary?.totalExpenses || 0),
        deductibleLoanInterest: Number(taxReportingSummary?.totals?.mortgageInterest || 0),
        depreciation: Number(taxReportingSummary?.totals?.depreciation || 0),
        scheduleE: Number(taxReportingSummary?.netRentalIncomeLoss || 0),
        adjustedScheduleE: Number(taxReportingSummary?.netRentalIncomeLoss || 0),
      },
      propertyWorksheet: scheduleEPropertyWorksheet,
      readiness: {
        label: taxPacketSummary?.readiness?.label || taxReadinessSummary?.label || "Preliminary",
        status: taxPacketSummary?.readiness?.status || taxReadinessSummary?.status || taxReportingSummary?.status || "preliminary",
        blockingCount: Number(taxPacketSummary?.openItems?.length || 0),
        warningCount: Number(taxPacketSummary?.warningCount || 0),
        supportWarningCount: Number(taxPacketSummary?.documentChecklist?.missingSupportCount || 0),
        sourceRowCount,
        documentCount: Number(taxPacketSummary?.documentChecklist?.linkedDocumentCount || 0),
        notes: [
          "Escrow deposits are not automatically deducted as taxes or insurance.",
          "Use Review Center to clear open source-record checks before filing.",
        ],
      },
    });
    const scope = sanitizeFileNamePart([yearFilter, propertyFilter, unitFilter].join("-"));
    downloadTextAsFile(csv, `schedule-e-${scope}.csv`, "text/csv;charset=utf-8");
  };

  const exportScheduleEFormFdf = () => {
    const fdf = scheduleEFormFdf({
      propertyWorksheet: {
        columns: scheduleEPropertyWorksheet.columns.slice(0, 3),
        rows: scheduleEPropertyWorksheet.rows.map((row) => ({ ...row, values: row.values.slice(0, 3) })),
      },
      pdfFileName: "f1040se.pdf",
    });
    const scope = sanitizeFileNamePart([yearFilter, propertyFilter, unitFilter].join("-"));
    downloadTextAsFile(fdf, `schedule-e-form-data-${scope}.fdf`, "application/vnd.fdf;charset=utf-8");
  };

  const exportScheduleEFilledPdf = () => {
    const pages = scheduleEWorksheetPages(scheduleEPropertyWorksheet, 3);
    const pageHtml = pages.map((page) => {
      const propertyHead = page.columns.map((column) => `<th>Property ${escapeHtml(column.formLabel)}<br /><span>${escapeHtml(column.propertyName || "")}</span></th>`).join("");
      const metaRows = [
        ["Address", ...page.columns.map((column) => column.address || ""), ""],
        ["Fair rental days", ...page.columns.map((column) => column.fairRentalDays || ""), ""],
        ["Personal use days", ...page.columns.map((column) => column.personalUseDays || ""), ""],
      ].map((row) => `<tr>${row.map((cell, index) => `<td class="${index > 0 ? "num" : ""}">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
      const amountRows = page.rows.map((row) => `<tr class="${row.line === "20" || row.line === "21" ? "total" : ""}"><td>${escapeHtml(row.line)}</td><td>${escapeHtml(row.label)}</td>${page.columns.map((_, index) => `<td class="num">${escapeHtml(currency(row.values[index] || 0))}</td>`).join("")}<td class="num">${escapeHtml(currency(row.total || 0))}</td></tr>`).join("");
      return `<section class="form-page">
        <div class="form-title">
          <div><strong>Schedule E Part I ${page.pageNumber === 1 ? "" : `Continuation ${page.pageNumber}`}</strong><br /><span>Supplemental Income and Loss - Rental Real Estate</span></div>
          <div>${escapeHtml(yearFilter)}</div>
        </div>
        <table class="property-table">
          <thead><tr><th></th>${propertyHead}<th>Page total</th></tr></thead>
          <tbody>${metaRows}</tbody>
        </table>
        <table>
          <thead><tr><th>Line</th><th>Schedule E label</th>${page.columns.map((column) => `<th>Property ${escapeHtml(column.formLabel)}</th>`).join("")}<th>Page total</th></tr></thead>
          <tbody>${amountRows}</tbody>
        </table>
      </section>`;
    }).join("");
    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Filled Schedule E ${escapeHtml(yearFilter)}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 20px; }
            .cover { margin-bottom: 14px; }
            .muted { color: #64748b; font-size: 12px; }
            .form-page { break-after: page; border: 1px solid #cbd5e1; padding: 14px; margin-bottom: 16px; }
            .form-title { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; font-size: 14px; }
            .form-title span { color: #64748b; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: left; vertical-align: top; }
            th { background: #f8fafc; font-weight: 700; }
            th span { color: #64748b; font-weight: 400; }
            .num { text-align: right; white-space: nowrap; }
            .total td { background: #f8fafc; font-weight: 700; }
            @media print { body { margin: 10mm; } .form-page { page-break-after: always; } }
          </style>
        </head>
        <body>
          <div class="cover">
            <h1>Filled Schedule E Worksheet</h1>
            <div class="muted">${escapeHtml(formatPropertyLabel(propertyFilter))} | ${escapeHtml(formatUnitLabel(unitFilter))} | Generated from Rental Tracker</div>
            <p class="muted">Use this filled worksheet for Schedule E Part I. The IRS form page has A-C columns; additional properties are shown on continuation pages.</p>
          </div>
          ${pageHtml || "<p>No Schedule E property rows are available for this scope.</p>"}
        </body>
      </html>`;
    if (!printHtmlDocument(html)) {
      const scope = sanitizeFileNamePart([yearFilter, propertyFilter, unitFilter].join("-"));
      downloadTextAsFile(html, `filled-schedule-e-${scope}.html`, "text/html;charset=utf-8");
    }
  };

  const printTaxPacket = () => {
    const lineRows = (taxReportingSummary?.lineDefs || []).map((line) => {
      const amount = taxReportingSummary?.totals?.[line.key] || 0;
      return `<tr><td>${escapeHtml(line.label)}</td><td>${escapeHtml(line.type === "income" ? "Income" : "Expense")}</td><td class="num">${escapeHtml(currency(amount))}</td></tr>`;
    }).join("");
    const filedRows = (taxReportingSummary?.computedFiledRows || [])
      .filter((row) => row.filedAmount != null || row.status === "needs_note")
      .map((row) => `<tr><td>${escapeHtml(row.label)}</td><td class="num">${escapeHtml(currency(row.computedAmount))}</td><td class="num">${row.filedAmount == null ? "-" : escapeHtml(currency(row.filedAmount))}</td><td class="num">${escapeHtml(currency(row.difference || 0))}</td><td>${escapeHtml(row.status === "needs_note" ? "Needs note" : row.status === "difference" ? "Difference" : "Match")}</td></tr>`)
      .join("");
    const openItems = (taxPacketSummary?.openItems || []).map((item) => `<li><strong>${escapeHtml(item.label)}</strong>: ${escapeHtml(item.helperText || "")}</li>`).join("");
    const missingSupport = (taxPacketSummary?.documentChecklist?.missingSupport || []).slice(0, 12).map((row) => `<li>${escapeHtml(row.date || "")} ${escapeHtml(row.description || "")} ${escapeHtml(currency(row.deductibleAmount || 0))}</li>`).join("");
    const packetHtml = `<!doctype html>
      <html>
        <head>
          <title>Tax Prep Packet ${escapeHtml(yearFilter)}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 28px; }
            h1, h2 { margin-bottom: 6px; }
            .muted { color: #64748b; font-size: 12px; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0; }
            .tile { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0 18px; font-size: 12px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 6px; text-align: left; }
            th { background: #f8fafc; }
            .num { text-align: right; }
            @media print { body { margin: 18mm; } button { display: none; } }
          </style>
        </head>
        <body>
          <h1>Tax Prep Packet</h1>
          <div class="muted">${escapeHtml(yearFilter)} | ${escapeHtml(formatPropertyLabel(propertyFilter))} | ${escapeHtml(taxPacketSummary?.readiness?.label || "Preliminary")}</div>
          <div class="grid">
            <div class="tile"><div class="muted">Net before passive limitation</div><strong>${escapeHtml(currency(taxPacketSummary?.scheduleSummary?.netRentalIncomeLoss || 0))}</strong></div>
            <div class="tile"><div class="muted">Depreciation</div><strong>${escapeHtml(currency(taxPacketSummary?.depreciationSummary?.total || 0))}</strong></div>
            <div class="tile"><div class="muted">Loan interest</div><strong>${escapeHtml(currency(taxPacketSummary?.loanSummary?.mortgageInterest || 0))}</strong></div>
            <div class="tile"><div class="muted">Missing support</div><strong>${escapeHtml(taxPacketSummary?.documentChecklist?.missingSupportCount || 0)}</strong></div>
          </div>
          <h2>Schedule E-style totals</h2>
          <table><thead><tr><th>Line</th><th>Type</th><th class="num">Amount</th></tr></thead><tbody>${lineRows}</tbody></table>
          <h2>Computed vs filed</h2>
          <table><thead><tr><th>Line</th><th class="num">Computed</th><th class="num">Filed</th><th class="num">Difference</th><th>Status</th></tr></thead><tbody>${filedRows || "<tr><td colspan=\"5\">No filed overrides entered.</td></tr>"}</tbody></table>
          <h2>Depreciation and loan support</h2>
          <p class="muted">Current-year depreciation ${escapeHtml(currency(taxPacketSummary?.depreciationSummary?.total || 0))}. Mortgage interest ${escapeHtml(currency(taxPacketSummary?.loanSummary?.mortgageInterest || 0))}. Escrow deposits are not automatically deducted as taxes or insurance.</p>
          <h2>Document checklist</h2>
          <p>Linked documents: ${escapeHtml(taxPacketSummary?.documentChecklist?.linkedDocumentCount || 0)} | Loan documents: ${escapeHtml(taxPacketSummary?.documentChecklist?.loanDocumentCount || 0)} | Missing support: ${escapeHtml(taxPacketSummary?.documentChecklist?.missingSupportCount || 0)}</p>
          <ul>${missingSupport || "<li>No missing support rows in this scope.</li>"}</ul>
          <h2>Open items</h2>
          <ul>${openItems || "<li>No open readiness items in this scope.</li>"}</ul>
        </body>
      </html>`;
    if (!printHtmlDocument(packetHtml)) {
      downloadTextAsFile(packetHtml, `tax-prep-packet-${yearFilter}-${sanitizeFileNamePart(propertyFilter)}.html`, "text/html;charset=utf-8");
    }
  };

  return {
    exportScheduleEFilledPdf,
    exportScheduleEFormFdf,
    exportTaxDetailCsv,
    exportScheduleEReport,
    printTaxPacket,
    taxPacketSummary,
    taxReportingSummary,
  };
}
