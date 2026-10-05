# UI refresh: first implementation pass

Scope: the shared navigation and header, Home, and Transaction Activity. This is a local, unpublished follow-up to v1.9.7. No installed rental records were changed. The previously verified Spectrum reminder and review-navigation fixes remain included in the local changes.

## Implemented

- One Year / Property / Unit toolbar, with an explicit Reset property scope action when narrowed. Shared is labelled Shared expenses. Search and New remain in the page header.
- Consistent grouped desktop navigation, neutral icons, a clear active state, and accessible labels in the collapsed sidebar. Narrow windows use a labelled Navigation drawer instead of a horizontal list or duplicate filters.
- Subtle teal panel washes, coloured metric accents, lighter shadows, readable dashboard metadata, and tabular numbers. Dark mode now provides readable heading and muted-text colours and consistent secondary surfaces.
- Home leads with rent recorded, rent balance, net cashflow, and leased units, with a compact visible financial strip, then Cashflow, Rent Collection and Action Center side by side. Financial overview retains every selected existing financial metric and its action. Existing Settings selections still control those financial cards.
- Partial lease coverage displays Review schedule rather than an apparently authoritative zero balance. Cashflow states its rent-month or cash-date basis and the number of recent recorded months; it is not presented as a full-year total. Leased units states the number with active leases out of the units in scope.
- Financial overview, setup progress, cashflow, recent transactions, and property details remain reachable. Metric tiles now support keyboard activation.
- Transaction modes use compact tabs with counts and a focused section description. Existing card/table preference, optional columns, sorting, saved filters, pagination, and record actions remain available.

## Verification

Packaged visual and interaction checks cover 1440, 1024, and 720 px widths, a single visible scope control set, no page-wide horizontal overflow, all four operational tiles, access to the selected financial metrics, navigation drawer dismissal and focus restoration, navigation to Transaction Activity, and table access. Screenshots also cover narrow dark mode. Tests use temporary fictional profiles.

Visual review found and corrected drawer focus restoration, small-window collapse-control visibility, dark heading contrast, and the cashflow basis label. All 736 unit tests and all 32 packaged desktop workflows passed. Configured type checks, production packaging, privacy scan, bug sweep, release smoke, and whitespace checks passed. The UI scan now reports eight advisory items, including the intentional larger operational metric values; it has no blocking result.

## Performance check

The final unchanged package completed a large-profile recheck with one excluded warm-up and three measured fresh launches: startup to hydrated scope controls 954.9 ms median (951.0–999.7), first Transactions 128.4 ms (126.2–136.2), transaction panel with loaded file 417.3 ms (416.3–449.9), and document review with loaded file 892.0 ms (859.4–918.4). Report: `output/playwright/ui-refresh-large-benchmark-recheck.json`, complete, package SHA-256 `8abaffc888862ac14fc6289f63122bcb0ed3e2cc42cae021149f72a354041684`.

Earlier runs of that same package measured startup at 1,258.7–1,293.7 ms and first Transactions near 428 ms. A comparison copy of published v1.9.7 was extracted without installation and benchmarked in a fictional profile; its medians were 1,033.4 ms and 140.2 ms. A temporary typography diagnostic and then the unchanged-package recheck returned normal timings, so the earlier slowdown was not reproducible. The diagnostic file was removed, and the final UI styling was not rolled back. Retain these reports as variability evidence rather than claiming a general speed improvement or a conclusively isolated cause.

All timings are local warm-cache, GPU-disabled, automation-inclusive measurements. The large fictional profile contains 10,000 transactions, 20,000 audit entries, and 500 documents. Panel readiness means loaded file bytes and a visible frame, not completed PDF rendering. See `desktop-performance-2026-10-03.md` for the benchmark methodology.

Preview files are under ignored `output/playwright/`: `refresh-home-1440.png`, `refresh-home-1024.png`, `refresh-home-720.png`, `refresh-home-dark-720.png`, `refresh-navigation-720.png`, `refresh-transactions-1440.png`, and `refresh-transactions-720.png`.

## Next pass

Apply the same compact list, filter, status, and panel patterns to Documents, Properties, Leases, Maintenance, and Calendar. Preserve their specialist actions and definitions; review representative screens before widening changes. This first pass does not claim a complete redesign of those workspaces.

## Laptop overview follow-up

The user specified a 1920 x 1200 laptop display and requested a single-page Home with more app character. The desktop header now holds title, Year / Property / Unit and actions in one row. Home uses compact operational tiles and a visible strip of all selected financial metrics. Teal panel washes and coloured metric accents retain visual character. Recent records show three items, or two in a short desktop window, with the exact visible count and full-list action. Unit/property previews show at most three rows; scope counts and Manage/See all actions preserve access to the complete records. Setup starts as a compact summary and can expand deliberately.

Small/narrow windows retain natural scrolling and readable controls. No page content is clipped to force the overview to fit. Expanded setup details may require scrolling.

Final laptop checks passed in the packaged Electron app at 1920 x 1200, 1440 x 900 and 1280 x 800, asserting zero document vertical overflow with all overview sections present. The full desktop run passed 30 workflows and identified two issues: compact sidebar height and a header rule affecting New-menu labels. Both were corrected; the two affected workflows passed on the final rebuilt app, including narrow navigation and dark mode. Final type checks, whitespace checks, production packaging and release smoke passed. The earlier 736 unit-test pass remains applicable; this follow-up changes layout and responsive previews only. This update remains local and unpublished.

## Header scope integration follow-up

Replaced the three detached filter pills with a single segmented scope group adjacent to the workspace title. The group uses a shared surface and outline, consistent label/value spacing and field separators; Search/New remain right-aligned. A two-column desktop header is used when a workspace has no scope controls. Narrow screens wrap the group deliberately. Packaged checks assert scope/actions share a vertical centre, the group sits between the heading and actions, and each native select remains inside its field. All four focused desktop workflows passed at the final build, including zero-scroll Home at the three desktop sizes, narrow keyboard creation, scope restoration and New-menu use. Type checking and whitespace checks passed.
