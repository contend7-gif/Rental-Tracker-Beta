import type { Transaction } from "../models.ts";

export type BankImportRow = {
  id: string;
  sourceLine: number;
  date: string;
  description: string;
  amount: number;
  rawAmount: string;
  externalId?: string;
};

export type ParsedBankCsv = {
  rows: BankImportRow[];
  skippedRows: number;
};

export type BankImportFormat = "csv" | "ofx";

export type ParsedBankImport = ParsedBankCsv & {
  format: BankImportFormat;
};

export type SuggestedBankTransaction = {
  type: "Income" | "Expense";
  category: string;
};

export type BankMatch = {
  transactionId: string;
  score: number;
  dayDiff: number;
  confidence: "high" | "medium" | "low";
};

export type BankMatchOptions = {
  amountTolerance?: number;
  daysWindow?: number;
  minimumConfidence?: BankMatch["confidence"];
};

function normalizeHeader(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      row.push(field.trim());
      field = "";
      if (row.some((item) => item.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field.trim());
  if (row.some((item) => item.length > 0)) {
    rows.push(row);
  }

  return rows;
}

function headerIndex(headers: string[], aliases: string[]) {
  for (let i = 0; i < headers.length; i += 1) {
    const normalized = normalizeHeader(headers[i]);
    if (aliases.includes(normalized)) return i;
  }
  return -1;
}

function parseMoney(value: string): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const hasParens = raw.startsWith("(") && raw.endsWith(")");
  const cleaned = raw
    .replace(/[,$\s]/g, "")
    .replace(/^\(/, "")
    .replace(/\)$/, "");

  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return hasParens ? -Math.abs(parsed) : parsed;
}

function parseDate(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const slashMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slashMatch) {
    const a = Number(slashMatch[1]);
    const b = Number(slashMatch[2]);
    const yearRaw = Number(slashMatch[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;

    let month = a;
    let day = b;
    if (a > 12 && b <= 12) {
      month = b;
      day = a;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function parseOfxDate(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const digits = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!digits) return "";

  return `${digits[1]}-${digits[2]}-${digits[3]}`;
}

function detectBankImportFormat(text: string, fileName?: string): BankImportFormat {
  const lowerName = String(fileName || "").toLowerCase();
  if (lowerName.endsWith(".qbo") || lowerName.endsWith(".ofx")) return "ofx";

  const probe = String(text || "").slice(0, 3000).toUpperCase();
  if (probe.includes("<OFX>") || probe.includes("<STMTTRN>") || probe.includes("OFXHEADER:")) {
    return "ofx";
  }

  return "csv";
}

function extractTagValue(block: string, tagName: string): string {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withClose = new RegExp(`<${escaped}>([^<\\r\\n]+)</${escaped}>`, "i");
  const inline = new RegExp(`<${escaped}>([^<\\r\\n]+)`, "i");
  const closedMatch = block.match(withClose);
  if (closedMatch) return closedMatch[1].trim();
  const inlineMatch = block.match(inline);
  return inlineMatch ? inlineMatch[1].trim() : "";
}

function parseBankOfx(text: string): ParsedBankCsv {
  const input = String(text || "");
  const upper = input.toUpperCase();
  if (!upper.includes("<STMTTRN>")) {
    return { rows: [], skippedRows: 0 };
  }

  const chunks = input.split(/<STMTTRN>/i).slice(1);
  const rows: BankImportRow[] = [];
  let skippedRows = 0;

  chunks.forEach((chunk, idx) => {
    const block = chunk.split(/<\/STMTTRN>/i)[0] || chunk;
    const date = parseOfxDate(extractTagValue(block, "DTPOSTED") || extractTagValue(block, "DTUSER"));
    const externalId = extractTagValue(block, "FITID");
    const description =
      extractTagValue(block, "NAME") ||
      extractTagValue(block, "MEMO") ||
      externalId;
    const amountRaw = extractTagValue(block, "TRNAMT");
    const amount = parseMoney(amountRaw);

    if (!date || !description || amount == null || !Number.isFinite(amount) || amount === 0) {
      skippedRows += 1;
      return;
    }

    rows.push({
      id: `bank-${idx + 1}`,
      sourceLine: idx + 1,
      date,
      description,
      amount: Math.round(amount * 100) / 100,
      rawAmount: amountRaw,
      externalId: externalId || undefined,
    });
  });

  return { rows, skippedRows };
}

function signedAmountForTransaction(txn: Pick<Transaction, "type" | "amount">) {
  const amount = Number(txn.amount || 0);
  if (txn.type === "Income" || txn.type === "Owner Contribution") return amount;
  if (txn.type === "Expense" || txn.type === "Owner Draw") return -amount;
  return 0;
}

function toUtcDay(dateIso: string) {
  const [year, month, day] = String(dateIso || "").split("-").map(Number);
  if (!year || !month || !day) return Number.NaN;
  return Date.UTC(year, month - 1, day) / 86400000;
}

function dayDiff(a: string, b: string) {
  const dayA = toUtcDay(a);
  const dayB = toUtcDay(b);
  if (!Number.isFinite(dayA) || !Number.isFinite(dayB)) return Number.POSITIVE_INFINITY;
  return Math.abs(dayA - dayB);
}

function descriptionSimilarity(a: string, b: string) {
  const tokensA = new Set(
    String(a || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3),
  );
  const tokensB = new Set(
    String(b || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3),
  );

  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) overlap += 1;
  });
  return overlap / Math.max(tokensA.size, tokensB.size);
}

