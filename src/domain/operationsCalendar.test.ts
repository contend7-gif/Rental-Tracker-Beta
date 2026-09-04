import assert from "node:assert/strict";
import test from "node:test";

import {
  bucketOperationsCalendarItems,
  applyOperationsFollowUps,
  buildOperationsCalendarItems,
  operationsFollowUpRecord,
  selectOperationsCalendarItems,
} from "./operationsCalendar.ts";

test("operations calendar derives dated work without creating duplicate task records", () => {
  const items = buildOperationsCalendarItems({
    leaseAutomationReminders: [{
      id: "late-1", leaseId: "lease-1", propertyId: "p1", unit: "Unit A", tenantName: "A", kind: "late",
      dueDate: "2026-08-29", daysUntilDue: -1, amount: 900, title: "Late rent: Unit A", message: "$900 unpaid.",
    }],
    leases: [
      { id: "lease-1", propertyId: "p1", unit: "Unit A", tenantName: "A", startDate: "2026-01-01", endDate: "2026-09-30", monthlyRent: 900, rentalType: "Long-term", utilitiesIncluded: false, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
      { id: "lease-open", propertyId: "p1", unit: "Unit B", tenantName: "B", startDate: "2026-01-01", endDate: "2026-09-30", monthlyRent: 900, rentalType: "Long-term", agreementType: "month_to_month", utilitiesIncluded: false, monthToMonthAfterTerm: true, extensionTermMonths: 0, status: "Active", notes: "" },
    ],
    workOrders: [{ id: "wo-1", propertyId: "p1", unit: "Unit A", title: "Repair sink", description: "", priority: "High", status: "Open", reportedOn: "2026-08-20", dueDate: "2026-09-02", createdAt: "2026-08-20T00:00:00Z" }],
    documents: [{ id: "doc-1", propertyId: "p1", name: "Insurance.pdf", type: "Insurance", expiresOn: "2026-09-20" }],
    recurringTemplates: [{ id: "rt-1", description: "Mortgage", propertyId: "p1", unit: "Shared", type: "Expense", category: "Mortgage Interest", amount: 1200, frequency: "Monthly", nextDueDate: "2026-09-01", reviewRequired: true, ownerUsePct: 0, active: true }],
    recurringExpenseChecks: [{ patternKey: "repeat-1234abcd", reviewDate: "2026-09-01", expectedDate: "2026-08-25", lastRecordedDate: "2026-07-25", propertyId: "p1", unit: "Shared", vendor: "Utility Co", category: "Utilities", occurrenceCount: 4 }],
    planningActionItems: [{ id: "pa-1", title: "Review bids", status: "in_progress", priority: "high", dueDate: "2026-09-10", propertyId: "p1" }],
    loans: [{ id: "loan-1", propertyId: "p1", lender: "Bank", loanType: "Primary Mortgage", lienPosition: 1, originatedOn: "2024-01-01", rate: 6, originalBalance: 100000, currentBalance: 99000, scheduledPI: 700, scheduledEscrow: 200, scheduledMortgageInsurance: 0, defaultExtraPrincipal: 0, interestYTD: 0, principalYTD: 0, escrowYTD: 0, nextPayment: "2026-09-01" }],
    backup: { lastRecoverableBackupAt: "2026-08-30T12:00:00.000Z", intervalDays: 3, todayIso: "2026-09-01" },
  });

  assert.ok(items.some((item) => item.eventKind === "lease_start" && item.sourceRecordId === "lease-1"));
  assert.ok(items.some((item) => item.eventKind === "lease_review" && item.sourceRecordId === "lease-1"));
  assert.ok(items.some((item) => item.eventKind === "lease_end" && item.sourceRecordId === "lease-1"));
  assert.ok(items.some((item) => item.eventKind === "lease_start" && item.sourceRecordId === "lease-open"));
  assert.equal(items.some((item) => item.sourceRecordId === "lease-open" && item.eventKind !== "lease_start"), false);
  assert.equal(items.find((item) => item.source === "smart_check")?.searchText, "Utility Co");
  assert.equal(items.find((item) => item.source === "backup")?.date, "2026-09-02");
});

test("operations follow-ups hide handled items, move snoozes, and preserve source dates", () => {
  const items = [{ id: "maintenance:wo-1:2026-09-01", source: "maintenance" as const, sourceRecordId: "wo-1", date: "2026-09-01", title: "Repair", detail: "", propertyId: "p1" }];
  const snoozed = operationsFollowUpRecord(items[0], "snoozed", "2026-09-03", 7);
  const visible = applyOperationsFollowUps(items, { [items[0].id]: snoozed });
  assert.equal(visible[0].date, "2026-09-10");
  assert.equal(visible[0].originalDate, "2026-09-01");
  assert.equal(visible[0].followUpStatus, "snoozed");

  const done = { ...snoozed, status: "done" as const };
  assert.equal(applyOperationsFollowUps(items, { [items[0].id]: done }).length, 0);
  assert.equal(applyOperationsFollowUps(items, { [items[0].id]: done }, { showHandled: true })[0].followUpStatus, "done");
});

test("lease calendar includes lifecycle milestones and adapts review timing for short terms", () => {
  const items = buildOperationsCalendarItems({
    leaseReviewDaysBefore: 60,
    leases: [
      { id: "fixed", propertyId: "p1", unit: "A", tenantName: "Fixed", startDate: "2026-01-01", endDate: "2026-12-31", monthlyRent: 1000, rentalType: "Long-term", agreementType: "fixed_term", utilitiesIncluded: false, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
      { id: "short", propertyId: "p1", unit: "B", tenantName: "Short", startDate: "2026-09-01", endDate: "2026-09-30", monthlyRent: 1200, rentalType: "Mid-term", agreementType: "fixed_term", utilitiesIncluded: true, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Active", notes: "" },
      { id: "transition", propertyId: "p1", unit: "C", tenantName: "Transition", startDate: "2026-01-01", endDate: "2026-10-31", monthlyRent: 1100, rentalType: "Long-term", agreementType: "fixed_then_month_to_month", utilitiesIncluded: false, monthToMonthAfterTerm: true, extensionTermMonths: 0, status: "Active", notes: "" },
      { id: "moved", propertyId: "p1", unit: "D", tenantName: "Moved", startDate: "2026-01-01", endDate: "2026-08-31", actualEndDate: "2026-08-20", monthlyRent: 900, rentalType: "Long-term", agreementType: "fixed_term", utilitiesIncluded: false, monthToMonthAfterTerm: false, extensionTermMonths: 0, status: "Ended", notes: "" },
    ],
  });

  assert.equal(items.find((item) => item.id.startsWith("lease-review:fixed"))?.date, "2026-11-01");
  assert.equal(items.find((item) => item.id.startsWith("lease-review:short"))?.date, "2026-09-21");
  assert.match(items.find((item) => item.id.startsWith("lease-review:transition"))?.title || "", /transition/i);
  assert.equal(items.some((item) => item.id.startsWith("lease-end:transition")), true);
  assert.equal(items.find((item) => item.id.startsWith("lease-move-out:moved"))?.role, "milestone");
  assert.equal(items.some((item) => item.id.startsWith("lease-review:moved") || item.id.startsWith("lease-end:moved")), false);
});

test("operations calendar respects scope, source, and horizon filters", () => {
  const items = [
    { id: "1", source: "maintenance" as const, sourceRecordId: "1", date: "2026-08-29", title: "Late", detail: "", propertyId: "p1", unit: "Unit A" },
    { id: "past-start", source: "lease" as const, sourceRecordId: "lease-1", date: "2026-08-20", title: "Started", detail: "", propertyId: "p1", unit: "Unit A", role: "milestone" as const },
    { id: "2", source: "document" as const, sourceRecordId: "2", date: "2026-09-05", title: "Soon", detail: "", propertyId: "p1", unit: "Unit B" },
    { id: "3", source: "maintenance" as const, sourceRecordId: "3", date: "2026-12-31", title: "Far", detail: "", propertyId: "p1", unit: "Unit A" },
  ];
  const selected = selectOperationsCalendarItems(items, {
    todayIso: "2026-08-30",
    horizonDays: 30,
    propertyFilter: "p1",
    unitFilter: "Unit A",
    sourceFilter: "maintenance",
  });
  assert.deepEqual(selected.map((item) => item.id), ["1"]);
});

test("operations calendar buckets overdue, near-term, and later dates", () => {
  const item = (id: string, date: string) => ({ id, source: "planning" as const, sourceRecordId: id, date, title: id, detail: "", propertyId: "" });
  const buckets = bucketOperationsCalendarItems([
    item("overdue", "2026-08-29"),
    item("today", "2026-08-30"),
    item("week", "2026-09-05"),
    item("month", "2026-09-20"),
    item("later", "2026-11-01"),
  ], "2026-08-30");
  assert.deepEqual(buckets.attention.map((entry) => entry.id), ["overdue", "today"]);
  assert.deepEqual(buckets.next7.map((entry) => entry.id), ["week"]);
  assert.deepEqual(buckets.next30.map((entry) => entry.id), ["month"]);
  assert.deepEqual(buckets.later.map((entry) => entry.id), ["later"]);
});
