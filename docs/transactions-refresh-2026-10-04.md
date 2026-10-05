# Transactions refresh

- Activity cards become compact rows: record and residence, category/source, a focused review indicator, amount, and Open.
- Attention and import review cards retain their detailed flags, selections, and existing bulk actions.
- Search, Category, Sort, and Bank match / Review reason have explicit labels and share one filter toolbar. Saved views and Cards/Table controls sit together above it.
- Activity totals state their basis once: posted through the as-of date or the full selected year. Calculations and scope are unchanged.
- Tables show residence context beneath the description, distinguish expense/income amounts, show actual support status rather than only file counts, and keep sortable headings visible while scrolling.
- Transaction details use Overview, Review, and Files. Opening from a specific flag selects Review; ordinary record opening selects Overview. Attached-file preview stays beside the record on wide windows.
- Edit, Duplicate, and Close remain directly available. Reconciliation/tax toggles, Void, and Delete live in More actions, preserving their existing permissions and confirmations.
- Existing saved preferences, imports, recurring transactions, mileage, record paging, edit drafts, and financial controllers are preserved.

This is a local source and packaged preview update, not a published release. Desktop validation uses isolated fictional records rather than the installed database.

Validation: 739 automated checks and all 32 packaged desktop workflows passed. After final badge spacing and Shared label corrections, the automated suite passed again and all five affected desktop checks passed. Type checks, production packaging, diff checks, and the packaged artifact smoke check passed. Screenshots cover Activity at 1920 × 1200, 1440 × 900, and 720 × 900, plus the table and record detail panel at 1440 × 900.
