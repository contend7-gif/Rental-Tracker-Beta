# Dialog and record-panel follow-up — October 1, 2026

Implemented following v1.9.6 and included in the v1.9.7 release candidate. Publication is verified separately against the tagged release workflow and installer assets.

## Behavior

- Shared dialogs use native modal focus containment and focus restoration. Escape closes only the top dialog. Opening a PDF preview inside a record panel and closing it returns focus to its initiating control.
- Property, unit, photo, asset, loan, full lease, lease-extension, and Quick Add editors ask before discarding changed drafts. Keep editing preserves the draft and restores focus. Quick Add compares its editable fields, excluding automatic bookkeeping defaults.
- Quick Add waits for the save result. Invalid entries remain open with an inline message and retain their input; an active save disables repeated submission and dismissal.
- Document OCR corrections are protected when closing review, moving to the next inbox item, or opening a linked record or draft. A successful correction save establishes a new baseline; rejected corrections stay unsaved. Discarding before opening a linked panel restores the original trigger before opening that panel.
- Transactions and Documents use a shared detail-panel layout. Linked files load through the existing desktop file bridge and can be previewed within the panel or opened in the full viewer. File bytes remain component-local and are excluded from draft comparison and workspace memory.
- Shared form fields and select controls expose accessible names matching their visible labels.

## Scope and limits

Accounting calculations, persistence schema, backup formats, and installed rental data are unchanged. Desktop checks use disposable fictional profiles. Existing document text/tag editors retain their save-on-blur behavior; import review dialogs and inline ledger/occupancy subforms do not gain new discard prompts in this pass. No measured startup or interaction speed improvement is claimed.

## Verification

The new packaged checks cover keyboard focus containment, rejected and successful Quick Add saves, unchanged-form dismissal, keep/discard decisions, persisted transaction counts, saved PDF previews after restart, nested panel focus restoration, and discarded OCR corrections.

All 734 automated tests and all 26 packaged desktop workflows passed. Configured type checks, production build, desktop packaging, privacy scan, and whitespace checks passed. The UI scan retained 13 advisory items. A final Quick Add cleanup also clears the previous validation message on dismissal; its focused desktop regression includes reopening a clean form without a stale message.
