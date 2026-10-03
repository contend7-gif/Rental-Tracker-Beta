# Modern app follow-up — October 3, 2026

All six requested improvements are included in the v1.9.7 release candidate. Development checks use temporary fictional profiles and do not modify the installed rental database. Publication is verified separately against the tagged release workflow and installer assets.

## Implemented improvements

1. **Faster document review.** Reuse the currency formatter and defer unopened review sections, including the full manual attachment picker. Once opened, a section retains its controls and edits when collapsed.
2. **Consistent record panels.** Property editing, unit details, lease editing, and maintenance records use the shared side panel. Maintenance records expose linked files and existing edit, document, and expense actions. Closing returns keyboard focus to the initiating control.
3. **Recoverable drafts.** Full transaction entry, lease editing, and loan editing offer explicit Save draft, Restore draft, and Remove saved draft controls. Leaving an edited transaction workspace offers keep editing, save a draft and leave, or discard and leave. Drafts survive navigation and reload in the current window, expire when it closes, and exclude file contents. Restored drafts require review before posting; files must be selected again.
4. **More useful lists.** Transactions and Documents offer named saved filter views. Transaction Activity can switch between cards and a sortable table, with remembered optional columns. Existing bulk actions state that selection spans matching pages.
5. **Clearer feedback.** File previews show loading and local retry controls. Transaction saving shows progress, prevents repeated submissions while saving, retains input after validation failures, and offers an explicit retry. Uncertain save errors advise checking the ledger before retrying.
6. **Keyboard and smaller-window access.** The New menu supports arrow keys, Home, End, and Escape. Ctrl+S saves full transaction entry. Scope filters remain visible at smaller sizes, focus indicators are clearer, panels adapt to narrow windows, and the desktop minimum window size is 640 × 540.

The combined review also corrected an existing missing maintenance icon import on Home and ensured the table uses the existing tax-review eligibility rules. Accounting rules and the database schema are unchanged.

## Verification

All 735 unit tests and all 30 packaged desktop workflows passed. Production packaging, configured type checks, privacy scan, bug sweep, release smoke, benchmark syntax, and whitespace checks passed. The UI scan reports 13 advisory style items, with no blocking result. The desktop workflows cover retained drafts, saved views after restart, missing-file retry, narrow-window keyboard saving, PDF preview after restart, lease extension, maintenance, SQLite persistence, receipt intake, and restore points.

The benchmark methodology and original baseline are in `desktop-performance-2026-10-03.md`; raw reports and logs are under ignored `output/playwright/`.

The final combined package completed one excluded warm-up plus five measured launches of the large fictional profile (10,000 transactions, 20,000 audit entries, 500 documents). Document panel readiness improved from the original 1,397.3 ms median to 914.0 ms (890.4–966.3 ms), approximately 35%. Startup to hydrated controls improved from 1,311.1 ms to 957.6 ms (921.4–981.0 ms), approximately 27%. These are warm-cache, GPU-disabled, local workflow measurements including automation overhead; panel readiness includes loaded file bytes and a visible frame, not completed PDF rendering. Other workflows were not uniformly faster: Documents workspace first-open measured 478.8 ms versus 463.6 ms, and search-open measured 400.6 ms versus 383.3 ms. Do not extrapolate the improvement to every action or other machines.

Final benchmark: `output/playwright/desktop-benchmark-final-modern.json`, `complete: true`, packaged-source SHA-256 `572a1770239971fae4a6f70834e57ded489d1c227f49772ebba1f154cdbc4a27`. The initial final-benchmark attempt stayed incomplete because a late initial release-notes prompt intercepted navigation. The runner now waits for that prompt outside the timed actions; the successful rerun completed all five samples. Invalid benchmark sizes are rejected before generating a report.

Draft retention is explicitly per window, rather than automatic recovery after app shutdown. Saved list views and column preferences are local UI preferences. The table is available in Transaction Activity; other transaction modes retain their existing workflows.
