# Guided lease extensions — reviewed September 9, 2026

The desktop workflow is available from an existing fixed-term lease billed as one full-term amount. Monthly and recurring leases retain their existing billing workflow; guided extensions do not silently change that contract.

Original dates and rent are captured in `originalTerm`. Repeated extensions store coverage dates, expected departure time, fixed rent, total paid, actual receipt dates, document links and explicit ledger/transaction links. Each correction retains the previous extension and financial records in `extensionRevisions`. New signed PDFs are added without replacing earlier attachments.

For a lease whose end date was already manually extended, enter the original agreement end in the guided form. Matching manual charge/payment entries are presented for explicit confirmation. Ambiguous matches block saving. No existing live record is automatically migrated or changed by this release.

The preview shows dates, charge, receipt, payment status, extension balance and combined rent. Payments may be received before the extension starts. Increasing total paid with a new received date records another receipt while preserving the earlier one. Repeating a save uses the same identifiers. Corrections to reconciled receipts require reopening reconciliation first.

SQLite uses the existing transactional snapshot save. The dialog confirms success only after the current save queue flushes. A failed save remains pending with a retry message; the dialog does not claim that it was saved. All state slices are batched, and the existing SQLite transaction prevents a partially committed set of records.

Cancellation is permitted from the last active extension backward, maintaining continuous agreement coverage. It voids the charge and restores the preceding expected departure. Actual received payments remain tenant credit until a refund is recorded; cancellation does not fabricate a refund or erase income. Canceled extensions and correction history remain visible.

The full-term monthly planning equivalent uses combined rent over the extended duration, while the original billing charge stays unchanged. Dashboard scheduled rent counts extension rent once. Voided charges are excluded from month-end totals and tax posting prompts. Extension receipts cover the linked extension charge rather than silently covering a different unpaid term.

Validation uses fictional data and disposable desktop profiles, including save failure/retry, restart, PDF links, repeated extensions, corrections, payment history, cancellation, conflicting tenants, and reporting. Live records were not modified. Publication evidence is tracked in the release review notes.
