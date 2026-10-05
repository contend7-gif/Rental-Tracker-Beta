# Rental Tracker UI refresh strategy

## Direction

A calm, compact desktop workspace: neutral surfaces, teal for primary actions and selection, readable labels, aligned numbers, and a clear distinction between recorded facts and inferred follow-ups. Keep current routes, saved preferences, keyboard controls, and accounting behavior.

This design plan is based on the current source and the supplied screenshots. The first shared-shell, Home, and Transaction Activity pass is now implemented and verified locally; see `ui-refresh-pass-one-2026-10-03.md`. The broader workspace rollout remains proposed. The verified Spectrum reminder and review-navigation fixes are retained with the local update.

## Observed opportunities

- Small windows currently show Year, Property, and Unit controls in both the sidebar and page header. Navigation becomes a horizontal strip.
- The global styles layer gradients, translucent surfaces, blur, and shadows. Simplifying these would reduce visual competition; any performance benefit needs measurement.
- Header filter labels are 9 px, with several other dashboard labels at 9–11 px. Important labels should remain readable without zooming.
- Home gives six financial metrics equal visual weight, then presents several large panels. Operational status and tax estimates need different levels of emphasis.
- The Calendar reminder combines an inferred missing-payment label with overdue styling. The preceding bug demonstrated how record scope and review navigation can confuse users.

## Shared visual rules

- Use one scope toolbar: Year, Property, Unit, Search, and New. Show a readable scope summary and an explicit reset. Keep list search and saved views within their own workspace.
- Use a compact grouped left navigation on desktop. At narrow widths, use a labelled navigation drawer; retain one scope toolbar and avoid duplicate selectors.
- Use neutral backgrounds, mostly flat surfaces, consistent 8 px corner rounding, and a small spacing scale. Reserve stronger elevation for popovers and dialogs.
- Prefer 13–14 px body and control text, readable 12 px metadata, clear headings, and tabular numerals for money and dates. Use the existing system font stack.
- Give primary actions one consistent treatment. Use neutral secondary controls and clear text labels for important actions; reserve destructive styling for destructive actions.
- Retain side panels, focus restoration, unsaved-edit protection, and explicit retry controls. Place section headings, actions, and form fields consistently.
- Distinguish an actual unit from Shared expense allocation in visible labels. Clearly mark estimates, inferred checks, historical dates, and partial coverage.

## Home layout

1. Compact page header and one scope toolbar.
2. Four operational summaries: rent recorded, rent balance, cashflow, and occupancy. Use existing verified definitions and label the time basis.
3. A task list for actionable follow-ups, with confirmed issues and inferred checks clearly labelled. Keep counts consistent with their source workspace.
4. Rent collection and cashflow with concise explanations of coverage and date basis.
5. Recent transactions and unit/property status in aligned rows.
6. An expandable Tax overview containing the existing deductible expenses, interest, mortgage-paid, depreciation, and Schedule E estimate information. Preserve access to every existing metric.

## Workspace patterns

- Transactions: compact toolbar, saved views, readable table or cards respecting the saved layout preference, clear selection scope, and the existing record panel.
- Documents: file list with status, vendor, date, and links; original preview and review fields in the shared panel. Advanced sections remain deferred until opened.
- Properties and Leases: concise lists, occupancy and lease status, consistent detail panels, and readable edit forms.
- Maintenance: clear list of work orders, priority/due status, and the existing record panel with linked expense and document actions.
- Calendar: distinguish view modes, source filters, and horizon controls. Inferred items should say that a record needs checking rather than assert that payment is missing. Review actions should show their intended destination and preserve scope unless the user explicitly changes it.

## Delivery sequence

| Pass | Deliverable | Review gate |
| --- | --- | --- |
| 1 | Home and Transaction Activity design preview using fictional records at 1440, 1024, and 720 px | Approve layout, density, typography, and visual hierarchy before broad implementation |
| 2 | Shared visual primitives, navigation, scope toolbar, and Home | All existing routes and actions remain reachable; scope and dashboard numbers remain correct |
| 3 | Transactions, Documents, and shared record panels | Search, sorting, paging, saved views, bulk actions, previews, and drafts retain behavior |
| 4 | Properties, Leases, Maintenance, Calendar, and remaining workspaces | Apply the same patterns consistently and preserve specialised workflows |
| 5 | Keyboard, narrow-window, empty/error/loading states, and release verification | Packaged checks, visual inspection, and realistic performance comparison pass |

The first concrete deliverable should be the Home and Transaction Activity preview. Those two screens exercise navigation, scope, metrics, lists, primary actions, and record details, so they can establish the design before applying it throughout the app.

## Acceptance criteria

- One visible global scope control set at each target width; no unexpected scope change after opening a review.
- No clipped controls, overlapping labels, or page-wide horizontal scrolling at supported sizes. Wide tables may scroll within their own container.
- Keyboard users can reach navigation, filters, actions, lists, and panels with visible focus. Closing panels restores focus and guards unfinished work.
- Financial values and recorded data retain their existing calculations. UI changes do not rewrite the database or reinterpret lease terms.
- Existing layout/column/view preferences remain usable. Every moved metric or action has an identifiable destination.
- Packaged regression tests cover the affected workflows. Compare repeated realistic timings with the existing benchmark; report results per workflow rather than assume that visual changes make the app faster.

Each implementation pass should remain independently reviewable and releasable. Publication of the existing bug fix can proceed separately from this broader refresh.
