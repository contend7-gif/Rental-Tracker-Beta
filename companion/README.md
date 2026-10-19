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

## Mobile turnover checklists

With desktop v1.11.5 or later and Phone overview & turnover sync enabled, the
Turnover section shows shared leases and their checklists. Check off tasks, add
custom tasks, notes and due dates, change readiness, and use the camera or gallery
to attach task photos. Save turnover keeps progress on the private companion even
while the desktop is closed. Unsaved text drafts stay on this phone; photos that
have not uploaded must be reselected after a reload.

The paired desktop checks in about every 30 seconds while open. Turnover edits
merge by field, and conflicting edits remain visible for an explicit phone or
desktop version choice. Photos are verified before becoming linked desktop
Documents. Receipts, ordinary maintenance reports and mileage still use their
existing review/import flows. Other overview records remain read only.

Linked turnover photos remain in private cloud storage for phone viewing, separate
from capture-inbox retention. Unlinking a task photo keeps the file. Stop sharing &
clear cloud snapshot removes shared turnover checklists and photos as well as the
overview; it does not delete desktop records.

## Desktop overview snapshots

Desktop snapshot sharing is off by default, including on existing installations.
An Admin enables it under Settings → Admin & Tools → Mobile companion. The
desktop pushes an allowlisted snapshot after changes and refreshes its timestamp
about every 30 seconds while open and paired. Only explicit turnover notes and linked turnover photos are added to sharing;
agreement notes, unrelated files and credentials are excluded. Overview reads the last cloud copy,
clearly timestamps it, and warns when it is over 24 hours old.

The snapshot contains active properties and units, ongoing leases plus recently ended leases and leases with turnover checklists, open
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
