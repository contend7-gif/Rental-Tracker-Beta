import { createRecurringTemplateFromTxn, generateRecurringDrafts, generateRecurringTransactions } from "../domain/accounting.ts";
import type { RecurringDraft, RecurringTemplate, Transaction, UsePeriod } from "../models.ts";

type StateSetter<T> = (updater: T[] | ((previous: T[]) => T[])) => void;

export function createRecurringActions({
  getTemplates,
  getDrafts,
  getTransactions,
  getUsePeriods,
  setTemplates,
  setDrafts,
  setTransactions,
}: {
  getTemplates: () => RecurringTemplate[];
  getDrafts: () => RecurringDraft[];
  getTransactions: () => Transaction[];
  getUsePeriods: () => UsePeriod[];
  setTemplates: StateSetter<RecurringTemplate>;
  setDrafts: StateSetter<RecurringDraft>;
  setTransactions: StateSetter<Transaction>;
}) {
  return {
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
      const drafts = generateRecurringDrafts({ template, throughDate, usePeriods: getUsePeriods() });
      const existingIds = new Set(getDrafts().map((draft) => draft.id));
      const unique = drafts.filter((draft) => !existingIds.has(draft.id));
      if (unique.length > 0) setDrafts((previous) => [...unique, ...previous]);
      return unique.length;
    },
  };
}
