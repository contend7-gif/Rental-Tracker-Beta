import { toLocalIsoDate } from "../lib/localDate.ts";

export function daysUntil(dateString, fromDateString = toLocalIsoDate()) {
  const today = new Date(`${fromDateString}T00:00:00`);
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateString}T00:00:00`);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((target.getTime() - today.getTime()) / msPerDay);
}

export function formatDaysLeft(daysLeft) {
  if (Number.isNaN(daysLeft)) return "Unknown";
  if (daysLeft < 0) return `${Math.abs(daysLeft)}d overdue`;
  if (daysLeft === 0) return "Due today";
  return `${daysLeft}d left`;
}

export function nextMonthSameDay(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

export function monthKey(dateStr) {
  return (dateStr || "").slice(0, 7);
}

export function addMonths(dateStr, monthsToAdd) {
  const [y, m, d] = (dateStr || "").split("-").map(Number);
  const base = new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
  base.setUTCMonth(base.getUTCMonth() + monthsToAdd);
  return base.toISOString().slice(0, 10);
}

export function daysBetween(dateA, dateB) {
  const left = new Date(`${dateA}T00:00:00Z`);
  const right = new Date(`${dateB}T00:00:00Z`);
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return null;
  return Math.round((right.getTime() - left.getTime()) / 86400000);
}
