import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { bookkeepingSignature, buildAccountCoverage, ownerDrawMonthReview } from "../../domain/bookkeepingCoverage.js";
import { validConfirmationDate } from "../../domain/confirmationEntry.js";

export function BookkeepingCoveragePanel({ transactions, appSettings, setSetting, requirePermission, propertyFilter, propertyNameById, todayIso, yearFilter, currency }) {
  const [month, setMonth] = useState(`${yearFilter}-${yearFilter === todayIso.slice(0, 4) ? todayIso.slice(5, 7) : "12"}`);
  useEffect(() => setMonth(`${yearFilter}-${yearFilter === todayIso.slice(0, 4) ? todayIso.slice(5, 7) : "12"}`), [yearFilter]);
  const [dates, setDates] = useState({});
  const [message, setMessage] = useState("");
  const accounts = buildAccountCoverage({ transactions, reconciliations: Object.values(appSettings.bankReconciliationRecords || {}), reviews: appSettings.accountActivityReviews || {}, propertyFilter, todayIso });
  const drawKey = `${month}::${propertyFilter}`;
  const drawReview = ownerDrawMonthReview({ transactions, month, propertyFilter, todayIso, review: appSettings.ownerDrawMonthlyReviews?.[drawKey] });
  const monthEnd = /^\d{4}-\d{2}$/.test(month) ? new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10) : "";
  const lastClose = Object.entries(appSettings.monthlyCloseRecords || {}).filter(([key]) => key.endsWith(`::${propertyFilter}`) && key.slice(0, 7) <= month).sort(([a], [b]) => b.localeCompare(a))[0];
  const markAccount = account => {
    if (!requirePermission("reconcile_records", "This access profile cannot mark account activity reviewed.")) return;
    const throughDate = dates[account.key] || todayIso;
    if (!validConfirmationDate(throughDate) || throughDate > todayIso) { setMessage("Choose a review date on or before today."); return; }
    setSetting("accountActivityReviews", { ...appSettings.accountActivityReviews, [account.key]: { throughDate, reviewedAt: new Date().toISOString(), signature: bookkeepingSignature(account.rows.filter(tx => tx.date <= throughDate)) } });
    setMessage("Activity review saved. Statement reconciliation is unchanged.");
  };
  return <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
    <summary className="cursor-pointer text-sm font-semibold">Bookkeeping coverage <span className="ml-2 text-xs font-normal text-slate-600">{accounts.filter(account => !account.unchanged || account.newerActivity).length} accounts need review | Owner draws {drawReview.reviewed ? "checked" : "not checked"} for {month}</span></summary>
    <p className="mt-2 text-xs text-slate-600">Activity reviews are your confirmation that you checked the source account, including missing entries. Statement reconciliation is shown separately. These checks cover all units at the selected property.</p>
    <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
      {!accounts.length && <p className="text-xs text-slate-500">Accounts appear here when used in recorded transactions or closed statement reconciliations.</p>}
      {accounts.map(account => <section key={account.key} className="rounded border border-slate-200 bg-white p-3 text-xs">
        <div className="font-semibold">{account.accountLabel} | {propertyNameById[account.propertyId] || account.propertyId}</div>
        <div className="mt-1">Statement reconciled through: {account.closed?.periodEnd || "No closed statement"}</div>
        <div className="mt-1">Activity reviewed through: {account.review?.throughDate || "Not reviewed"}{account.review && !account.unchanged ? " - recorded entries changed; review again" : account.newerActivity ? " - newer recorded activity needs review" : ""}</div>
        <div className="mt-2 flex flex-wrap items-end gap-2"><label>Review through date<Input type="date" className="mt-1" max={todayIso} aria-label={`Review through date for ${account.accountLabel} at ${propertyNameById[account.propertyId] || account.propertyId}`} value={dates[account.key] || todayIso} onChange={event => setDates({ ...dates, [account.key]: event.target.value })} /></label><Button size="sm" variant="secondary" onClick={() => markAccount(account)}>Mark account activity reviewed</Button>{account.review && <Button size="sm" variant="ghost" onClick={() => { if (!requirePermission("reconcile_records")) return; const next = { ...appSettings.accountActivityReviews }; delete next[account.key]; setSetting("accountActivityReviews", next); }}>Reopen account review</Button>}</div>
      </section>)}
    </div>
    <section aria-label="Owner draw monthly review" className="mt-3 rounded border border-slate-200 bg-white p-3 text-xs">
      <div className="flex flex-wrap items-end gap-3"><label>Owner draw review month<Input type="month" className="mt-1" value={month} max={todayIso.slice(0, 7)} onChange={event => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setMonth(event.target.value); }} /></label><span>{drawReview.count} {drawReview.count === 1 ? "draw" : "draws"} recorded | {currency(drawReview.amount)} | {drawReview.reviewed ? "Reviewed" : "Not reviewed"}</span>
      <Button size="sm" variant="secondary" disabled={!monthEnd || month > todayIso.slice(0, 7)} onClick={() => {
        if (!requirePermission("reconcile_records")) return;
        setSetting("ownerDrawMonthlyReviews", { ...appSettings.ownerDrawMonthlyReviews, [drawKey]: { throughDate: monthEnd > todayIso ? todayIso : monthEnd, reviewedAt: new Date().toISOString(), signature: drawReview.signature } });
      }}>Mark owner draws checked</Button>{appSettings.ownerDrawMonthlyReviews?.[drawKey] && <Button size="sm" variant="ghost" onClick={() => { if (!requirePermission("reconcile_records")) return; const next = { ...appSettings.ownerDrawMonthlyReviews }; delete next[drawKey]; setSetting("ownerDrawMonthlyReviews", next); }}>Reopen owner draw review</Button>}</div>
      <p className="mt-2 text-slate-600">Zero recorded draws does not establish that none occurred. Mark checked after comparing the source accounts. New or changed cash movements reopen this review.</p>
      <p className="mt-2 text-slate-500">Last monthly close snapshot: {lastClose ? `${lastClose[0].slice(0, 7)} (saved ${new Date(lastClose[1].closedAt).toLocaleDateString()})` : "None for this scope"}. Open Calendar Monthly Close to review whether the snapshot is still current.</p>
    </section>
    {message && <p role="status" className="mt-2 text-xs">{message}</p>}
  </details>;
}
