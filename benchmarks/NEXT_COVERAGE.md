# Next.js release evidence

The stable release requires all 162 configurations and 2,694 scenario groups to pass. The gate uses the packed Redact package, retains failed scenarios, and rejects partial results, duplicate cases, and mismatched package or suite fingerprints.

## Recorded run

The final packed-runtime run completes all 162 configurations and all 2,694 scenario groups. It passes 158 configurations and 2,690 scenarios. Every Next 15.5, 16.0, 16.1, 16.3, and 16.4 configuration passes, including all 42 Next 16.4 cases.

The four failures are Next 16.2.12 development streaming in Firefox, with both bundlers and both Cache Components settings. Native React reproduces the same debug-channel reload loop. All other Next 16.2 scenarios pass. The report records complete coverage with a failing release result.

[Full matrix report](./results/framework-release-next.json), [runtime and release-gate checks](./results/framework-release-validation.json).

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

## Remaining dependency failures

[Root causes, native React controls, and upstream fixes](./upstream/README.md). Next 16.2 Firefox development streaming still requires an upstream backport. Its failing cases remain required.
