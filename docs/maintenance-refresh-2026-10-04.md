# Maintenance refresh

- Compact mode navigation retains Active work, History & costs, Cleanup & accounting, and Vendors with their counts.
- Work-order rows show request, property/unit, status, urgent/high priority, overdue cue, first review issue, vendor, due date, cost basis, and one next action. Full accounting forms no longer expand across the list.
- Search covers title, description, notes, property, unit, and vendor. The Show selector retains every existing mode-specific filter.
- The record panel separates Overview, Update & accounting, and Files. Existing status changes, vendor assignment, costs, treatment, reviewed flag, notes, expense/asset handoffs, attachments, and deletion remain available.
- Files offers a selector for all linked files and the existing lazy preview/retry behavior. Closing the panel restores the opening control's focus.
- Calendar and Work Queue focus requests still select the appropriate active/history mode, clear search, and reveal the exact record.
- Creation, document-based drafts, vendors, cleanup grouping, cost rollup, domain calculations, and persistence retain their existing behavior.

Local UI change only; no installed records or release metadata changed. Packaged checks use isolated fictional profiles.

Validation: 739 automated tests, types, production build, and all 32 packaged desktop workflows passed. After final polish, three affected packaged workflows and release smoke passed again. Screenshots cover 1920 x 1200, 1440 x 900, 1024 x 900, and 720 x 900; narrow record updates show no horizontal page overflow. Maintenance coverage verifies search, status/cost edits saved to SQLite, filtering, focus restoration, all four modes, and edits retained after reload.
