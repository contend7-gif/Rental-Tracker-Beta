import type { TenantLedgerAccountingTreatment, TenantLedgerEntryKind, Transaction } from "../models.ts";

export const TENANT_LEDGER_ACCOUNTING_TREATMENTS: TenantLedgerAccountingTreatment[] = [
  "none",
  "rent_income",
  "other_income",
  "security_deposit_liability",
  "security_deposit_applied_damages",
  "security_deposit_return",
  "repairs_expense",
];

export function normalizeTenantLedgerAccountingTreatment(value: unknown): TenantLedgerAccountingTreatment {
  const treatment = String(value || "").trim();
  return TENANT_LEDGER_ACCOUNTING_TREATMENTS.includes(treatment as TenantLedgerAccountingTreatment)
    ? (treatment as TenantLedgerAccountingTreatment)
    : "none";
}

export function recommendedTenantLedgerAccountingTreatment(kind: TenantLedgerEntryKind): TenantLedgerAccountingTreatment {
  if (kind === "payment") return "rent_income";
  if (kind === "refund") return "security_deposit_return";
  return "none";
}

const ALL_TENANT_LEDGER_KINDS: TenantLedgerEntryKind[] = ["charge", "payment", "credit", "refund", "adjustment"];
const TREATMENT_KIND_RULES: Record<TenantLedgerAccountingTreatment, TenantLedgerEntryKind[]> = {
  none: ALL_TENANT_LEDGER_KINDS,
  rent_income: ["payment"],
  other_income: ["payment"],
  security_deposit_liability: ["payment"],
  security_deposit_applied_damages: ["charge", "adjustment"],
  security_deposit_return: ["refund"],
  repairs_expense: ["charge", "adjustment"],
};

export function tenantLedgerKindsForTreatment(treatment: TenantLedgerAccountingTreatment): TenantLedgerEntryKind[] {
  return [...TREATMENT_KIND_RULES[normalizeTenantLedgerAccountingTreatment(treatment)]];
}

export function recommendedTenantLedgerKindForTreatment(treatment: TenantLedgerAccountingTreatment): TenantLedgerEntryKind {
  const allowedKinds = tenantLedgerKindsForTreatment(treatment);
  return allowedKinds[0] || "charge";
}

export function isTenantLedgerKindAllowedForTreatment(
  kind: TenantLedgerEntryKind,
  treatment: TenantLedgerAccountingTreatment,
): boolean {
  return tenantLedgerKindsForTreatment(treatment).includes(kind);
}

export type TenantLedgerPostingTemplate = {
  txType: Transaction["type"];
  category: string;
  paidFrom: string;
  paymentMethod: string;
  nonIncome: boolean;
};

export function tenantLedgerPostingTemplate(treatment: TenantLedgerAccountingTreatment): TenantLedgerPostingTemplate | null {
  if (treatment === "none") return null;

  if (treatment === "rent_income") {
    return {
      txType: "Income",
      category: "Rents received",
      paidFrom: "Tenant",
      paymentMethod: "ACH",
      nonIncome: false,
    };
  }

  if (treatment === "other_income") {
    return {
      txType: "Income",
      category: "Other income",
      paidFrom: "Tenant",
      paymentMethod: "ACH",
      nonIncome: false,
    };
  }

  if (treatment === "security_deposit_liability") {
    return {
      txType: "Transfer",
      category: "Transfer",
      paidFrom: "Security deposit trust",
      paymentMethod: "ACH",
      nonIncome: true,
    };
  }

  if (treatment === "security_deposit_applied_damages") {
    return {
      txType: "Income",
      category: "Other income",
      paidFrom: "Security deposit trust",
      paymentMethod: "Journal",
      nonIncome: false,
    };
  }

  if (treatment === "security_deposit_return") {
    return {
      txType: "Transfer",
      category: "Transfer",
      paidFrom: "Security deposit trust",
      paymentMethod: "Check",
      nonIncome: true,
    };
  }

  return {
    txType: "Expense",
    category: "Repairs",
    paidFrom: "Security deposit trust",
    paymentMethod: "Journal",
    nonIncome: false,
  };
}

export function defaultTenantLedgerPostingDescription(args: {
  treatment: TenantLedgerAccountingTreatment;
  tenantName: string;
  unit: string;
  memo: string;
}) {
  const fallbackTenant = args.tenantName || `Unit ${args.unit}`;
  const memo = String(args.memo || "").trim();
  if (memo) return memo;

  if (args.treatment === "security_deposit_liability") {
    return `Security deposit received - ${fallbackTenant}`;
  }
  if (args.treatment === "security_deposit_applied_damages") {
    return `Security deposit applied to damages - ${fallbackTenant}`;
  }
  if (args.treatment === "security_deposit_return") {
    return `Security deposit returned - ${fallbackTenant}`;
  }
  if (args.treatment === "repairs_expense") {
    return `Damage repairs - ${fallbackTenant}`;
  }
  if (args.treatment === "rent_income") {
    return `Rent payment - ${fallbackTenant}`;
  }
  return `Tenant ledger entry - ${fallbackTenant}`;
}

