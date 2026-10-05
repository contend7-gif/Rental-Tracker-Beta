# Documents refresh

Documents follows the focused list and explicit record review pattern introduced for Leases.

- Four compact summary shortcuts: Inbox, Needs text, Expense drafts, Missing support.
- Inbox / Library / Missing Support appear before the search and view controls.
- Filename buttons open review directly. Rows retain their workflow action and secondary action menu, but show one workflow status instead of a stack of overlapping badges.
- Processing tools contains text extraction, draft review, and batch review. It starts closed and states that matching batch actions cover all pages.
- Review keeps the original file beside the review content on wide windows. It stacks the preview above the content in smaller windows.
- Review / Links / Text & tools separate corrections and suggestions from record attachment and advanced tools. Switching sections retains correction drafts; closing or navigating to another record uses the existing unsaved-change guard.
- Removed the duplicate fix panel. Warnings, extracted fields, possible duplicates, and linked-record navigation remain available in their relevant sections.
- Existing upload, OCR, receipt matching, manual attachment, draft posting, saved views, grouping, paging, and next-item behaviors remain connected to their existing controllers.

Validation uses fictional isolated desktop profiles. This refresh does not modify the installed application's records and is not a release.

Verified: 739 automated tests, all 32 packaged desktop workflows, type checks, production packaging, diff checks, and the packaged artifact smoke check passed. Desktop screenshots cover 1920 × 1200, 1440 × 900, and 720 × 900. The existing navigation test now opens the Links section before following a linked record. The UI scan reports advisory style items, without blocking findings.
