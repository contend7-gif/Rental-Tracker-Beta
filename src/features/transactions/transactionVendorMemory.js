const COUNTERPARTY_STOP_WORDS = new Set([
  "ach",
  "auto",
  "autopay",
  "card",
  "check",
  "debit",
  "deposit",
  "online",
  "payment",
  "pos",
  "purchase",
  "recurring",
  "withdrawal",
]);

export function normalizeTransactionCounterparty(value) {
  const tokens = String(value || "")
    .toLowerCase()
    .replace(/[#*]/g, " ")
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !/^\d+$/.test(token))
    .filter((token) => !COUNTERPARTY_STOP_WORDS.has(token));

  return tokens.slice(0, 5).join(" ");
}

function tokenOverlapScore(left, right) {
  const leftTokens = new Set(String(left || "").split(/\s+/).filter(Boolean));
  const rightTokens = new Set(String(right || "").split(/\s+/).filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1;
  });
  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

export function buildTransactionVendorMemory(transactions) {
  const groups = new Map();

  (transactions || []).forEach((transaction) => {
    if (!transaction || transaction.status === "voided") return;
    const counterparty = String(transaction.vendor || transaction.description || "").trim();
    const key = normalizeTransactionCounterparty(counterparty);
    if (!key || !transaction.category) return;

    const existing = groups.get(key) || {
      key,
      label: counterparty,
      uses: 0,
      lastDate: "",
      type: transaction.type,
      category: transaction.category,
      propertyId: transaction.propertyId,
      unit: transaction.unit || "Shared",
      paidFrom: transaction.paidFrom || "",
      paymentMethod: transaction.paymentMethod || "",
      vendor: transaction.vendor || counterparty,
      capitalImprovement: Boolean(transaction.capitalImprovement),
      deMinimisTreatment: transaction.deMinimisTreatment || "",
    };

    existing.uses += 1;
    if (!existing.lastDate || String(transaction.date || "") >= existing.lastDate) {
      existing.lastDate = String(transaction.date || "");
      existing.label = counterparty;
      existing.type = transaction.type;
      existing.category = transaction.category;
      existing.propertyId = transaction.propertyId;
      existing.unit = transaction.unit || "Shared";
      existing.paidFrom = transaction.paidFrom || "";
      existing.paymentMethod = transaction.paymentMethod || "";
      existing.vendor = transaction.vendor || counterparty;
      existing.capitalImprovement = Boolean(transaction.capitalImprovement);
      existing.deMinimisTreatment = transaction.deMinimisTreatment || "";
    }

    groups.set(key, existing);
  });

  return Array.from(groups.values()).sort((left, right) => {
    if (right.uses !== left.uses) return right.uses - left.uses;
    return String(right.lastDate || "").localeCompare(String(left.lastDate || ""));
  });
}

export function findTransactionVendorMemoryForDescription(description, memories) {
  const key = normalizeTransactionCounterparty(description);
  if (!key) return null;

  const scored = (memories || [])
    .map((memory) => {
      const exact = key.includes(memory.key) || memory.key.includes(key);
      return {
        memory,
        score: exact ? 1 : tokenOverlapScore(key, memory.key),
      };
    })
    .filter((entry) => entry.score >= 0.45)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if ((right.memory.uses || 0) !== (left.memory.uses || 0)) return (right.memory.uses || 0) - (left.memory.uses || 0);
      return String(right.memory.lastDate || "").localeCompare(String(left.memory.lastDate || ""));
    });

  return scored[0]?.memory || null;
}

export function findTransactionVendorMemoryForDraft(draft, memories) {
  const candidates = [
    draft?.vendor,
    draft?.description,
    `${draft?.vendor || ""} ${draft?.description || ""}`,
  ].map((value) => String(value || "").trim()).filter(Boolean);

  for (const candidate of candidates) {
    const match = findTransactionVendorMemoryForDescription(candidate, memories);
    if (match) return match;
  }
  return null;
}

export function applyTransactionVendorMemoryToDraft(draft, memory, categories = {}) {
  if (!memory) return { ...draft };
  const memoryType = categories[memory.type] ? memory.type : draft.type;
  const categoryOptions = categories[memoryType] || [];
  const memoryCategory = categoryOptions.includes(memory.category) ? memory.category : draft.category;
  return {
    ...draft,
    type: memoryType || draft.type,
    category: memoryCategory || draft.category,
    propertyId: memory.propertyId || draft.propertyId,
    unit: memory.unit || draft.unit || "Shared",
    paidFrom: memory.paidFrom || draft.paidFrom,
    paymentMethod: memory.paymentMethod || draft.paymentMethod,
    vendor: memory.vendor || draft.vendor,
    capitalImprovement: memory.capitalImprovement ? "Yes" : (draft.capitalImprovement || "No"),
    deMinimisTreatment: memory.deMinimisTreatment || draft.deMinimisTreatment,
  };
}
