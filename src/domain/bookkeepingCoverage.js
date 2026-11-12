import { accountRouteKey, validConfirmationDate } from "./confirmationEntry.js";

export function bookkeepingSignature(transactions) {
  const text = JSON.stringify(transactions.map(tx => [tx.id, tx.propertyId, tx.unit, tx.date, tx.amount, tx.type, tx.category, tx.paidFrom, tx.fromAccount, tx.toAccount, tx.status]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return `review-${(hash >>> 0).toString(16)}`;
}

export function accountReviewKey(propertyId, account) {
  return JSON.stringify([propertyId, accountRouteKey(account)]);
}

export function sanitizeBookkeepingReviews(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).slice(0, 1000).flatMap(([key, value]) => {
    if (!value || typeof value !== "object" || !validConfirmationDate(value.throughDate) || !/^\d{4}-\d{2}-\d{2}T/.test(String(value.reviewedAt || "")) || !/^review-[0-9a-f]+$/.test(String(value.signature || ""))) return [];
    return [[key.slice(0, 300), { throughDate: value.throughDate, reviewedAt: String(value.reviewedAt).slice(0, 40), signature: value.signature }]];
  }));
}

export function buildAccountCoverage({ transactions = [], reconciliations = [], reviews = {}, propertyFilter = "all", todayIso }) {
  const accounts = new Map();
  const inScope = propertyId => propertyFilter === "all" || propertyId === propertyFilter;
  const active = transactions.filter(tx => tx.status !== "voided" && inScope(tx.propertyId) && tx.date <= todayIso);
  for (const tx of active) {
    const label = String(tx.paidFrom || "").trim();
    if (label) accounts.set(accountReviewKey(tx.propertyId, label), { propertyId: tx.propertyId, accountLabel: label });
  }
  for (const record of reconciliations) {
    if (inScope(record.propertyId) && record.accountLabel && record.periodEnd <= todayIso) accounts.set(accountReviewKey(record.propertyId, record.accountLabel), { propertyId: record.propertyId, accountLabel: record.accountLabel });
  }
  return [...accounts.entries()].map(([key, account]) => {
    const rows = active.filter(tx => tx.propertyId === account.propertyId && accountRouteKey(tx.paidFrom) === accountRouteKey(account.accountLabel));
    const closed = reconciliations.filter(record => record.propertyId === account.propertyId && accountRouteKey(record.accountLabel) === accountRouteKey(account.accountLabel) && record.periodEnd <= todayIso).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];
    const review = reviews[key];
    const reviewedRows = review ? rows.filter(tx => tx.date <= review.throughDate) : [];
    const unchanged = Boolean(review && review.throughDate <= todayIso && review.signature === bookkeepingSignature(reviewedRows));
    return { ...account, key, rows, closed, review, unchanged, newerActivity: Boolean(review && rows.some(tx => tx.date > review.throughDate)) };
  });
}

export function ownerDrawMonthReview({ transactions = [], month, propertyFilter = "all", review, todayIso = "" }) {
  const movements = transactions.filter(tx => tx.status !== "voided" && (!todayIso || tx.date <= todayIso) && (propertyFilter === "all" || tx.propertyId === propertyFilter) && tx.date?.slice(0, 7) === month && ["Owner Draw", "Owner Contribution", "Transfer"].includes(tx.type));
  const signature = bookkeepingSignature(movements);
  const currentThrough = todayIso && month === todayIso.slice(0, 7) ? todayIso : "";
  return { count: movements.filter(tx => tx.type === "Owner Draw").length, amount: movements.filter(tx => tx.type === "Owner Draw").reduce((sum, tx) => sum + Number(tx.amount || 0), 0), signature, reviewed: Boolean(review && review.signature === signature && (!todayIso || review.throughDate <= todayIso) && (!currentThrough || review.throughDate === currentThrough)) };
}
