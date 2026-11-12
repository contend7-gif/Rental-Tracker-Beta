const CASH_TYPES = ["Owner Draw", "Owner Contribution", "Transfer"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_PATTERN = MONTHS.map(month => `${month.slice(0, 3)}(?:${month.slice(3)})?`).join("|");
const DATE_PATTERN = `\\b(?:20\\d{2}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}/20\\d{2}|(?:${MONTH_PATTERN})\\.?\\s+\\d{1,2},?\\s+20\\d{2})\\b`;

export function validConfirmationDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function parseDate(text) {
  const raw = String(text).trim();
  let value = raw;
  const numeric = raw.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
  const named = raw.match(new RegExp(`^(${MONTH_PATTERN})\\.?\\s+(\\d{1,2}),?\\s+(20\\d{2})$`, "i"));
  if (numeric) value = `${numeric[3]}-${numeric[1].padStart(2, "0")}-${numeric[2].padStart(2, "0")}`;
  if (named) value = `${named[3]}-${String(MONTHS.findIndex(month => month.startsWith(named[1].slice(0, 3).toLowerCase())) + 1).padStart(2, "0")}-${named[2].padStart(2, "0")}`;
  return validConfirmationDate(value) ? value : "";
}

export function accountRouteKey(value) {
  return String(value || "").toLowerCase().replace(/\b(?:your|account|ending|in|number)\b/g, "").replace(/[^a-z0-9]/g, "");
}

export function sanitizeCashMovementRules(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap(rule => {
    if (!rule || !CASH_TYPES.includes(rule.type)) return [];
    const next = Object.fromEntries(["id", "fromAccount", "toAccount", "propertyId", "unit"].map(key => [key, String(rule[key] || "").trim().slice(0, 120)]));
    if (!next.id || !next.propertyId || !next.unit || !accountRouteKey(next.fromAccount) || !accountRouteKey(next.toAccount) || accountRouteKey(next.fromAccount) === accountRouteKey(next.toAccount)) return [];
    return [{ ...next, type: rule.type, ...(CASH_TYPES.includes(rule.reverseType) ? { reverseType: rule.reverseType } : {}) }];
  });
}

export function matchCashMovementRule(rules, { fromAccount, toAccount, propertyId, unit }) {
  const from = accountRouteKey(fromAccount), to = accountRouteKey(toAccount);
  if (!from || !to || from === to) return null;
  const matches = sanitizeCashMovementRules(rules).flatMap(rule => {
    if (rule.propertyId !== propertyId || rule.unit !== unit) return [];
    if (accountRouteKey(rule.fromAccount) === from && accountRouteKey(rule.toAccount) === to) return [{ rule, type: rule.type }];
    if (rule.reverseType && accountRouteKey(rule.fromAccount) === to && accountRouteKey(rule.toAccount) === from) return [{ rule, type: rule.reverseType }];
    return [];
  });
  return matches.length && new Set(matches.map(match => match.type)).size === 1 ? matches[0] : null;
}

export function parsePaymentConfirmation(raw) {
  const text = String(raw || "").trim().slice(0, 20000);
  const warnings = [];
  const amountPattern = "(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{2})?";
  const money = new RegExp(`\\$\\s*(-?${amountPattern})(?!\\d|[.,]\\d|[ \t]+\\d)`, "g");
  const amounts = [...new Set([...text.matchAll(money)].map(match => Math.abs(Number(match[1].replaceAll(",", "")))) .filter(value => Number.isFinite(value) && value > 0))];
  const labelledAmounts = [...text.matchAll(new RegExp(`(?:transfer amount|payment amount|amount|sent you|paid you|you received|payment of|transfer of)\\s*[:\\-]?\\s*\\$\\s*(${amountPattern})(?!\\d|[.,]\\d|[ \t]+\\d)`, "gi"))].map(match => Number(match[1].replaceAll(",", "")));
  const preferredAmounts = [...new Set(labelledAmounts.filter(value => value > 0))];
  const amount = preferredAmounts.length === 1 ? preferredAmounts[0] : amounts.length === 1 ? amounts[0] : null;
  if (!amount) warnings.push(amounts.length > 1 ? "Multiple amounts found. Enter the payment amount after reviewing the source." : "No clear payment amount found.");
  const allDates = [...new Set([...text.matchAll(new RegExp(DATE_PATTERN, "gi"))].filter(match => !/(?:due(?: date)?|scheduled(?: for)?|expected(?: on)?)\s*[:\-]?\s*$/i.test(text.slice(Math.max(0, match.index - 35), match.index))).map(match => parseDate(match[0])).filter(Boolean))];
  const preferredDates = [...new Set([...text.matchAll(new RegExp(`(?:payment date|transfer date|processed(?: successfully)?(?: on)?|posted(?: on)?|received(?: on)?)\\s*[:\\-]?\\s*(${DATE_PATTERN})`, "gi"))].map(match => parseDate(match[1])).filter(Boolean))];
  const date = preferredDates.length === 1 ? preferredDates[0] : allDates.length === 1 ? allDates[0] : "";
  if (!date) warnings.push("Choose the actual payment date; the source does not identify one unambiguously.");
  const negative = /\b(?:cancelled|canceled|failed|declined|rejected|not completed|not processed|unsuccessful)\b/i.test(text);
  const initiated = /\b(?:scheduled|pending|initiated|processing|will be|expected|on (?:its|the) way|in transit|request(?:ed)?|submitted)\b/i.test(text);
  const completed = /\b(?:successfully|completed|processed|posted|you received|paid you|sent you|received a payment)\b/i.test(text);
  const status = negative ? "failed" : initiated ? "initiated" : completed ? "completed" : "unknown";
  if (status !== "completed") warnings.push("This is not clear evidence of a completed payment. Keep it as a draft until completion is confirmed.");
  const provider = /\bvenmo\b/i.test(text) ? "Venmo" : /\bfidelity\b/i.test(text) ? "Fidelity" : "";
  const route = text.match(/\bfrom\s*:?\s+([^\n:;$]{2,100}?)\s+(?:to\s*:?|->|\u2192)\s+([^\n:;$.]{2,100})/i);
  const cleanAccount = value => String(value || "").split(/\s+(?:on|was|has|for|processed|completed|successfully|initiated|scheduled|pending|processing)\b/i)[0].trim().replace(/[,\s]+$/, "");
  const reference = text.match(/(?:transaction|confirmation|reference|transfer)\s*(?:id|number|#|no\.?)\s*[:#]?\s*([a-z0-9-]{6,80})/i)?.[1] || "";
  const rent = /\brent\b/i.test(text) && !/\b(?:cash.?out|withdrawal|bank transfer)\b/i.test(text);
  // Require a month next to 'rent'; a payment's calendar date alone is not a rent allocation.
  const rentMonthMatch = text.match(new RegExp(`(?:rent\\s+(?:for\\s+)?(${MONTH_PATTERN})\\.?\\s*(20\\d{2})?|(${MONTH_PATTERN})\\.?\\s*(20\\d{2})?\\s+rent)`, "i"));
  const monthName = rentMonthMatch?.[1] || rentMonthMatch?.[3];
  const explicitYear = rentMonthMatch?.[2] || rentMonthMatch?.[4];
  const monthIndex = monthName ? MONTHS.findIndex(month => month.startsWith(monthName.slice(0, 3).toLowerCase())) : -1;
  const year = explicitYear || (date && monthIndex >= 0 && Math.abs(monthIndex + 1 - Number(date.slice(5, 7))) <= 6 ? date.slice(0, 4) : "");
  const rentPeriod = rent && monthName && year ? `${year}-${String(MONTHS.findIndex(month => month.startsWith(monthName.slice(0, 3).toLowerCase())) + 1).padStart(2, "0")}` : "";
  if (rent && !rentPeriod) warnings.push("Choose which rent month this payment covers.");
  if (rentPeriod && !explicitYear) warnings.push("Rent year was inferred from the payment date. Review the rent month, especially at year-end.");
  return { amount: amount == null ? "" : amount.toFixed(2), date, status, provider, reference, fromAccount: cleanAccount(route?.[1]), toAccount: cleanAccount(route?.[2]), type: rent ? "Income" : route ? "Transfer" : "", category: rent ? "Rents received" : route ? "Transfer" : "", rentPeriod, warnings };
}

export function confirmationDuplicateCandidates(draft, transactions, editingId = "") {
  const ref = String(draft.sourceConfirmation?.reference || "").toLowerCase().trim().slice(0, 120);
  const provider = String(draft.sourceConfirmation?.provider || "").toLowerCase().trim().slice(0, 120);
  return transactions.filter(tx => tx.status !== "voided" && tx.id !== editingId).flatMap(tx => {
    const legacyText = `${tx.description || ""}\n${tx.notes || ""}\n${tx.invoiceRef || ""}`.toLowerCase();
    const legacyReference = /^[a-z0-9-]{6,120}$/.test(ref) && ["venmo", "fidelity"].includes(provider) && legacyText.includes(provider) && new RegExp(`(^|[^a-z0-9])${ref}($|[^a-z0-9])`, "i").test(legacyText);
    const sameReference = Boolean(ref && provider && ((String(tx.sourceConfirmation?.reference || "").toLowerCase() === ref && String(tx.sourceConfirmation?.provider || "").toLowerCase() === provider) || legacyReference));
    const sameScope = tx.propertyId === draft.propertyId && tx.unit === draft.unit;
    const days = Math.abs(Date.parse(tx.date) - Date.parse(draft.date)) / 86400000;
    const amountMatches = Number(draft.amount) > 0 && Math.abs(Number(tx.amount) - Number(draft.amount)) < 0.005;
    const sameRoute = !draft.fromAccount || !tx.fromAccount || (accountRouteKey(draft.fromAccount) === accountRouteKey(tx.fromAccount) && accountRouteKey(draft.toAccount) === accountRouteKey(tx.toAccount));
    if (sameReference || (sameScope && tx.type === draft.type && amountMatches && days <= 5 && sameRoute)) return [{ transaction: tx, exact: sameReference }];
    return [];
  });
}

export function confirmationDuplicateKey(form, candidates) {
  return JSON.stringify([form.propertyId, form.unit, form.type, form.date, String(form.amount), form.fromAccount, form.toAccount, candidates.map(item => [item.transaction.id, item.transaction.date, item.transaction.amount]).sort()]);
}

export function confirmationSaveIssue(form, transactions, editingId = "", todayIso = "") {
  if (CASH_TYPES.includes(form.type) && accountRouteKey(form.fromAccount) && accountRouteKey(form.fromAccount) === accountRouteKey(form.toAccount)) return "Choose two different accounts for a cash movement.";
  if (!form.sourceConfirmation?.text) return "";
  if (form.sourceConfirmation.status !== "completed") return "Confirm that the payment completed before posting it. Your draft can be kept without posting.";
  if (!validConfirmationDate(form.date) || (todayIso && form.date > todayIso)) return "Choose the actual completed payment date, on or before today.";
  if (form.type === "Income" && form.category === "Rents received" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(form.rentPeriod || ""))) return "Choose the rent month this payment covers before saving.";
  const candidates = confirmationDuplicateCandidates(form, transactions, editingId);
  if (candidates.some(candidate => candidate.exact)) return "This confirmation reference is already recorded. Open the existing entry instead.";
  if (candidates.length && form.confirmationDuplicateAcknowledged !== confirmationDuplicateKey(form, candidates)) return "Review the possible duplicate and confirm this is a separate payment before saving.";
  return "";
}

export function cashMovementBankSuggestion(row, defaults, rules) {
  const route = parsePaymentConfirmation(row.description);
  const match = matchCashMovementRule(rules, { ...defaults, fromAccount: route.fromAccount, toAccount: route.toAccount });
  if (!match) return null;
  if ((match.type === "Owner Draw" && Number(row.amount) >= 0) || (match.type === "Owner Contribution" && Number(row.amount) <= 0)) return null;
  const account = match.type === "Owner Contribution" ? route.toAccount : route.fromAccount;
  if (accountRouteKey(defaults.paidFrom) !== accountRouteKey(account)) return null;
  return { type: match.type, category: match.type, propertyId: defaults.propertyId, unit: defaults.unit, fromAccount: route.fromAccount, toAccount: route.toAccount, paidFrom: defaults.paidFrom, cashMovementRuleLabel: `${route.fromAccount} to ${route.toAccount}: ${match.type}` };
}

export function rentPaymentSummary({ transactions, propertyId, unit, leaseId, allowUnlinked = false, rentPeriod, editingId, amount, expected, todayIso = "" }) {
  const rows = transactions.filter(tx => tx.status !== "voided" && (!todayIso || tx.date <= todayIso) && tx.id !== editingId && tx.propertyId === propertyId && tx.unit === unit && tx.type === "Income" && tx.category === "Rents received" && (tx.rentPeriod || tx.date.slice(0, 7)) === rentPeriod);
  const ambiguous = Boolean(leaseId && !allowUnlinked && rows.some(tx => !tx.rentLeaseId));
  const recorded = rows.filter(tx => !leaseId || tx.rentLeaseId === leaseId || (allowUnlinked && !tx.rentLeaseId)).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const remaining = expected == null || ambiguous ? null : Math.max(0, Math.round((expected - recorded - Number(amount || 0)) * 100) / 100);
  const credit = expected == null || ambiguous ? null : Math.max(0, Math.round((recorded + Number(amount || 0) - expected) * 100) / 100);
  return { recorded, remaining, credit, ambiguous };
}
