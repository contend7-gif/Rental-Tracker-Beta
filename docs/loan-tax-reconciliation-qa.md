# Loan Tax Reconciliation QA

Use fictional data only. This checklist validates loan payment attachment, loan review, escrow/PMI handling, LTV labels, Tax Center totals, and backup survival before a stabilization release.

## Setup

- Create a fictional duplex with two units.
- Mark one unit owner-occupied and one unit rental for the same year.
- Add a fictional purchase / closing valuation and a separate current valuation support record in Properties.
- Add a primary mortgage with scheduled P&I, scheduled escrow deposit, mortgage insurance / PMI, and default extra principal.
- Add a second loan with its own lender, balance, rate, and scheduled P&I.
- Confirm Loans shows LTV vs purchase price separately from LTV vs estimated current value.

## Loan Payment Entry

- Record a primary mortgage payment and confirm the selected loan remains the primary mortgage.
- Record a second-loan payment and confirm it attaches to the second loan.
- Confirm the payment list for each visible loan contains only that loan's payments.
- Record a late-month primary payment that should satisfy the intended following due month.
- Confirm missing payment month review does not flag fully covered months.
- Leave one fictional second-loan month unpaid and confirm the missing-month chip lists that actual month.

## Loan Review

- Review missing payment chips and confirm their month labels match the expected gaps.
- Enter 1098 interest support.
- Enter reviewed escrow property tax and reviewed escrow insurance.
- Enter PMI / mortgage insurance support or override when applicable.
- Confirm extra principal is described as principal and not deductible interest.
- Confirm balance-as-of date follows the latest recorded payment.
- Confirm scheduled labels distinguish escrow deposit, mortgage insurance / PMI, and default extra principal.

## Tax Center

- Confirm mortgage principal and extra principal are excluded from Schedule E expenses.
- Confirm recorded mortgage interest is allocated by owner/rental use.
- Confirm escrow deposits are not deducted as tax or insurance before review.
- Confirm reviewed escrow property tax appears only after review data exists.
- Confirm reviewed escrow insurance appears only after review data exists.
- Confirm PMI / mortgage insurance follows the same rental allocation assumptions.
- Confirm 1098 deductible-interest override replaces computed loan payment interest without double-counting.
- Confirm Schedule E totals match expected allocated mortgage interest, reviewed escrow tax, reviewed escrow insurance, PMI, depreciation, and net rental income/loss.
- Confirm Tax Packet loan totals agree with Tax Center totals.

## LTV

- Confirm LTV vs purchase price uses the purchase / closing valuation when present.
- Confirm LTV vs estimated current value uses current valuation support from Properties.
- Confirm both labels are visible and cannot be confused with depreciation or cost-basis fields.

## Backup / Restore

- Export a backup.
- Validate latest backup.
- Restore into a clean local test profile.
- Confirm loans, loan payments, year-end reviews, valuation support, LTV labels, and Tax Center totals survive restore.

## Release Gate

- Run `npm run privacy:scan`.
- Run `npm run bug:sweep`.
- Run `npm run scenario:dry-run`.
- Run `npm run scenario:loan-tax`.
- Run `npm test`.
- Run `npm run build`.
- Run `npm run smoke:ci`.
