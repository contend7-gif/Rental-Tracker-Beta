# Desktop performance after the refresh — October 5, 2026

The current local package was compared with the official v1.9.7 Windows release on the same machine. The apparent medium-dataset Transactions slowdown did not repeat. Startup was broadly unchanged; returning to Transactions was consistently faster. Some file-panel medians were modestly higher, with overlapping ranges. Document review and the full save path remain the main large-dataset profiling candidates. No accounting or persistence algorithm was changed in this measurement pass.

## Packages and method

- Baseline: official v1.9.7 installer extracted to an isolated directory, without installing it. Packaged-source SHA-256: `96e5f23be074db5f8a014dabf26a42ff2a306cc0591fad6097765fe3801248c2`.
- Current: the v1.9.9 UI refresh plus the locally implemented, unreleased restart draft recovery. Packaged-source SHA-256: `9c6369707c6cab5d68da1538ae2085e613fbb277bdf6b60580ce53e43f8afa19`.
- Windows x64, Intel Core Ultra 7 155U, fixed 1920 × 1200 content viewport, GPU acceleration disabled by desktop test mode, warm OS disk cache.
- Five measured fresh-process launches and one excluded warm-up for each size/build. The initial comparison ran baseline then current, sequentially to avoid competition. A medium-size recheck ran current then baseline, again with five measurements each.
- Small: 200 transactions / 400 audit entries / 20 documents. Medium: 2,000 / 5,000 / 100. Large: 10,000 / 20,000 / 500. All records and the single-page PDF fixture are fictional. The installed user profile was never opened.
- Startup ends at hydrated property controls. Workflow timings include automation overhead and two animation frames. File-panel readiness means loaded bytes and a visible iframe, **not completed PDF page rendering**. Save-to-disk includes UI submission, the save queue, IPC and repeated full-snapshot verification reads; it is not raw SQLite write latency.
- Results are local observations with five samples per case, not guarantees for other machines or evidence that every workflow became faster. The current package includes draft recovery, so the comparison does not isolate the UI refresh alone.

## Initial comparison

Median milliseconds; each cell is **v1.9.7 → current**. Raw reports retain every sample and min/max ranges.

| Workflow | Small | Medium | Large |
| --- | ---: | ---: | ---: |
| Startup to hydrated controls | 841.2 → 812.1 | 953.7 → 943.2 | 1293.5 → 1284.0 |
| First Transactions opening | 146.8 → 131.4 | 133.1 → 310.4 | 144.6 → 124.6 |
| Next transaction page | 116.3 → 83.8 | 116.8 → 83.8 | 114.6 → 100.4 |
| Open global search | 415.6 → 200.0 | 416.7 → 449.9 | 442.8 → 183.8 |
| Query to matching result | 50.2 → 50.1 | 50.6 → 50.3 | 50.0 → 49.6 |
| Transaction panel with file | 451.9 → 467.5 | 457.9 → 466.2 | 452.4 → 475.1 |
| First Documents opening | 153.5 → 132.9 | 188.7 → 138.7 | 485.3 → 489.6 |
| Document panel with file | 736.9 → 528.2 | 642.3 → 569.6 | 1045.3 → 992.2 |
| Return to Transactions | 269.8 → 114.8 | 210.6 → 139.3 | 208.4 → 138.3 |
| Transaction edit saved and verified | 208.5 → 151.1 | 305.8 → 248.0 | 758.6 → 628.7 |

Do not interpret the search-open median differences as consistent speed gains: current samples ranged from about 133 to 467 ms, and the medium recheck measured 432.8 ms versus 451.1 ms. Several other ranges overlap. A simple targeted query remained near 50 ms, including observation and paint overhead.

Transaction panels with files measured 8–23 ms higher medians in the initial comparison and 35 ms higher in the medium recheck. Their sample ranges overlap; retain this as a possible small cost to investigate rather than describe every workflow as faster.

## Investigation of the medium Transactions result

The initial current first-open measurement varied from 111.7 to 324.9 ms. In the reverse-order recheck, current measured 122.1 ms (120.6–130.3), versus baseline 144.4 ms (133.3–339.7). The apparent initial median slowdown did not repeat.

The runner now also measures inside the renderer, starting at the actual click and ending after a visible pager has had a frame to paint. This excludes automation observation delay. Current measured 63.0 ms (59.0–78.9), versus baseline 76.3 ms (73.4–287.6). Both rechecks used the same runner SHA-256: `d7e275ef149bf48b03b40371933b2bbf3785876ba1963b435fc7939c3dfd4cf6`.

Save timings also vary: the medium recheck measured 328.8 ms current versus 331.0 ms baseline, compared with 248.0 versus 305.8 in the initial pair. The initial save differences are therefore observations, not a general speedup claim.

## Database save measurements

The separate Node benchmark used seven iterations per operation and excluded automatic backups. It does not include renderer work, the desktop bridge, or the UI save queue.

| Profile | Unchanged snapshot | Edit + audit entry | Row changes: unchanged / edit |
| --- | ---: | ---: | ---: |
| Small | 2.84 ms | 3.08 ms | 2 / 5 |
| Medium | 13.32 ms | 10.96 ms | 2 / 5 |
| Large | 47.03 ms | 42.38 ms | 2 / 5 |

The row counts confirm that unchanged records are not all rewritten. These measurements do not justify replacing the database engine. The difference between raw saves and UI save-to-disk timings includes multiple stages and the verification reads; it cannot all be attributed to renderer calculations without profiling.

## Next performance work

1. Profile large-dataset document opening and save submission in the packaged app, separating record derivation, attachment preparation, IPC serialization, database work and verification overhead.
2. Optimize a repeatable measured contributor, then repeat the same comparison and relevant desktop checks.
3. Keep normal correctness tests free of machine-dependent timing thresholds. These measurements are a diagnostic baseline.

## Reproduce and evidence

`npm run desktop:pack`, then `npm run bench:desktop -- output/playwright/desktop-benchmark.json`. The runner uses five samples per size by default, records the actual Electron runtime version, package and runner fingerprints, and a fixed laptop viewport. `RENTAL_TRACKER_BENCH_SIZE` can select `small`, `medium` or `large`; `RENTAL_TRACKER_BENCH_SAMPLES` accepts 3–20. `RENTAL_TRACKER_E2E_EXECUTABLE` can point to another isolated packaged executable.

For raw database measurements, rebuild the SQLite dependency for Node before `npm run bench:saves`. Restore the Electron native dependency with `npm run desktop:prepare` before subsequent desktop work. Run these sequentially.

Ignored evidence under `output/playwright/`:

- `performance-baseline-v1.9.7-2026-10-05.json`
- `performance-current-2026-10-05.json`
- `performance-current-medium-recheck-2026-10-05.json`
- `performance-baseline-medium-recheck-2026-10-05.json`
- `performance-saves-2026-10-05.json`

All four comparison reports completed: 40 measured desktop launches and eight excluded warm-ups. A separate three-sample small-profile sanity check also passed. The raw save benchmark completed, native desktop dependencies were restored, and benchmark syntax, privacy scan, bug sweep and whitespace checks passed. The app code is unchanged from the draft recovery pass, which passed 746 automated tests and 35 packaged desktop workflows. No release was published by this pass.
