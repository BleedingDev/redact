---
id: vinext
title: Vinext
---

Add Redact after Vinext in your Vite configuration:

```js
import { defineConfig } from 'vite'
import vinext from 'vinext'
import { redact } from '@tanstack/redact/vinext'

export default defineConfig({
  plugins: [vinext(), redact()],
})
```

Keep React, React DOM, and React Server DOM installed. Keep your normal `react`, `react-dom`, and `next/*` imports. Vinext uses native React for server rendering and Server Components, while Redact renders in the browser. Do not change `jsxImportSource` to Redact.

The release matrix pins Vinext 1.3.0, Vite 8.3.5, React 19.3.1, React plugin 6.1.2, and RSC plugin 0.5.38. Local Workers use stable Cloudflare Vite plugin 1.65.0 and Wrangler 4.152.0. Use Node 24.22.0 from `.nvmrc`.

The stable release remains blocked by failures in the unpatched Vinext stack, including failures reproduced with native React. These remain failures in the release gate. [Results, root causes, and upstream fixes](../benchmarks/VINEXT_COVERAGE.md).

## Client size and performance

In Vinext's benchmark suite, the same app emitted 154.9 KB of gzipped client JavaScript and CSS with React and 115.5 KB with Redact, a 39.4 KB or 25.4% reduction. All six builds returned the same sizes. These totals include lazy routes, they are not the download for one page.

Production builds took about 18 ms longer, or 1.9%. Startup differences were inconclusive. Browser rendering, hydration, responsiveness, and SSR throughput were not timed. [Full measurements and limits](../benchmarks/VINEXT_BENCHMARKS.md).

## What the adapter changes

The browser resolver replaces React, React DOM, the JSX and compiler runtimes, and Scheduler. It uses the React ID and Flight bridges shared with the Next.js adapter and keeps the replaced browser modules out of dependency prebundling.

Vite's alias table is shared across environments. The adapter uses environment-specific resolution hooks so native server React and Flight remain intact. It uses the full Redact renderer. The separate Vite plugin's feature presets do not apply.

## Rendering behavior

Redact keeps committed content visible when a transition suspends, tracks pending state until it commits, and retains stale results for `useDeferredValue`. Urgent updates can proceed while suspended work waits, with queued updates rebased in their original order. The browser journeys check intermediate states against native React, along with the eventual result.

Hidden Activity trees can suspend without holding a visible route transition open. Rendering within a pass remains synchronous. Redact does not implement React's time slicing or interrupt a component in the middle of rendering.

## Verification

`pnpm test:vinext` packs Redact, installs it with npm outside the workspace, and runs both router suites against that same package. No dependency patches are applied. Reusing a test consumer reinstalls its dependencies, so previous local edits cannot carry into the release checks. Results fingerprint the package, consumer lockfile, fixture, and checks.

The mixed App Router and Pages Router suite contains 66 configurations and 1,260 scenario groups. It runs native React and Redact in Chromium, Firefox, and WebKit across development, production, Cache Components, standalone Node output, static export, and local Cloudflare Workers. Standalone and static cases use `/coverage` as a base path with trailing slashes.

A separate Pages-only suite contains 36 configurations and 150 scenarios. It removes the App Router entirely to exercise Vinext's Pages pipeline, including SSR, static props, client navigation, state retention, server DOM adoption, and Fast Refresh. It runs both renderers and all three browsers across Node, standalone output, static export, and local Workers.

```sh
pnpm install
pnpm exec playwright install chromium firefox webkit
pnpm test:vinext
```

The combined gate requires all 102 configurations and 1,410 scenario groups from one packed runtime. It writes `release.json` with both suite summaries. Browser errors, setup failures, missing cases, partial runs, and mismatched fingerprints fail the gate. The Pages suite still runs if the mixed suite fails.

The [Vinext compatibility workflow](../.github/workflows/vinext.yml) runs on PRs, before release publication, and on manual dispatch. It also runs runtime tests, type checks, package verification, and all existing size limits. Evidence is saved even when checks fail.

The automatic Worker matrix runs locally. A separate hosted gate deploys native React and Redact apps, with and without Cache Components, plus Pages-only apps. It runs all three browsers against the deployed versions. [Hosted verification](../benchmarks/VINEXT_COVERAGE.md#hosted-workers).

Deployed apps need shared data and cache storage. Vinext's default memory cache belongs to one Worker isolate, so `revalidatePath` cannot invalidate another isolate's copy. Configure a shared data-cache adapter through `vinext({ cache })`. Redact does not change server caching.

For a single diagnostic mode:

```sh
pnpm build
node scripts/test-vinext.mjs
node scripts/test-vinext.mjs --production
node scripts/test-vinext.mjs --production --standalone
node scripts/test-vinext-static.mjs
```

Set `VINEXT_TEST_REFERENCE=1` for native React, `VINEXT_TEST_WORKERS=1` for local Workers, or `VINEXT_TEST_CACHE_COMPONENTS=1` for Cache Components. `VINEXT_TEST_BROWSERS` selects diagnostic browsers. Partial runs do not satisfy the release gate.

Run the development example with `pnpm example:vinext`. `pnpm test:vinext:workspace` uses workspace dependencies for diagnosis. Release evidence comes from the fresh npm consumer.
