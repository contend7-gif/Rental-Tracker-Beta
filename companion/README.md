# Rental Tracker Companion

Private mobile capture surface for the Rental Tracker desktop application.

This service is optional and is not a shared Rental Tracker account. Every user
who enables it must create and privately own a separate deployment, storage,
sync secret, and Site access token. See `docs/mobile-companion-setup.md` in the
parent repository for the deployment and pairing guide.

The companion accepts receipt photos/PDFs and maintenance issue photos, stores metadata in D1
and file bytes in R2, and exposes a separately authenticated desktop inbox. The
desktop application remains the system of record: a mobile capture is not a
Rental Tracker document until it has been reviewed and imported there.

Up to eight receipt or maintenance photos can be ordered and combined locally
on the phone into one PDF before upload. Large PDFs upload in resumable private pieces. Imported file bytes are removed
immediately by default, or after an optional 7- or 30-day recovery window. The
companion keeps only a minimal audit receipt after cloud file cleanup and never
creates a permanent offline document cache on the phone.

## Read-only desktop snapshots

Desktop snapshot sharing is off by default, including on existing installations.
An Admin enables it under Settings → Admin & Tools → Mobile companion. The
desktop pushes an allowlisted snapshot after changes and refreshes its timestamp
at least every five minutes while open and paired. No source files, private notes,
credentials, or attachment bytes are sent. Overview reads the last cloud copy,
clearly timestamps it, and warns when it is over 24 hours old.

The snapshot contains active properties and units, ongoing lease records, open
work orders, the latest 200 non-voided transactions, and recorded loan details.
Transaction filters operate on those 200 records, not full desktop history.
Optional payoff dates reuse the desktop planning calculation and show their
constant-rate/payment assumptions; they are estimates, not lender payoff quotes.
Dates follow the desktop's local calendar day. The server refuses future-clock
uploads and prevents an older upload from replacing a newer snapshot.

Turning sharing off stops uploads but retains the last cloud copy. The desktop's
Stop sharing & clear cloud snapshot control removes it. Capture-file retention
is separate and never deletes desktop records. Snapshot writes and clearing
require desktop authorization; reads rely on the owner-private Site boundary
and signed-in browser identity. Keep the Site owner-private.

## Local development

```text
npm install
npm run dev
```

Local browser requests use a development-only identity, and the desktop API
uses `local-rental-tracker-sync`. Production browser access is protected by
Sites, while production desktop requests require both the Sites bypass token
and the `COMPANION_SYNC_SECRET` runtime secret.

The `project_id` in `.openai/hosting.json` identifies one deployment but is not
an access credential. A different user must create a new Site project rather
than attempting to reuse that identifier.

## Validation

```text
npm test
```
