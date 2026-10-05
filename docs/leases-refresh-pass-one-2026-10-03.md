# Leases workspace and detail refresh

Local and unpublished. The main lease screen is now an agreement list rather than a combined rent roll and occupancy audit. No installed records were changed.

## Behavior

- Compact Active / Upcoming / Past / All filters with counts, tenant/property/unit search, tenant initials and a responsive agreement list. Records with incomplete or inconsistent dates have an explicit Dates need review filter.
- Every scoped agreement remains available, including overlaps and multiple future bookings for one unit. Agreement classification uses today and existing effective-end rules, independently of the occupancy audit year. Monthly, full-term and custom rent labels retain the existing term/billing presentation.
- Review labels come from the exact lease's existing tenant-ledger review issues. No new paid/unpaid or outstanding-balance calculations were introduced.
- Thirty-record paging preserves the complete searchable list and resets appropriately when filters/search change.
- Add lease chooses a physical unit in the current scope, or uses the explicitly selected unit. It opens the existing draft editor; adding a record still requires Save.
- Occupancy & coverage is a secondary view. Timelines never expand automatically. Existing month details, lease history, owner/vacancy editing and deletion remain available on demand. Status labels in the coverage view refer to the audit endpoint.
- Automation, reminders, Run now and Work Queue access live in a collapsed Lease management section. Opening the section performs no automation.
- Existing leases now open to a read-only overview with Overview / Payments / Documents / History sections. Edit agreement explicitly reveals the retained form. New agreements open directly to the form. Save/Delete appear during agreement editing, and Save remains available across section changes. Existing ledger posting, document attachments, statement exports and guided extension flows remain in place.

## Verification

739 automated tests passed, including new agreement classification, overlapping agreements, future bookings, actual departures, open-ended terms, incomplete dates, scope and lease-specific review coverage. Packaged checks exercise active/upcoming/past search, long-history pagination, audit disclosure, unit picker cancellation, laptop/narrow screenshots and the existing payment-linked extension persistence/cancellation workflow. The main-screen desktop run passed all 32 workflows. Final verification of both the workspace and detail panel passed all 32 workflows in output/playwright/leases-detail-all-desktop.log.

## Detail panel verification

Focused packaged tests passed for all four sections, read-only opening, payment draft retention across sections, agreement-edit retention across sections, discard/keep-editing protection, new-lease editing and the existing extension posting/restart/cancellation flow. Overview dates respect open-ended agreements and actual departures. Missing deposits and missing ledger entries are labelled as unrecorded rather than zero. Recorded balances identify their ledger basis; the full-term billing label says due upfront instead of implying payment was received. No financial calculation or stored data schema was changed.

Final verification: 739 automated tests, all 32 packaged desktop workflows, type checking, production build/packaging, whitespace checks and packaged release smoke passed. Screenshots cover 1440/1280/720px agreement lists and the 720px lease overview. Screenshots use fictional test records. The update remains local and unpublished.
