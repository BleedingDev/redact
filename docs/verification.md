---
title: Testing Your Integration
---

Run your app's test suite and production build with the default Vite preset first. Check server-rendered routes on a direct load and after client navigation, then exercise forms, portals, Suspense boundaries, and third-party components.

Disabling hydration makes `hydrateRoot` throw. Disabling class components also removes class error boundaries and lifecycle methods. Read the feature-flag behavior before changing presets.

## Framework release checks

The [Next.js gate](../benchmarks/NEXT_COVERAGE.md) tests 162 configurations and 2,694 scenario groups. The [Vinext gate](../benchmarks/VINEXT_COVERAGE.md) tests 102 configurations and 1,410 scenario groups across mixed-router and Pages-only apps. Both use packed packages, verify complete results, retain framework failures reproduced with native React, and block publication when checks fail.

Run with Node 24.22.0 from `.nvmrc`. `pnpm test:ci` passes 1,832 runtime and tooling tests, type checks, built-package verification, and all 38 source/dist bundle limits. The 91 ordinary-suite skips remain separate from passing tests. `pnpm test:next` and `pnpm test:vinext` run the browser matrices. The release evidence records remaining blockers separately from passing checks.

## Published verification

The following evidence describes the 0.1.0 release, it is not coverage of every application or later version.

`pnpm test:ci` passes 1,569 tests, type checking, the built-package verifier, and all 19 source/dist size budgets. The 91 ordinary-suite skips are not passes. Native Node import order, NodeNext declarations, development/production behavior, and actual Vite feature selection are checked.

The separate Chrome gate passes 1,266 case executions across Redact and React, including repeated suites/motion modes, not 1,266 unique behaviors. Seven declared exclusions remain: six Node-only stream executions and one known React Activity hydration failure. [Chrome ledger](https://github.com/TanStack/redact/blob/main/benchmarks/SHIP_CHROME_FINAL.md).

| Real app | Published Redact 0.1.0 result |
|---|---|
| tanstack.com | Production build, 503 tests, 5 local Worker routes, navigation/history, controls, portals, and mobile checks pass. Deployed preview works; production upgrade awaits required review. |
| tannerlinsley.com | Upgraded in production. Normal build prerenders all 10 pages; 8 live routes and browser interactions pass with no browser errors. Existing mobile header overflow remains. |

These are integration checks, not site-speed measurements or coverage of authenticated flows. [Published-package and deployment evidence](https://github.com/TanStack/redact/blob/main/benchmarks/RELEASE_0_1_0_SITES.md), [earlier renderer controls](https://github.com/TanStack/redact/blob/main/benchmarks/SHIP_SITE_INTEGRATION.md).
