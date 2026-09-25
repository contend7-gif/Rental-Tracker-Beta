import React, { useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { buildMileagePosting, mileageTripAmount, postedMileageEntryIds, validateMileageEntry } from "../../domain/mileageLog.ts";

function blankTrip({ todayIso, propertyFilter, unitFilter, properties }) {
  return { id: "", date: todayIso, propertyId: propertyFilter !== "all" ? propertyFilter : (properties[0]?.id || ""), unit: unitFilter !== "all" ? unitFilter : "Shared", destination: "", purpose: "", miles: "", rate: "" };
}

export function MileageLogWorkspace({ actions, mileageEntries = [], transactions = [], openTransaction, properties = [], propertyNameById = {}, yearFilter, propertyFilter, unitFilter, usePeriods = [], leases = [], units = [], todayIso, currency, requirePermission }) {
  const [form, setForm] = useState(() => blankTrip({ todayIso, propertyFilter, unitFilter, properties }));
  const [message, setMessage] = useState("");
  const activePosted = useMemo(() => postedMileageEntryIds(transactions), [transactions]);
  const visibleEntries = useMemo(() => mileageEntries.filter((entry) =>
    entry.date.startsWith(yearFilter)
    && (propertyFilter === "all" || entry.propertyId === propertyFilter)
    && (unitFilter === "all" || entry.unit === unitFilter)
  ).sort((a, b) => b.date.localeCompare(a.date)), [mileageEntries, yearFilter, propertyFilter, unitFilter]);
  const groups = useMemo(() => {
    const byScope = new Map();
    visibleEntries.forEach((entry) => {
      const key = [entry.date.slice(0, 7), entry.propertyId, entry.unit].join("|");
      if (!byScope.has(key)) byScope.set(key, []);
      byScope.get(key).push(entry);
    });
    return [...byScope.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [visibleEntries]);
  const existingMileageTransactions = useMemo(() => transactions.filter((transaction) =>
    transaction.status === "active" && transaction.category === "Auto and travel"
    && Number(transaction.mileageMiles) > 0 && !transaction.mileageEntryIds?.length
    && transaction.date.startsWith(yearFilter)
    && (propertyFilter === "all" || transaction.propertyId === propertyFilter)
    && (unitFilter === "all" || transaction.unit === unitFilter)
  ).sort((a, b) => b.date.localeCompare(a.date)), [transactions, yearFilter, propertyFilter, unitFilter]);
  const formEntry = { ...form, miles: Number(form.miles), rate: Number(form.rate) };
  const formValid = validateMileageEntry(formEntry) && form.date <= todayIso;
  const selectedPropertyUnits = units.filter((unit) => unit.propertyId === form.propertyId).map((unit) => unit.name).filter(Boolean);

  const saveTrip = () => {
    if (!formValid) { setMessage("Add a valid date, property, destination, purpose, business miles, and rate."); return; }
    if (requirePermission && !requirePermission("create_edit_records", "This access profile cannot edit mileage.")) return;
    if (form.id && activePosted.has(form.id)) { setMessage("This trip is linked to a posted expense. Void that posting before editing it."); return; }
    actions.saveMileageEntry({ ...formEntry, id: form.id || `mile-${crypto.randomUUID()}` });
    setForm(blankTrip({ todayIso, propertyFilter, unitFilter, properties }));
    setMessage("Trip saved in the mileage log. No expense transaction was created.");
  };
  const deleteTrip = (entry) => {
    if (activePosted.has(entry.id)) return;
    if (requirePermission && !requirePermission("create_edit_records", "This access profile cannot edit mileage.")) return;
    if (!window.confirm(`Delete the unposted ${entry.date} trip to ${entry.destination}?`)) return;
    actions.deleteMileageEntry(entry.id);
    if (form.id === entry.id) setForm(blankTrip({ todayIso, propertyFilter, unitFilter, properties }));
    setMessage("Unposted trip removed.");
  };
  const postMonth = (entries) => {
    if (requirePermission && !requirePermission("create_edit_records", "This access profile cannot post mileage.")) return;
    const posting = buildMileagePosting(entries, { transactions, usePeriods, leases, units, todayIso });
    if (!posting) { setMessage("This month cannot be posted yet. Check the trips and wait until the month is complete."); return; }
    if (!window.confirm(`Post ${entries.length} trips for ${posting.date.slice(0, 7)} as one ${currency(posting.amount)} expense? Estimated rental use: ${currency(posting.deductibleAmount)}. The trip logs will stay linked.`)) return;
    actions.addOrUpdateTransaction({ ...posting, id: `mile-post-${crypto.randomUUID()}` });
    setMessage(`${posting.description} posted as one expense. The trip details remain linked here.`);
  };

  return <div className="space-y-4">
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-sm text-slate-700">
      <div className="font-semibold text-slate-900">Mileage log</div>
      <p className="mt-1">Save each business trip here. Trips stay out of ledger totals until you review and post a completed month. Keep the trip date, destination, purpose, and miles as your log; no separate receipt upload is needed for mileage.</p>
      <p className="mt-1 text-xs text-slate-600">Existing mileage expense transactions remain in Activity. Avoid entering those trips again.</p>
    </div>
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{form.id ? "Edit trip" : "Add trip"}</h3>{form.id ? <Button variant="secondary" size="sm" onClick={() => setForm(blankTrip({ todayIso, propertyFilter, unitFilter, properties }))}>Cancel edit</Button> : null}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><Label htmlFor="mileage-date">Trip date</Label><Input id="mileage-date" type="date" max={todayIso} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></div>
        <div><Label htmlFor="mileage-property">Property</Label><select id="mileage-property" className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm" value={form.propertyId} onChange={(event) => setForm({ ...form, propertyId: event.target.value, unit: "Shared" })}>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></div>
        <div><Label htmlFor="mileage-unit">Unit</Label><select id="mileage-unit" className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-sm" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}><option value="Shared">Shared</option>{selectedPropertyUnits.filter((unit) => unit !== "Shared").map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></div>
        <div><Label htmlFor="mileage-destination">Destination</Label><Input id="mileage-destination" value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} placeholder="Where you went" /></div>
        <div className="sm:col-span-2"><Label htmlFor="mileage-purpose">Business purpose</Label><Input id="mileage-purpose" value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} placeholder="Why this trip was for the rental" /></div>
        <div><Label htmlFor="mileage-miles">Business miles</Label><Input id="mileage-miles" type="number" min="0" step="0.1" value={form.miles} onChange={(event) => setForm({ ...form, miles: event.target.value })} /></div>
        <div><Label htmlFor="mileage-rate">Rate per mile</Label><Input id="mileage-rate" type="number" min="0" step="0.001" value={form.rate} onChange={(event) => setForm({ ...form, rate: event.target.value })} /></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3"><Button disabled={!formValid} onClick={saveTrip}>Save trip</Button><span className="text-sm text-slate-600">Trip amount: {currency(formValid ? mileageTripAmount(formEntry) : 0)}</span></div>
      {message ? <p role="status" className="mt-2 text-sm text-blue-800">{message}</p> : null}
    </div>
    <div className="space-y-3">
      {groups.length === 0 ? <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500">No mileage trips in this scope yet.</div> : groups.map(([key, entries]) => {
        const unposted = entries.filter((entry) => !activePosted.has(entry.id));
        const groupIds = new Set(entries.map((entry) => entry.id));
        const linkedPostings = transactions.filter((transaction) => transaction.status === "active" && transaction.mileageEntryIds?.some((id) => groupIds.has(id)));
        const posting = buildMileagePosting(unposted, { transactions, usePeriods, leases, units, todayIso });
        return <div key={key} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">{entries[0].date.slice(0, 7)} · {propertyNameById[entries[0].propertyId] || entries[0].propertyId} · {entries[0].unit}</h3><p className="text-xs text-slate-500">{entries.length} trip{entries.length === 1 ? "" : "s"} · {unposted.length} unposted</p></div><div className="flex items-center gap-2"><span className="text-sm font-semibold">{currency(unposted.reduce((sum, entry) => sum + mileageTripAmount(entry), 0))} unposted</span><Button size="sm" disabled={!posting} onClick={() => postMonth(unposted)}>Review and post month</Button></div></div>
          {posting ? <p className="mt-1 text-xs text-slate-600">Posting preview: {currency(posting.amount)} expense; {currency(posting.deductibleAmount)} estimated rental use. Check the trip details before posting.</p> : null}
          {linkedPostings.map((transaction) => <div key={transaction.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"><span>Posted expense {transaction.date}: {currency(transaction.amount)} · {transaction.mileageEntryIds.length} linked trips</span><Button variant="secondary" size="sm" onClick={() => { if (requirePermission && !requirePermission("create_edit_records", "This access profile cannot undo mileage posting.")) return; if (window.confirm("Undo this mileage posting? The trip logs will remain available for review and posting again.")) { actions.voidTransaction(transaction.id); setMessage("Posting voided. Trip logs remain available."); } }}>Undo posting</Button></div>)}
          <div className="mt-3 space-y-2">{entries.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm"><div><div className="font-medium">{entry.date} · {entry.destination} · {entry.purpose}</div><div className="text-xs text-slate-600">{entry.miles} miles × ${Number(entry.rate).toFixed(3)}/mile = {currency(mileageTripAmount(entry))} · {activePosted.has(entry.id) ? "Posted" : "Unposted"}</div></div>{!activePosted.has(entry.id) ? <div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => setForm({ ...entry, miles: String(entry.miles), rate: String(entry.rate) })}>Edit</Button><Button variant="secondary" size="sm" onClick={() => deleteTrip(entry)}>Delete</Button></div> : null}</div>)}</div>
        </div>;
      })}
    </div>
    {existingMileageTransactions.length > 0 ? <div className="rounded-lg border border-slate-200 bg-white p-3"><h3 className="font-semibold">Existing mileage expenses</h3><p className="mt-1 text-xs text-slate-600">These were already posted as individual transactions. They remain in ledger totals and are shown here for reference.</p><div className="mt-3 space-y-2">{existingMileageTransactions.map((transaction) => <div key={transaction.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 p-2 text-sm"><span>{transaction.date} · {transaction.description} · {transaction.mileageMiles} miles · {currency(transaction.amount)}</span><Button variant="secondary" size="sm" onClick={() => openTransaction?.(transaction, "ledger", false)}>View transaction</Button></div>)}</div></div> : null}
  </div>;
}
