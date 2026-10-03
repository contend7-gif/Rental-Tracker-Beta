import { transactionReconciliationStatusLabel, transactionTaxStatusLabel } from "./transactionPresentation.js";

export const OPTIONAL_TRANSACTION_COLUMNS = ["Category", "Source", "Support", "Tax"];
export function TransactionTable({ records, columns, sort, onSort, onOpen, currency, documentCount, reviews, isTaxReviewRelevantTransaction }) {
  const direction = (key) => sort.startsWith(`${key}_`) ? sort.endsWith("asc") ? "ascending" : "descending" : "none";
  const toggle = (key) => onSort(key === "category" ? "category_asc" : `${key}_${sort === `${key}_desc` ? "asc" : "desc"}`);
  return <div className="max-w-full overflow-x-auto rounded-lg border border-slate-200">
    <table aria-label="Transactions table" className="min-w-full text-left text-sm">
      <thead className="bg-slate-50"><tr>
        <th className="p-3" scope="col" aria-sort={direction("date")}><button onClick={() => toggle("date")}>Date {sort.startsWith("date_") ? sort.endsWith("asc") ? "↑" : "↓" : "↕"}</button></th>
        <th className="p-3" scope="col">Description</th>
        <th className="p-3 text-right" scope="col" aria-sort={direction("amount")}><button onClick={() => toggle("amount")}>Amount {sort.startsWith("amount_") ? sort.endsWith("asc") ? "↑" : "↓" : "↕"}</button></th>
        {columns.includes("Category") && <th scope="col" className="p-3" aria-sort={direction("category")}><button onClick={() => toggle("category")}>Category ↕</button></th>}
        {columns.filter((column) => column !== "Category").map((column) => <th key={column} scope="col" className="p-3">{column}</th>)}
      </tr></thead>
      <tbody>{records.map((record) => <tr key={record.id} className="border-t border-slate-200">
        <td className="whitespace-nowrap p-3">{record.date}</td>
        <td className="p-3"><button className="text-left font-medium text-teal-800 underline decoration-transparent hover:decoration-current" onClick={() => onOpen(record, "ledger", false)}>{record.description || record.vendor || "Transaction"}</button></td>
        <td className="whitespace-nowrap p-3 text-right">{currency(record.amount)}</td>
        {columns.includes("Category") && <td className="p-3">{record.category}</td>}
        {columns.filter((column) => column !== "Category").map((column) => <td key={column} className="p-3">{column === "Source" ? transactionReconciliationStatusLabel(record) : column === "Support" ? `${documentCount(record)} files` : transactionTaxStatusLabel(record, reviews[record.id]?.readiness, isTaxReviewRelevantTransaction(record))}</td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}
