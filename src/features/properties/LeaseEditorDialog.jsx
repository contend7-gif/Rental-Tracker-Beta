import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { DialogLoadFallback } from "../shared/CommonDialogs.jsx";
import { field } from "../shared/uiHelpers.jsx";
import { selectableProperties } from "../../domain/propertyLifecycle.js";
import {
  leaseAgreementTypeLabel,
  leaseBillingCadenceLabel,
  leaseMonthlyEquivalent,
  leaseRentSummaryLabel,
  normalizeLeaseAgreementType,
  normalizeLeaseBillingCadence,
} from "../../domain/leaseTerms.js";

export function LeaseEditorDialog({
  TENANT_LEDGER_ACCOUNTING_OPTIONS,
  TENANT_LEDGER_KIND_OPTIONS,
  actions,
  appSettings,
  canCreateEditRecords,
  canDeleteRecords,
  clearTenantLedgerEntryDraft,
  closeLeaseEditor,
  confirmAndDeleteLease,
  confirmAndDeleteTenantLedgerEntry,
  confirmAndDeleteUsePeriod,
  currency,
  displayedLeaseTenantLedgerRows,
  editingTenantLedgerEntryId,
  editingUsePeriodId,
  exportTenantStatement,
  exportTenantStatementPdf,
  formatStatementPresetLabel,
  getUnitOccupancyPeriods,
  getUnitStatusForDate,
  isTenantLedgerKindAllowedForTreatment,
  leaseDraft,
  leaseEditorMode,
  leasePdfInputRef,
  leaseReminderKindLabel,
  leaseReminderToneClass,
  leaseTenantLedgerHeadline,
  leaseTenantLedgerRowById,
  leaseTenantLedgerSort,
  leaseTenantLedgerSummary,
  monthStartIso,
  normalizeTenantLedgerAccountingTreatment,
  onLeasePdfInputChange,
  openDocumentPreview,
  openLinkedTenantLedgerTransaction,
  openLeasePdfPicker,
  printTenantStatement,
  properties,
  recommendedTenantLedgerAccountingTreatment,
  recommendedTenantLedgerKindForTreatment,
  saveLease,
  saveTenantLedgerEntry,
  saveUnitOccupancyPeriod,
  selectedLeaseAutomationReminders,
  selectedLeaseDocuments,
  setEditingUsePeriodId,
  setLeaseDraft,
  setLeaseEditorMode,
  setLeaseTenantLedgerSort,
  setTenantLedgerDraft,
  setTenantStatementCustomEnd,
  setTenantStatementCustomStart,
  setTenantStatementPreset,
  setUsePeriodDraft,
  startTenantLedgerEntryEdit,
  tenantLedgerDraft,
  tenantStatementCustomEnd,
  tenantStatementCustomStart,
  tenantStatementPreset,
  todayIso,
  transactionById,
  unitStatusLabel,
  units,
  usePeriodDraft,
}) {
  const propertyOptions = selectableProperties(properties, leaseDraft?.propertyId);
  const agreementType = normalizeLeaseAgreementType(leaseDraft);
  const billingCadence = normalizeLeaseBillingCadence(leaseDraft);
  const rentAmountLabel = billingCadence === "full_term"
    ? "Full-term rent"
    : billingCadence === "weekly"
      ? "Weekly rent"
      : billingCadence === "biweekly"
        ? "Rent every two weeks"
        : billingCadence === "custom"
          ? "Rent each interval"
          : "Monthly rent";
  return (
    <Dialog open={Boolean(leaseDraft)} onOpenChange={(isOpen) => { if (!isOpen) closeLeaseEditor(); }}>
      <DialogContent className="flex max-h-[90vh] w-[min(96vw,1280px)] max-w-[1280px] flex-col overflow-hidden rounded-xl border bg-white shadow-lg">
        {!leaseDraft ? (
          <div className="p-4">
            <DialogLoadFallback message="We could not load this editor. Close and try opening Manage again." onClose={closeLeaseEditor} />
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <DialogHeader>
                <DialogTitle>{leaseEditorMode === "full" ? `Lease - ${leaseDraft.unit} (${leaseDraft.tenantName})` : `Occupancy - ${leaseDraft.unit}`}</DialogTitle>
              </DialogHeader>
              {leaseEditorMode === "full" && (
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {field("Tenant", <Input value={leaseDraft.tenantName} onChange={(e) => setLeaseDraft({ ...leaseDraft, tenantName: e.target.value })} />)}
                  {field(
                    "Property",
                    <Select value={leaseDraft.propertyId} onValueChange={(value) => setLeaseDraft({ ...leaseDraft, propertyId: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {propertyOptions.map((property) => (
                          <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>,
                  )}
                  {field(
                    "Unit",
                    <Select value={leaseDraft.unit} onValueChange={(value) => setLeaseDraft({ ...leaseDraft, unit: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {units.filter((unit) => unit.propertyId === leaseDraft.propertyId).map((unit) => (
                          <SelectItem key={unit.id} value={unit.name}>{unit.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>,
                  )}
                  <div className="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-950">
                    <div className="font-semibold">Term and billing are tracked separately</div>
                    <div className="mt-1">{leaseDraft.rentalType || "Long-term"} | {leaseAgreementTypeLabel(leaseDraft)} | {leaseBillingCadenceLabel(leaseDraft)}</div>
                    <div className="mt-1">{leaseRentSummaryLabel(leaseDraft, currency)}{billingCadence !== "monthly" ? ` | ${currency(leaseMonthlyEquivalent(leaseDraft))} monthly equivalent for planning` : ""}</div>
                  </div>
                  {field(
                    "Stay length",
                    <Select value={leaseDraft.rentalType || "Long-term"} onValueChange={(value) => setLeaseDraft({ ...leaseDraft, rentalType: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Short-term">Short-term</SelectItem>
                        <SelectItem value="Mid-term">Mid-term</SelectItem>
                        <SelectItem value="Long-term">Long-term</SelectItem>
                      </SelectContent>
                    </Select>,
                  )}
                  {field(
                    "Agreement",
                    <Select value={agreementType} onValueChange={(value) => setLeaseDraft({
                      ...leaseDraft,
                      agreementType: value,
                      monthToMonthAfterTerm: value !== "fixed_term",
                      billingCadence: value !== "fixed_term" && billingCadence === "full_term" ? "monthly" : billingCadence,
                    })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed_term">Fixed term</SelectItem>
                        <SelectItem value="month_to_month">Month-to-month</SelectItem>
                        <SelectItem value="fixed_then_month_to_month">Fixed, then month-to-month</SelectItem>
                      </SelectContent>
                    </Select>,
                  )}
                  {field(
                    "Billing schedule",
                    <Select value={billingCadence} onValueChange={(value) => setLeaseDraft({
                      ...leaseDraft,
                      billingCadence: value,
                      prorationMethod: value === "monthly" ? (leaseDraft.prorationMethod || "thirty_day") : "none",
                    })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {agreementType === "fixed_term" ? <SelectItem value="full_term">Full term, paid upfront</SelectItem> : null}
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Every two weeks</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="custom">Custom day interval</SelectItem>
                      </SelectContent>
                    </Select>,
                  )}
                  {field(rentAmountLabel, <Input type="number" min="0" step="0.01" value={leaseDraft.rentAmount ?? leaseDraft.monthlyRent} onChange={(e) => setLeaseDraft({ ...leaseDraft, rentAmount: e.target.value })} />)}
                  {field("Security deposit", <Input type="number" min="0" value={leaseDraft.securityDeposit || ""} onChange={(e) => setLeaseDraft({ ...leaseDraft, securityDeposit: e.target.value })} />)}
                  {billingCadence === "monthly" && field("Rent due day", <Input type="number" min="1" max="28" value={leaseDraft.rentDueDay ?? appSettings.leaseDefaultRentDueDay} onChange={(e) => setLeaseDraft({ ...leaseDraft, rentDueDay: e.target.value })} />)}
                  {billingCadence === "custom" && field("Days between charges", <Input type="number" min="1" max="366" value={leaseDraft.billingIntervalDays || 30} onChange={(e) => setLeaseDraft({ ...leaseDraft, billingIntervalDays: e.target.value })} />)}
                  {billingCadence !== "monthly" && field(billingCadence === "full_term" ? "Full payment due" : "First payment due", <Input type="date" value={leaseDraft.firstRentDueDate || leaseDraft.startDate} onChange={(e) => setLeaseDraft({ ...leaseDraft, firstRentDueDate: e.target.value })} />)}
                  {billingCadence === "monthly" && field(
                    "Partial-month billing",
                    <Select value={leaseDraft.prorationMethod === "none" ? "none" : "thirty_day"} onValueChange={(value) => setLeaseDraft({ ...leaseDraft, prorationMethod: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="thirty_day">Prorate on a 30-day month</SelectItem>
                        <SelectItem value="none">Charge full billing periods</SelectItem>
                      </SelectContent>
                    </Select>,
                  )}
                  {field("Reminder days before due", <Input type="number" min="0" max="14" value={leaseDraft.reminderDaysBefore ?? appSettings.leaseReminderDaysBefore} onChange={(e) => setLeaseDraft({ ...leaseDraft, reminderDaysBefore: e.target.value })} />)}
                  {field(
                    "Utilities included",
                    <Select value={leaseDraft.utilitiesIncluded ? "Yes" : "No"} onValueChange={(value) => setLeaseDraft({ ...leaseDraft, utilitiesIncluded: value === "Yes" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="No">No</SelectItem>
                        <SelectItem value="Yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>,
                  )}
                  {leaseDraft.rentalType === "Mid-term" && field(
                    "Extension term (months)",
                    <Input type="number" value={leaseDraft.extensionTermMonths ?? 0} onChange={(e) => setLeaseDraft({ ...leaseDraft, extensionTermMonths: e.target.value })} />,
                  )}
                  {field("Occupancy starts", <Input type="date" value={leaseDraft.startDate} onChange={(e) => setLeaseDraft({ ...leaseDraft, startDate: e.target.value, firstRentDueDate: leaseDraft.firstRentDueDate || e.target.value })} />)}
                  {agreementType !== "month_to_month" && field("Fixed term ends", <Input type="date" value={leaseDraft.endDate} onChange={(e) => setLeaseDraft({ ...leaseDraft, endDate: e.target.value })} />)}
                  {field("Actual move-out date (optional)", <Input type="date" value={leaseDraft.actualEndDate || ""} onChange={(e) => setLeaseDraft({ ...leaseDraft, actualEndDate: e.target.value })} />)}
                  {field(
                    "Status",
                    <Select value={leaseDraft.status} onValueChange={(value) => setLeaseDraft({ ...leaseDraft, status: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Pending Renewal">Pending Renewal</SelectItem>
                        <SelectItem value="Ended">Ended</SelectItem>
                      </SelectContent>
                    </Select>,
                  )}
                  {field("Notes", <Input value={leaseDraft.notes} onChange={(e) => setLeaseDraft({ ...leaseDraft, notes: e.target.value })} />)}
                  {field(
                    "Auto late fees",
                    <Select value={leaseDraft.autoLateFeeEnabled ? "on" : "off"} onValueChange={(value) => setLeaseDraft({ ...leaseDraft, autoLateFeeEnabled: value === "on" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="off">Off</SelectItem>
                        <SelectItem value="on">On</SelectItem>
                      </SelectContent>
                    </Select>,
                  )}
                  {field("Late fee grace days", <Input type="number" min="0" max="30" value={leaseDraft.lateFeeGraceDays ?? appSettings.leaseLateFeeGraceDays} onChange={(e) => setLeaseDraft({ ...leaseDraft, lateFeeGraceDays: e.target.value })} />)}
                  {field(
                    "Late fee type",
                    <Select value={leaseDraft.lateFeeType || appSettings.leaseLateFeeType || "flat"} onValueChange={(value) => setLeaseDraft({ ...leaseDraft, lateFeeType: value === "percent" ? "percent" : "flat" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat amount</SelectItem>
                        <SelectItem value="percent">Percent of rent</SelectItem>
                      </SelectContent>
                    </Select>,
                  )}
                  {field(
                    leaseDraft.lateFeeType === "percent" ? "Late fee percent" : "Late fee amount",
                    <Input type="number" min="0" step="0.01" value={leaseDraft.lateFeeValue ?? appSettings.leaseLateFeeValue} onChange={(e) => setLeaseDraft({ ...leaseDraft, lateFeeValue: e.target.value })} />,
                  )}
                </div>
              )}
              <div className="mt-4 rounded border p-3">
                <div className="text-sm font-medium">Owner/Vacancy dates for this unit</div>
                {leaseEditorMode === "full" ? (
                  <div className="mt-2 text-sm text-slate-600">
                    Current status: {(() => {
                      const status = getUnitStatusForDate({ propertyId: leaseDraft.propertyId, name: leaseDraft.unit });
                      const current = getUnitOccupancyPeriods(leaseDraft.propertyId, leaseDraft.unit)[0];
                      if (!current) return unitStatusLabel[status] || status;
                      return `${current.useType}: ${current.startDate} to ${current.endDate || "until lease starts"}`;
                    })()}
                  </div>
                ) : (
                  <>
                    <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                      <Select
                        value={usePeriodDraft.useType}
                        onValueChange={(value) => {
                          if (value === "__add_lease__") {
                            setLeaseEditorMode("full");
                            setEditingUsePeriodId("");
                            setUsePeriodDraft((prev) => ({ ...prev, startDate: "", endDate: "" }));
                            return;
                          }
                          setUsePeriodDraft({ ...usePeriodDraft, useType: value });
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Owner-Occupied">Owner occupied</SelectItem>
                          <SelectItem value="Vacant">Vacant</SelectItem>
                          <SelectItem value="__add_lease__">Add lease</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="date" value={usePeriodDraft.startDate} onChange={(e) => setUsePeriodDraft({ ...usePeriodDraft, startDate: e.target.value })} />
                      <Input type="date" value={usePeriodDraft.endDate || ""} onChange={(e) => setUsePeriodDraft({ ...usePeriodDraft, endDate: e.target.value })} />
                      <Button variant="secondary" onClick={() => saveUnitOccupancyPeriod({ propertyId: leaseDraft.propertyId, name: leaseDraft.unit })}>{editingUsePeriodId ? "Update dates" : "Save dates"}</Button>
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-[auto_minmax(180px,1fr)]">
                      <label className="flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(usePeriodDraft.reviewed)}
                          onChange={(event) => setUsePeriodDraft({ ...usePeriodDraft, reviewed: event.target.checked })}
                        />
                        Reviewed
                      </label>
                      <Input
                        placeholder="Review notes"
                        value={usePeriodDraft.reviewNotes || ""}
                        onChange={(event) => setUsePeriodDraft({ ...usePeriodDraft, reviewNotes: event.target.value })}
                      />
                    </div>
                    <div className="mt-2 text-xs text-slate-500">Leave end date blank to keep this status until a lease starts.</div>
                    {editingUsePeriodId && (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-blue-700">Editing existing period.</span>
                        <Button size="sm" variant="secondary" onClick={() => { setEditingUsePeriodId(""); setUsePeriodDraft((prev) => ({ ...prev, startDate: "", endDate: "" })); }}>Cancel edit</Button>
                      </div>
                    )}
                    {getUnitOccupancyPeriods(leaseDraft.propertyId, leaseDraft.unit).length === 0 && <div className="mt-2 text-xs text-slate-500">No owner-occupied or vacant periods saved for this unit.</div>}
                    {getUnitOccupancyPeriods(leaseDraft.propertyId, leaseDraft.unit).map((period) => (
                      <div key={period.id} className="mt-2 flex items-center justify-between rounded border p-2 text-sm">
                        <span>
                          {period.useType}: {period.startDate} to {period.endDate || "until lease starts"}
                          <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${period.reviewed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                            {period.reviewed ? "Reviewed" : "Needs review"}
                          </span>
                        </span>
                        <div className="flex items-center gap-1">
                          {!period.reviewed && <Button size="sm" variant="secondary" onClick={() => actions.updateUsePeriodReview(period.id, { reviewed: true })}>Mark reviewed</Button>}
                          <Button size="sm" variant="secondary" onClick={() => { setEditingUsePeriodId(period.id); setUsePeriodDraft({ useType: period.useType, startDate: period.startDate, endDate: period.endDate || "", reviewed: Boolean(period.reviewed), reviewNotes: period.reviewNotes || "" }); }}>Edit</Button>
                          <Button size="sm" variant="secondary" onClick={() => confirmAndDeleteUsePeriod(period)}>Delete</Button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
              {leaseEditorMode === "full" && (
                <>
                  <div className="mt-4 rounded border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium">Tenant ledger</div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500">Sort</span>
                        <Button size="sm" variant={leaseTenantLedgerSort === "date_desc" ? "default" : "secondary"} onClick={() => setLeaseTenantLedgerSort("date_desc")}>Newest first</Button>
                        <Button size="sm" variant={leaseTenantLedgerSort === "date_asc" ? "default" : "secondary"} onClick={() => setLeaseTenantLedgerSort("date_asc")}>Oldest first</Button>
                        <Button size="sm" variant="secondary" onClick={exportTenantStatement}>Export CSV</Button>
                        <Button size="sm" variant="secondary" onClick={() => void exportTenantStatementPdf()}>PDF</Button>
                        <Button size="sm" variant="secondary" onClick={printTenantStatement}>Print</Button>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {leaseTenantLedgerHeadline}
                    </div>
                    <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-4">
                      <div>
                        <Label className="text-xs text-slate-600">Statement preset</Label>
                        <Select value={tenantStatementPreset} onValueChange={setTenantStatementPreset}>
                          <SelectTrigger className="mt-1 h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All activity</SelectItem>
                            <SelectItem value="current-year">Current year</SelectItem>
                            <SelectItem value="current-month">Current month</SelectItem>
                            <SelectItem value="custom">Custom range</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">Start date</Label>
                        <Input className="mt-1 h-9" type="date" disabled={tenantStatementPreset !== "custom"} value={tenantStatementCustomStart} onChange={(e) => setTenantStatementCustomStart(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">End date</Label>
                        <Input className="mt-1 h-9" type="date" disabled={tenantStatementPreset !== "custom"} value={tenantStatementCustomEnd} onChange={(e) => setTenantStatementCustomEnd(e.target.value)} />
                      </div>
                      <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-600">
                        <div className="font-medium text-slate-800">Statement scope</div>
                        <div className="mt-1">{tenantStatementPreset === "all" ? "All activity" : formatStatementPresetLabel(tenantStatementPreset)}</div>
                        <div className="mt-1">
                          {tenantStatementPreset === "custom" && tenantStatementCustomStart && tenantStatementCustomEnd
                            ? `${tenantStatementCustomStart} to ${tenantStatementCustomEnd}`
                            : tenantStatementPreset === "all"
                              ? "Lease start to current balance"
                              : tenantStatementPreset === "current-month"
                                ? `${monthStartIso(todayIso)} to ${todayIso}`
                                : `${todayIso.slice(0, 4)}-01-01 to ${todayIso}`}
                        </div>
                      </div>
                    </div>
                    {selectedLeaseAutomationReminders.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {selectedLeaseAutomationReminders.map((reminder) => (
                          <div key={reminder.id} className={`rounded border px-2 py-1 text-[11px] ${leaseReminderToneClass(reminder.kind)}`}>
                            <span className="font-medium">{leaseReminderKindLabel(reminder.kind)}:</span> {reminder.message}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 grid gap-2 md:grid-cols-[160px_minmax(150px,1fr)_minmax(220px,1.4fr)_120px_minmax(220px,1.5fr)_auto_auto]">
                      <Input type="date" value={tenantLedgerDraft.date} onChange={(event) => setTenantLedgerDraft((prev) => ({ ...prev, date: event.target.value }))} />
                      <Select
                        value={tenantLedgerDraft.kind}
                        onValueChange={(value) =>
                          setTenantLedgerDraft((prev) => ({
                            ...prev,
                            kind: value,
                            accountingTreatment: recommendedTenantLedgerAccountingTreatment(value),
                          }))
                        }
                      >
                        <SelectTrigger className="min-w-[150px]"><SelectValue placeholder="Entry type" /></SelectTrigger>
                        <SelectContent>
                          {TENANT_LEDGER_KIND_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={normalizeTenantLedgerAccountingTreatment(tenantLedgerDraft.accountingTreatment)}
                        onValueChange={(value) =>
                          setTenantLedgerDraft((prev) => {
                            const accountingTreatment = normalizeTenantLedgerAccountingTreatment(value);
                            const nextKind = isTenantLedgerKindAllowedForTreatment(prev.kind, accountingTreatment)
                              ? prev.kind
                              : recommendedTenantLedgerKindForTreatment(accountingTreatment);
                            return { ...prev, accountingTreatment, kind: nextKind };
                          })
                        }
                      >
                        <SelectTrigger className="min-w-[220px]"><SelectValue placeholder="Accounting treatment" /></SelectTrigger>
                        <SelectContent>
                          {TENANT_LEDGER_ACCOUNTING_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input type="number" step="0.01" placeholder="Amount" value={tenantLedgerDraft.amount} onChange={(event) => setTenantLedgerDraft((prev) => ({ ...prev, amount: event.target.value }))} />
                      <Input placeholder={tenantLedgerDraft.kind === "adjustment" ? "Adjustment reason (required)" : "Memo"} value={tenantLedgerDraft.memo} onChange={(event) => setTenantLedgerDraft((prev) => ({ ...prev, memo: event.target.value }))} />
                      <Button onClick={saveTenantLedgerEntry}>{editingTenantLedgerEntryId ? "Update entry" : "Add entry"}</Button>
                      <Button variant="secondary" onClick={clearTenantLedgerEntryDraft}>Clear</Button>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Security deposits should usually post as <strong>Security deposit (liability)</strong> (non-income).
                      If part is kept for move-out damage, post that portion as <strong>Deposit applied to damages</strong>.
                    </div>
                    {tenantLedgerDraft.kind === "adjustment" && (
                      <div className="mt-1 text-xs text-slate-500">Use positive adjustments to increase tenant balance and negative adjustments to reduce it.</div>
                    )}
                    {leaseTenantLedgerSummary.rows.length === 0 ? (
                      <div className="mt-2 text-xs text-slate-500">No tenant ledger entries yet.</div>
                    ) : (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="p-1">Date</th>
                              <th className="p-1">Type</th>
                              <th className="p-1">Memo</th>
                              <th className="p-1 text-right">Charge</th>
                              <th className="p-1 text-right">Credit</th>
                              <th className="p-1 text-right">Balance</th>
                              <th className="p-1">Details</th>
                              <th className="p-1 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayedLeaseTenantLedgerRows.map((entry) => {
                              const kindLabel = TENANT_LEDGER_KIND_OPTIONS.find((option) => option.value === entry.kind)?.label || entry.kind;
                              const accountingTreatment = normalizeTenantLedgerAccountingTreatment(entry.accountingTreatment);
                              const accountingLabel = TENANT_LEDGER_ACCOUNTING_OPTIONS.find((option) => option.value === accountingTreatment)?.label || "Do not post";
                              const linkedTxn = entry.transactionId ? transactionById[entry.transactionId] : null;
                              const rowOpenAmount = Number(leaseTenantLedgerSummary.chargeBalanceById[entry.id] || 0);
                              const allocationText = entry.allocations
                                .map((allocation) => {
                                  const charge = leaseTenantLedgerRowById[allocation.chargeEntryId];
                                  const chargeLabel = charge
                                    ? `${charge.date}${charge.memo ? ` (${charge.memo})` : ""}`
                                    : allocation.chargeEntryId;
                                  return `${currency(allocation.amount)} -> ${chargeLabel}`;
                                })
                                .join("; ");

                              return (
                                <tr key={entry.id} className="border-b last:border-b-0">
                                  <td className="p-1 align-top">{entry.date}</td>
                                  <td className="p-1 align-top">{kindLabel}</td>
                                  <td className="p-1 align-top">{entry.memo || "-"}</td>
                                  <td className="p-1 text-right align-top">{entry.delta > 0 ? currency(entry.delta) : ""}</td>
                                  <td className="p-1 text-right align-top">{entry.delta < 0 ? currency(Math.abs(entry.delta)) : ""}</td>
                                  <td className="p-1 text-right align-top">
                                    {entry.runningBalance >= 0
                                      ? currency(entry.runningBalance)
                                      : `Credit ${currency(Math.abs(entry.runningBalance))}`}
                                  </td>
                                  <td className="p-1 align-top text-slate-600">
                                    <div>Posting: {accountingLabel}</div>
                                    <div>Review: {entry.reviewed ? "Reviewed" : "Needs review"}</div>
                                    {allocationText && <div>Applied: {allocationText}</div>}
                                    {entry.unappliedAmount > 0 && <div>Unapplied credit: {currency(entry.unappliedAmount)}</div>}
                                    {entry.delta > 0 && rowOpenAmount > 0 && <div>Open on this entry: {currency(rowOpenAmount)}</div>}
                                    {entry.transactionId && (
                                      <div>
                                        Linked txn: {linkedTxn ? `${linkedTxn.date} | ${linkedTxn.type} | ${currency(linkedTxn.amount)}` : `${entry.transactionId} (not found)`}
                                      </div>
                                    )}
                                    <div className="text-[11px] text-slate-500">Created {new Date(entry.createdAt).toLocaleString()}</div>
                                  </td>
                                  <td className="p-1 align-top">
                                    <div className="flex justify-end gap-1">
                                      {entry.transactionId && <Button size="sm" variant="secondary" onClick={() => openLinkedTenantLedgerTransaction(entry)}>Open txn</Button>}
                                      {!entry.reviewed && <Button size="sm" variant="secondary" onClick={() => actions.updateTenantLedgerEntryReview(entry.id, { reviewed: true })}>Mark reviewed</Button>}
                                      <Button size="sm" variant="secondary" onClick={() => startTenantLedgerEntryEdit(entry)}>Edit</Button>
                                      <Button size="sm" variant="secondary" onClick={() => confirmAndDeleteTenantLedgerEntry(entry)}>Delete</Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 rounded border p-3">
                    <div className="text-sm font-medium">Lease PDFs</div>
                    <div className="mt-2">
                      <input ref={leasePdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={onLeasePdfInputChange} />
                      <Button variant="secondary" onClick={openLeasePdfPicker}>Add PDF</Button>
                    </div>
                    {selectedLeaseDocuments.length === 0 && <div className="mt-2 text-xs text-slate-500">No PDFs attached to this lease yet.</div>}
                    {selectedLeaseDocuments.map((document) => (
                      <div key={document.id} className="mt-2 flex items-center justify-between rounded border p-2 text-sm">
                        <span>{document.name}</span>
                        <Button size="sm" variant="secondary" onClick={() => openDocumentPreview(document)}>View PDF</Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="border-t bg-white px-4 py-3">
              <div className="flex flex-wrap justify-end gap-2">
                {leaseEditorMode === "full" && <Button onClick={saveLease} disabled={!canCreateEditRecords}>Save lease</Button>}
                {leaseEditorMode === "full" && leaseDraft?.id && <Button variant="destructive" onClick={confirmAndDeleteLease} disabled={!canDeleteRecords}>Delete lease</Button>}
                <Button variant="secondary" onClick={closeLeaseEditor}>Close</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
