import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { accountRouteKey, confirmationDuplicateCandidates, confirmationDuplicateKey, matchCashMovementRule, parsePaymentConfirmation } from "../../domain/confirmationEntry.js";

const CASH_TYPES = ["Owner Draw", "Owner Contribution", "Transfer"];
const TYPES = ["Income", "Expense", ...CASH_TYPES];
const CONTROL = "mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm";

export function ConfirmationEntryPanel({ form, setForm, editingTxnId, setRentAmountTouched, leases, transactions, openTransaction, markEdited }) {
  const [candidate, setCandidate] = useState(null);
  const text = form.sourceConfirmation?.text || "";
  useEffect(() => setCandidate(null), [text, editingTxnId]);
  const apply = () => {
    if (!candidate?.type) return;
    markEdited();
    const periodDate = candidate.rentPeriod ? `${candidate.rentPeriod}-15` : candidate.date;
    const eligible = leases.filter(lease => lease.propertyId === form.propertyId && lease.tenantName && lease.startDate <= periodDate && (!lease.endDate || lease.endDate >= periodDate));
    const chosen = eligible.filter(lease => lease.unit === form.unit);
    const lease = chosen.length === 1 ? chosen[0] : eligible.length === 1 ? eligible[0] : null;
    setRentAmountTouched(true);
    setForm(previous => ({ ...previous,
      amount: candidate.amount, date: candidate.date, type: candidate.type,
      category: candidate.type === "Income" ? (candidate.category === "Rents received" ? "Rents received" : "Other income") : candidate.type === "Expense" ? "Other expenses" : candidate.type,
      fromAccount: candidate.fromAccount, toAccount: candidate.toAccount,
      paidFrom: candidate.fromAccount || previous.paidFrom,
      paymentMethod: candidate.provider === "Venmo" ? "Venmo" : previous.paymentMethod,
      description: previous.description || (candidate.category === "Rents received" ? `${candidate.rentPeriod || "Rent"} rent payment` : "Payment from confirmation"),
      rentPeriod: candidate.rentPeriod,
      rentLeaseId: candidate.category === "Rents received" ? lease?.id || "" : "",
      unit: candidate.category === "Rents received" ? lease?.unit || "" : previous.unit,
      vendor: candidate.category === "Rents received" && lease ? lease.tenantName : previous.vendor,
      sourceConfirmation: { text, provider: candidate.provider, reference: candidate.reference, status: candidate.status },
      confirmationDuplicateAcknowledged: "",
    }));
    setCandidate(null);
  };
  if (editingTxnId && !text) return null;
  return <details className="rounded-lg border border-blue-200 bg-blue-50/40 p-3" open={text ? true : undefined}>
    <summary className="cursor-pointer text-sm font-semibold text-slate-900">Paste a payment confirmation</summary>
    <p className="mt-2 text-xs text-slate-600">Paste one rent or transfer confirmation, review the suggested draft, then save the transaction below. Dates, amounts and account routes need your review.</p>
    <label className="mt-3 block text-sm">Confirmation text
      <textarea className={`${CONTROL} min-h-28`} maxLength={20000} readOnly={Boolean(editingTxnId)} value={text} onChange={event => { markEdited(); setCandidate(null); setForm(previous => ({ ...previous, sourceConfirmation: { text: event.target.value, provider: "", reference: "", status: "unknown" }, confirmationDuplicateAcknowledged: "" })); }} />
    </label>
    <div className="mt-2 flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="secondary" disabled={!text.trim() || Boolean(editingTxnId)} onClick={() => setCandidate(parsePaymentConfirmation(text))}>Review confirmation draft</Button>
      {text && <Button type="button" size="sm" variant="ghost" onClick={() => { markEdited(); setCandidate(null); setForm(previous => ({ ...previous, sourceConfirmation: undefined, confirmationDuplicateAcknowledged: "" })); }}>Remove pasted confirmation</Button>}
    </div>
    {candidate && <section aria-label="Confirmation draft review" className="mt-3 space-y-3 rounded border border-slate-200 bg-white p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs">Suggested amount<Input inputMode="decimal" className="mt-1" value={candidate.amount} onChange={event => setCandidate({ ...candidate, amount: event.target.value })} /></label>
        <label className="text-xs">Suggested payment date<Input type="date" className="mt-1" value={candidate.date} onChange={event => setCandidate({ ...candidate, date: event.target.value })} /></label>
        <label className="text-xs">Suggested type<select className={CONTROL} value={candidate.type} onChange={event => setCandidate({ ...candidate, type: event.target.value })}><option value="">Choose a type</option>{TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
        <div className="text-xs"><span className="text-slate-500">Evidence status</span><div className="mt-2 font-semibold">{candidate.status}</div></div>
      </div>
      <p className="text-xs text-slate-600">{candidate.provider || "Provider not identified"}{candidate.reference ? ` | Reference ${candidate.reference}` : ""}{candidate.rentPeriod ? ` | Rent month ${candidate.rentPeriod}` : ""}{candidate.fromAccount || candidate.toAccount ? ` | ${candidate.fromAccount || "Unknown source"} to ${candidate.toAccount || "Unknown destination"}` : ""}</p>
      {candidate.warnings.length > 0 && <ul className="list-inside list-disc text-xs text-amber-800">{candidate.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
      <p className="text-xs text-slate-500">Use reviewed draft replaces the amount, date, type and account fields below. It does not post a transaction.</p>
      <Button type="button" size="sm" disabled={!candidate.type || Boolean(editingTxnId)} onClick={apply}>Use reviewed draft</Button>
    </section>}
  </details>;
}

export function PaymentEvidenceFields({ form, setForm, transactions, editingTxnId, appSettings, setSetting, requirePermission, openTransaction, markEdited, currency }) {
  const [reverse, setReverse] = useState(false);
  const [message, setMessage] = useState("");
  const hasEvidence = Boolean(form.sourceConfirmation?.text);
  const isCash = CASH_TYPES.includes(form.type);
  const match = matchCashMovementRule(appSettings.cashMovementRules || [], form);
  const candidates = hasEvidence ? confirmationDuplicateCandidates(form, transactions, editingTxnId) : [];
  const key = confirmationDuplicateKey(form, candidates);
  const patch = fields => { markEdited(); setMessage(""); setForm(previous => ({ ...previous, ...fields, confirmationDuplicateAcknowledged: "" })); };
  const saveRule = () => {
    if (!requirePermission("create_edit_records", "This access profile cannot save account rules.")) return;
    if (!accountRouteKey(form.fromAccount) || !accountRouteKey(form.toAccount) || accountRouteKey(form.fromAccount) === accountRouteKey(form.toAccount) || !form.propertyId || !form.unit) { setMessage("Choose a property, unit and two different accounts first."); return; }
    const rules = appSettings.cashMovementRules || [];
    const retained = rules.filter(rule => !(rule.propertyId === form.propertyId && rule.unit === form.unit && ((accountRouteKey(rule.fromAccount) === accountRouteKey(form.fromAccount) && accountRouteKey(rule.toAccount) === accountRouteKey(form.toAccount)) || (accountRouteKey(rule.fromAccount) === accountRouteKey(form.toAccount) && accountRouteKey(rule.toAccount) === accountRouteKey(form.fromAccount)))));
    const reverseType = form.type === "Owner Draw" ? "Owner Contribution" : form.type === "Owner Contribution" ? "Owner Draw" : "Transfer";
    setSetting("cashMovementRules", [...retained, { id: `route-${Date.now()}`, fromAccount: form.fromAccount.trim(), toAccount: form.toAccount.trim(), propertyId: form.propertyId, unit: form.unit, type: form.type, ...(reverse ? { reverseType } : {}) }]);
    setMessage("Account rule saved. Future suggestions still require review.");
  };
  return <>
    {(isCash || hasEvidence) && <section aria-label="Payment evidence and account route" className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs">From account<Input maxLength={120} className="mt-1" placeholder="Institution and account nickname or last four" value={form.fromAccount || ""} onChange={event => patch({ fromAccount: event.target.value })} /></label>
        <label className="text-xs">To account<Input maxLength={120} className="mt-1" value={form.toAccount || ""} onChange={event => patch({ toAccount: event.target.value })} /></label>
        {hasEvidence && <>
          <label className="text-xs">Confirmation reference<Input maxLength={120} className="mt-1" value={form.sourceConfirmation.reference || ""} onChange={event => patch({ sourceConfirmation: { ...form.sourceConfirmation, reference: event.target.value } })} /></label>
          <label className="text-xs">Payment evidence status<select aria-label="Payment evidence status" className={CONTROL} value={form.sourceConfirmation.status} onChange={event => patch({ sourceConfirmation: { ...form.sourceConfirmation, status: event.target.value } })}>
            <option value="unknown">Unclear - keep as draft</option><option value="initiated">Initiated or scheduled - keep as draft</option><option value="failed">Failed or cancelled - do not post</option><option value="completed">Completed payment confirmed</option>
          </select></label>
          <p className="text-xs text-slate-600 sm:col-span-2">A completed confirmation supports entry. Bank matching is a separate review and is not set by this form.</p>
        </>}
      </div>
      {isCash && <p className="mt-2 text-xs text-slate-600">Rental ledger account: {(form.type === "Owner Contribution" ? form.toAccount : form.fromAccount) || form.paidFrom || "Choose account"}.</p>}
      {match && isCash && <div className="mt-3 rounded border border-indigo-200 bg-indigo-50 p-2 text-xs">Saved route suggests <strong>{match.type}</strong> for this property and unit. <Button type="button" size="sm" variant="secondary" className="ml-2" onClick={() => patch({ type: match.type, category: match.type, paidFrom: match.type === "Owner Contribution" ? form.toAccount : form.fromAccount })}>Apply account rule</Button></div>}
      {isCash && <details className="mt-3 text-xs"><summary className="cursor-pointer font-medium">Save or manage account rules</summary>
        <p className="mt-2">Save this exact route for this property and unit as {form.type}. Use account nicknames or last four digits to distinguish accounts.</p>
        <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={reverse} onChange={event => setReverse(event.target.checked)} />Also suggest {form.type === "Owner Draw" ? "Owner Contribution" : form.type === "Owner Contribution" ? "Owner Draw" : "Transfer"} for the reverse route</label>
        <Button type="button" size="sm" className="mt-2" variant="secondary" onClick={saveRule}>Save account rule</Button>
        <div className="mt-3 space-y-2">{(appSettings.cashMovementRules || []).filter(rule => rule.propertyId === form.propertyId).map(rule => <div key={rule.id} className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 break-words">{rule.fromAccount} to {rule.toAccount}: {rule.type} | {rule.unit}{rule.reverseType ? ` | reverse: ${rule.reverseType}` : ""}</span><Button type="button" size="sm" variant="ghost" onClick={() => { if (requirePermission("create_edit_records")) setSetting("cashMovementRules", appSettings.cashMovementRules.filter(item => item.id !== rule.id)); }}>Remove rule</Button></div>)}</div>
      </details>}
      {message && <p role="status" className="mt-2 text-xs text-slate-700">{message}</p>}
    </section>}
    {candidates.length > 0 && <section aria-label="Possible duplicate confirmations" className="mt-3 space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs">
      <div className="font-semibold">{candidates.some(candidate => candidate.exact) ? "This confirmation is already recorded" : "Possible existing payment"}</div>
      {candidates.slice(0, 5).map(({ transaction, exact }) => <div key={transaction.id} className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1">{transaction.date} | {currency(transaction.amount)} | {transaction.description}{exact ? " | same reference" : ""}</span><Button type="button" size="sm" variant="secondary" onClick={() => openTransaction(transaction, "quickAdd")}>Open existing entry</Button></div>)}
      {!candidates.some(candidate => candidate.exact) && <label className="flex items-center gap-2"><input type="checkbox" checked={form.confirmationDuplicateAcknowledged === key} onChange={event => { markEdited(); setForm(previous => ({ ...previous, confirmationDuplicateAcknowledged: event.target.checked ? key : "" })); }} />I reviewed these entries; this is a separate payment.</label>}
    </section>}
  </>;
}