export function parseBankCsv(text: string): ParsedBankCsv {
  const rows = parseCsv(text || "");
  if (rows.length === 0) return { rows: [], skippedRows: 0 };

  const headers = rows[0] || [];
  const dateIdx = headerIndex(headers, ["date", "transaction date", "posted date", "posting date"]);
  const descriptionIdx = headerIndex(headers, ["description", "transaction description", "memo", "details", "payee", "name"]);
  const amountIdx = headerIndex(headers, ["amount", "transaction amount", "amt"]);
  const debitIdx = headerIndex(headers, ["debit", "withdrawal", "outflow", "payment"]);
  const creditIdx = headerIndex(headers, ["credit", "deposit", "inflow"]);

  const parsedRows: BankImportRow[] = [];
  let skippedRows = 0;

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const date = parseDate(dateIdx >= 0 ? row[dateIdx] : "");
    const description = String(descriptionIdx >= 0 ? row[descriptionIdx] : "").trim();

    const debitAmount = debitIdx >= 0 ? parseMoney(row[debitIdx]) : null;
    const creditAmount = creditIdx >= 0 ? parseMoney(row[creditIdx]) : null;
    const directAmount = amountIdx >= 0 ? parseMoney(row[amountIdx]) : null;

    let signedAmount: number | null = null;
    if (debitAmount != null || creditAmount != null) {
      signedAmount = Number(creditAmount || 0) - Number(debitAmount || 0);
    } else {
      signedAmount = directAmount;
    }

    if (!date || !description || signedAmount == null || !Number.isFinite(signedAmount) || signedAmount === 0) {
      skippedRows += 1;
      continue;
    }

    parsedRows.push({
      id: `bank-${i + 1}`,
      sourceLine: i + 1,
      date,
      description,
      amount: Math.round(signedAmount * 100) / 100,
      rawAmount:
        (amountIdx >= 0 ? row[amountIdx] : "") ||
        [creditIdx >= 0 ? row[creditIdx] : "", debitIdx >= 0 ? row[debitIdx] : ""].filter(Boolean).join(" / "),
    });
  }

  return { rows: parsedRows, skippedRows };
}

export function parseBankStatement(text: string, fileName = ""): ParsedBankImport {
  const format = detectBankImportFormat(text, fileName);
  const parsed = format === "ofx" ? parseBankOfx(text) : parseBankCsv(text);
  return {
    ...parsed,
    format,
  };
}

export function bankImportIdFromExternalId(externalId?: string): string {
  const normalized = String(externalId || "").trim();
  if (!normalized) return "";
  return `ofx:${normalized}`;
}

