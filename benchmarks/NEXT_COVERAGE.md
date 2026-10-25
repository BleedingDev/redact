# Next.js release evidence

The stable release requires all 162 configurations and 2,694 scenario groups to pass. The gate uses the packed Redact package, retains failed scenarios, and rejects partial results, duplicate cases, and mismatched package or suite fingerprints.

## Recorded run

The October 25 Linux CI run passes all 162 configurations and all 2,694 scenario groups. All six pinned Next.js releases pass, including development, production, standalone output, and static export. The complete report has no missing cases, duplicate cases, fingerprint mismatches, or failed scenarios.

The Next 16.2 Firefox streaming cases now pass with both bundlers and both Cache Components settings. The packed Redact integration supplies a version-scoped development cache correction, preserving debug-channel replay and leaving installed Next files intact. Publication does not require another Next.js release.

[Full passing matrix](./results/framework-stable-next.json), [CI run](https://github.com/TanStack/redact/actions/runs/40188021674), [runtime and package validation](./results/framework-stable-validation.json). The workflow tested source commit `0e879521fbd4ae7637bfcadae1841c2ef0f44c97`.

The [earlier macOS run](./results/framework-release-next.json) completed the matrix with four native-React-reproduced Firefox reload-loop failures in Next 16.2. Those failures remain recorded alongside the fixes they motivated.

An earlier Linux CI run also exposed a Firefox reload assertion failure with native React and Redact. Next's development socket can reconnect during a slow document load and start a second reload, aborting Playwright's wait for the first request. A controlled reproduction showed the replacement document renders the correct full route. The reload check now issues one browser reload, requires a new document at the same URL with a successful HTTP response, and keeps the original UI assertions and deadline. Fifteen browser regressions cover normal and interrupted reloads, canceled loads, server errors, and wrong destinations. [Before/after evidence](./results/framework-reload-diagnostic.json).

## Matrix

Pinned releases: 15.5.28, 16.0.11, 16.1.7, 16.2.12, 16.3.8, and 16.4.3. Each runs Turbopack and Webpack, development and production, and Chromium, Firefox, and WebKit. Next 16 runs with Cache Components enabled and disabled. Next 15.5 and 16.4 also test standalone and static output, base paths, and trailing slashes.

The [integration guide](../docs/next.md) lists the covered journeys. PR checks and release publication both require the complete matrix.

## Reproduce

```sh
nvm use
pnpm install --frozen-lockfile
pnpm exec playwright install chromium firefox webkit
pnpm test:ci
pnpm test:next
```

The tests use Node 24.22.0. Local fixtures run sequential modes to prevent development servers and production builds from sharing caches. CI splits the same matrix into independent jobs and combines their evidence.

## Runtime regression checks

The release candidate fixes a suspended hidden Activity tree holding a visible Next route transition open. Six regression cases cover function, class, and promised children with and without an inner Suspense boundary. All six pass with native React and Redact in Chromium, Firefox, and WebKit. They check visible commits, pending state, retained DOM, disconnected effects, and later reveal.

The separate Redact browser gate passes 61 tests per browser, 183 executions. It includes adapter-specific tests and is not presented as 61 portable native React tests.

## Bundle limits

Measured with Node 24.22.0 and its pinned zlib, retaining all public client exports:

| Bundle | Source gzip bytes | Published-build gzip bytes | Original total limit |
|---|---:|---:|---:|
| Full client used by Next.js | 27,938 | 27,921 | 28,183 |
| Default Vite client | 23,318 | 23,304 | 23,335 |

All 38 existing source/dist size gates pass. These totals measure the runtime, not a complete application. [Machine-readable measurements](./results/framework-release-sizes.json).

## Maintained Next 16.2 correction

The browser development loader requires decoded body bytes before treating zero transferred bytes as a cached response. It preserves the original debug-channel replay path. The four original Firefox cases remain required and now pass in the complete matrix. [Implementation and scope](../docs/next.md#bundlers), [root causes and upstream contributions](./upstream/README.md).
