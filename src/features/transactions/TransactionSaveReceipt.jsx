import { Button } from "../../components/ui/button";

const cashTypes = ["Owner Draw", "Owner Contribution", "Transfer"];
const sameFacts = (a, b) => ["date", "propertyId", "unit", "type", "category", "description", "amount", "notes", "fromAccount", "toAccount", "paidFrom"].every(key => a[key] === b[key]);

export function TransactionSaveReceipt({ receipt, transactions, onDismiss, openTransaction, actions, requirePermission, currency, propertyNameById, setNotice, view }) {
  if (!receipt) return null;
  const saved = receipt.transaction;
  const live = transactions.find(tx => tx.id === saved.id);
  const canUndo = receipt.isNew && cashTypes.includes(saved.type) && live?.status === "active" && !live.reconciled && !live.bankImportId && !live.tenantLedgerEntryId && !live.recurringTemplateId && !live.workOrderId && !live.capitalImprovement && sameFacts(saved, live);
  return <section aria-label="Saved transaction confirmation" role="status" className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
    <div className="font-semibold">{receipt.isNew ? "Transaction saved" : "Transaction updated"}: {currency(saved.amount)} | {saved.type}</div>
    <div className="mt-1 text-xs text-slate-700">{saved.date} | {propertyNameById[saved.propertyId] || saved.propertyId} | {saved.unit} | {saved.description}{saved.rentPeriod ? ` | Rent month ${saved.rentPeriod}` : ""}{saved.fromAccount || saved.toAccount ? ` | ${saved.fromAccount || "Unknown source"} to ${saved.toAccount || "Unknown destination"}` : ""}</div>
    <div className="mt-1 text-xs text-slate-600">{saved.sourceConfirmation ? "Completed confirmation retained; bank matching remains separate." : "Recorded in the ledger."}</div>
    <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={!live} onClick={() => openTransaction(live, view)}>View saved transaction</Button>
      {canUndo && <Button size="sm" variant="secondary" onClick={() => { if (!requirePermission("create_edit_records")) return; actions.voidTransaction(saved.id); onDismiss(); setNotice("New cash movement voided. It remains in the audit history."); }}>Undo new entry</Button>}
      <Button size="sm" variant="ghost" onClick={onDismiss}>Dismiss confirmation</Button>
    </div>
  </section>;
}
