# Framework release blockers

## Maintained release adapters

The current release candidate carries these corrections in Redact, so publication does not depend on another upstream release. The historical reproductions below still record the original failures.

- Next 16.2 uses a browser development loader that requires decoded body bytes before treating a zero transfer size as a cache hit. Debug-channel replay remains intact. All 222 targeted development scenarios pass with published Next 16.2.12, both bundlers, both cache modes, and three browsers.
- The Vinext adapter corrects shim optimizer identity, shares Pages instrumentation state, and preserves Pages data URLs during trailing-slash canonicalization. Node and Worker request handlers use the same transform path. Both native React and Redact controls use these shipped corrections.
- `@tanstack/redact/cloudflare` supplies a reproducible owned copy of Cloudflare Vite plugin 1.65.0 with the development evaluator fix. The four installed-package checks cover the original and owned distributions in development and production. Production results match the original plugin.
- Standard npm and pnpm overrides resolve Miniflare's Undici dependency to the published 7.30.1 security fix. The malformed-response negative control still crashes on 7.29.1; the upgraded dependency rejects safely. Miniflare's JavaScript is byte-identical. The Cloudflare-only consumer audit reports zero vulnerabilities. The full Vinext graph also needs the published fflate 0.7.5 fix through a Satori dependency override.

The Vinext development transform also applies the React Flight timing guards from PR 37572. Tests execute both real compiled error and cancellation tracks with the captured negative timestamp, preserve valid measurements, and require real measurement errors to propagate.

The final packed candidate passes all 162 Next.js configurations and 2,694 scenarios, all 102 local Vinext configurations and 1,410 scenarios, and all 18 hosted configurations and 282 scenarios. The complete gates remain required for publication. See [Next.js evidence](../NEXT_COVERAGE.md), [Vinext evidence](../VINEXT_COVERAGE.md), and [configuration and maintenance details](../../docs/vinext.md).

## Historical upstream investigation


These reproductions investigate dependency failures. The Redact release consumer installs the published dependencies without patches, and its failures remain in the release gate.

## Vinext Pages data redirects

Vinext 1.3.0 normalizes a Pages data URL to its document pathname before the mixed-router handler applies trailing-slash canonicalization. With `trailingSlash: true`, a JSON request receives a document redirect and Pages navigation reloads the app, losing client state. Both native React and Redact reproduce the failure.

[Source fix and tests](./vinext-pages-data.patch) target cloudflare/vinext commit `5c2c5b76abff857bfcf9e0dc266cf750ad56b4a6`. The handler excludes verified data requests from document canonicalization. Document requests still redirect, including requests with a forged `x-nextjs-data` header.

