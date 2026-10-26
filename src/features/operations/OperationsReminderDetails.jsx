import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Button } from "../../components/ui/button";

export function FollowUpSelect({ item, onFollowUp }) {
  if (item.role === "milestone" || item.recurringStatus === "recorded") return null;
  return (
    <Select value={item.followUpStatus || "open"} onValueChange={(value) => onFollowUp(item, value)}>
      <SelectTrigger className="h-9 w-40 bg-white text-xs" aria-label={`Follow-up status for ${item.title}`}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="open">Open</SelectItem>
        <SelectItem value="done">{item.utilityComparison ? "Amount explained" : "Review complete"}</SelectItem>
        <SelectItem value="snoozed">Snooze 7 days</SelectItem>
        <SelectItem value="waiting">Waiting</SelectItem>
        {(item.source === "smart_check" && !item.utilityComparison) || item.followUpStatus === "intentional" ? <SelectItem value="intentional">{item.source === "smart_check" ? "Gap intentional" : "Intentional"}</SelectItem> : null}
      </SelectContent>
    </Select>
  );
}

const BASIS = {
  rent: "Based on the lease payment schedule and recorded tenant ledger. Check the ledger to confirm the balance.",
  lease: "Based on recorded lease dates. Review reminders use your calendar lead time; they are planning prompts.",
  maintenance: "Based on the due date of an open maintenance record.",
  document: "Based on the expiration date saved on the document.",
  recurring: "Based on an active recurring rule's next date. A rule is a schedule, not proof of payment.",
  planning: "Based on the due date saved on your Planning action.",
  loan: "Based on the next payment date saved on the loan. Review payment records to confirm payment.",
  backup: "Based on your recovery schedule and the last verified restore point.",
};

export function OperationsReminderDetails({ item, onConfirmRecurringMatch, onFollowUp }) {
  return (
    <details className="mt-2 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
      <summary className="cursor-pointer font-medium text-slate-700">Why this appears</summary>
      <p className="mt-2 leading-relaxed">{item.evidence?.reason || BASIS[item.source]}</p>
      {item.utilityComparison ? <div className="mt-2 space-y-2">
        <p>Planning range: ${item.utilityComparison.low.toFixed(2)}–${item.utilityComparison.high.toFixed(2)}. Totals use the same provider, property and unit; the current month may still be incomplete.</p>
        <div>Recorded entries: {item.utilityComparison.records.map(record => `${record.date}: $${record.amount.toFixed(2)}`).join("; ")}</div>
        {onFollowUp && item.followUpStatus !== "done" ? <Button size="sm" variant="secondary" onClick={() => onFollowUp(item, "done")}>Mark amount explained</Button> : null}
      </div> : null}
      {item.evidence?.records?.length ? (
        <div className="mt-2">
          <div className="font-medium text-slate-700">Recent supporting transactions</div>
          <ul className="mt-1 max-h-48 overflow-y-auto space-y-1" tabIndex={0} aria-label="Supporting transactions">
            {item.evidence.records.map((record) => <li key={record.id} className="flex flex-wrap items-center justify-between gap-2"><span>{record.date}</span><span>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(record.amount)}</span>{onConfirmRecurringMatch && item.matchCandidateIds?.includes(record.id) ? <Button size="sm" variant="secondary" onClick={() => onConfirmRecurringMatch(item, record.id)}>Link this existing entry</Button> : null}</li>)}
          </ul>
          <p className="mt-2">{item.source === "recurring" ? "Open transactions to review the recurring rule and ledger. Linking preserves the entry's amount and date; it does not mark it bank reconciled." : "Use Review transactions to open the vendor history."}</p>
        </div>
      ) : null}
      {item.originalDate ? <p className="mt-2">Original source date: {item.originalDate}. {item.snoozeReturned ? "Snooze ended; ready for review again." : "Snoozing changes the review date only."}</p> : null}
      {item.role !== "milestone" ? <p className="mt-2 border-t border-slate-200 pt-2">Review complete hides this reminder. Record payments or completion in the source record.</p> : null}
    </details>
  );
}
