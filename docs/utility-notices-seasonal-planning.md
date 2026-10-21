# Utility notices and seasonal planning

Calendar now shows the next expected cycle of an inferred monthly expense within
the selected horizon. Three recorded monthly dates establish a pattern. The
notice gives the expected recording date, recent average and observed range,
and the supporting records. After seven days it becomes a review suggestion.
Neither stage establishes a due date or unpaid balance, and neither creates a
transaction. Existing recurring rules suppress matching inferred notices.
Intentional and review-complete choices keep their existing calendar behavior.
Monthly Close and desktop daily notices retain overdue-only inference.

Planning learns utility costs separately by property, unit, and normalized
provider. Multiple charges in a month are totaled. It considers up to 24 complete
months, excluding voided, future, invalid, and capital records. At least three
consecutive recent complete months are needed; quarterly and stale histories are
not promoted to monthly forecasts. Missing months never mean zero cost.

When all 12 calendar months are represented, a future month uses the latest
recorded matching calendar month. At least two recent year-over-year pairs can
adjust that amount for changing costs, with the ratio bounded to 0.5–2.0.
Shorter histories use the last three complete months' average. This learns
recorded spending seasonality; it does not use weather or utility rate feeds.

The learned amount replaces its corresponding part of the historical utility
baseline, so it enters OpEx and cash flow once. Existing utilities-included lease
scaling and annual expense growth still apply. A positive manual utilities-included
assumption takes priority. Unmodeled providers keep their existing baseline.

The displayed range is a planning allowance: at least 20% around seasonal
estimates or 35% around recent averages, widened by observed variation. It is not
a statistical confidence interval. Monthly forecast details and CSV export show
the utility estimate, range, and method. Estimates do not write financial records
or change leases, recurring rules, or user budget assumptions.

Validation covers winter versus summer costs, short and stale histories,
scope separation, split charges, exclusions, trend and growth, manual overrides,
and no double-counting. An isolated packaged desktop test exercises the upcoming
notice, source navigation, and forecast explanation and verifies that the
transaction collection remains unchanged.
