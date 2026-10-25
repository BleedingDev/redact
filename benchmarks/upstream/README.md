# Framework release blockers

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

Three helper tests and strict TypeScript checks pass. The [framework-free Worker reproduction](./cloudflare-dev-eval.mjs) verifies the original development failure, the corrected behavior, and the unchanged production restriction. The changed files pass formatting with the upstream configuration. The full workers-sdk package suite has not been run.

```sh
node benchmarks/upstream/cloudflare-dev-eval.mjs /path/to/unmodified-consumer --expect-unsupported
node benchmarks/upstream/cloudflare-dev-eval.mjs /path/to/fixed-consumer
node benchmarks/upstream/cloudflare-dev-eval.mjs /path/to/fixed-consumer --production --expect-unsupported
```

[Upstream PR #16466](https://github.com/cloudflare/workers-sdk/pull/16466) was submitted, then automatically closed because the contributing account is not on Cloudflare's vouched-collaborator list. A maintainer can reopen it. [Contribution text](./cloudflare-dev-eval-pr.md). This fix is not applied by Redact or by the release consumer.

## React Flight development profiler

Native React reproduced `Performance.measure: Given attribute end cannot be negative` during a Firefox navigation. The recorded call was for `Content Errored`, with `start: 0` and `end: -8.478078109386843`. The diagnostic logger rethrew the exception, so it did not hide the failure.

React's errored and aborted Flight performance tracks can pass an uninitialized or translated negative end time to the browser. [Issue 37561](https://github.com/react/react/issues/37561), [fix PR 37563](https://github.com/react/react/pull/37563), and [fix PR 37572](https://github.com/react/react/pull/37572) remain open. React 19.3.1 is the latest published 19.3 patch checked on October 24, 2026.

## Next 16.2 Firefox development streaming

Native React and Redact reproduce repeated document reloads before a streamed Suspense boundary finishes, with both bundlers and both rendering modes. Next 16.2's debug-channel cache detector treats an unfinished Firefox navigation's zero `transferSize` as a cached document, then calls `location.reload()` when it cannot restore the channel.

[Next issue 94634](https://github.com/vercel/next.js/issues/94634) tracks the behavior. [PR 97510](https://github.com/vercel/next.js/pull/97510) removes debug-channel persistence and cache detection in later Next versions. That code is present in the tested Next 16.4.3 package. Next 16.2.12 remains the latest published 16.2 patch checked on October 24, 2026.

The four affected Next 16.2 matrix cases stay in the release gate. The tests do not replace `Performance`, suppress reloads, or patch the installed framework.
