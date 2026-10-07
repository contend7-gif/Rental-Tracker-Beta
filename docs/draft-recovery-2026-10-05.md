# Draft recovery across app restarts

Implemented following v1.9.9 and included in v1.9.10. Explicitly saved transaction, loan, and lease drafts persist on this computer after the app closes. Drafts remain separate from posted records and backups; files must be selected again. This does not automatically save every keystroke.

- Open the matching transaction entry, loan editor, or lease agreement and choose **Resume draft** or **Discard draft**. Resuming fills the form without posting a record. Discarding removes the stored draft without clearing current form entries.
- New lease drafts use stable property/unit keys rather than temporary generated IDs. Existing record drafts remain keyed by record ID.
- Successfully saving a record clears its saved draft; validation failures retain it. Loan/lease cleanup failures report that the record was saved but the draft needs discarding.
- Existing valid window drafts migrate when their matching form is opened. Invalid, unsupported, or oversized drafts are ignored. Storage failures preserve the existing form and previously saved draft.
- Drafts exclude file payloads and attachments. Nothing is sent to another service. Installed rental data is not modified by development checks.

Verification covers complete packaged desktop restarts for all three editors, no posting during draft retention, explicit resume, successful save cleanup, and discard persistence. Unit checks cover storage errors, malformed content, legacy migration, excluded file bytes, and stable lease identity.

Initial verification on October 5 passed: 746 automated tests, all 35 packaged desktop workflows, configured type checks, production packaging, privacy scan, bug sweep, whitespace check, and release smoke. The recovery card was visually checked in the packaged loan editor. The final release also covers failed draft cleanup: entries and navigation protection remain intact until Clear form succeeds.
