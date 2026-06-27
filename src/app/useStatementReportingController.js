import { useEffect, useMemo } from "react";
import {
  buildEffectiveOwnerContact,
  buildOwnerStatementNoteTemplate,
} from "../lib/appSupport.ts";
import {
  buildOwnerMonthlyReport,
  buildOwnerPeriodReport,
  ownerMonthlyReportCsv,
  ownerStatementActivitySummary,
  ownerStatementCommunicationTxt,
  ownerStatementCsv,
  ownerStatementEmailBody,
  ownerStatementEmailSubject,
  scheduleEFriendlyCsv,
  summarizeOwnerMonthlyReport,
  tenantStatementCsv,
  tenantStatementKindLabel,
  tenantStatementSummary,
} from "../domain/reporting.ts";

export function useStatementReportingController({
  activeTx,
  addAuditEntry,
  appSettings,
  buildPrintableStatementHtml,
  buildStatementBranding,
  copyTextToClipboard,
  currency,
  desktopStatementPdfApi,
  downloadTextAsFile,
  escapeHtml,
  formatPropertyLabel,
  formatStatementDateRangeLabel,
  formatStatementMonthLabel,
  formatStatementPresetLabel,
  formatUnitLabel,
  leaseActualEndLabel,
  leaseDraft,
  leaseTenantLedgerSummary,
  leases,
  loanPayments,
  loans,
  monthStartIso,
  ownerStatementCustomEnd,
  ownerStatementCustomStart,
  ownerStatementNoteDraft,
  ownerStatementNoteMode,
  ownerStatementNoteTemplate,
  ownerStatementPreset,
  printHtmlDocument,
  properties,
  propertyFilter,
  propertyNameById,
  quarterStartIso,
  sanitizeFileNamePart,
  setNotice,
  setOwnerStatementCustomEnd,
  setOwnerStatementCustomStart,
  setOwnerStatementNoteDraft,
  setOwnerStatementNoteMode,
  taxScheduleBreakdown,
  taxSnapshot,
  tenantStatementCustomEnd,
  tenantStatementCustomStart,
  tenantStatementPreset,
  todayIso,
  unitFilter,
  units,
  usePeriods,
  yearFilter,
}) {
  useEffect(() => {
    if (ownerStatementPreset !== "custom") return;
    if (!ownerStatementCustomStart?.startsWith(`${yearFilter}-`) || !ownerStatementCustomEnd?.startsWith(`${yearFilter}-`)) {
      setOwnerStatementCustomStart(`${yearFilter}-01-01`);
      setOwnerStatementCustomEnd(`${yearFilter}-12-31`);
    }
  }, [ownerStatementPreset, ownerStatementCustomStart, ownerStatementCustomEnd, yearFilter, setOwnerStatementCustomStart, setOwnerStatementCustomEnd]);

  const ownerStatementRange = useMemo(() => {
    const yearStart = `${yearFilter}-01-01`;
    const yearEnd = `${yearFilter}-12-31`;
    const effectiveEnd = todayIso.startsWith(`${yearFilter}-`) ? todayIso : yearEnd;

    if (ownerStatementPreset === "mtd") {
      return {
        startDate: monthStartIso(effectiveEnd) || yearStart,
        endDate: effectiveEnd,
        label: formatStatementPresetLabel("mtd"),
      };
    }

    if (ownerStatementPreset === "qtd") {
      return {
        startDate: quarterStartIso(effectiveEnd) || yearStart,
        endDate: effectiveEnd,
        label: formatStatementPresetLabel("qtd"),
      };
    }

    if (ownerStatementPreset === "ytd") {
      return {
        startDate: yearStart,
        endDate: effectiveEnd,
        label: formatStatementPresetLabel("ytd"),
      };
    }

    if (ownerStatementPreset === "custom") {
      const startDate = ownerStatementCustomStart || yearStart;
      const endDate = ownerStatementCustomEnd || yearEnd;
      return {
        startDate: startDate <= endDate ? startDate : endDate,
        endDate: endDate >= startDate ? endDate : startDate,
        label: formatStatementPresetLabel("custom"),
      };
    }

    return {
      startDate: yearStart,
      endDate: yearEnd,
      label: formatStatementPresetLabel("annual"),
    };
  }, [ownerStatementCustomEnd, ownerStatementCustomStart, ownerStatementPreset, todayIso, yearFilter, monthStartIso, quarterStartIso, formatStatementPresetLabel]);

  const ownerMonthlyRows = useMemo(
    () =>
      buildOwnerMonthlyReport({
        year: yearFilter,
        transactions: activeTx,
        loanPayments,
        loans,
        propertyId: propertyFilter,
        unit: unitFilter,
        usePeriods,
        leases,
        units,
      }),
    [yearFilter, activeTx, loanPayments, loans, propertyFilter, unitFilter, usePeriods, leases, units],
  );

  const ownerMonthlyTotals = useMemo(() => summarizeOwnerMonthlyReport(ownerMonthlyRows), [ownerMonthlyRows]);

  const ownerStatementRows = useMemo(
    () =>
      buildOwnerPeriodReport({
        startDate: ownerStatementRange.startDate,
        endDate: ownerStatementRange.endDate,
        transactions: activeTx,
        loanPayments,
        loans,
        propertyId: propertyFilter,
        unit: unitFilter,
        usePeriods,
        leases,
        units,
      }),
    [activeTx, loanPayments, loans, ownerStatementRange.endDate, ownerStatementRange.startDate, propertyFilter, unitFilter, usePeriods, leases, units],
  );

  const ownerStatementTotals = useMemo(() => summarizeOwnerMonthlyReport(ownerStatementRows), [ownerStatementRows]);

  const createStatementReportId = (prefix, scopeParts = []) => {
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12);
    const suffix = scopeParts.map(sanitizeFileNamePart).filter(Boolean).join("-");
    return [prefix, timestamp, suffix].filter(Boolean).join("-");
  };

  const selectedOwnerProperty = useMemo(
    () => (propertyFilter === "all" ? null : properties.find((property) => property.id === propertyFilter) || null),
    [properties, propertyFilter],
  );

  const ownerStatementReportId = useMemo(
    () => createStatementReportId("owner", [yearFilter, propertyFilter, unitFilter, ownerStatementRange.label]),
    [yearFilter, propertyFilter, unitFilter, ownerStatementRange.label],
  );
  const ownerStatementPeriodLabel = formatStatementDateRangeLabel({ start: ownerStatementRange.startDate, end: ownerStatementRange.endDate });
  const ownerStatementPreparedBy = String(appSettings.statementPreparedBy || appSettings.statementBusinessName || "Rental Tracker").trim() || "Rental Tracker";
  const ownerStatementContact = buildEffectiveOwnerContact(selectedOwnerProperty, appSettings);
  const ownerStatementRecipient = ownerStatementContact.ownerName;
  const ownerStatementRecipientEmail = ownerStatementContact.ownerEmail;
  const ownerStatementRecipientPhone = ownerStatementContact.ownerPhone;
  const ownerStatementDefaultNote = String(appSettings.statementOwnerNote || "").trim();
  const ownerStatementPropertyLabel = propertyFilter === "all" ? "All properties" : (selectedOwnerProperty?.name || propertyFilter);
  const ownerStatementUnitLabel = unitFilter === "all" ? "All units" : unitFilter;

  useEffect(() => {
    setOwnerStatementNoteDraft(ownerStatementDefaultNote);
    setOwnerStatementNoteMode("default");
  }, [ownerStatementDefaultNote, selectedOwnerProperty?.id, setOwnerStatementNoteDraft, setOwnerStatementNoteMode]);

  useEffect(() => {
    if (ownerStatementNoteMode !== "template") return;
    setOwnerStatementNoteDraft(buildOwnerStatementNoteTemplate(ownerStatementNoteTemplate, {
      propertyLabel: ownerStatementPropertyLabel,
      unitLabel: ownerStatementUnitLabel,
      presetLabel: ownerStatementRange.label,
      periodLabel: ownerStatementPeriodLabel,
      totals: ownerStatementTotals,
    }));
  }, [
    ownerStatementNoteMode,
    ownerStatementNoteTemplate,
    ownerStatementPeriodLabel,
    ownerStatementPropertyLabel,
    ownerStatementRange.label,
    ownerStatementTotals,
    ownerStatementUnitLabel,
    setOwnerStatementNoteDraft,
  ]);

  const ownerStatementEmailDraftSubject = ownerStatementEmailSubject({
    propertyLabel: ownerStatementPropertyLabel,
    unitLabel: ownerStatementUnitLabel,
    presetLabel: ownerStatementRange.label,
    statementPeriodLabel: ownerStatementPeriodLabel,
  });

  const ownerStatementEmailDraftBody = ownerStatementEmailBody({
    recipientName: ownerStatementRecipient,
    recipientEmail: ownerStatementRecipientEmail,
    recipientPhone: ownerStatementRecipientPhone,
    propertyLabel: ownerStatementPropertyLabel,
    unitLabel: ownerStatementUnitLabel,
    presetLabel: ownerStatementRange.label,
    statementPeriodLabel: ownerStatementPeriodLabel,
    reportId: ownerStatementReportId,
    preparedBy: ownerStatementPreparedBy,
    note: ownerStatementNoteDraft,
    totals: ownerStatementTotals,
    attachmentLabels: ["Owner statement PDF", "Owner statement CSV"],
  });

  const ownerStatementCommunicationBundle = ownerStatementCommunicationTxt({
    recipientName: ownerStatementRecipient,
    recipientEmail: ownerStatementRecipientEmail,
    recipientPhone: ownerStatementRecipientPhone,
    propertyLabel: ownerStatementPropertyLabel,
    unitLabel: ownerStatementUnitLabel,
    presetLabel: ownerStatementRange.label,
    statementPeriodLabel: ownerStatementPeriodLabel,
    reportId: ownerStatementReportId,
    preparedBy: ownerStatementPreparedBy,
    note: ownerStatementNoteDraft,
    totals: ownerStatementTotals,
    attachmentLabels: ["Owner statement PDF", "Owner statement CSV"],
  });

  const buildStatementDetailGridHtml = (details) =>
    `<div class="detail-grid">${details
      .filter((detail) => detail?.value)
      .map((detail) => `<div class="detail-item"><div class="detail-label">${escapeHtml(detail.label)}</div><div class="detail-value">${escapeHtml(detail.value)}</div></div>`)
      .join("")}</div>`;

  const exportPrintableStatementPdf = async ({ html, suggestedFileName, successMessage }) => {
    if (!desktopStatementPdfApi?.savePdf) {
      setNotice("PDF export is available in installed desktop builds. In the browser, use Print and choose Save as PDF.");
      return;
    }

    try {
      const result = await desktopStatementPdfApi.savePdf({ html, suggestedFileName });
      if (result?.ok) {
        setNotice(successMessage || "Statement PDF saved.");
        return;
      }
      if (!result?.canceled) {
        setNotice(result?.message || "Could not export statement PDF.");
      }
    } catch {
      setNotice("Could not export statement PDF.");
    }
  };

  const exportOwnerReport = () => {
    try {
      const csv = ownerMonthlyReportCsv(ownerMonthlyRows, ownerMonthlyTotals);
      const scope = [yearFilter, propertyFilter, unitFilter].join("-").replace(/[^a-zA-Z0-9\-]+/g, "_");
      downloadTextAsFile(csv, `owner-pnl-${scope}.csv`, "text/csv;charset=utf-8");
      addAuditEntry({
        action: "export",
        entityType: "owner-report",
        entityId: `${yearFilter}-${propertyFilter}-${unitFilter}`,
        propertyId: propertyFilter === "all" ? undefined : propertyFilter,
        unit: unitFilter === "all" ? undefined : unitFilter,
        summary: "Exported owner P&L CSV.",
        details: `Scope ${yearFilter} | ${formatPropertyLabel(propertyFilter)} | ${formatUnitLabel(unitFilter)}.`,
        category: "reporting",
      });
      setNotice("Owner P&L CSV exported.");
    } catch {
      setNotice("Could not export owner P&L CSV.");
    }
  };

  const exportOwnerStatement = () => {
    try {
      const csv = ownerStatementCsv({
        year: yearFilter,
        reportId: ownerStatementReportId,
        propertyLabel: formatPropertyLabel(propertyFilter),
        unitLabel: formatUnitLabel(unitFilter),
        recipientName: ownerStatementRecipient,
        preparedBy: ownerStatementPreparedBy,
        presetLabel: ownerStatementRange.label,
        statementPeriod: { start: ownerStatementRange.startDate, end: ownerStatementRange.endDate },
        note: ownerStatementNoteDraft,
        rows: ownerStatementRows,
        totals: ownerStatementTotals,
        readiness: {
          label: ownerStatementRows.length > 0 ? "Owner-facing statement prepared" : "No owner statement activity",
          blockingCount: 0,
          warningCount: ownerStatementRows.every((row) => Number(row.grossIncome || 0) === 0 && Number(row.operatingExpenses || 0) === 0 && Number(row.capex || 0) === 0 && Number(row.debtService || 0) === 0) ? 1 : 0,
          sourceRowCount: ownerStatementRows.length,
        },
        generatedAt: new Date().toISOString(),
      });
      const scope = [ownerStatementReportId, ownerStatementRange.startDate, ownerStatementRange.endDate].map(sanitizeFileNamePart).filter(Boolean).join("-");
      downloadTextAsFile(csv, `owner-statement-${scope}.csv`, "text/csv;charset=utf-8");
      addAuditEntry({
        action: "export",
        entityType: "owner-statement",
        entityId: ownerStatementReportId,
        propertyId: propertyFilter === "all" ? undefined : propertyFilter,
        unit: unitFilter === "all" ? undefined : unitFilter,
        summary: "Exported owner statement CSV.",
        details: `Preset ${ownerStatementRange.label} | ${ownerStatementPeriodLabel}.`,
        category: "reporting",
      });
      setNotice("Owner statement CSV exported.");
    } catch {
      setNotice("Could not export owner statement CSV.");
    }
  };

  const buildOwnerStatementPayload = () => ({
    year: String(yearFilter),
    presetLabel: ownerStatementRange.label,
    periodLabel: ownerStatementPeriodLabel,
    periodStart: ownerStatementRange.startDate,
    periodEnd: ownerStatementRange.endDate,
    reportId: ownerStatementReportId,
    recipientName: ownerStatementRecipient,
    preparedBy: ownerStatementPreparedBy,
    note: ownerStatementNoteDraft,
    propertyLabel: formatPropertyLabel(propertyFilter),
    unitLabel: formatUnitLabel(unitFilter),
    rows: ownerStatementRows,
    totals: ownerStatementTotals,
  });

  const buildOwnerStatementDocument = () => {
    const payload = buildOwnerStatementPayload();
    const activitySummary = ownerStatementActivitySummary(payload.rows);
    const statementBranding = buildStatementBranding(appSettings);
    const rowHtml = payload.rows
      .map((row) => {
        const incomeClass = row.grossIncome > 0 ? "positive" : "";
        const cashFlowClass = row.cashFlow < 0 ? "negative" : row.cashFlow > 0 ? "positive" : "";
        return `<tr><td>${escapeHtml(formatStatementMonthLabel(row.month))}</td><td class="num ${incomeClass}">${escapeHtml(currency(row.grossIncome))}</td><td class="num">${escapeHtml(currency(row.operatingExpenses))}</td><td class="num">${escapeHtml(currency(row.netOperatingIncome))}</td><td class="num">${escapeHtml(currency(row.capex))}</td><td class="num">${escapeHtml(currency(row.debtService))}</td><td class="num ${cashFlowClass}">${escapeHtml(currency(row.cashFlow))}</td></tr>`;
      })
      .join("");

    const totalsHtml = `<tr><td><strong>Total</strong></td><td class="num positive"><strong>${escapeHtml(currency(payload.totals.grossIncome))}</strong></td><td class="num"><strong>${escapeHtml(currency(payload.totals.operatingExpenses))}</strong></td><td class="num"><strong>${escapeHtml(currency(payload.totals.netOperatingIncome))}</strong></td><td class="num"><strong>${escapeHtml(currency(payload.totals.capex))}</strong></td><td class="num"><strong>${escapeHtml(currency(payload.totals.debtService))}</strong></td><td class="num ${payload.totals.cashFlow < 0 ? "negative" : payload.totals.cashFlow > 0 ? "positive" : ""}"><strong>${escapeHtml(currency(payload.totals.cashFlow))}</strong></td></tr>`;
    const scopePills = [
      `Property: ${payload.propertyLabel}`,
      `Unit: ${payload.unitLabel}`,
      `Preset: ${payload.presetLabel}`,
      `Statement period: ${payload.periodLabel}`,
      `Active months: ${activitySummary.activeMonthCount}`,
    ]
      .map((label) => `<span class="pill">${escapeHtml(label)}</span>`)
      .join("");
    const bannerText = payload.totals.cashFlow < 0
      ? `Cash flow for this ${payload.presetLabel.toLowerCase()} statement is currently negative at ${currency(payload.totals.cashFlow)}.`
      : `Cash flow for this ${payload.presetLabel.toLowerCase()} statement is ${currency(payload.totals.cashFlow)}.`;
    const printHtml = buildPrintableStatementHtml({
      title: `Owner Statement ${payload.year}`,
      subtitle: `${payload.propertyLabel} | ${payload.unitLabel}`,
      branding: statementBranding,
      bannerText,
      summaryCards: [
        { label: "Generated", value: new Date().toLocaleString(), subtext: `Year ${payload.year}` },
        { label: "Gross income", value: currency(payload.totals.grossIncome) },
        { label: "Operating expenses", value: currency(payload.totals.operatingExpenses) },
        { label: "NOI", value: currency(payload.totals.netOperatingIncome) },
        { label: "Debt service", value: currency(payload.totals.debtService) },
        { label: "Cash flow", value: currency(payload.totals.cashFlow), subtext: "After CapEx and debt service" },
        { label: "Avg monthly income", value: currency(activitySummary.averageMonthlyIncome) },
        { label: "Avg monthly cash flow", value: currency(activitySummary.averageMonthlyCashFlow) },
      ],
      sections: [
        {
          title: "Statement details",
          description: "Recipient, generation details, and reference information.",
          contentHtml: buildStatementDetailGridHtml([
            { label: "Recipient", value: payload.recipientName },
            { label: "Prepared by", value: payload.preparedBy },
            { label: "Statement ID", value: payload.reportId },
            { label: "Preset", value: payload.presetLabel },
            { label: "Period", value: payload.periodLabel },
            { label: "Generated", value: new Date().toLocaleString() },
          ]),
        },
        {
          title: "Statement scope",
          description: "Filters and period included in this report.",
          contentHtml: `<div class="pill-row">${scopePills}</div>`,
        },
        {
          title: "Annual summary",
          description: "Quick owner-facing rollup for the selected statement scope.",
          contentHtml: `<div class="muted-copy"><strong>Gross income:</strong> ${escapeHtml(currency(payload.totals.grossIncome))}<br /><strong>Operating expenses:</strong> ${escapeHtml(currency(payload.totals.operatingExpenses))}<br /><strong>CapEx:</strong> ${escapeHtml(currency(payload.totals.capex))}<br /><strong>Debt service:</strong> ${escapeHtml(currency(payload.totals.debtService))}<br /><strong>Net cash flow:</strong> ${escapeHtml(currency(payload.totals.cashFlow))}</div>`,
        },
        {
          title: "Monthly owner statement",
          description: "Income, expense, and cash flow totals by month.",
          contentHtml: `<div class="table-wrap"><table><thead><tr><th>Month</th><th class="num">Income</th><th class="num">OpEx</th><th class="num">NOI</th><th class="num">CapEx</th><th class="num">Debt service</th><th class="num">Cash flow</th></tr></thead><tbody>${rowHtml}${totalsHtml}</tbody></table></div>`,
        },
        {
          title: "Reading guide",
          description: "Quick interpretation notes for owners and advisors.",
          contentHtml: `<div class="muted-copy"><strong>NOI</strong> is gross income minus operating expenses. <strong>Cash flow</strong> subtracts capital spending and debt service from NOI, so it tracks what the property generated after major outflows. ${payload.unitLabel !== "All units" ? "Debt service is typically loan-level, so unit-level cash flow should be treated as directional unless loans are tracked per unit." : ""}</div>`,
        },
        ...(payload.note ? [{
          title: "Notes to recipient",
          description: "Optional owner-facing delivery note.",
          contentHtml: `<div class="note-box">${escapeHtml(payload.note)}</div>`,
        }] : []),
      ],
      footerNote: "NOI equals income minus operating expenses. Cash flow subtracts CapEx and debt service from NOI.",
    });

    return {
      html: printHtml,
      fileName: `owner-statement-${sanitizeFileNamePart(payload.reportId)}.pdf`,
    };
  };

  const printOwnerStatement = () => {
    const documentPayload = buildOwnerStatementDocument();
    if (!printHtmlDocument(documentPayload.html)) {
      setNotice("Could not initialize owner statement print preview.");
      return;
    }
    setNotice("Owner statement sent to printer.");
  };

  const exportOwnerStatementPdf = async () => {
    const documentPayload = buildOwnerStatementDocument();
    await exportPrintableStatementPdf({
      html: documentPayload.html,
      suggestedFileName: documentPayload.fileName,
      successMessage: "Owner statement PDF saved.",
    });
  };

  const buildTenantStatementPayload = () => {
    if (!leaseDraft?.id) return null;

    const allRows = leaseTenantLedgerSummary.rows.map((row) => ({
      date: row.date,
      kind: row.kind,
      memo: row.memo,
      delta: row.delta,
      runningBalance: row.runningBalance,
    }));

    let rangeStart = "";
    let rangeEnd = "";
    let presetLabel = "All activity";

    if (tenantStatementPreset === "current-year") {
      rangeStart = `${todayIso.slice(0, 4)}-01-01`;
      rangeEnd = todayIso;
      presetLabel = formatStatementPresetLabel("current-year");
    } else if (tenantStatementPreset === "current-month") {
      rangeStart = monthStartIso(todayIso);
      rangeEnd = todayIso;
      presetLabel = formatStatementPresetLabel("current-month");
    } else if (tenantStatementPreset === "custom") {
      rangeStart = tenantStatementCustomStart;
      rangeEnd = tenantStatementCustomEnd;
      presetLabel = formatStatementPresetLabel("custom");
    }

    const normalizedRangeStart = rangeStart && rangeEnd && rangeStart > rangeEnd ? rangeEnd : rangeStart;
    const normalizedRangeEnd = rangeStart && rangeEnd && rangeStart > rangeEnd ? rangeStart : rangeEnd;
    const openingBalanceRow = normalizedRangeStart
      ? [...allRows].reverse().find((row) => row.date && row.date < normalizedRangeStart)
      : null;
    const filteredRows = allRows.filter((row) => {
      if (normalizedRangeStart && row.date < normalizedRangeStart) return false;
      if (normalizedRangeEnd && row.date > normalizedRangeEnd) return false;
      return true;
    });
    const statementEndingBalance = filteredRows.length > 0
      ? Number(filteredRows[filteredRows.length - 1].runningBalance || 0)
      : Number(openingBalanceRow?.runningBalance || 0);
    const statementBalanceDue = statementEndingBalance > 0 ? statementEndingBalance : 0;
    const statementTenantCredit = statementEndingBalance < 0 ? Math.abs(statementEndingBalance) : 0;
    const reportId = createStatementReportId("tenant", [
      leaseDraft.tenantName,
      leaseDraft.propertyId,
      leaseDraft.unit,
      presetLabel,
    ]);

    return {
      reportId,
      presetLabel,
      periodStart: normalizedRangeStart,
      periodEnd: normalizedRangeEnd,
      periodLabel: normalizedRangeStart && normalizedRangeEnd ? formatStatementDateRangeLabel({ start: normalizedRangeStart, end: normalizedRangeEnd }) : "All activity",
      recipientName: String(leaseDraft.tenantName || "Tenant").trim() || "Tenant",
      preparedBy: String(appSettings.statementPreparedBy || appSettings.statementBusinessName || "Rental Tracker").trim() || "Rental Tracker",
      note: String(appSettings.statementTenantNote || "").trim(),
      openingBalance: Number(openingBalanceRow?.runningBalance || 0),
      tenantName: String(leaseDraft.tenantName || "Tenant").trim() || "Tenant",
      propertyLabel: propertyNameById[leaseDraft.propertyId] || leaseDraft.propertyId || "",
      unitLabel: String(leaseDraft.unit || ""),
      leaseStartDate: leaseDraft.startDate || "",
      leaseEndDate: leaseActualEndLabel(leaseDraft) || "",
      totalDue: statementBalanceDue,
      tenantCredit: statementTenantCredit,
      rows: filteredRows,
      readiness: {
        label: filteredRows.length > 0 ? "Tenant-facing ledger statement prepared" : "No tenant ledger activity in range",
        blockingCount: 0,
        warningCount: filteredRows.length > 0 ? 0 : 1,
        sourceRowCount: filteredRows.length,
      },
    };
  };

  const exportTenantStatement = () => {
    try {
      const payload = buildTenantStatementPayload();
      if (!payload) {
        setNotice("Open a lease first.");
        return;
      }

      const csv = tenantStatementCsv(payload);
      const scope = [payload.reportId, payload.periodStart || payload.leaseStartDate, payload.periodEnd || payload.leaseEndDate]
        .join("-")
        .replace(/[^a-zA-Z0-9\-]+/g, "_")
        .replace(/_+/g, "_");
      downloadTextAsFile(csv, `tenant-statement-${scope}.csv`, "text/csv;charset=utf-8");
      addAuditEntry({
        action: "export",
        entityType: "tenant-statement",
        entityId: payload.reportId,
        propertyId: leaseDraft?.propertyId,
        unit: leaseDraft?.unit,
        summary: "Exported tenant statement CSV.",
        details: `Preset ${payload.presetLabel} | ${payload.periodLabel}.`,
        category: "reporting",
      });
      setNotice("Tenant statement CSV exported.");
    } catch {
      setNotice("Could not export tenant statement CSV.");
    }
  };

  const buildTenantStatementDocument = () => {
    const payload = buildTenantStatementPayload();
    if (!payload) return null;

    const statementSummary = tenantStatementSummary(payload.rows);
    const statementBranding = buildStatementBranding(appSettings);
    const balanceLabel = payload.tenantCredit > 0
      ? `Tenant credit ${currency(payload.tenantCredit)}`
      : payload.totalDue > 0
        ? `Balance due ${currency(payload.totalDue)}`
        : `Current balance ${currency(0)}`;
    const rowHtml = (payload.rows.length > 0 ? payload.rows : [{ date: "", kind: "", memo: "No ledger activity for this lease yet.", delta: 0, runningBalance: 0 }])
      .map((row) => {
        const charge = row.delta > 0 ? currency(row.delta) : "";
        const credit = row.delta < 0 ? currency(Math.abs(row.delta)) : "";
        const balanceClass = row.runningBalance < 0 ? "positive" : row.runningBalance > 0 ? "negative" : "";
        const runningBalanceLabel = row.runningBalance < 0 ? `Credit ${currency(Math.abs(row.runningBalance))}` : currency(row.runningBalance);
        return `<tr><td>${escapeHtml(row.date)}</td><td>${escapeHtml(tenantStatementKindLabel(String(row.kind || "")))}</td><td class="memo-col">${escapeHtml(row.memo || "")}</td><td class="num">${escapeHtml(charge)}</td><td class="num positive">${escapeHtml(credit)}</td><td class="num ${balanceClass}">${escapeHtml(runningBalanceLabel)}</td></tr>`;
      })
      .join("");
    const leasePills = [
      `Property: ${payload.propertyLabel}`,
      `Unit: ${payload.unitLabel}`,
      `Lease start: ${payload.leaseStartDate || "Not set"}`,
      `Lease end: ${payload.leaseEndDate || "Open-ended"}`,
      `Preset: ${payload.presetLabel}`,
      `Statement period: ${payload.periodLabel}`,
    ]
      .map((label) => `<span class="pill">${escapeHtml(label)}</span>`)
      .join("");
    const statusCopy = payload.totalDue > 0
      ? "A positive balance means charges currently exceed payments and credits recorded in the tenant ledger."
      : payload.tenantCredit > 0
        ? "A tenant credit means the ledger shows prepayments or credits that can be applied to future charges."
        : "A zero balance means recorded charges and payments are currently in balance.";

    const printHtml = buildPrintableStatementHtml({
      title: `${payload.tenantName} Tenant Statement`,
      subtitle: `${payload.propertyLabel} | Unit ${payload.unitLabel} | Lease ${payload.leaseStartDate} to ${payload.leaseEndDate}`,
      branding: statementBranding,
      bannerText: balanceLabel,
      summaryCards: [
        { label: "Generated", value: new Date().toLocaleString() },
        { label: "Balance due", value: currency(payload.totalDue) },
        { label: "Tenant credit", value: currency(payload.tenantCredit) },
        { label: "Current status", value: balanceLabel, subtext: payload.totalDue > 0 ? "Payment still due" : "Account is settled or in credit" },
        { label: "Total charges", value: currency(statementSummary.totalCharges) },
        { label: "Total credits", value: currency(statementSummary.totalCredits) },
        { label: "Entries", value: String(statementSummary.entryCount) },
      ],
      sections: [
        {
          title: "Statement details",
          description: "Recipient, delivery details, and report reference information.",
          contentHtml: buildStatementDetailGridHtml([
            { label: "Recipient", value: payload.recipientName },
            { label: "Prepared by", value: payload.preparedBy },
            { label: "Statement ID", value: payload.reportId },
            { label: "Preset", value: payload.presetLabel },
            { label: "Period", value: payload.periodLabel },
            { label: "Opening balance", value: payload.openingBalance !== 0 ? currency(payload.openingBalance) : "0.00" },
          ]),
        },
        {
          title: "Lease snapshot",
          description: "Lease details tied to this ledger statement.",
          contentHtml: `<div class="pill-row">${leasePills}</div>`,
        },
        {
          title: "Statement summary",
          description: "A quick tenant-facing overview of this statement.",
          contentHtml: `<div class="muted-copy"><strong>Opening balance:</strong> ${escapeHtml(currency(payload.openingBalance))}<br /><strong>Total charges:</strong> ${escapeHtml(currency(statementSummary.totalCharges))}<br /><strong>Total credits/payments:</strong> ${escapeHtml(currency(statementSummary.totalCredits))}<br /><strong>Current status:</strong> ${escapeHtml(balanceLabel)}<br /><strong>Entries included:</strong> ${escapeHtml(String(statementSummary.entryCount))}</div>`,
        },
        {
          title: "Ledger activity",
          description: "Charges, payments, credits, refunds, and adjustments in posted order.",
          contentHtml: `<div class="table-wrap"><table class="statement-ledger-table"><colgroup><col class="date-col" /><col class="type-col" /><col class="memo-width-col" /><col class="charge-col" /><col class="credit-col" /><col class="balance-col" /></colgroup><thead><tr><th>Date</th><th>Type</th><th class="memo-col">Memo</th><th class="num">Charge</th><th class="num">Credit</th><th class="num">Running balance</th></tr></thead><tbody>${rowHtml}</tbody></table></div>`,
        },
        {
          title: "How to read this statement",
          description: "Balance interpretation for tenant-facing printouts.",
          contentHtml: `<div class="muted-copy">${escapeHtml(statusCopy)}</div>`,
        },
        ...(payload.note ? [{
          title: "Notes to recipient",
          description: "Optional payment or follow-up instructions.",
          contentHtml: `<div class="note-box">${escapeHtml(payload.note)}</div>`,
        }] : []),
      ],
      footerNote: "This statement reflects the tenant ledger currently recorded in Rental Tracker, including charges, payments, credits, refunds, and adjustments.",
    });

    return {
      html: printHtml,
      fileName: `tenant-statement-${sanitizeFileNamePart(payload.reportId)}.pdf`,
    };
  };

  const printTenantStatement = () => {
    const documentPayload = buildTenantStatementDocument();
    if (!documentPayload) {
      setNotice("Open a lease first.");
      return;
    }

    if (!printHtmlDocument(documentPayload.html)) {
      setNotice("Could not initialize tenant statement print preview.");
      return;
    }

    addAuditEntry({
      action: "print",
      entityType: "tenant-statement",
      entityId: documentPayload.fileName,
      propertyId: leaseDraft?.propertyId,
      unit: leaseDraft?.unit,
      summary: "Printed tenant statement.",
      details: `Preset ${tenantStatementPreset}.`,
      category: "reporting",
    });
    setNotice("Tenant statement sent to printer.");
  };

  const exportTenantStatementPdf = async () => {
    const documentPayload = buildTenantStatementDocument();
    if (!documentPayload) {
      setNotice("Open a lease first.");
      return;
    }

    await exportPrintableStatementPdf({
      html: documentPayload.html,
      suggestedFileName: documentPayload.fileName,
      successMessage: "Tenant statement PDF saved.",
    });
  };

  const exportScheduleEReport = () => {
    try {
      const csv = scheduleEFriendlyCsv({
        year: yearFilter,
        propertyLabel: formatPropertyLabel(propertyFilter),
        unitLabel: formatUnitLabel(unitFilter),
        rows: taxScheduleBreakdown.map((line) => ({
          id: line.id,
          label: line.label,
          total: line.total,
          sourceNote: line.sourceNote,
        })),
        metrics: taxSnapshot.metrics,
        readiness: {
          label: "Schedule E summary export",
          status: "summary",
          blockingCount: 0,
          warningCount: 0,
          sourceRowCount: taxScheduleBreakdown.reduce((sum, line) => {
            const match = String(line.sourceNote || "").match(/\d+/);
            return sum + Number(match?.[0] || 0);
          }, 0),
          notes: ["For detailed source readiness, use the Tax Packet export from Tax Center."],
        },
      });
      const scope = [yearFilter, propertyFilter, unitFilter].join("-").replace(/[^a-zA-Z0-9\-]+/g, "_");
      downloadTextAsFile(csv, `schedule-e-${scope}.csv`, "text/csv;charset=utf-8");
      addAuditEntry({
        action: "export",
        entityType: "schedule-e",
        entityId: `${yearFilter}-${propertyFilter}-${unitFilter}`,
        propertyId: propertyFilter === "all" ? undefined : propertyFilter,
        unit: unitFilter === "all" ? undefined : unitFilter,
        summary: "Exported Schedule E-friendly CSV.",
        details: `Scope ${yearFilter} | ${formatPropertyLabel(propertyFilter)} | ${formatUnitLabel(unitFilter)}.`,
        category: "reporting",
      });
      setNotice("Schedule E CSV exported.");
    } catch {
      setNotice("Could not export Schedule E CSV.");
    }
  };

  const applyOwnerStatementNoteTemplate = () => {
    const nextNote = buildOwnerStatementNoteTemplate(ownerStatementNoteTemplate, {
      propertyLabel: ownerStatementPropertyLabel,
      unitLabel: ownerStatementUnitLabel,
      presetLabel: ownerStatementRange.label,
      periodLabel: ownerStatementPeriodLabel,
      totals: ownerStatementTotals,
    });
    setOwnerStatementNoteDraft(nextNote);
    setOwnerStatementNoteMode("template");
    setNotice("Owner note template applied.");
  };

  const copyOwnerStatementSubject = async () => {
    try {
      const copied = await copyTextToClipboard(ownerStatementEmailDraftSubject);
      if (copied) {
        addAuditEntry({
          action: "copy",
          entityType: "owner-communication",
          entityId: ownerStatementReportId,
          propertyId: propertyFilter === "all" ? undefined : propertyFilter,
          unit: unitFilter === "all" ? undefined : unitFilter,
          summary: "Copied owner email subject.",
          details: ownerStatementEmailDraftSubject,
          category: "reporting",
        });
      }
      setNotice(copied ? "Owner email subject copied." : "Could not copy the owner email subject.");
    } catch {
      setNotice("Could not copy the owner email subject.");
    }
  };

  const copyOwnerStatementBody = async () => {
    try {
      const copied = await copyTextToClipboard(ownerStatementEmailDraftBody);
      if (copied) {
        addAuditEntry({
          action: "copy",
          entityType: "owner-communication",
          entityId: ownerStatementReportId,
          propertyId: propertyFilter === "all" ? undefined : propertyFilter,
          unit: unitFilter === "all" ? undefined : unitFilter,
          summary: "Copied owner email body.",
          details: `Prepared for ${ownerStatementRecipient}.`,
          category: "reporting",
        });
      }
      setNotice(copied ? "Owner email body copied." : "Could not copy the owner email body.");
    } catch {
      setNotice("Could not copy the owner email body.");
    }
  };

  const exportOwnerCommunicationBundle = () => {
    try {
      const scope = [ownerStatementReportId, ownerStatementRange.startDate, ownerStatementRange.endDate].map(sanitizeFileNamePart).filter(Boolean).join("-");
      downloadTextAsFile(ownerStatementCommunicationBundle, `owner-statement-email-${scope}.txt`);
      addAuditEntry({
        action: "export",
        entityType: "owner-communication",
        entityId: ownerStatementReportId,
        propertyId: propertyFilter === "all" ? undefined : propertyFilter,
        unit: unitFilter === "all" ? undefined : unitFilter,
        summary: "Exported owner communication bundle.",
        details: `Preset ${ownerStatementRange.label} | ${ownerStatementPeriodLabel}.`,
        category: "reporting",
      });
      setNotice("Owner communication bundle exported.");
    } catch {
      setNotice("Could not export the owner communication bundle.");
    }
  };

  return {
    applyOwnerStatementNoteTemplate,
    copyOwnerStatementBody,
    copyOwnerStatementSubject,
    exportOwnerCommunicationBundle,
    exportOwnerReport,
    exportOwnerStatement,
    exportOwnerStatementPdf,
    exportScheduleEReport,
    exportTenantStatement,
    exportTenantStatementPdf,
    ownerMonthlyRows,
    ownerMonthlyTotals,
    ownerStatementEmailDraftBody,
    ownerStatementEmailDraftSubject,
    ownerStatementPeriodLabel,
    ownerStatementPreparedBy,
    ownerStatementRange,
    ownerStatementRecipient,
    ownerStatementRecipientEmail,
    ownerStatementRecipientPhone,
    printOwnerStatement,
    printTenantStatement,
    selectedOwnerProperty,
  };
}
