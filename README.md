# Rental Tracker Alpha

Rental Tracker is a local-first React, Vite, and Electron prototype for managing rental records on a single machine. It focuses on source-record confidence: bills, transactions, leases, occupancy, documents, loans, assets, maintenance, tenant ledger activity, and Tax Center reporting stay connected so records are easier to review before year-end.

This app is not a tax filing product. Keep your own backups and confirm tax filings with a qualified tax preparer.

## Main Workflows

- `Dashboard`: status-first rental summary, urgent review counts, compact previews, and setup attention only while setup needs work.
- `Review Center`: one place for transaction, document, asset, maintenance, lease, tenant-ledger, loan, and Tax Center cleanup, with what/why/fix guidance, safe fix-in-place actions, and loan year-end 1098/escrow review fields.
- `Ledger` and `Add Transaction`: transaction entry, bank import, repeated-vendor templates, mileage support, reconciliation, and clear handling for owner draws, contributions, transfers, principal, escrow, and deposits.
- `Documents`: OCR-backed document inbox, guided Add bill from document flow, expense/work-order draft review, source-record links, supporting-only files, optional AI document analysis, and an optional privately deployed Mobile Companion inbox.
- `Properties`, `Leases`, `Maintenance`, `Assets`, and `Loans`: source records for valuation history, property documents, occupancy, tenant ledger readiness, work-order accounting handoff, depreciation support, and loan payment entry. Property value is updated from Properties and read by Loans for LTV.
- `Tax Center`: Overview landing tab, preparer-facing Schedule E summaries, click-through source rows, depreciation and loan support, final tax packet handoff, and optional owner-reporting tools under Tools.
- `Settings`: setup checklist access, Real Data Mode, sample data loading, backup validation, current data status, audit log, access profile testing, updates, diagnostics, and advanced/admin controls.

## Data Safety

Do not commit real rental data, tenant names, property addresses, utility bills, mortgage statements, app backups, exported ZIPs, SQLite databases, API keys, lock codes, or private notes. Use fictional fixtures only. Backup/export files belong outside the repository.

Run this before committing:

```bash
npm run privacy:scan
```

If real data is accidentally committed, deleting the file in a later commit is not enough; Git history must be cleaned separately.

## Quick Start

Prerequisites:

- Node.js 20+
- npm

Install and run:

```bash
npm install
npm run dev
```

Common checks:

```bash
npm run privacy:scan
npm run scenario:dry-run
npm run scenario:loan-tax
npm test
npm run build
npm run smoke:ci
```

`npm run scenario:dry-run` runs fictional owner-occupied duplex scenario checks for tax/accounting invariants.
`npm run scenario:loan-tax` runs fictional loan/tax stabilization checks for selected-loan payment attachment, duplicate loan IDs, missing payment months, escrow/PMI review behavior, LTV labels, and Tax Center/Tax Packet agreement.

## Desktop App

Run the production desktop app locally:

```bash
npm run desktop:run
```

Build desktop artifacts:

```bash
npm run desktop:pack
npm run desktop:dist
```

Desktop persistence uses SQLite plus a managed document folder in Electron's user-data directory. Imported document blobs are stored as files, while metadata, hashes, and relative paths are stored in SQLite. The browser/dev fallback can still read legacy localStorage data for Alpha migration.

Desktop builds store the OpenAI API key through Electron safeStorage when OS-backed encryption is available. API keys are excluded from localStorage-shaped settings and backups.

The Mobile Companion is off by default for new installs. Users who want mobile capture must deploy their own private companion and pair it under Settings; Rental Tracker never requires the maintainer's Site. See [Optional Mobile Companion Setup](docs/mobile-companion-setup.md).

## Backups And Validation

The desktop app can create local restore points and ZIP backups containing `backup.json` plus embedded document files. Backup validation checks the latest managed backup before restore and reports `valid`, `valid_with_warnings`, or `invalid`.

Settings > Data & Backup includes controls for:

- current data status
- fictional sample dataset loading with overwrite protection
- Real Data Mode and first-record checklist
- backup export and latest-backup validation
- desktop database/document health
- managed data folder access

## Release Notes And Updates

Bundled release notes live in `src/domain/releaseNotes.ts`. Packaged desktop builds use `electron-updater` to check GitHub Releases, download updates, and show in-app update notes.

For a tagged release, keep these aligned:

- `package.json`
- `package-lock.json`
- `src/domain/releaseNotes.ts`
- `docs/manual-qa.md`
- `README.md` when behavior or navigation changes

Tag builds run `npm run smoke:ci` before publishing release assets.

## Tech Stack

- React 19
- Vite 7
- Tailwind CSS 4
- Lucide React icons
- Electron
- better-sqlite3
- Electron safeStorage

## Project Map

- `src/App.jsx`: main app coordinator and workspace wiring
- `src/app/`: controller hooks, shell components, lazy workspace registry, navigation helpers
- `src/features/`: workspace UIs and feature-specific helpers
- `src/domain/`: accounting, tax, OCR, backup, demo, planning, and safety helpers
- `src/store/`: local state and app settings
- `electron/`: desktop persistence, backup archive, OCR, diagnostics, and IPC bridges
- `scripts/`: privacy scan, bug sweep, release smoke, and supporting checks
- `docs/manual-qa.md`: manual release validation checklist
- `docs/loan-tax-reconciliation-qa.md`: fictional loan/tax reconciliation release checklist

## README Maintenance

Keep this README short and durable. Put detailed release-by-release behavior in `src/domain/releaseNotes.ts`, and put hands-on validation steps in `docs/manual-qa.md`.
