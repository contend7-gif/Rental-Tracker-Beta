import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildLoanSelectorOptions,
  formatLoanPaymentDraftTotal,
  loanPaymentDraftTotalAmount,
  projectedCurrentPaymentComponents,
} from "../../domain/loans.ts";
import { field } from "../shared/uiHelpers.jsx";

export function LoanPaymentEntryPanel({
  cancelLoanPaymentEdit,
  editingLoanPaymentId,
  loanPaymentDraft,
  loanPaymentDraftTotalInput,
  loans,
  propertyNameById,
  recordLoanPayment,
  resetLoanPaymentDraftForLoan,
  setEditingLoanPaymentId,
  setIsEditingLoanPaymentTotal,
  setLoanPaymentDraft,
  setLoanPaymentDraftTotalInput,
  visibleLoans,
  effectiveLoanForDraft,
}) {
  const loanOptions = buildLoanSelectorOptions(visibleLoans);
  const selectedOption = loanOptions.find((option) => option.value === loanPaymentDraft.loanSelectorValue)
    || loanOptions.find((option) => String(option.loan.id ?? "") === String(loanPaymentDraft.loanId ?? ""));
  const selectedLoanValue = selectedOption?.value || "";
  const [activeLoanSelectorValue, setActiveLoanSelectorValue] = useState(selectedLoanValue);
  const activeLoanValue = loanOptions.some((option) => option.value === activeLoanSelectorValue)
    ? activeLoanSelectorValue
    : selectedLoanValue;
  const loanPickerKey = `${loanOptions.map((option) => option.value).join("|")}::${activeLoanValue}`;
  const loanPickerRef = useRef(null);
  const selectLoan = (value) => {
    const option = loanOptions.find((entry) => entry.value === value);
    if (!option?.loan) return;
    setActiveLoanSelectorValue(option.value);
    setEditingLoanPaymentId?.("");
    resetLoanPaymentDraftForLoan(option.loan, {
      loanId: String(option.loan.id ?? ""),
      loanSelectorValue: option.value,
    });
  };
  const selectedLoanFromPicker = () => {
    const selectedValue = loanPickerRef.current?.value || activeLoanValue;
    return loanOptions.find((entry) => entry.value === selectedValue) || selectedOption;
  };
  const syncLoanPicker = () => {
    const selectedValue = loanPickerRef.current?.value || activeLoanValue;
    if (selectedValue && selectedValue !== activeLoanValue) {
      selectLoan(selectedValue);
    }
  };
  const scheduleLoanPickerSync = () => {
    window.setTimeout(syncLoanPicker, 0);
  };

  useEffect(() => {
    const picker = loanPickerRef.current;
    if (!picker) return undefined;
    picker.addEventListener("change", scheduleLoanPickerSync);
    picker.addEventListener("input", scheduleLoanPickerSync);
    return () => {
      picker.removeEventListener("change", scheduleLoanPickerSync);
      picker.removeEventListener("input", scheduleLoanPickerSync);
    };
  });

  useEffect(() => {
    if (selectedLoanValue && selectedLoanValue !== activeLoanSelectorValue) {
      setActiveLoanSelectorValue(selectedLoanValue);
    }
  }, [selectedLoanValue]);

  useEffect(() => {
    if (!activeLoanValue || activeLoanValue === loanPaymentDraft.loanSelectorValue) return;
    selectLoan(activeLoanValue);
  }, [activeLoanValue]);

  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 md:grid-cols-3">
      {field(
        "Loan",
        <select
          key={loanPickerKey}
          ref={loanPickerRef}
          aria-label="Loan"
          value={activeLoanValue}
          onChange={(event) => selectLoan(event.currentTarget.value)}
          onInput={(event) => selectLoan(event.currentTarget.value)}
          onClick={scheduleLoanPickerSync}
          onMouseUp={scheduleLoanPickerSync}
          onKeyUp={scheduleLoanPickerSync}
          onBlur={scheduleLoanPickerSync}
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        >
          {loanOptions.map(({ loan, value }) => (
            <option key={value} value={value}>
              {(propertyNameById[loan.propertyId] || loan.propertyId) + " | " + loan.loanType + " | " + loan.lender}
            </option>
          ))}
        </select>,
      )}
      {field(
        "Payment date",
        <Input
          type="date"
          value={loanPaymentDraft.paymentDate}
          onChange={(e) => {
            const loan = selectedLoanFromPicker()?.loan
              || loans.find((entry) => String(entry.id ?? "") === String(loanPaymentDraft.loanId ?? ""));
            const calc = projectedCurrentPaymentComponents(effectiveLoanForDraft(loan || {}, editingLoanPaymentId));
            setLoanPaymentDraft({
              ...loanPaymentDraft,
              paymentDate: e.target.value,
              interest: String(calc.interest),
              principal: String(calc.principal),
            });
          }}
        />,
      )}
      {field("Interest", <Input type="number" value={loanPaymentDraft.interest} onChange={(e) => setLoanPaymentDraft({ ...loanPaymentDraft, interest: e.target.value })} />)}
      {field("Principal", <Input type="number" value={loanPaymentDraft.principal} onChange={(e) => setLoanPaymentDraft({ ...loanPaymentDraft, principal: e.target.value })} />)}
      {field("Escrow deposit", <Input type="number" value={loanPaymentDraft.escrow} onChange={(e) => setLoanPaymentDraft({ ...loanPaymentDraft, escrow: e.target.value })} />)}
      {field("Mortgage insurance / PMI", <Input type="number" value={loanPaymentDraft.mortgageInsurance} onChange={(e) => setLoanPaymentDraft({ ...loanPaymentDraft, mortgageInsurance: e.target.value })} />)}
      {field("Extra principal (not deductible)", <Input type="number" value={loanPaymentDraft.extraPrincipal} onChange={(e) => setLoanPaymentDraft({ ...loanPaymentDraft, extraPrincipal: e.target.value })} />)}
      {field(
        "Total payment",
        <Input
          type="number"
          value={loanPaymentDraftTotalInput}
          onFocus={() => setIsEditingLoanPaymentTotal(true)}
          onBlur={() => {
            setIsEditingLoanPaymentTotal(false);
            setLoanPaymentDraftTotalInput(formatLoanPaymentDraftTotal(loanPaymentDraftTotalAmount(loanPaymentDraft)));
          }}
          onChange={(e) => {
            const rawValue = e.target.value;
            setLoanPaymentDraftTotalInput(rawValue);
            const enteredTotal = Number(rawValue || 0);
            if (!rawValue || !Number.isFinite(enteredTotal)) return;
            const baseWithoutExtra = Number(loanPaymentDraft.interest || 0)
              + Number(loanPaymentDraft.principal || 0)
              + Number(loanPaymentDraft.escrow || 0)
              + Number(loanPaymentDraft.mortgageInsurance || 0);
            setLoanPaymentDraft({
              ...loanPaymentDraft,
              extraPrincipal: String(Math.max(0, Math.round((enteredTotal - baseWithoutExtra) * 100) / 100)),
            });
          }}
        />,
        { hint: "Enter the full payment and the app will backfill extra principal after recorded interest, scheduled principal, escrow deposit, and PMI." },
      )}
      <div className="md:col-span-3">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              const selectedValue = loanPickerRef.current?.value || activeLoanValue;
              const option = loanOptions.find((entry) => entry.value === selectedValue);
              recordLoanPayment(option?.loan, selectedValue);
            }}
          >
            {editingLoanPaymentId ? "Save payment changes" : "Record payment"}
          </Button>
          {editingLoanPaymentId && <Button variant="secondary" onClick={cancelLoanPaymentEdit}>Cancel edit</Button>}
        </div>
      </div>
    </div>
  );
}