export function findExistingImportedBankRows(
  rows: BankImportRow[],
  transactions: Array<Pick<Transaction, "id"> & { bankImportId?: string }>,
): Record<string, string> {
  const txnIdByBankImportId: Record<string, string> = {};
  transactions.forEach((txn) => {
    const key = String(txn.bankImportId || "").trim();
    if (!key || txnIdByBankImportId[key]) return;
    txnIdByBankImportId[key] = txn.id;
  });

  const existingByRowId: Record<string, string> = {};
  rows.forEach((row) => {
    const bankImportId = bankImportIdFromExternalId(row.externalId);
    if (!bankImportId) return;
    const existingTxnId = txnIdByBankImportId[bankImportId];
    if (existingTxnId) {
      existingByRowId[row.id] = existingTxnId;
    }
  });

  return existingByRowId;
}

export function suggestBankTransactionTypeAndCategory(amount: number, description: string): SuggestedBankTransaction {
  const normalized = String(description || "").toLowerCase();
  const isIncome = Number(amount || 0) > 0;

  if (isIncome) {
    if (/rent|lease/.test(normalized)) {
      return { type: "Income", category: "Rents received" };
    }
    return { type: "Income", category: "Other income" };
  }

  if (/utilit|electric|water|gas|sewer|trash|internet/.test(normalized)) {
    return { type: "Expense", category: "Utilities" };
  }
  if (/repair|maintenance|plumb|hvac|paint|lawn|landscap/.test(normalized)) {
    return { type: "Expense", category: "Repairs" };
  }
  if (/insur/.test(normalized)) {
    return { type: "Expense", category: "Insurance" };
  }
  if (/tax/.test(normalized)) {
    return { type: "Expense", category: "Taxes" };
  }

  return { type: "Expense", category: "Other expenses" };
}

export function matchBankRowsToTransactions(
  rows: BankImportRow[],
  transactions: Array<Pick<Transaction, "id" | "date" | "type" | "amount" | "description">>,
  options?: BankMatchOptions,
): Record<string, BankMatch> {
  const amountTolerance = options?.amountTolerance ?? 0.01;
  const daysWindow = options?.daysWindow ?? 5;
  const minimumConfidence = options?.minimumConfidence || "medium";
  const confidenceRank: Record<BankMatch["confidence"], number> = { low: 1, medium: 2, high: 3 };
  const matches: Record<string, BankMatch> = {};
  const candidates: Array<{ rowId: string; match: BankMatch }> = [];

  rows.forEach((row) => {
    transactions.forEach((txn) => {
      const txnSignedAmount = signedAmountForTransaction(txn);
      const amountDiff = Math.abs(txnSignedAmount - row.amount);
      if (amountDiff > amountTolerance) return;

      const txnDayDiff = dayDiff(txn.date, row.date);
      if (txnDayDiff > daysWindow) return;

      const similarity = descriptionSimilarity(row.description, txn.description);
      const score = 100 - txnDayDiff * 10 - amountDiff * 1000 + similarity * 25;

      let confidence: BankMatch["confidence"] = "low";
      if (txnDayDiff <= 1 && (similarity >= 0.3 || amountDiff <= 0.005)) confidence = "high";
      else if (txnDayDiff <= 3 && (similarity >= 0.1 || txnDayDiff <= 1)) confidence = "medium";

      if (confidenceRank[confidence] < confidenceRank[minimumConfidence]) return;

      candidates.push({
        rowId: row.id,
        match: {
          transactionId: txn.id,
          score,
          dayDiff: txnDayDiff,
          confidence,
        },
      });
    });
  });

  candidates.sort((a, b) => {
    if (b.match.score !== a.match.score) return b.match.score - a.match.score;
    if (a.match.dayDiff !== b.match.dayDiff) return a.match.dayDiff - b.match.dayDiff;
    return a.rowId.localeCompare(b.rowId);
  });

  const usedRows = new Set<string>();
  const usedTransactions = new Set<string>();
  candidates.forEach((candidate) => {
    if (usedRows.has(candidate.rowId)) return;
    if (usedTransactions.has(candidate.match.transactionId)) return;
    matches[candidate.rowId] = candidate.match;
    usedRows.add(candidate.rowId);
    usedTransactions.add(candidate.match.transactionId);
  });

  return matches;
}
