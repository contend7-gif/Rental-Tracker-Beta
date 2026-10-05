# Work Queue and Calendar refresh

- Work Queue separates grouped source-record tasks from Tax Center cross-check totals.
- Task rows retain source context and priority while shortening repeated detail. The selected task emphasizes one primary action and a next-step explanation; longer reasoning lives in Why this matters.
- Narrow windows place the selected task above the scrollable task list, keeping its action within reach.
- Work Queue and Calendar link to each other without changing the property/unit scope.
- Calendar uses source and horizon selectors instead of rows of source and day-count buttons. Agenda, Month, and Monthly Close remain separate modes.
- Agenda omits empty timing sections. Month displays its own selected-month context rather than unrelated agenda counts.
- Inferred monthly expense gaps are labeled Suggested check rather than overdue. They retain their expected date and source evidence, intentional/snoozed/waiting/done choices, and transaction-review navigation. They do not create a payment or change the underlying records.
- Existing record routing, queue grouping, reviewed-result notices, recurring batch confirmations, follow-up storage, and monthly close behavior are preserved.

This is a local refresh, not a release. Desktop checks use isolated fictional profiles, leaving installed records untouched.

Validation: 739 automated tests and the complete 32-test packaged desktop suite passed. After visual polish, types, production packaging, five affected desktop workflows, and release smoke passed again. Screenshots cover 1920 x 1200, 1440 x 900, and 720 x 900 with no horizontal page overflow. Source-record navigation, smart-check scope preservation, and monthly-close restart persistence passed.
