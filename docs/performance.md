---
title: Bundle Size and Performance
---

## Framework client bundles

The October 25, 2026 run of Vinext's benchmark suite compares the same generated app and published Vinext 1.3.0 dependencies, changing only the browser renderer. It uses the frozen Redact framework release candidate, identified by its package hash in the report.

| Gzipped client output | React | Redact | Saving |
| --- | ---: | ---: | ---: |
| All emitted JavaScript and CSS | 154.9 KB | 115.5 KB | 39.4 KB, 25.4% |
| Browser entry and eager JavaScript imports | 144.2 KB | 105.0 KB | 39.2 KB, 27.2% |

KB means 1,000 bytes. All six builds returned the same client sizes. Total output includes lazy routes, it is not one page's download. This is the Vinext comparison, not a measurement of adding Redact to Next.js.

Production builds took a median 18 ms longer, about 1.9%. Startup differences were inconclusive. The suite does not time hydration, rendering, interaction responsiveness, or production SSR throughput. Both implementations use native React on the server. [Workloads, versions, raw measurements, and uncertainty](../benchmarks/VINEXT_BENCHMARKS.md).

The framework integration stays within the existing runtime size limits: 27,921 bytes gzip for the full built runtime, against 28,183, and 23,304 for default Vite, against 23,335. [All 38 size checks](../benchmarks/results/framework-release-sizes.json).

## Earlier runtime measurements

The remaining measurements describe the 0.1.0 release and its frozen pre-release timing snapshot, compared with React 19.3.0 on September 11, 2026. They are not measurements of every later release.

React and Redact make different runtime tradeoffs. These comparisons help you choose for your app, they don't rank the projects or imply that React's broader capabilities are unnecessary.

## Bundle size

Production ESM bundles retaining all exports from the React, JSX, DOM, and DOM-client entries:

| Runtime | Gzip bytes | Compared with React |
|---|---:|---:|
| React 19.3.0 | 69,162 | Reference |
| Redact, default Vite configuration | 23,311 | 66.3% smaller |
| Redact, native animation enabled | 28,159 | 59.3% smaller |

These are runtime bundles, not whole applications. Redact is measured from the [0.1.0 release build](https://github.com/TanStack/redact/blob/main/benchmarks/results/release-0.1.0-sizes.json). Real apps tree-shake differently, and the runtimes have different scheduling capabilities.

Standalone Redact entries, measured separately:

| Entry / configuration | Gzip bytes |
|---|---:|
| DOM client, default Vite features | 20,139 |
| DOM client, native animation enabled | 24,991 |
| DOM client, `nano` preset | 12,466 |
| React API entry | 2,764 |
| Server entry | 8,964 |

These entries overlap, so their sizes are not additive. `nano` removes behavior and is not a full-compatibility preset. The expanded API surface is larger than earlier Redact, not a size reduction over previous releases. [Exact configurations, inputs, and historical comparisons](https://github.com/TanStack/redact/blob/main/benchmarks/SHIP_RESULTS.md#size).

## Performance

Production microbenchmarks on an Apple M5 Pro, Chrome 152, without CPU throttling: five fresh-browser blocks, five rounds each. Redact uses the built package with default Vite features. Synchronous flushes ensure updates complete before timing stops.

These timings use the frozen pre-release snapshot, before the final hydration-recovery cleanup was merged from 0.0.21. That cleanup passed the release tests; the timing experiments were not repeated.

Times are median averages per completed workload batch in **milliseconds**, not per component. Negative percentages mean less time. Percentages use paired measurements, not division of the rounded medians.

| Browser workload | React ms | Redact ms | Redact time vs React |
|---|---:|---:|---:|
| Sparse state updates | 0.009 | 0.002 | -71.9% |
| Mixed-depth state updates | 0.227 | 0.093 | -59.1% |
| Keyed list reversal | 0.161 | 0.112 | -30.3% |
| Context through memo | 0.073 | 0.052 | -29.1% |
| Deep-tree prop updates | 0.012 | 0.010 | -22.4% |
| Batched state updates | 0.050 | 0.041 | -19.7% |
| Null-heavy child lists | 0.094 | 0.083 | -14.2% |
| Stable keyed rows, automatic JSX | 0.050 | 0.043 | -11.6% |
| Controlled selects | 0.142 | 0.132 | -7.6% |
| Prop updates, automatic JSX | 0.237 | 0.226 | -3.8% |
| Prop updates, classic JSX | 0.249 | 0.243 | -2.3% |
| Stable keyed rows, classic JSX | 0.045 | 0.046 | No clear difference |
| Mount and unmount | 0.149 | 0.162 | +7.5% |
| Reducer batches | 0.051 | 0.055 | +7.9% |
| String SSR in the browser | 0.038 | 0.043 | +10.4% |
| Hydration | 0.182 | 0.227 | +21.4% |
| Passive effects | 0.024 | 0.032 | +27.0% |
| Reducer updates under Suspense | 0.051 | 0.076 | +49.6% |
| Suspense retry cycles | 0.117 | 0.268 | +124.8% |

The largest ratio, Suspense retries, is about **0.15 ms of extra work per cycle** here. A cycle covers 96 components, 192 reducer actions, hiding, retrying, revealing, and shared correctness checks. It does not mean interactions feel 2.25 times slower. Larger trees, repeated retries, and slower devices can make the difference matter.

### Server rendering

Separate Node 24 measurements use production source bundles, five fresh-process blocks, and the same checked output. They exclude package startup, network latency, and streaming waterfalls.

| Server workload | React ms | Redact ms | Redact time vs React |
|---|---:|---:|---:|
| Fully-ready readable stream | 0.175 | 0.088 | -49.4% |
| String SSR with hooks/context | 0.076 | 0.053 | -30.5% |
| String SSR, clean text | 0.057 | 0.053 | -6.9% |
| String SSR, escaped text | 0.126 | 0.124 | No clear difference |

### Interactions and memory

Separate 2,400-row fixtures use normal scheduling for clicks and forced garbage collection for retained heap:

| Measurement | React | Redact, default |
|---|---:|---:|
| Click handler to committed DOM, median / p95 | 1.5 / 1.6 ms | 1.2 / 1.3 ms |
| Mounted retained JS heap, median | 666.4 KiB | 762.5 KiB |
| Extra DOM nodes after final unmount | 0 | 0 |

Handler-to-commit is not paint latency or field INP; retained heap is not allocation rate or proof of no leaks. Observed click durations were browser-rounded to 16 ms for both; one Redact event entry was absent, not zero.

An identical-React control measured 0.5% median absolute variation across browser workloads, with wider uncertainty in some cases. Small differences need caution. These results do not establish whole-app speedups, behavior under concurrent input, or mobile/Safari/Firefox performance. [All intervals and measurements](https://github.com/TanStack/redact/blob/main/benchmarks/SHIP_MEASUREMENTS.md), [independent audit](https://github.com/TanStack/redact/blob/main/benchmarks/SHIP_AUDIT.md).
