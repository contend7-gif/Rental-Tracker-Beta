# Packaged desktop performance baseline — October 3, 2026

This document records the original baseline before the six subsequent improvements. Final combined-package results and their verification are in `modern-app-follow-up-2026-10-03.md`.

The shared Transactions and Documents panels were rechecked in the current packaged app. Saved PDF previews after restart, nested dialog focus, search navigation, paging, and unsaved-change protection passed all three focused desktop workflows. The local panel changes remain unpublished.

## Reproduce

Build with `npm run desktop:pack`, then run `npm run bench:desktop`. The benchmark uses the packaged executable and temporary fictional profiles. It never opens the installed user profile. The default report is `output/playwright/desktop-benchmark.json`; an alternate path can be passed after `--`. `RENTAL_TRACKER_BENCH_SAMPLES` accepts 3–20 samples; the default is five. Failed/incomplete runs retain `complete: false`.

Each profile has one excluded warm-up and five measured fresh-process launches. The small profile has 200 transactions, 400 audit entries, and 20 documents; medium has 2,000 / 5,000 / 100; large has 10,000 / 20,000 / 500. A generated fictional PDF is persisted through the desktop bridge, then reloaded in both panels.

These are wall-clock workflow measurements on a Windows x64 Intel Core Ultra 7 155U machine. GPU acceleration is disabled by the existing desktop-test mode. The OS disk cache is warm; this is not a cold machine boot. Measurements include automation action/observation overhead and two animation frames. Startup ends at hydrated property controls, not completion of every background job. Navigation waits for the destination workspace; panel readiness means loaded file bytes and a visible preview frame, not completed PDF rendering. The report retains every sample, medians/ranges, package version, and packaged-source checksum.

This establishes a local baseline, not a before/after improvement claim or a guarantee for other machines. No machine-dependent timing threshold has been added to the normal test suite.

## Measured medians

All values are milliseconds. The final report is marked complete and contains 15 measured samples plus three excluded warm-ups.

| Workflow | Small | Medium | Large |
| --- | ---: | ---: | ---: |
| Launch to hydrated controls | 625.2 | 698.4 | 1,311.1 |
| First Transactions workspace | 153.1 | 160.1 | 174.4 |
| Next transaction page | 100.2 | 99.4 | 100.1 |
| Open global search | 383.4 | 366.9 | 383.3 |
| Query to matching result | 49.5 | 50.2 | 50.0 |
| Transaction panel with loaded file | 452.1 | 483.1 | 420.3 |
| First Documents workspace | 151.7 | 170.8 | 463.6 |
| Document panel with loaded file | 606.6 | 604.6 | 1,397.3 |
| Return to Transactions | 181.0 | 203.9 | 252.6 |

The clearest scaling target is document review: its median rises from roughly 0.6 seconds to 1.4 seconds. Profile document matching, attachment-option preparation, and render work before choosing an optimization. The source currently prepares and sorts manual attachment options from the full transaction list on each review render, even when that section is collapsed; this is a candidate to measure, not a proven explanation for the entire delay. Transactions first-open timings also varied between benchmark runs, so do not infer an improvement from a single run.

Validation for this follow-up: the production package built, all three targeted packaged workflows passed, and configured type checks, privacy scan, benchmark syntax check, and whitespace checks passed. The benchmark completed twice; the final run additionally waited for the Documents workspace's Upload document control before recording navigation readiness. No installed rental data was modified and no release was published.
