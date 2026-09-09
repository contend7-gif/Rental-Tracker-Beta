# Code sweep — September 5, 2026

This pass scanned 271 production source files under `src` and `electron` for unused bindings, repeated function bodies, and large modules, then inspected document processing, review workflows, monthly-close snapshots, and persistence. Static findings were checked before editing. Earlier bug fixes in this working tree were preserved. Live accounting records were not changed.

## Improvements completed

- **Less repeated document processing.** Batch analysis now extracts fields and utility sections once per document, sharing the results with expense, work-order, and attachment suggestions. No cache survives a batch, so edits are analyzed again. Regression tests compare the combined results with the independent analysis functions.
- **Consistent receipt checks.** Transactions, Maintenance, and Monthly Close share receipt-support rules. Direct document links, shared links, and receipt names count as support; whitespace-only names do not. Batch review builds a reusable index of document links.
- **Reliable close snapshots.** Snapshot signatures now include source-record details, catching category edits and loan breakdown changes even when counts and totals remain unchanged. Record ordering and preview-file hydration do not change the signature. Existing snapshots display “Review updated” and can be refreshed; their original saved metadata is retained until that action.
- **Less obsolete and duplicate code.** Removed 29 unused named imports and one unreferenced date helper. Consolidated the duplicate document-preview classifier into the existing presentation module. Used type imports, historical release notes, sample data, and working features were retained.

## Validation

- 668 automated tests passed, including added snapshot, settings-reload, document-analysis equivalence, and whitespace-receipt regressions.
- Type checks, production build, privacy scan, bug sweep, whitespace checks, packaging, and release smoke passed.
- 14 packaged desktop checks passed: the full 13-check suite plus a new monthly-close restart check. Desktop tests used disposable fictional-data profiles.
- The existing 150-document analysis test measured approximately 1.22 seconds before shared extraction and 0.71 seconds afterward in the initial local comparison. This is a synthetic processing measurement, not a screen-load benchmark or a guaranteed speedup.
- The UI style scan still reports 13 nonblocking advisories in existing layout/style code.

## Larger improvements worth a separate pass

1. **Split the largest modules by responsibility.** `src/App.jsx` remains roughly 2,700 lines, `src/domain/planning.ts` roughly 3,100, and the document controller roughly 1,400. Extract cohesive calculations and workflows with their tests as those areas are changed. A wholesale rewrite has no demonstrated user benefit in this sweep.
2. **Measure and improve large-data saves.** `electron/db.mjs` still deletes and reinserts each collection on a save. Incremental writes may reduce work for larger histories, but should first be benchmarked and verified for deletion handling, rollback, and backup consistency. The authoritative persistence path was left intact.
3. **Consolidate remaining shared calculations deliberately.** Matching date-validation and occupancy-allocation implementations remain in separate modules. Move these behind shared domain functions when their call-site semantics and accounting fixtures have been checked together.

The local desktop build includes the fixes. No release was published.
