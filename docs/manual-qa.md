# Manual QA Checklist

Use this checklist before publishing alpha builds or validating a real-world rental workflow. Keep all test data fictional unless you are working in a private local app database outside the repository.

Before release, run `npm run scenario:dry-run` and `npm run scenario:loan-tax`, then run `docs/real-duplex-dry-run.md` and `docs/loan-tax-reconciliation-qa.md` manually with fictional data. The automated scenarios protect tax/accounting and loan/tax reconciliation invariants, while the manual dry runs still cover UI behavior, backup restore, and desktop file handling.

## Fresh App Flow

- Launch a fresh desktop build.
- Load the fictional sample dataset from the demo-data control.
- Confirm Dashboard shows Getting Started and Tax Readiness panels.
- Complete setup checklist and verify it collapses to Core setup complete.
- Reopen setup checklist from the compact card.
- Complete setup and confirm Getting Started no longer occupies Dashboard.
- Open the full setup checklist from Settings.
- Mark loan or recurring setup item not applicable, then undo it.
- Add a property.
- Add units.
- In Properties, set the annual appreciation rate and confirm projected value updates from the current value.
- Add a property valuation record with a fictional appraisal or assessment source and confirm it can set the current value.
- Attach an existing fictional closing statement or appraisal document to the property and confirm it appears under Property documents.
- In Loans, confirm current property value is read-only, LTV reflects the Properties value, and Update in Properties opens the property record.
- Confirm Loan year-end checks no longer occupy the Loans tab.
- Add a lease.
- Add an owner/vacancy period.
- Add a transaction.
- Upload a document.
- Create a transaction from a document suggestion.
- Create an asset from a capital-improvement transaction.
- Create a work order and linked expense.
- Add a loan payment.
- From Review Center > Loans, expand 1098 / escrow fields and enter year-end 1098 review data.
- Run the loan tax reconciliation checklist in `docs/loan-tax-reconciliation-qa.md` for selected-loan payment attachment, duplicate loan safety, missing payment months, escrow/PMI review, and LTV labels.
- Check Dashboard Tax Readiness.
- Confirm Tax Center opens to Overview tab.
- Move through Tax Center tabs: Schedule E, Details, Depreciation, Loans & Escrow, Tax Packet, and Tools.
- From Schedule E, click Open sources on a line and confirm Details opens filtered to that source line.
- Confirm Tax Packet shows Ready to print, Missing support, or Needs cleanup first at the top.
- Confirm Tax Center Overview/Schedule E/Details/Depreciation/Loans & Escrow/Tax Packet tabs do not show owner statement tools.
- Confirm owner statement tools are available only under Tools or a reporting area.
- Confirm old/legacy Tax Center sections are hidden or under Tools.
- Check Tax Center Schedule E-style summary.
- Export Schedule E detail CSV.
- Export detail CSV.
- Print the Tax Prep Packet.
- Export a backup.
- Validate latest backup.
- Restore the backup into a clean local test profile.
- Attempt to load demo data into a non-empty app and verify destructive confirmation appears.
- Open Settings > Data & backup and confirm Current data status shows fictional sample data while the demo dataset is loaded.
- Enable Real Data Mode and review the First Real Records checklist.
- Before entering actual records, export a backup and validate latest backup.
- Replace the sample dataset only after explicit confirmation, then confirm Current data status moves away from fictional sample data as real records are entered.
- Confirm audit/readiness badges are visible and consistent across Transactions, Documents, Assets, Maintenance, Leases, Loans, and Tax Center source rows.
- Select transaction review rows with blocking issues and confirm bulk review actions remain disabled until the issues are resolved.
- Confirm Activity Log is accessible from Settings/Audit Log.
- Confirm Activity Log is not in primary nav.
- Open Operations Calendar and confirm Agenda, Month, and Monthly Close are separate views.
- In Month, navigate backward and forward, return to Today, and open a calendar item back to its exact source record.
- Confirm fixed-term leases show start, renewal/move-out review, and scheduled end milestones; confirm fixed-then-month-to-month leases label the transition and actual move-outs remain visible only as historical milestones.
- Set the lease review lead time in Settings, confirm short stays use a shorter review window, and confirm setting it to 0 hides the planning reminder without hiding lease starts or ends.
- On a date with more than three items, select + more and confirm every item appears in the selected-day detail panel; use the month picker to jump directly to another month.
- In Monthly Close, review bank-match, receipt, rent, Smart Check, loan, maintenance, and backup checks for the selected month and property scope.
- Close a fictional month with no open checks, change a source record, and confirm the close status changes to Changed since close; refresh the snapshot and then reopen it.
- Close a fictional month with open checks and confirm the snapshot records the visible count without marking those checks fixed or creating transactions.
- Enable Settings > Operations Calendar daily summary, restart with a due non-rent calendar item, and confirm only one quiet summary is delivered for the day.
- Confirm access profile controls are under Settings/Advanced.
- Open Settings and confirm the Workspace, Data & Backup, and Advanced tabs separate daily settings from admin tools.
- On a fresh profile, confirm Mobile Companion defaults to Off and Mobile Inbox is absent from Documents.
- On a previously paired profile, confirm the update preserves the Enabled setting and encrypted connection.
- Open Settings > Admin & Tools > Mobile companion and confirm paired status, Site address, private-token status, Check connection, Update pairing, and Disconnect controls appear without revealing credential values.
- Turn Mobile Companion off and confirm Mobile Inbox is hidden from Documents without deleting the saved pairing; turn it back on and confirm the connection is still available.
- Use Check connection and confirm the desktop reports the number of waiting captures.
- Upload a fictional JPEG or PNG larger than 700 KB from the mobile Site and confirm it is resized before upload and appears in the desktop Mobile Inbox.
- Confirm another user's setup guide requires a separate private Site, D1/R2 storage, sync secret, and private-Site token rather than reusing the maintainer deployment.
- Open Review Center from primary navigation.
- Confirm Review Center summarizes Transactions, Documents, Assets, Maintenance, Leases & Occupancy, Loans, and Tax Center cleanup queues.
- Confirm Review Center rows explain what is wrong, why it matters, and what button fixes it.
- From Review Center, confirm transaction rows show safe fix-in-place buttons only for the matching issue: Mark reviewed, Support unavailable, Use date as period, Mark repair, Mark capital, or Create asset.
- Confirm Mark reviewed only appears when a transaction row has no other blocking cleanup issue.
- From Review Center, open the Documents queue and review the next expense draft.
- In Documents, use Add bill from document to upload a fictional utility bill, follow the Save transaction and attach document path, and confirm the source document is attached automatically.
- Confirm Add bill from document shows guided steps for Upload, OCR draft, Confirm transaction, and Save + attach.
- Confirm the default bill action reads Save transaction and attach document when OCR finds an expense draft.
- Add a second fictional utility bill for the same vendor and confirm the repeated-vendor template applies prior category/unit/payment defaults without changing the OCR amount, date, or selected property.
- From Quick Add, type a repeated fictional vendor name and confirm Apply template fills category/property/unit/payment defaults.
- Enter Owner Draw, Owner Contribution, and Transfer rows and confirm the form describes them as ledger-only items, not deductible rental expenses.
- Enter an Auto and travel expense and confirm the Mileage log support panel shows date, property/unit, trip purpose, miles, rate, and Use mileage total as amount.
- Set Dashboard density to compact and confirm the Dashboard leads with the status strip and keeps detail cards short.
- In Lease History, click a mixed occupancy month and confirm the detail panel shows rented/owner/vacant date ranges.
- Confirm Ledger import defaults to Recommended matching.
- Expand Advanced matching options and confirm strict/standard/lenient are available.
- Restart the app and confirm data persists.
- Run `npm run privacy:scan`.
- Confirm privacy scan passes.
- Run `npm run scenario:dry-run`.
- Run `npm run scenario:loan-tax`.
- Run `npm run smoke:ci`.

## Real-Data Reminder

This app is local-first and intended to organize rental records. Keep your own backups and confirm tax filings with a qualified tax preparer. Do not commit real rental data, tenant names, property addresses, documents, exports, databases, API keys, or private notes to the repository.
