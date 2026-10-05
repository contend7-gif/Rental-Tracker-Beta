# Properties and unit details refresh

- A compact identity area keeps the property photo, address, type, unit count, selected-date context, and edit/photo actions together.
- Portfolio cards replace the fixed-width comparison table. Each property shows occupancy, cash flow, and open items; selected-property rent/schedule and valuation remain in Overview.
- Compact mode navigation retains Overview, Units & occupancy, Property records, and Photos with their counts.
- Overview includes a unit snapshot with occupancy status, active tenant/schedule, lease ending, and direct access to unit details.
- Unit detail separates Overview, Occupancy history, and Files & work. Current agreement and metrics remain distinct from historical periods. All timeline entries are available in the panel.
- Unit list history is collapsed initially and remains accessible without opening another workspace.
- Linked work orders and documents open their source record and preserve property/unit scope. Panel close restores focus to the opening unit control.
- Existing property/unit editing, archived records, valuations, operating notes, attachments, photos, draft protection, and financial/occupancy calculations remain in place.

Local UI changes only. No release metadata or installed records changed; packaged verification uses isolated fictional profiles.

Validation: 739 automated tests, types, production packaging, and release smoke passed. Properties coverage verifies portfolio selection, Overview/Units/Records/Photos, snapshot and unit-list entry points, all three unit sections, focus restoration, and exact maintenance navigation with property/unit scope retained. Screenshots cover 1920 x 1200, 1440 x 900, 1024 x 900, and 720 x 900 without horizontal page overflow. A final width adjustment keeps unit details within an 800 px panel; the affected Properties and navigation checks passed again.

The full desktop suite finished with 31 passing workflows and one failure in the existing saved-PDF preview restart check: its renderer error collection contains `Failed to load resource: net::ERR_FAILED`. That PDF check failed again on targeted rerun, while Properties and navigation passed. Full release validation is not clean; investigate PDF preview loading before publication.

Resolved in the subsequent PDF preview loading fix: the reported request was an internal Chromium viewer stylesheet. The regression now waits for preview frame load before closing nested previews. Twelve repeated PDF workflows and the complete 32-workflow desktop suite passed; see `pdf-preview-loading-fix-2026-10-04.md`.
