# Module split — September 7, 2026

This refactor follows the September 5 code sweep. It preserves the earlier working-tree fixes, existing planning API, document action names, permission checks, and accounting formulas. It does not migrate live data or publish a release.

## Planning calculations

`src/domain/planning.ts` is now a compatibility entry point that re-exports the existing public functions and types. Existing callers and tests can keep their imports.

The implementation lives under `src/domain/planning/`:

| Module | Responsibility |
| --- | --- |
| `types.ts` | Shared planning input and result contracts |
| `shared.ts` | Date, scope, rent, and operating-expense helpers |
| `scenarios.ts` | Dated scenario events and occupancy overrides |
| `forecast.ts` | Re-rental assumptions and monthly projections |
| `financing.ts` | Debt service, amortization, financing comparisons, and payoff |
| `portfolio.ts` | Property snapshots and milestones |
| `capital.ts` | Reserves and capital funding targets |
| `rent.ts` | Rent strategies and turnover planning |
| `exit.ts` | Hold, refinance, and sale analysis |
| `tax.ts` | Planning depreciation and tax projections |
| `comparisons.ts` | Decision comparisons, scenario ranges, and sensitivity |
| `review.ts` | Health, recommendations, assumptions, triggers, goals, and review inbox |
| `export.ts` | Planning CSV output |

Internal modules import the specific module they need, not the compatibility entry point. The extracted dependency graph is acyclic. A source comparison verified that all 58 planning function bodies were retained unchanged.

## App coordination

`src/app/usePlanningWorkspace.js` composes the existing planning model, actions, analytics, narrative, and report hooks in their original order. `App.jsx` passes their shared inputs once and receives the outputs used elsewhere. Global state ownership and the workspace/dialog interfaces remain in `App.jsx`.

This removes roughly 120 lines of repeated coordination from the app root. The root remains large because it still connects the other workspaces; this is not a wholesale application rewrite.

## Document workflows

`src/app/documentWorkspaceController.ts` continues to expose the same action interface. Intake, attachment routing, and review-queue coordination remain there. It delegates to:

- `documentRecordActions.ts`: preview loading, external opening, deletion confirmation, tags, extracted text, OCR corrections, and warning review.
- `documentSuggestionActions.ts`: eligibility checks, suggested expense/work-order creation, utility sections, and batch acceptance.
- `documentAiActions.ts`: permissions, OCR preparation, AI requests, audit records, and busy/error feedback.
- `documentWorkspaceTypes.ts`: shared dependency and action-option types.

The controller decreased from about 1,450 lines to 800. A source comparison verified all 22 moved action bodies unchanged. The new factories receive explicit dependencies; they do not add global state, eager document-file reads, or background writes.

## Validation

Existing calculation and workflow tests exercise the preserved public interfaces. Added tests cover document-preview loading order, AI permission gating and error cleanup, and switching among the packaged app's primary planning views. The planning source-contract test now inspects the implementation modules where its protected wording lives.

Final results: 670 automated tests passed; type checking, production build, packaging, privacy/bug scans, whitespace checks, and release smoke passed. All 15 desktop checks passed: 14 in the broad run and the new planning navigation check after correcting its selector to match the existing button controls. Tests used isolated fictional-data profiles. The UI style scan remains advisory.

The local packaged build includes this refactor. No release was published.

## Shared calculations

The follow-up sweep consolidated only helpers with identical behavior:

- `src/domain/isoDate.ts` is the single calendar-safe ISO date validator used by operations and recurring-expense checks.
- `src/domain/leaseActivity.ts` is the shared lease-active-by-date rule used by the app lease helpers and depreciation calculations.
- `electron/fileStore.mjs` owns filename-stem sanitization for document OCR and external document opening.

Rental-use calculations remain separate because accounting uses raw use-period values while depreciation applies clamping and different defaults. Keeping those semantics explicit avoids changing financial results under the guise of deduplication.
