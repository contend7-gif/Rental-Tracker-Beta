import { formatTransactionUnitLabel, getTransactionVisual, transactionReconciliationStatusLabel, transactionSupportStatusLabel, transactionTaxStatusLabel } from "./transactionPresentation.js";

export const OPTIONAL_TRANSACTION_COLUMNS = ["Category", "Source", "Support", "Tax"];
export function TransactionTable({ records, columns, sort, onSort, onOpen, currency, documentCount, reviews, isTaxReviewRelevantTransaction, propertyNameById = {}, todayIso = "" }) {
  const direction = (key) => sort.startsWith(`${key}_`) ? sort.endsWith("asc") ? "ascending" : "descending" : "none";
  const toggle = (key) => onSort(key === "category" ? "category_asc" : `${key}_${sort === `${key}_desc` ? "asc" : "desc"}`);
  return <div className="rt-transaction-table max-w-full overflow-auto rounded-lg border border-slate-200">
    <table aria-label="Transactions table" className="min-w-full text-left text-sm">
      <thead className="sticky top-0 z-10 bg-slate-50"><tr>
        <th className="p-3" scope="col" aria-sort={direction("date")}><button onClick={() => toggle("date")}>Date {sort.startsWith("date_") ? sort.endsWith("asc") ? "↑" : "↓" : "↕"}</button></th>
        <th className="p-3" scope="col">Description</th>
        <th className="p-3 text-right" scope="col" aria-sort={direction("amount")}><button onClick={() => toggle("amount")}>Amount {sort.startsWith("amount_") ? sort.endsWith("asc") ? "↑" : "↓" : "↕"}</button></th>
        {columns.includes("Category") && <th scope="col" className="p-3" aria-sort={direction("category")}><button onClick={() => toggle("category")}>Category ↕</button></th>}
        {columns.filter((column) => column !== "Category").map((column) => <th key={column} scope="col" className="p-3">{column}</th>)}
      </tr></thead>
      <tbody>{records.map((record) => {
        const review = reviews[record.id];
        const issues = review?.issues || [];
        const { amountClass } = getTransactionVisual(record);
        return <tr key={record.id} className="border-t border-slate-200 transition hover:bg-teal-50/40">
        <td className="whitespace-nowrap p-3">{record.date}</td>
        <td className="p-3"><button className="text-left font-semibold text-slate-900 hover:text-teal-700" onClick={() => onOpen(record, "ledger", false)}>{record.description || record.vendor || "Transaction"}</button><div className="mt-0.5 text-xs text-slate-500">{[record.vendor, propertyNameById[record.propertyId] || record.propertyId, formatTransactionUnitLabel(record.unit)].filter(Boolean).join(" · ")}</div>{issues.length ? <button className="mt-1 text-left text-xs text-amber-700 hover:underline" onClick={() => onOpen(record, "ledger", false, issues[0].key)} title={issues.map((issue) => issue.label).join("; ")}>{issues.length} check{issues.length === 1 ? "" : "s"} · {issues[0].label}</button> : null}</td>
        <td className={`whitespace-nowrap p-3 text-right font-semibold tabular-nums ${record.type === "Expense" ? "text-rose-700" : amountClass}`}>{currency(record.amount)}</td>
        {columns.includes("Category") && <td className="p-3">{record.category}</td>}
        {columns.filter((column) => column !== "Category").map((column) => <td key={column} className="p-3 text-xs text-slate-600">{column === "Source" ? transactionReconciliationStatusLabel(record, todayIso) : column === "Support" ? transactionSupportStatusLabel(record, { documentCount: documentCount(record), missingReceipt: issues.some((issue) => issue.key === "missing_receipt") }) : transactionTaxStatusLabel(record, review?.readiness, isTaxReviewRelevantTransaction(record))}</td>)}
      </tr>; })}</tbody>
    </table>
  </div>;
}
