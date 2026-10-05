# Loans, Tax Center, and Planning refresh

Local changes only. No release, installation, or live database mutation. Desktop checks use disposable fictional profiles.

## User-facing changes

- Loans: compact teal mode navigation and summary tiles; readable responsive loan rows; history, review issues, and schedules open in a focused record panel. Escape and Close return focus to the initiating control, or the selected mode after Manage loan changes modes. Payment history can load older payment dates beyond the first eight. Existing balance reconciliation, tax totals, payment grouping, and future-payment exclusions remain.
- Tax Center: compact primary and secondary navigation, next actions above the readiness checklist, and summary tiles that wrap before their values become cramped. Blocking issues, source warnings, support warnings, preliminary status, exports, and source drilldowns remain distinct.
- Planning: horizon control beside the working plan and export actions; primary views and scenario tools share one navigation strip. Current-versus-planned cash flow remains near the headline metrics. Scenario tools and horizon changes preserve the current working plan.
- Depreciation: uses the same compact mode navigation. Shared mode navigation supports arrow keys, Home, and End with visible focus.

## Bugs found during verification

1. Planning health divided selected-horizon cash flow by 12 even for 24- and 36-month plans, overstating the monthly warning and potentially changing its severity. Health now uses the selected horizon when given a horizon total. First-year fallback amounts still divide by 12, and invalid or omitted periods retain the 12-month default. Forecast totals, reserve estimates, and debt calculations are unchanged.
2. The loan payment picker normalized its value by replacing the draft and clearing the editing identifier. Opening a saved payment could become a new-payment form. Picker normalization now preserves an existing draft's date, components, and editing identifier. Explicitly selecting another loan retains the existing reset behavior.

## Validation

- 740 automated checks passed, including 12/24/36-month Planning health warnings and invalid-period/fallback coverage.
- Type checks and the final packaged desktop build passed.
- Packaged navigation and layout checks passed at 1920×1200, 1440×900, 1024×900, and 720×900 with no page-wide horizontal overflow. Screenshots were visually inspected.
- Four focused packaged workspace checks and all 32 packaged app-wide workflows passed after the Planning and payment-edit fixes. They verify older history access, payment edits updating the existing record without duplication, nested loan editor focus, panel dismissal, all workspace modes, and 24/36-month warnings matching the displayed monthly average. The suite also covers Home, scope navigation, leases, transactions, documents/PDF previews, maintenance, backup, and restart persistence.
- Local release smoke passed for metadata, workflow, manual QA references, Electron bridges, and packaged artifacts. This does not mean a release has been published.
- UI scan returned 17 advisory items, including subtle header/property gradients, header overflow for popovers, and headline/fallback typography. Existing colors and mild gradients were retained intentionally. The scan is advisory rather than a release gate.

Evidence is saved under `output/playwright/workspace-refresh-*.log`; screenshots use `loans-refresh-*`, `tax-center-refresh-*`, `planning-refresh-*`, and `loan-history-720.png`.
