# Modern app update — September 30, 2026

The first modernization pass improves startup loading, review calculations, large lists, and finding records. Database writes, accounting rules, and the installed user profile were not changed.

## Behavior

- Search in the header or Ctrl+K opens a keyboard-accessible search dialog. It finds active transactions, documents (including indexed extracted text), leases, properties, maintenance, screens, and create actions across properties and years. Arrow keys select results; Enter opens the existing workflow; Escape closes. Native modal behavior contains focus and restores it on close.
- Transactions and Documents inbox/library render 50 matching records per page. Changing filters returns to page one. Deletions clamp an out-of-range page. Summary totals and existing bulk operations retain their complete matching scope; document bulk labels explain the scope across pages.
- Opening a completed maintenance result selects History and expands the task.
- Ledger and document search results can update after the input, keeping text entry responsive.
- Transaction issue analysis is shared between readiness, inbox, and row summaries. Tax calculation callbacks stay stable while their source records are unchanged.
- Workspace UI is no longer grouped into the same build chunks as eagerly imported controllers. Views and editors remain behind dynamic imports.

## Measurements and validation

- Initial entry/module-preload JavaScript before: 1,546,991 bytes across 12 files.
- After: approximately 1,188,771 bytes across 3 files, a 23.2% reduction. Minor changes in generated hashes can change the exact byte count.
- This is a build payload measurement, not a measured reduction in installed-app startup time. The main coordinator still produces a large build chunk; further isolation of feature models is a future improvement.
- 728 automated tests passed, including new search, paging, and shared-review regressions. The final review helper was also covered by a focused 19-test rerun.
- All 24 packaged desktop tests passed using disposable fictional-data profiles. The new workflow check covered 123-record paging, filter resets, historical search, keyboard focus, document opening, and completed maintenance navigation.
- Configured type checks, production build, privacy scan, and whitespace checks passed. The UI scan retained 13 existing nonblocking advisories.

## Next separate work

The incremental SQLite save follow-up is described below. Navigation history and remembered workspace state are described below. The subsequent local dialog and detail-panel work is described in [the October 1 follow-up](dialog-and-record-panels-2026-10-01.md).

## Incremental save follow-up

Saves compare incoming snapshots with committed database rows. They insert new records, update changed records, and delete removed records within one SQLite transaction. Unchanged JSON records retain their existing row and timestamp. Settings and workspace payloads also skip unchanged writes. Saves still update their status metadata.

Ordered record IDs are stored separately in the existing app-data table. This preserves prepended records and reordered lists after restart without updating every row's position. Older databases fall back to their existing row order until their next save. Backup formats and schema versions are unchanged; portable restore reconstructs order from the backup arrays. Comparisons read the database rather than trusting an in-memory cache, so rollback and restore cannot leave a stale cache.

`npm run bench:saves` creates temporary fictional databases, excludes initial load and automatic backup creation, and reports median timings over seven saves per operation. The same benchmark ran before and after the persistence change:

| Fictional history | Transactions / audit entries / documents | Edit plus new audit entry before | After | SQLite row changes before / after |
| --- | --- | --- | --- | --- |
| Small | 200 / 400 / 20 | 5.46 ms | 3.43 ms | 1,253 / 5 |
| Medium | 2,000 / 5,000 / 100 | 60.42 ms | 8.10 ms | 14,213 / 5 |
| Large | 10,000 / 20,000 / 500 | 245.49 ms | 33.81 ms | 61,013 / 5 |

The large-history edit benchmark improved by approximately 86%. It measures the backend save path on this machine, not end-to-end UI latency or saves that create a scheduled backup. Snapshots still travel to the backend and are compared in full; this change reduces writes, not all work to constant time. The first save of an older database also initializes ordering metadata.

All 732 automated tests passed. New regressions verify unchanged physical rows, changed indexed fields, explicit deletion, empty replacements, legacy ordering, reopen, deferred audit loading, portable archive/file restoration, transaction-wide rollback after an injected failure, and successful retry. Type checks, build, packaging, privacy scan, and whitespace checks passed.

These changes are included in the v1.9.6 release candidate. Publication is verified separately against the release workflow and installer assets.


## Remembered workspaces and navigation

The header now has Back and Forward controls, with Alt+Left and Alt+Right shortcuts. History retains up to 100 screen visits, restores each visit's year/property/unit scope, and discards forward visits when navigation branches. Keyboard history commands pause while a dialog is open. Repeated navigation to the current screen does not add another visit.

Workspace preferences stay in a session-only memory provider while inactive screens continue to unmount and load lazily. Transactions and Documents retain their tabs and pages; Properties retains the selected property and detail tab; Maintenance retains its mode, queue filter, and expanded work orders. Calendar filters/month, Review Center filters/selection, and Assets/Loans modes also survive screen changes. Existing root-level searches and filters continue to persist between screens. Changing a filter still resets paging, and deleted property selections fall back to a current record.

Scroll restoration runs after lazy workspace content commits. Document review retains only the selected document ID and reloads its file on return; an explicit Close clears that selection. File bytes, draft editors, bulk selections, and confirmation dialogs are not stored in workspace memory. Memory and history clear when the app closes. Changing property resets unit immediately, while restoring a complete navigation scope applies property and unit together without a later effect overwriting the restored unit.

Regression coverage includes Back/Forward scope restoration, keyboard navigation, branch clearing, property tab restoration, later-page restoration, exact scroll restoration after transient notices clear, retained search, and returning from a linked maintenance record to the document review. Pure history tests cover bounded history, boundary commands, and scope preservation.

Validation: all 734 automated tests and all 25 packaged desktop workflows passed. Configured type checks, production build, packaging, privacy scan, and whitespace checks passed; the UI scan retained 13 existing advisory items. All desktop checks used isolated fictional profiles. This validation applies to the v1.9.6 release candidate; publication is verified separately against the release workflow and installer assets.
