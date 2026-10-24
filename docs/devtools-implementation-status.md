# React DevTools

Redact connects to the official React DevTools backend in development. No extra plugin or application setup is needed beyond `redact()` and the React DevTools extension.

## Checked behavior

The same 17 scenarios run against Redact and React DOM 19.3.1 using `react-devtools-inline@8.0.0`. Six additional integration tests cover Redact's synchronous downgrade hooks and renderer integration.

Full-suite validation: 1,679 tests passed, with 91 existing skips. Type checks, package build checks, and all source and built-package size budgets passed.

- Component, props, state, context, and hook inspection, including custom hooks, `useDebugValue`, and `use()` thenables.
- Editing, deleting, and renaming nested props and hook state, plus class state and props edits.
- Owner chains, component source functions, hook source locations, and stable IDs across updates and keyed moves.
- Render and effect warning attribution, warning clearing, and error boundary controls, including naturally caught errors.
- Suspense controls that preserve the retained DOM and state when toggled off and back on.
- Portals, multiple roots, hydration, hidden Activity children, lazy and memo-wrapped classes, memo names, Profiler nodes, and ViewTransition nodes.
- Separate commit timings, layout and passive effect timings, update attribution, hook change descriptions, and sparse-update profiles.

The browser check uses the real Components and Profiler interfaces. It checks live hook updates, browser source locations, profile recording, export, and import. The embedded frontend needs experimental React, which is isolated to the test harness. The reference application tests use stable React 19.3.1.

These checks cover Redact's client renderer. They do not add concurrent scheduling, Server Components, or React scheduler timeline events. Redact's existing synchronous downgrades stay in place, and the public `<Profiler onRender>` callback remains a no-op. DevTools commit profiling works independently of that callback. DevTools is intentionally unavailable in production, including production profiling builds.

## Production size

All 38 Vite production fixtures, 19 source entries and 19 built-package entries, are byte-for-byte identical to the pre-DevTools baseline at `f84f5d7`. Minified, gzip, and Brotli increases are all zero. No size budgets were raised.

The production test also checks that the metadata, adapter, effect timing, and refresh modules contribute zero output bytes and that rendering never touches the DevTools hook.

## Development cost

Owner stacks and debug trees are only collected with a real DevTools backend attached. Owner stack capture uses React's 10,000-element-per-second limit. Unchanged subtrees are reused, with sibling paths copied where needed to preserve DevTools identity.

The benchmark alternates baseline Redact, current Redact, and React in headless Chrome. Each of 12 samples warms up with 20 updates, then measures 100 synchronous updates. Results are local measurements, not a general performance guarantee. Real React is loaded without the repository's React-to-Redact aliases.

| Development workload, DevTools attached | Redact per update | React 19.3.1 per update |
| --- | ---: | ---: |
| Update all 300 leaves | 0.94 ms | 1.12 ms |
| Update first leaf in a 1,000-leaf tree | 0.78 ms | 0.82 ms |
| Update last leaf in a 1,000-leaf tree | 1.33 ms | 0.83 ms |

The last-leaf case still costs more because the adapter copies the preceding sibling path. This is development-only overhead, not a production regression. Without a backend attached, full-tree updates measured 0.094 ms versus 0.089 ms before this change. Sparse-update measurements were at the timer's practical resolution, around 0.002 to 0.003 ms per update.

## Reproduce

Use Node 24 and run from the repository root:

```sh
pnpm test
pnpm test:types
pnpm build
pnpm size:check
CHROME_CHANNEL=chrome node scripts/verify-devtools-browser.mjs
node scripts/verify-devtools-production.mjs BASELINE_REPOSITORY
CHROME_CHANNEL=chrome node scripts/bench-devtools.mjs BASELINE_REPOSITORY
CHROME_CHANNEL=chrome BENCH_WORKLOAD=sparse node scripts/bench-devtools.mjs BASELINE_REPOSITORY
CHROME_CHANNEL=chrome BENCH_WORKLOAD=sparse BENCH_LEAF=999 node scripts/bench-devtools.mjs BASELINE_REPOSITORY
```

The baseline needs the same root TypeScript configuration and a built `packages/redact/dist` directory. Omit `CHROME_CHANNEL` to use Playwright's installed Chromium instead. Browser screenshots and the exported profile go to the system temporary directory, or `DEVTOOLS_ARTIFACT_DIR` when set.

The adapter uses React's private fiber protocol. Its advertised reconciler version is 19.2.3, with compatibility checked against React 19.3.1 and React source commit `a6b912fbe77f698ad43c922f206db0d4f4ad7485`. Future DevTools protocol changes need new compatibility checks.
