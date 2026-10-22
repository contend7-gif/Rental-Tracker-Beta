import { createRecurringTemplateFromTxn, generateRecurringDrafts, generateRecurringTransactions } from "../domain/accounting.ts";
import type { RecurringDraft, RecurringTemplate, Transaction, UsePeriod } from "../models.ts";
import { recurringBillCycles } from "../domain/recurringBillMatches.ts";

type StateSetter<T> = (updater: T[] | ((previous: T[]) => T[])) => void;

export function createRecurringActions({
  getTemplates,
  getDrafts,
  getTransactions,
  getUsePeriods,
  setTemplates,
  setDrafts,
  setTransactions,
  onRecurringMatch,
}: {
  getTemplates: () => RecurringTemplate[];
  getDrafts: () => RecurringDraft[];
  getTransactions: () => Transaction[];
  getUsePeriods: () => UsePeriod[];
  setTemplates: StateSetter<RecurringTemplate>;
  setDrafts: StateSetter<RecurringDraft>;
  setTransactions: StateSetter<Transaction>;
  onRecurringMatch?: (transactionId: string, cycleDate: string) => void;
}) {
  return {
    confirmRecurringBillMatch(templateId: string, cycleDate: string, transactionId: string, todayIso: string) {
      const template = getTemplates().find(item => item.id === templateId);
      if (!template) return false;
      const cycle = recurringBillCycles(template, getTransactions(), todayIso).find(item => item.date === cycleDate);
      if (cycle?.status !== "needs_review" || !cycle.records.some(tx => tx.id === transactionId && !tx.recurringTemplateId)) return false;
      setTransactions(previous => previous.map(tx => tx.id === transactionId && !tx.recurringTemplateId && tx.status === "active"
        ? { ...tx, recurringTemplateId: templateId } : tx));
      onRecurringMatch?.(transactionId, cycleDate);
      return true;
    },
    createRecurringTemplate(transaction: Transaction, options?: { frequency?: RecurringTemplate["frequency"]; nextDueDate?: string; reviewRequired?: boolean }) {
      const template = createRecurringTemplateFromTxn(transaction);
      const configured = {
        ...template,
        frequency: options?.frequency ?? template.frequency,
        nextDueDate: options?.nextDueDate ?? template.nextDueDate,
        reviewRequired: options?.reviewRequired ?? template.reviewRequired,
      };
      setTemplates((previous) => [configured, ...previous]);
      return configured;
    },
    updateRecurringTemplate(template: RecurringTemplate) {
      setTemplates((previous) => previous.map((item) => item.id === template.id ? template : item));
    },
    setRecurringTemplateActive(id: string, active: boolean) {
      setTemplates((previous) => previous.map((item) => item.id === id ? { ...item, active } : item));
    },
    deleteRecurringTemplate(id: string) {
      setTemplates((previous) => previous.filter((item) => item.id !== id));
    },
    materializeRecurringTransactions(throughDate: string) {
      const transactions = getTransactions();
      const templates = getTemplates();
      const existingTransactionKeys = new Set(transactions
        .filter((transaction) => transaction.recurringTemplateId)
        .map((transaction) => `${transaction.recurringTemplateId}:${transaction.date}`));
      const generatedTransactions: Transaction[] = [];
      const updatedTemplates = templates.map((template) => {
        const cycles = recurringBillCycles(template, transactions, throughDate, { continueAfterReview: true });
        // A possible existing bill blocks generation until reviewed, rather than posting a duplicate.
        if (cycles.some(cycle => cycle.status === "needs_review" && cycle.records.length > 0)) return template;
        cycles.filter(cycle => cycle.status === "recorded").forEach(cycle => existingTransactionKeys.add(`${template.id}:${cycle.date}`));
        const result = generateRecurringTransactions({ template, throughDate, usePeriods: getUsePeriods(), existingTransactionKeys });
        generatedTransactions.push(...result.transactions);
        return { ...template, nextDueDate: result.nextDueDate };
      });
      if (updatedTemplates.some((template, index) => template.nextDueDate !== templates[index]?.nextDueDate)) setTemplates(updatedTemplates);
      if (generatedTransactions.length > 0) {
        setTransactions((previous) => {
          const existingIds = new Set(previous.map((transaction) => transaction.id));
          const unique = generatedTransactions.filter((transaction) => !existingIds.has(transaction.id));
          return unique.length > 0 ? [...unique, ...previous] : previous;
        });
      }
      return generatedTransactions.length;
    },
    generateDrafts(template: RecurringTemplate, throughDate: string) {
      const covered = new Set(recurringBillCycles(template, getTransactions(), throughDate, { continueAfterReview: true })
        .filter(cycle => cycle.status === "recorded" || cycle.records.length > 0).map(cycle => cycle.date));
      const drafts = generateRecurringDrafts({ template, throughDate, usePeriods: getUsePeriods() });
      const existingIds = new Set(getDrafts().map((draft) => draft.id));
      const unique = drafts.filter((draft) => !existingIds.has(draft.id) && !covered.has(draft.dueDate));
      if (unique.length > 0) setDrafts((previous) => [...unique, ...previous]);
      return unique.length;
    },
  };
}
