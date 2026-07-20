# Rental Tracker Companion

Private mobile capture surface for the Rental Tracker desktop application.

The first vertical slice accepts receipt photos or PDFs, stores metadata in D1
and file bytes in R2, and exposes a separately authenticated desktop inbox. The
desktop application remains the system of record: a mobile capture is not a
Rental Tracker document until it has been reviewed and imported there.

## Local development

```text
npm install
npm run dev
```

Local browser requests use a development-only identity, and the desktop API
uses `local-rental-tracker-sync`. Production browser access is protected by
Sites, while production desktop requests require both the Sites bypass token
and the `COMPANION_SYNC_SECRET` runtime secret.

## Validation

```text
npm test
```
