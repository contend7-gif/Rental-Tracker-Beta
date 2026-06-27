# Real Duplex Dry Run Checklist

Use this checklist for v1.37.0 real-record hardening with fictional data only. The goal is to validate a realistic owner-occupied duplex workflow without adding new product behavior.

## Automated Coverage

Run `npm run scenario:dry-run` before the manual pass. The automated scenario checks owner draw/contribution exclusion, mortgage principal exclusion, escrow review behavior, service-period utilities, capital-improvement asset linkage, lease-extension coverage, document-created transaction support, Tax Packet readiness, and backup-normalized record preservation.

The manual checklist still matters for UI behavior, backup export/restore, desktop file handling, and visual review of the end-to-end workflow.

## Fictional Setup

- Start from a clean local test profile.
- Confirm no real owner, tenant, address, bank, loan, or document data is present.
- Create one duplex property using a fictional address, purchase date, purchase price, land value, and current valuation support.
- Add two units, for example Unit 614 and Unit 616.
- Add one owner-occupied period for one unit that overlaps the tax year.
- Add one furnished mid-term lease for the other unit.
- Extend the furnished lease and confirm the lease history shows the original term plus the extension.
- Attach a fictional lease PDF or placeholder document to the lease.

## Real-Record Entries

- Record rent payments tied to the furnished lease.
- Record at least one tenant fee payment, such as a cleaning fee or pet fee, and confirm its accounting treatment.
- Enter a shared utility bill with a service period that spans more than one month.
- Attach the fictional utility bill document to the transaction.
- Confirm the utility remains tax-relevant and uses the service period for review.
- Record one mortgage payment with interest, principal, and escrow split.
- Confirm mortgage principal does not appear as a Schedule E expense.
- Confirm mortgage interest is sourced from the loan payment or reviewed year-end override.
- Confirm escrow deposits do not flow to property tax or insurance until reviewed.
- Add escrow review amounts for property tax and insurance, then confirm those reviewed amounts appear in Tax Center support.
- Record an owner contribution and confirm it stays ledger-only.
- Record an owner draw and confirm it stays ledger-only.
- Record one ordinary repair with a receipt document attached.
- Record one capital improvement and confirm Review Center asks for an asset until the asset exists.
- Create an asset from the capital-improvement transaction and confirm the review warning clears.

## Documents

- Upload or attach fictional support for the lease, utility bill, repair, capital improvement, and loan or escrow review.
- Create at least one transaction from a document suggestion and confirm the source document is automatically attached.
- Confirm document links show the created transaction as linked or related support.
- Run document cleanup queues and resolve missing OCR, missing tag, or safe suggestion items that apply.

## Review Center

- Open Review Center and check Transactions, Documents, Assets, Maintenance, Leases, Loans, and Tax queues.
- Resolve missing receipts, service-period warnings, asset-needed warnings, occupancy gaps, and loan escrow review items.
- Confirm Mark reviewed only appears when no blocking cleanup issue remains.
- Confirm Review Center totals reach zero or only show intentional non-blocking items.

## Tax Center

- Open Tax Center Overview and confirm readiness reflects the Review Center state.
- Check Schedule E lines for rent, fees, utilities, repairs, mortgage interest, reviewed escrow taxes, reviewed escrow insurance, and depreciation.
- Confirm owner draw, owner contribution, mortgage principal, transfers, and capital improvements do not appear as current Schedule E expenses.
- Open Details rows and confirm each tax line points back to the supporting source record.
- Open Loans & Escrow and confirm escrow review support is visible.
- Open Tax Packet and confirm the packet state is Ready to print only after cleanup is resolved.
- Print or preview the fictional Tax Prep Packet.

## Backup And Restore

- Export a backup after the fictional duplex workflow is complete.
- Validate the latest backup and confirm it reports valid or valid with warnings only for intentionally missing fictional document files.
- Restore the backup into a clean local test profile.
- Confirm the restored property, units, owner period, lease extension, payments, mortgage payment, documents, asset, review state, and Tax Packet readiness match the original test profile.

## Release Gate

- Run `npm run privacy:scan`.
- Run `npm run bug:sweep`.
- Run `npm run scenario:dry-run`.
- Run `npm test`.
- Run `npm run build`.
- Run `npm run smoke:ci`.