- The 16 new cases cover root, static, and dynamic data URLs, both trailing-slash settings, and empty or `/docs` base paths. Four fail before the fix, all 16 pass after it.
- All 442 tests in `tests/app-rsc-handler.test.ts` pass after the fix.
- `vp check tests/app-rsc-handler.test.ts packages/vinext/src/server/app-rsc-handler.ts` passes formatting, lint, and type checks.
- The [published-handler reproduction](./vinext-pages-data.mjs) independently fails four cases against unmodified 1.3.0 and passes all 16 against a local copy with the same source fix.
- [Next.js reference tests](https://github.com/vercel/next.js/blob/canary/test/e2e/middleware-trailing-slash/test/index.test.ts) request JSON data URLs with trailing slashes enabled. Redact's Next.js matrix also preserves Pages state in the same journey.

Run the published-handler reproduction with:

```sh
node --conditions=react-server benchmarks/upstream/vinext-pages-data.mjs /path/to/node_modules/vinext
```

[Upstream PR #4299](https://github.com/cloudflare/vinext/pull/4299) is open. [Contribution text](./vinext-pages-data-pr.md).

## Vinext Workers development prebundling

The unpatched mixed-router Workers development fixture fails with `react_react_server.createContext is not a function`, with both native React and Redact. Vinext's `next/*` client shims enter the RSC dependency optimizer under the wrong React export conditions. The separate Pages-only pipeline does not reproduce this failure.

[Upstream PR 4268](https://github.com/cloudflare/vinext/pull/4268) fixes shim optimizer exclusions. It remains open, and Vinext 1.3.0 is still the latest stable npm release checked on October 24, 2026. The Redact adapter does not rewrite Vinext's server module graph.

## Cloudflare Workers development evaluation

After correcting Vinext's optimizer exclusions, Cache Components development rendering reports `eval() is not supported in this environment` with both native React and Redact in all three browser engines. React Flight uses indirect eval to reconstruct development call stacks. The Cloudflare Vite runner has a local evaluator for loading modules, but global eval still throws.

The [proposed source fix and tests](./cloudflare-dev-eval.patch) connect indirect eval to that existing evaluator when the development runner starts. They preserve non-string inputs, return values, and exceptions. The patch targets upstream module-runner blob `11a59be48fd39d81646398b0cf5f801e47d0a836`. Its equivalent was tested in stable Cloudflare Vite plugin 1.65.0. Production Workers keep their eval restriction.

All 12 Workers development configurations and all 258 scenarios pass after the optimizer and evaluator fixes, including native React and Redact, both rendering modes, and all three browser engines. These are [modified-dependency diagnostics](../results/framework-upstream-fix-diagnostics.json), not release evidence.

The cached content and counter assertions complete before the unsupported-eval console error fails the strict gate. This is a confirmed development debugging incompatibility; no production rendering failure was demonstrated. The proposed change enables indirect eval throughout the development runner, and that scope needs upstream design review.

Three helper tests and strict TypeScript checks pass. The [framework-free Worker reproduction](./cloudflare-dev-eval.mjs) verifies the original development failure, the corrected behavior, and the unchanged production restriction. The changed files pass formatting with the upstream configuration. The full workers-sdk package suite has not been run locally.

The upstream PR now includes a permanent real-Worker playground regression, commit `6ae1ed8343b15b34c9b6928acae589f3e18908ac`. It captures and calls indirect eval while application modules initialize, checks values, function names, non-string identity, and thrown errors, and requires production to keep rejecting string evaluation. All 13 development tests and 12 production tests pass, with the existing production HMR skip unchanged. Removing the runner installation makes the same regression fail with `EvalError`. All 16 dependency build tasks, fixture types, formatting, and type-aware lint pass. [Recorded results and negative control](../results/cloudflare-dev-eval-playground.json).

```sh
node benchmarks/upstream/cloudflare-dev-eval.mjs /path/to/unmodified-consumer --expect-unsupported
node benchmarks/upstream/cloudflare-dev-eval.mjs /path/to/fixed-consumer
node benchmarks/upstream/cloudflare-dev-eval.mjs /path/to/fixed-consumer --production --expect-unsupported
```

[Upstream PR #16466](https://github.com/cloudflare/workers-sdk/pull/16466) was automatically closed by Cloudflare's contributor gate, then reopened by a maintainer on October 25 after the account was added to the contributor list. It is awaiting review and publication. [Contribution text](./cloudflare-dev-eval-pr.md). This fix is not applied by Redact or by the release consumer.

## React Flight development profiler

Native React reproduced `Performance.measure: Given attribute end cannot be negative` during a Firefox navigation. The recorded call was for `Content Errored`, with `start: 0` and `end: -8.478078109386843`. The diagnostic logger rethrew the exception, so it did not hide the failure.

React's errored and aborted Flight performance tracks can pass an uninitialized or translated negative end time to the browser. [Issue 37561](https://github.com/react/react/issues/37561), [fix PR 37563](https://github.com/react/react/pull/37563), and [fix PR 37572](https://github.com/react/react/pull/37572) remain open. React 19.3.1 is the latest published 19.3 patch checked on October 24, 2026.

## Next 16.2 Firefox development streaming

Native React and Redact reproduce repeated document reloads before a streamed Suspense boundary finishes, with both bundlers and both rendering modes. Next 16.2's debug-channel cache detector treats an unfinished Firefox navigation's zero `transferSize` as a cached document, then calls `location.reload()` when it cannot restore the channel.

[Next issue 94634](https://github.com/vercel/next.js/issues/94634) tracks the behavior. [PR 97510](https://github.com/vercel/next.js/pull/97510) removes debug-channel persistence and cache detection in later Next versions. That code is present in the tested Next 16.4.3 package. Next 16.2.12 remains the latest published 16.2 patch checked on October 24, 2026.

The four affected Next 16.2 matrix cases stay in the release gate. The tests do not replace `Performance`, suppress reloads, or patch the installed framework.

### Next 16.2 backport path

The earlier targeted fix, [PR 94128](https://github.com/vercel/next.js/pull/94128), already has a [16.2 backport request with a native React reproduction](https://github.com/vercel/next.js/pull/94128#issuecomment-5147626082). The [maintainer response](https://github.com/vercel/next.js/pull/94128#issuecomment-5176202998) directs users to 16.3.0. The existing `next-16-2` branch still contains the faulty `transferSize === 0` check.

Next's current [release policy](https://github.com/vercel/next.js/blob/canary/contributing/repository/release-channels-publishing.md) freezes the old `next-*` branches. A maintainer must create a `releases/16-2` branch from a release tag through the release-bot workflow before accepting and publishing a new 16.2 backport. That branch did not exist when checked on October 24, 2026.

The final upstream fix has two parts: [PR 97505](https://github.com/vercel/next.js/pull/97505) restores `no-store` for development documents and data responses, then [PR 97510](https://github.com/vercel/next.js/pull/97510) removes the cache replay machinery. Removing replay alone would break cached document restores on the old line. Both changes, their browser history tests, and the applicable release-workflow prerequisite need maintainer review for a 16.2 release. No duplicate PR was opened against the frozen branch, and the Redact version range and required checks remain unchanged.


### Tested Next 16.2 source backport

The [backport branch](https://github.com/tannerlinsley/next.js/tree/taren/backport-next-162-development-cache), commit `6ebceaf5becb273501452938baf8d85b0298c36c`, applies both development cache changes to tag `v16.2.12`. It preserves the 16.2 debug-stream API and handles stream cancellation without leaving a rejected cleanup promise. [Patch](./next-16.2-development-cache.patch).

The complete source bootstrap passed all 17 build tasks. The existing development cache suite now covers document headers, unchanged static-asset ETags and 304 responses, and a streamed document that must finish without reloading. The existing browser-history interactivity regression is unchanged. All five tests pass in Chromium, Firefox, and WebKit, with Turbopack and Webpack, and with Cache Components on and off: 60 checks across 12 configurations. ESLint and formatting pass. [Recorded upstream matrix](../results/next-16.2-backport-upstream.json).

The source-built Next package also passes the unchanged full development journeys with native React and Redact: all 24 browser configurations and 444 scenario groups, with both bundlers and Cache Components on and off. Each renderer passes 222 scenarios. These are [backport diagnostics](../results/next-16.2-backport-integration.json), separate from the required unmodified-dependency release gate. The frozen Redact package hash remains `8a9d69cc858ad6ce31fce298e2e20312e75db92f2f2e1aaf10ded56b44bcba97`.

This branch is ready for backport review. It cannot become a 16.2 release until a Next.js maintainer creates the active release branch and accepts the backport. It is not installed by the Redact release fixture.


## Cloudflare tooling dependency advisory

The PR dependency scan reports [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c). The installed Miniflare `5.20261019.2-beta` pins Undici `7.29.1`; the corrected 7.x release is `7.30.1`. A malicious HTTP response with excessive content encodings can crash the local Node process. This dependency belongs to the verification/deployment tooling, not either Redact client bundle.

Wrangler `4.152.0` and Cloudflare Vite plugin `1.65.0` remain the latest published versions checked on October 25, 2026, and both resolve the affected Miniflare dependency. The upstream workspace catalog also still pins `7.29.1`. The advisory is not dismissed. A published tooling update and fresh unpatched verification are needed before calling this stack release-ready.


### Tested Cloudflare dependency fix

[Workers SDK PR #16476](https://github.com/cloudflare/workers-sdk/pull/16476) updates the shared Undici and Undici-types catalog to 7.30.1, regenerates the lockfile, and includes Changesets for the bundled consumers. A maintainer reopened, approved, and merged it on October 25, 2026. [Patch](./cloudflare-undici.patch), [contribution text](./cloudflare-undici-pr.md).

The regression sends excessive content encodings and closes the response early. The untouched published Miniflare exits with an unhandled Readable error. Source-built Miniflare with Undici 7.30.1 rejects the fetch and exits cleanly, with no stderr. [Before and after output](../results/cloudflare-undici-regression.json).

All 75 Miniflare HTTP tests across five files pass, along with the nine dependency build tasks, Miniflare type checking, catalog and pinned-dependency checks, and formatting and lint for the changed test. The full Workers SDK matrix was not run locally. The latest six upstream platform test jobs pass on Linux, macOS, and Windows. The advisory remains open in the Redact dependency gate until patched tooling is published and the unmodified consumer is reverified.

## Vinext compression dependency advisory

The full Vinext consumer audit also finds [GHSA-px8p-9vwx-vf98](https://github.com/advisories/GHSA-px8p-9vwx-vf98) in Satori's pinned fflate 0.7.3. The published 0.7.5 patch fixes an infinite loop when a ZIP64 entry omits its required extra field. The release fixture uses a standard scoped override. `scripts/test-framework-dependencies.mjs` checks malformed input rejection and valid ZIP and zlib round trips, with an optional original-package negative control.

Both original dependency failures reproduce in the frozen published consumer. With Undici 7.30.1 and fflate 0.7.5, the same checks exit successfully and the full consumer audit reports zero vulnerabilities. [Recorded negative controls and fixed results](../results/framework-owned-security.json).
