import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const calendarSource = readFileSync(new URL("../features/operations/OperationsCalendarWorkspace.jsx", import.meta.url), "utf8");
const monthViewSource = readFileSync(new URL("../features/operations/OperationsMonthView.jsx", import.meta.url), "utf8");
const closeViewSource = readFileSync(new URL("../features/operations/MonthlyClosePanel.jsx", import.meta.url), "utf8");
const maintenanceSource = readFileSync(new URL("../features/maintenance/MaintenanceWorkspace.jsx", import.meta.url), "utf8");
const documentsSource = readFileSync(new URL("../features/documents/DocumentsWorkspace.jsx", import.meta.url), "utf8");
const ledgerSource = readFileSync(new URL("../features/transactions/LedgerWorkspace.jsx", import.meta.url), "utf8");

test("App forwards reusable workspace focus requests", () => {
  assert.match(appSource, /createWorkspaceFocusRequest\(source, recordId\)/);
  assert.match(appSource, /clearWorkspaceFocus,/);
  assert.match(appSource, /requestWorkspaceFocus,/);
  assert.match(appSource, /workspaceFocus,/);
});

test("Operations Calendar targets exact maintenance, document, and recurring records", () => {
  for (const source of ["maintenance", "document", "recurring"]) {
    assert.match(calendarSource, new RegExp(`requestWorkspaceFocus\\(\"${source}\", item\\.sourceRecordId\\)`));
  }
});

test("Operations Calendar smart checks review the ledger and can be marked intentional", () => {
  assert.match(appSource, /setSearch,/);
  assert.match(calendarSource, /buildRecurringExpenseChecks/);
  assert.match(calendarSource, /setSearch\(item\.searchText \|\| ""\)/);
  assert.match(calendarSource, /recurringExpenseCheckAcknowledgements/);
  assert.match(calendarSource, /Intentional for now/);
  assert.match(calendarSource, /No transaction was created/);
});

test("Operations Calendar exposes agenda, full month, and reversible monthly close views", () => {
  assert.match(calendarSource, />Agenda</);
  assert.match(calendarSource, />Month</);
  assert.match(calendarSource, />Monthly Close</);
  assert.match(monthViewSource, /buildCalendarMonthDays/);
  assert.match(monthViewSource, /Select any item to open its authoritative record/);
  assert.match(closeViewSource, /Changed since close/);
  assert.match(closeViewSource, /Close with open checks/);
  assert.match(closeViewSource, /Reopen month/);
});

test("destination workspaces consume their exact focus request", () => {
  assert.match(maintenanceSource, /workspaceFocus\.recordId/);
  assert.match(maintenanceSource, /scrollIntoView/);
  assert.match(documentsSource, /showDocumentReview\(target\)/);
  assert.match(ledgerSource, /setWorkspaceMode\(\"recurring\"\)/);
  assert.match(ledgerSource, /focusedRecurringTemplateId === template\.id/);
});
