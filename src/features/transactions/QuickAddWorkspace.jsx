import React, { useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { field } from "../shared/uiHelpers.jsx";
import { selectableProperties } from "../../domain/propertyLifecycle.js";
import { CircleDollarSign, Droplets, Home, Landmark, MoreHorizontal, RotateCcw, Wrench } from "lucide-react";

function TransactionSection({ title, children, action, className = "" }) {
  return (
    <section className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <div className="text-sm font-semibold text-slate-950">{title}</div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function isCashMovementType(type) {
  return ["Owner Draw", "Owner Contribution", "Transfer"].includes(type);
}

function cashMovementHelp(type) {
  if (type === "Owner Draw") return "Owner draw is a ledger-only equity movement, not Schedule E income or a deductible expense.";
  if (type === "Owner Contribution") return "Owner contribution is ledger-only funding, not rental income or a deductible expense.";
  if (type === "Transfer") return "Transfer is ledger-only cash movement, not income and not an expense.";
  return "";
}

function findCategory(options = [], names = []) {
  const lowered = names.map((name) => name.toLowerCase());
  return options.find((option) => lowered.includes(String(option).toLowerCase()))
    || options.find((option) => lowered.some((name) => String(option).toLowerCase().includes(name)))
    || options[0]
    || "";
}

function isRepairCategory(category) {
  return /repair|maintenance/i.test(String(category || ""));
}

function isUtilityCategory(category) {
  return /utilit/i.test(String(category || ""));
}

function findGeneralExpenseCategory(options = [], currentCategory = "") {
  if (currentCategory && !isRepairCategory(currentCategory) && !isUtilityCategory(currentCategory)) {
    return currentCategory;
  }
  const preferred = findCategory(options, ["Supplies", "Cleaning", "Insurance", "Other"]);
  if (preferred && !isRepairCategory(preferred) && !isUtilityCategory(preferred)) return preferred;
  return options.find((option) => !isRepairCategory(option) && !isUtilityCategory(option)) || preferred || options[0] || "";
}

function transactionUnitKey(value) {
  return String(value || "").trim().toLowerCase();
}

function leaseEndDate(lease) {
  return lease?.actualEndDate || lease?.endDate || "9999-12-31";
}

function isTenantLeaseActiveOnDate(lease, date) {
  const checkDate = String(date || "").slice(0, 10);
  if (!lease || !checkDate) return false;
  return Boolean(lease.tenantName) && String(lease.startDate || "") <= checkDate && leaseEndDate(lease) >= checkDate;
}

function firstActiveTenantLeaseUnit(leases = [], propertyId, date) {
  return leases.find((lease) => lease.propertyId === propertyId && isTenantLeaseActiveOnDate(lease, date))?.unit || "";
}

function rentPeriodRange(period, fallbackDate) {
  const key = String(period || fallbackDate || "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(key)) return null;
  const [year, month] = key.split("-").map(Number);
  const start = `${key}-01`;
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { key, start, end };
}

export function QuickAddWorkspace({
  actions,
  appSettings,
  applyVendorMemoryToForm,
  autoOwnerUsePct,
  categories,
  categoriesForFormType,
  clearTransactionForm,
  currency,
  deMinimisPreview,
  deMinimisThreshold,
  editingTxnId,
  expenseSuggestionConfidenceLabel,
  form,
  formatPercentInput,
  getSuggestedFieldOptions,
  incomeCategoriesForForm,
  mileagePreview,
  openTransactionAttachmentPicker,
  onTransactionAttachmentInputChange,
  pendingDocumentExpenseSource,
  pendingTxnAttachment,
  activeProperties,
  properties,
  recurringTemplates,
  recurringThroughDate,
  saveTransaction,
  setForm,
  setNotice,
  setPropertyQuickAddOpen,
  setRentAmountTouched,
  showDeMinimisControls,
  toPctDisplay,
  txnAttachmentInputRef,
  units,
  vendorMemorySuggestion,
  preview,
  propertyNameById,
  leases = [],
  transactions = [],
  getUnitStatusForDate,
}) {
  const [ownerUseOpen, setOwnerUseOpen] = useState(false);
  const [servicePeriodOpen, setServicePeriodOpen] = useState(false);
  const [recurringManagerOpen, setRecurringManagerOpen] = useState(false);
  const [loanPaymentPrompt, setLoanPaymentPrompt] = useState(false);
  const propertyOptions = editingTxnId
    ? selectableProperties(properties, form.propertyId)
    : (activeProperties || properties);
  const expenseCategories = categories?.Expense || [];
  const showMileageControls = form.type === "Expense" && form.category === "Auto and travel";
  const showCashMovementPanel = isCashMovementType(form.type);
  const amountEntered = String(form.amount ?? "").trim() !== "";
  const selectedPropertyUnits = units.filter((unit) => unit.propertyId === form.propertyId);
  const unitStatusForDate = (unitName) => {
    const unit = selectedPropertyUnits.find((candidate) => transactionUnitKey(candidate.name) === transactionUnitKey(unitName));
    if (!unit) return "";
    return typeof getUnitStatusForDate === "function" ? getUnitStatusForDate(unit, form.date) : unit.status;
  };
  const selectedUnitStatus = form.unit === "Shared" ? "Shared" : unitStatusForDate(form.unit);
  const selectedUnitOwnerOccupied = selectedUnitStatus === "Owner-Occupied";
  const selectedPropertyLeases = leases.filter((lease) => lease.propertyId === form.propertyId);
  const activeTenantLeases = selectedPropertyLeases.filter((lease) => isTenantLeaseActiveOnDate(lease, form.date));
  const isRentPayment = form.type === "Income" && form.category === "Rents received";
  const activeRentUnitKeys = new Set(activeTenantLeases.map((lease) => transactionUnitKey(lease.unit)));
  const rentUnitOptions = selectedPropertyUnits.filter((unit) => activeRentUnitKeys.has(transactionUnitKey(unit.name)));
  const selectedRentUnitIsVisible = rentUnitOptions.some((unit) => transactionUnitKey(unit.name) === transactionUnitKey(form.unit));
  const unitOptionsForForm = isRentPayment
    ? [
        ...rentUnitOptions,
        ...(!selectedRentUnitIsVisible && form.unit && form.unit !== "Shared"
          ? selectedPropertyUnits.filter((unit) => transactionUnitKey(unit.name) === transactionUnitKey(form.unit))
          : []),
      ]
    : selectedPropertyUnits;
  const selectedActiveTenantLease = activeTenantLeases.find((lease) => transactionUnitKey(lease.unit) === transactionUnitKey(form.unit));
  const rentPeriod = rentPeriodRange(form.rentPeriod, form.date);
  const selectedRentPeriodLease = isRentPayment && rentPeriod
    ? selectedPropertyLeases.find((lease) => (
        transactionUnitKey(lease.unit) === transactionUnitKey(form.unit) &&
        Boolean(lease.tenantName) &&
        String(lease.startDate || "") <= rentPeriod.end &&
        leaseEndDate(lease) >= rentPeriod.start
      ))
    : null;
  const rentAmount = Number(form.amount || 0);
  const rentAlreadyRecorded = isRentPayment && rentPeriod
    ? transactions.some((transaction) => (
        transaction.status !== "voided" &&
        transaction.propertyId === form.propertyId &&
        transactionUnitKey(transaction.unit) === transactionUnitKey(form.unit) &&
        transaction.type === "Income" &&
        transaction.category === "Rents received" &&
        (String(transaction.rentPeriod || "").slice(0, 7) || String(transaction.date || "").slice(0, 7)) === rentPeriod.key
      ))
    : false;
  const rentWarnings = [];
  if (isRentPayment && rentUnitOptions.length === 0) {
    rentWarnings.push("No active tenant lease/unit is available for rent payments in this scope.");
  }
  if (isRentPayment && !form.unit) {
    rentWarnings.push("Choose the tenant unit for this rent payment.");
  }
  if (isRentPayment && form.unit && form.unit !== "Shared") {
    const leaseForWarning = selectedRentPeriodLease || selectedActiveTenantLease;
    if (!selectedActiveTenantLease) rentWarnings.push("No active tenant lease found for this unit.");
    if (rentPeriod && !selectedRentPeriodLease) rentWarnings.push("Rent month is outside the active tenant lease period.");
    if (leaseForWarning?.monthlyRent && amountEntered && Math.abs(Number(leaseForWarning.monthlyRent || 0) - rentAmount) > 0.01) {
      rentWarnings.push(`Lease rent is ${currency(Number(leaseForWarning.monthlyRent || 0))}/month; entered amount is ${currency(rentAmount)}.`);
    }
    if (rentAlreadyRecorded) rentWarnings.push("A rent payment appears to already be recorded for this unit and rent month.");
  } else if (isRentPayment && form.unit === "Shared") {
    rentWarnings.push("Choose the tenant unit for rent payments so lease checks and rent-month tracking work correctly.");
  }
  const servicePeriodRecommended =
    form.type === "Expense" &&
    form.unit === "Shared" &&
    ["Utilities", "Insurance"].includes(form.category);
  const hasServicePeriod = Boolean(form.servicePeriodStart || form.servicePeriodEnd);
  const showServicePeriodFields = servicePeriodOpen || servicePeriodRecommended || hasServicePeriod;
  const showOwnerUseEditor = ownerUseOpen || form.ownerUsePctOverride;
  const rentalUsePct = Number(preview?.rentalUsePct || 0);
  const ownerUsePct = Math.max(0, 1 - rentalUsePct);
  const possibleImprovement =
    form.type === "Expense" &&
    form.capitalImprovement !== "Yes" &&
    /(roof|hvac|furnace|water heater|remodel|renovat|replace|upgrade|floor|window|siding|deck|appliance)/i.test(`${form.category || ""} ${form.description || ""}`);
  const rentUnitMissing = isRentPayment && (!form.unit || form.unit === "Shared");
  const saveDisabled = properties.length === 0 || !form.date || !form.propertyId || !amountEntered || rentUnitMissing;
  const receiptRecommended = form.type === "Expense" && amountEntered && rentAmount >= 75 && !pendingTxnAttachment && !pendingDocumentExpenseSource?.documentId;
  const taxTreatmentExplanation = (() => {
    if (form.type !== "Expense") return "Income is tracked for reporting; deductible expense preview does not apply.";
    if (servicePeriodRecommended && form.servicePeriodStart && form.servicePeriodEnd) return "Rental-use percentage is calculated from occupancy during the service period.";
    if (ownerUsePct >= 0.999) return "This appears non-deductible because the selected unit is owner-occupied on this date.";
    if (rentalUsePct >= 0.999) return "This appears rental-use based on the selected unit and occupancy history.";
    return "Rental-use percentage is based on the selected scope and occupancy history.";
  })();
  const presetOptions = [
    {
      key: "rent",
      label: "Rent payment",
      Icon: Home,
      active: form.type === "Income" && form.category === "Rents received",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      activeTone: "border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500",
    },
    {
      key: "utility",
      label: "Utility bill",
      Icon: Droplets,
      active: form.type === "Expense" && isUtilityCategory(form.category),
      tone: "border-blue-200 bg-blue-50 text-blue-700",
      activeTone: "border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-500",
    },
    {
      key: "repair",
      label: "Repair / maintenance",
      Icon: Wrench,
      active: form.type === "Expense" && isRepairCategory(form.category),
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      activeTone: "border-amber-500 bg-amber-50 text-amber-900 ring-1 ring-amber-400",
    },
    {
      key: "mortgage",
      label: "Mortgage / loan payment",
      Icon: Landmark,
      active: false,
      tone: "border-indigo-200 bg-indigo-50 text-indigo-700",
      activeTone: "border-indigo-600 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-500",
    },
    {
      key: "expense",
      label: "Other expense",
      Icon: MoreHorizontal,
      active: form.type === "Expense" && !isUtilityCategory(form.category) && !isRepairCategory(form.category),
      tone: "border-slate-200 bg-slate-50 text-slate-600",
      activeTone: "border-slate-500 bg-slate-50 text-slate-900 ring-1 ring-slate-400",
    },
    {
      key: "income",
      label: "Other income",
      Icon: CircleDollarSign,
      active: form.type === "Income" && form.category !== "Rents received",
      tone: "border-teal-200 bg-teal-50 text-teal-700",
      activeTone: "border-teal-600 bg-teal-50 text-teal-900 ring-1 ring-teal-500",
    },
  ];

  const applyPreset = (preset) => {
    if (preset === "mortgage") {
      setLoanPaymentPrompt(true);
      setNotice?.("Mortgage and loan payments are best recorded from the Loans tab so principal, interest, escrow, and PMI stay split correctly.");
      return;
    }
    setLoanPaymentPrompt(false);
    const patch = {};
    if (preset === "rent") {
      const preferredLease = activeTenantLeases.find((lease) => unitStatusForDate(lease.unit) !== "Owner-Occupied") || activeTenantLeases[0];
      patch.type = "Income";
      patch.category = findCategory(incomeCategoriesForForm, ["Rents received", "Rent"]);
      patch.unit = preferredLease?.unit || "";
      patch.rentPeriod = form.rentPeriod || (form.date ? String(form.date).slice(0, 7) : "");
      setServicePeriodOpen(false);
    }
    if (preset === "utility") {
      patch.type = "Expense";
      patch.category = findCategory(expenseCategories, ["Utilities", "Utility"]);
      patch.unit = "Shared";
      setServicePeriodOpen(true);
    }
    if (preset === "repair") {
      patch.type = "Expense";
      patch.category = findCategory(expenseCategories, ["Repairs and maintenance", "Repairs", "Maintenance"]);
      setServicePeriodOpen(false);
    }
    if (preset === "expense") {
      patch.type = "Expense";
      patch.category = findGeneralExpenseCategory(expenseCategories, form.type === "Expense" ? form.category : "");
      if (form.unit !== "Shared" && selectedUnitOwnerOccupied) patch.unit = "Shared";
      setServicePeriodOpen(false);
    }
    if (preset === "income") {
      patch.type = "Income";
      patch.category = form.type === "Income" && form.category !== "Rents received"
        ? form.category
        : findCategory(incomeCategoriesForForm, ["Other income"]);
      setServicePeriodOpen(false);
    }
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const useMileageTotal = () => {
    if (!mileagePreview?.amount) return;
    setRentAmountTouched(true);
    setForm((prev) => ({ ...prev, amount: mileagePreview.amount.toFixed(2) }));
  };

  const resetOwnerUseToAuto = () => {
    setOwnerUseOpen(false);
    setForm((prev) => ({
      ...prev,
      ownerUsePct: formatPercentInput(autoOwnerUsePct),
      ownerUsePctOverride: false,
    }));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {editingTxnId ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-2 text-sm font-medium text-blue-900">
            Editing transaction
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {presetOptions.map(({ key, label, Icon, active, tone, activeTone }) => (
            <button
              key={key}
              type="button"
              className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium shadow-sm transition ${
                active
                  ? activeTone
                  : "border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50/40"
              }`}
              onClick={() => applyPreset(key)}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${active ? activeTone : tone}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
          {propertyOptions.length === 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Add your first property before adding transactions.
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setPropertyQuickAddOpen(true)}>Add Property</Button>
              </div>
            </div>
          )}

          {pendingDocumentExpenseSource?.documentId && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-sm text-blue-900">
              <div>
                Linked document: <span className="font-medium">{pendingDocumentExpenseSource.documentName || "Document"}</span>.
                Saving will attach this document to the transaction.
              </div>
              {pendingDocumentExpenseSource.confidence ? (
                <div className="mt-1 text-xs text-blue-800">
                  {expenseSuggestionConfidenceLabel(pendingDocumentExpenseSource.confidence)}
                  {pendingDocumentExpenseSource.reasonSummary ? ` | ${pendingDocumentExpenseSource.reasonSummary}` : ""}
                </div>
              ) : null}
              {pendingDocumentExpenseSource.nextDocumentName ? <div className="mt-1 text-xs text-blue-800">Next in queue: {pendingDocumentExpenseSource.nextDocumentName}</div> : null}
              {pendingDocumentExpenseSource.prefilledFields?.includes?.("vendorMemory") ? <div className="mt-1 text-xs text-blue-800">Repeated-vendor defaults were applied. Review the unit, category, and payment fields before saving.</div> : null}
            </div>
          )}

          {vendorMemorySuggestion && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-emerald-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">Data-entry template found</div>
                  <div className="mt-1 text-xs text-emerald-800">
                    {vendorMemorySuggestion.label || vendorMemorySuggestion.vendor || "This vendor"} usually posts as {vendorMemorySuggestion.category}
                    {vendorMemorySuggestion.unit ? ` for Unit ${vendorMemorySuggestion.unit}` : ""}
                    {vendorMemorySuggestion.paymentMethod ? ` by ${vendorMemorySuggestion.paymentMethod}` : ""}.
                    {["Utilities", "Insurance"].includes(vendorMemorySuggestion.category) ? " Confirm the service period before saving." : ""}
                  </div>
                </div>
                <Button type="button" size="sm" variant="secondary" onClick={applyVendorMemoryToForm}>Apply template</Button>
              </div>
            </div>
          )}

          {loanPaymentPrompt ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-sm text-blue-900">
              Record mortgage payments in Loans so principal, interest, escrow, PMI, and deductible interest stay correct.
            </div>
          ) : null}

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.85fr)]">
          <TransactionSection title="1. Essential details">
            <div className="grid gap-3 md:grid-cols-2">
              {field("Date", <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />, getSuggestedFieldOptions("date", "Date"))}
              {field(
                "Type",
                <Select value={form.type} onValueChange={(v) => {
                  if (v !== "Expense") setServicePeriodOpen(false);
                  const nextCategory = v === "Income" ? incomeCategoriesForForm[0] : categories[v][0];
                  const nextIsRentPayment = v === "Income" && nextCategory === "Rents received";
                  setForm({
                    ...form,
                    type: v,
                    category: nextCategory,
                    unit: nextIsRentPayment ? firstActiveTenantLeaseUnit(leases, form.propertyId, form.date) : form.unit,
                  });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.keys(categories).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                </Select>,
                getSuggestedFieldOptions("type", "Type"),
              )}
              {field(
                "Property",
                <Select value={form.propertyId} onValueChange={(v) => setForm({
                  ...form,
                  propertyId: v,
                  unit: isRentPayment ? firstActiveTenantLeaseUnit(leases, v, form.date) : "Shared",
                })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{propertyOptions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>,
                getSuggestedFieldOptions("propertyId", "Property"),
              )}
              {field(
                "Unit",
                unitOptionsForForm.length ? (
                  <Select value={isRentPayment && form.unit === "Shared" ? undefined : form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                    <SelectTrigger><SelectValue placeholder={isRentPayment ? "Select tenant unit" : "Select unit"} /></SelectTrigger>
                    <SelectContent>
                      {!isRentPayment ? <SelectItem value="Shared">Shared</SelectItem> : null}
                      {unitOptionsForForm.map((u) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    No active tenant units
                  </div>
                ),
                getSuggestedFieldOptions("unit", "Unit"),
              )}
              {field(
                "Category",
                <Select value={form.category} onValueChange={(v) => {
                  if (!["Utilities", "Insurance"].includes(v) && !form.servicePeriodStart && !form.servicePeriodEnd) setServicePeriodOpen(false);
                  const nextIsRentPayment = form.type === "Income" && v === "Rents received";
                  setForm({
                    ...form,
                    category: v,
                    unit: nextIsRentPayment && form.unit === "Shared" ? firstActiveTenantLeaseUnit(leases, form.propertyId, form.date) : form.unit,
                  });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categoriesForFormType.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>,
                getSuggestedFieldOptions("category", "Category"),
              )}
              {field("Amount", <Input type="number" value={form.amount} onChange={(e) => { setRentAmountTouched(true); setForm({ ...form, amount: e.target.value }); }} />, getSuggestedFieldOptions("amount", "Amount"))}
              {field("Vendor / payee", <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />, getSuggestedFieldOptions("vendor", "Vendor"))}
              {form.type === "Income" && form.category === "Rents received"
                ? field("Rent month / period", <Input type="month" value={form.rentPeriod || ""} onChange={(e) => setForm({ ...form, rentPeriod: e.target.value })} />)
                : null}
              <div className="md:col-span-2">
                {field("Description / memo", <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />, getSuggestedFieldOptions("description", "Description"))}
              </div>
            </div>
            {rentWarnings.length ? (
              <div className="mt-3 space-y-1 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                {rentWarnings.map((warning) => <div key={warning}>{warning}</div>)}
              </div>
            ) : null}
          </TransactionSection>

          <TransactionSection
            title="2. Tax treatment"
            action={form.type === "Expense" ? <Badge variant={form.ownerUsePctOverride ? "secondary" : "outline"}>{form.ownerUsePctOverride ? "Custom split" : "Auto"}</Badge> : null}
          >
            <div className="space-y-3">
              {showCashMovementPanel ? (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/80 p-3 text-sm text-indigo-950">
                  <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-indigo-200 bg-white text-indigo-800">Cash movement</Badge><span className="font-semibold">{form.type}</span></div>
                  <div className="mt-1 text-xs text-indigo-900">{cashMovementHelp(form.type)}</div>
                </div>
              ) : null}

              {form.type !== "Expense" && !showCashMovementPanel ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2 text-xs text-slate-600">
                  {taxTreatmentExplanation}
                </div>
              ) : null}

              {form.type === "Expense" ? (
                <>
                  <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-sm md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="font-medium text-slate-900">Rental-use treatment: {form.ownerUsePctOverride ? "Custom split" : "Auto"}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{taxTreatmentExplanation}</div>
                      <div className="mt-1 text-xs text-slate-700">
                        Rental use {toPctDisplay(rentalUsePct)} | Owner use {toPctDisplay(ownerUsePct)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <Button type="button" size="sm" variant="secondary" onClick={() => setOwnerUseOpen((value) => !value)}>
                        {showOwnerUseEditor ? "Hide split" : "Adjust"}
                      </Button>
                      {form.ownerUsePctOverride ? <Button type="button" size="sm" variant="ghost" onClick={resetOwnerUseToAuto}>Use auto</Button> : null}
                    </div>
                  </div>

                  {showOwnerUseEditor ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {field(
                        "Owner use %",
                        <Input
                          value={form.ownerUsePct}
                          onChange={(e) => setForm((prev) => ({ ...prev, ownerUsePct: e.target.value, ownerUsePctOverride: true }))}
                        />,
                        { hint: "Only change this when the bill needs a custom split." },
                      )}
                    </div>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    {field(
                      "Capital improvement",
                      <Select value={form.capitalImprovement} onValueChange={(v) => setForm({ ...form, capitalImprovement: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="No">No</SelectItem><SelectItem value="Yes">Yes</SelectItem></SelectContent>
                      </Select>,
                    )}
                    {showDeMinimisControls ? field("Invoice/item amount", <Input type="number" value={form.invoiceAmount} onChange={(e) => setForm({ ...form, invoiceAmount: e.target.value })} />, getSuggestedFieldOptions("invoiceAmount", "Invoice/item amount")) : null}
                    {showDeMinimisControls ? field(
                      "De minimis treatment",
                      <Select value={form.deMinimisTreatment} onValueChange={(v) => setForm({ ...form, deMinimisTreatment: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="auto">Auto (use election + threshold)</SelectItem><SelectItem value="yes">Force apply (if eligible)</SelectItem><SelectItem value="no">Do not apply</SelectItem></SelectContent>
                      </Select>,
                    ) : null}
                  </div>

                  {possibleImprovement ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2 text-xs text-amber-900">
                      Could this be a capital improvement? If yes, it may need an asset record instead of immediate expense treatment.
                    </div>
                  ) : null}
                  {form.capitalImprovement === "Yes" ? (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-2 text-xs text-blue-900">
                      Capital improvements may need an asset record rather than immediate expense treatment. Review in Assets after saving.
                    </div>
                  ) : null}
                  {showDeMinimisControls ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2 text-xs text-slate-600">
                      De minimis election: {appSettings.deMinimisElectionEnabled ? "On" : "Off"} | Threshold: {currency(deMinimisThreshold)} | Invoice amount: {currency(deMinimisPreview.invoiceAmount)} | {deMinimisPreview.qualifies ? (deMinimisPreview.applied ? "Will be expensed under de minimis." : "Eligible but not applied.") : "Not eligible for de minimis."}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </TransactionSection>
          </div>

          <TransactionSection
            title="3. Service period"
            action={!showServicePeriodFields ? <Button type="button" size="sm" variant="secondary" onClick={() => setServicePeriodOpen(true)}>Add service period</Button> : null}
          >
            {servicePeriodRecommended && !hasServicePeriod ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900">
                Shared utility and insurance bills usually need a service period so owner/rental use can be prorated correctly.
              </div>
            ) : null}

            {showServicePeriodFields ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {field("Service period start", <Input type="date" value={form.servicePeriodStart} onChange={(e) => setForm({ ...form, servicePeriodStart: e.target.value })} />, getSuggestedFieldOptions("servicePeriodStart", "Service period start"))}
                {field("Service period end", <Input type="date" value={form.servicePeriodEnd} onChange={(e) => setForm({ ...form, servicePeriodEnd: e.target.value })} />, getSuggestedFieldOptions("servicePeriodEnd", "Service period end"))}
              </div>
            ) : null}
            {showServicePeriodFields ? <div className="mt-2 text-xs text-slate-500">Using bill period or meter-read dates improves proration accuracy.</div> : null}
          </TransactionSection>

          <TransactionSection title="4. Support">
            <div className="grid gap-3 md:grid-cols-2">
              {field("Invoice / receipt reference", <Input value={form.invoiceRef} onChange={(e) => setForm({ ...form, invoiceRef: e.target.value })} />, getSuggestedFieldOptions("invoiceRef", "Invoice / receipt ref"))}
              {field(
                "Attach receipt / PDF",
                <div>
                  <input ref={txnAttachmentInputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onTransactionAttachmentInputChange} />
                  <div className="mt-1 flex min-h-10 flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                    <Button type="button" variant="secondary" className="h-8" onClick={openTransactionAttachmentPicker}>
                      {pendingTxnAttachment ? "Replace file" : "Choose file"}
                    </Button>
                    <span className="text-xs text-slate-500">{pendingTxnAttachment ? "File selected" : "or drag and drop"}</span>
                  </div>
                </div>,
              )}
            </div>
            {pendingTxnAttachment ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{pendingTxnAttachment.name}</div>
                  <div className="text-xs text-slate-500">Ready to attach as document support</div>
                </div>
                <Badge className="!bg-emerald-50 !text-emerald-700">Selected</Badge>
              </div>
            ) : null}
            {receiptRecommended ? (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2 text-xs text-amber-900">
                Receipt recommended for deductible expenses at this amount.
              </div>
            ) : null}
            <div className="mt-2 text-xs text-slate-500">Attached receipts become searchable document records.</div>

            {showMileageControls ? (
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/70 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Mileage log support</div>
                    <div className="mt-1 text-xs text-slate-600">Support data only. Tax Center can export the detail, but this is not a tax-rate engine.</div>
                  </div>
                  <Badge variant="outline">Auto and travel</Badge>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {field("Business miles", <Input type="number" min="0" step="0.1" value={form.mileageMiles} onChange={(e) => setForm({ ...form, mileageMiles: e.target.value })} />, { hint: "Total business miles for this trip or support entry." })}
                  {field("Mileage rate", <Input type="number" min="0" step="0.001" value={form.mileageRate} onChange={(e) => setForm({ ...form, mileageRate: e.target.value })} />, { hint: "Enter the per-mile rate you intend to support." })}
                </div>
                <div className="mt-2 rounded-lg border border-blue-100 bg-white/70 p-2 text-xs text-slate-700">
                  {form.date || "No date"} | {propertyNameById[form.propertyId] || "No property"} | Unit {form.unit || "Shared"} | Purpose: {form.description || "Add trip purpose in Description"}.
                  <span className="ml-1 font-medium">{mileagePreview?.miles || 0} miles x {currency(mileagePreview?.rate || 0)} = {currency(mileagePreview?.amount || 0)}.</span>
                  <Button type="button" size="sm" variant="secondary" className="ml-2 h-7 px-2 text-xs" disabled={!mileagePreview?.amount} onClick={useMileageTotal}>Use mileage total as amount</Button>
                </div>
              </div>
            ) : null}
          </TransactionSection>

          <TransactionSection title="5. Recurring and save">
            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="w-full sm:w-64">
                {field(
                  "Make recurring",
                  <Select value={form.recurringMonthly} onValueChange={(v) => setForm({ ...form, recurringMonthly: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="No">No</SelectItem><SelectItem value="Yes">Yes</SelectItem></SelectContent>
                  </Select>,
                )}
                </div>
                <Button type="button" variant="secondary" onClick={() => setRecurringManagerOpen((value) => !value)}>Recurring template options</Button>
              </div>
              {form.recurringMonthly === "Yes" ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-2 text-xs text-blue-900">
                  Saving will create or update a monthly recurring template using this transaction's details.
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => saveTransaction(false)} disabled={saveDisabled}>{pendingDocumentExpenseSource?.documentId ? "Save transaction and attach document" : "Save transaction"}</Button>
                  <Button variant="secondary" onClick={() => saveTransaction(true)} disabled={saveDisabled}>{pendingDocumentExpenseSource?.nextDocumentId ? "Save, attach + next bill" : "Save + add next"}</Button>
                  <Button variant="secondary" onClick={clearTransactionForm} disabled={properties.length === 0}>Clear form</Button>
                </div>
                <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                  {!amountEntered
                    ? <span className="text-slate-500">Enter an amount to preview tax treatment.</span>
                    : form.type === "Expense"
                      ? <span>Rental use: {toPctDisplay(rentalUsePct)} | Owner use: {toPctDisplay(ownerUsePct)} | Estimated deductible: <span className="font-semibold text-slate-950">{currency(preview.deductibleAmount)}</span>{servicePeriodRecommended && !hasServicePeriod ? <span className="ml-2 text-amber-700">Service period recommended.</span> : null}</span>
                      : <span className="text-slate-600">Income transaction. Deductible expense preview does not apply.</span>}
                </div>
              </div>
              {form.servicePeriodStart && form.servicePeriodEnd ? <div className="text-xs text-slate-500">Service-period proration: {form.servicePeriodStart} to {form.servicePeriodEnd}</div> : null}
              {(!form.date || !form.propertyId || !amountEntered) ? (
                <div className="text-xs text-amber-700">Date, property, and amount are required before saving.</div>
              ) : null}
            </div>
          </TransactionSection>
      </div>

      <details className="rounded-lg border border-slate-200 bg-white shadow-sm" open={recurringManagerOpen} onToggle={(event) => setRecurringManagerOpen(event.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <span>
            <span className="block text-sm font-semibold text-slate-950">Recurring templates</span>
            <span className="block text-xs text-slate-500">{recurringTemplates.length} saved | posting through {recurringThroughDate}</span>
          </span>
          <Badge variant="secondary">Manager</Badge>
        </summary>
        <div className="space-y-2 border-t border-slate-200 px-4 pb-4 pt-3">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm">
            <div>Posting through: <span className="font-medium">{recurringThroughDate}</span></div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const generated = actions.materializeRecurringTransactions(recurringThroughDate);
                setNotice(`Posted ${generated} due recurring transaction${generated === 1 ? "" : "s"}.`);
              }}
            >
              Post due now
            </Button>
          </div>

          {recurringTemplates.length === 0 ? <div className="text-xs text-slate-500">No recurring templates yet. Use Make recurring when saving a transaction, or mark a ledger item recurring.</div> : null}

          {recurringTemplates.map((template) => (
            <div key={template.id} className="self-start rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <Label>Description</Label>
                  <Input value={template.description} onChange={(e) => actions.updateRecurringTemplate({ ...template, description: e.target.value })} />
                </div>
                <div>
                  <Label>Amount</Label>
                  <Input type="number" value={template.amount} onChange={(e) => actions.updateRecurringTemplate({ ...template, amount: Number(e.target.value || 0) })} />
                </div>
                <div>
                  <Label>Frequency</Label>
                  <Select value={template.frequency} onValueChange={(v) => actions.updateRecurringTemplate({ ...template, frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Weekly">Weekly</SelectItem><SelectItem value="Monthly">Monthly</SelectItem><SelectItem value="Quarterly">Quarterly</SelectItem><SelectItem value="Yearly">Yearly</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Next due date</Label>
                  <Input type="date" value={template.nextDueDate} onChange={(e) => actions.updateRecurringTemplate({ ...template, nextDueDate: e.target.value })} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge variant="secondary">{template.active ? "Active" : "Paused"}</Badge>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => actions.setRecurringTemplateActive(template.id, !template.active)}>{template.active ? "Pause" : "Resume"}</Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const generated = actions.materializeRecurringTransactions(recurringThroughDate);
                    setNotice(`Posted ${generated} due recurring transaction${generated === 1 ? "" : "s"}.`);
                  }}
                >
                  Post due entries
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    actions.deleteRecurringTemplate(template.id);
                    setNotice(`Removed recurring template: ${template.description}.`);
                  }}
                >
                  Delete template
                </Button>
              </div>
              <div className="mt-2 text-xs text-slate-500">Property {propertyNameById[template.propertyId] || template.propertyId} | Unit {template.unit} | Category {template.category}</div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
