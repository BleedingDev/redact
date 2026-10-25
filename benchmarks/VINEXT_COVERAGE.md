# Vinext release evidence

The stable release requires both the mixed-router and Pages-only suites to pass from the same fresh npm consumer using the documented integrations. Workspace links or edits to installed dependency files do not satisfy this gate.

## Recorded run

The October 25 release candidate passes all 102 configurations and all 1,410 scenarios from one fresh npm consumer. The mixed-router suite passes 66 configurations and 1,260 scenarios. The separate Pages-only suite passes 36 configurations and 150 scenarios. There are no missing cases, browser failures, or observed differences in the paired transition checks.

Both renderers use the maintained corrections shipped in Redact. The consumer uses published Vinext and Cloudflare tooling, the owned Redact Cloudflare entry, and the documented dependency overrides. No installed dependency files are edited. Source and build fingerprints match across both router suites and the hosted run.

[Mixed-router report](./results/framework-stable-vinext.json), [Pages-only report](./results/framework-stable-vinext-pages.json), [combined release result](./results/framework-stable-vinext-combined.json), [runtime, package, size, and audit checks](./results/framework-stable-validation.json).

The earlier failing runs remain available: [mixed-router report](./results/framework-release-vinext.json), [Pages-only report](./results/framework-release-vinext-pages.json), [combined result](./results/framework-release-vinext-combined.json). Their shared Pages redirects and Worker setup failures led to the shipped corrections. The one native React WebKit image-loading failure was not reproduced in ten diagnostic runs, and the original failure remains recorded.

## Matrix

| Suite | Configurations | Scenario groups |
|---|---:|---:|
| App Router with Pages Router | 66 | 1,260 |
| Pages Router without an App Router | 36 | 150 |
| Combined gate | 102 | 1,410 |

Both suites run native React and Redact in Chromium, Firefox, and WebKit across Node development and production, standalone output, static export, and local Workers development and production. The mixed suite also checks Cache Components enabled and disabled. Standalone and static output use a base path and trailing slashes.

Versions: Vinext 1.3.0, React 19.3.1, Vite 8.3.5, React plugin 6.1.2, RSC plugin 0.5.38, Cloudflare Vite plugin 1.65.0, Wrangler 4.152.0, Node 24.22.0. Cloudflare tooling uses stable published releases.

## Reproduce

```sh
nvm use
pnpm install --frozen-lockfile
pnpm exec playwright install chromium firefox webkit
pnpm test:ci
pnpm test:vinext
```

`test:vinext` packs Redact, installs it with npm in a separate consumer, and runs both suites even if the first fails. Each suite validates package, source, fixture, and check fingerprints. The combined `release.json` additionally requires both suites to test the same runtime. Browser errors, missing cases, duplicate cases, setup failures, and partial runs fail the gate.

PR checks and release publication both require the complete gate. The workflow uploads evidence even when tests fail. Worker checks are local; hosted deployment verification is separate.

## Bundle limits

The published full client measures 27,921 bytes gzip against the original 28,183-byte total limit. The default Vite client measures 23,304 bytes against 23,335. All 38 existing size gates pass. [Full measurements](./results/framework-release-sizes.json).

## Maintained framework corrections

The adapter corrects Vinext shim module identity, Pages instrumentation state, and Pages JSON redirects. Its development Flight transform validates profiler timing bounds. The owned Cloudflare integration corrects development evaluation while preserving production behavior. Standard package-manager overrides select the published Undici and fflate security fixes. [Configuration and maintenance details](../docs/vinext.md), [root causes and upstream contributions](./upstream/README.md).

These corrections passed the complete package gate above. The release does not depend on another upstream publication.

## Upstream fix validation

An isolated consumer with the proposed dependency fixes passes all 24 affected configurations and all 504 scenarios: 12 standalone configurations for the Pages data redirect fix, and 12 Workers development configurations for the optimizer and development evaluator fixes. Both renderers and all three browser engines pass, with Cache Components enabled and disabled.

These earlier [diagnostic results](./results/framework-upstream-fix-diagnostics.json) used modified dependencies. They established the root causes before the corrections were shipped in Redact. The final package result above supersedes them for release readiness. The [Cloudflare Worker contract checks](./results/cloudflare-dev-eval-diagnostic.json) separately verify corrected development behavior and unchanged production restrictions.

## Hosted Workers

The deployed run passes all 18 configurations and all 282 scenarios using the same packed package and consumer lockfile as the local matrix. It covers native React and Redact in Chromium, Firefox, and WebKit, with standard rendering, Cache Components, and Pages-only apps. [Complete hosted report](./results/framework-stable-vinext-hosted.json).

[Redact preview](https://redact-vinext-stable-1025-redact-app.thetanstack.workers.dev), [native React preview](https://redact-vinext-stable-1025-react-app.thetanstack.workers.dev), [Redact Pages-only preview](https://redact-vinext-stable-1025-redact-pages.thetanstack.workers.dev).

`pnpm test:vinext:hosted --deploy` creates six application Workers and one shared fixture service in an explicitly selected Cloudflare account. It requires a fresh packed-package consumer and runs all 18 configurations and 282 scenarios. It checks each deployed version before opening browsers and records deployment IDs, runtime hashes, fixture hashes, and results.

```sh
pnpm build
node scripts/prepare-vinext-consumer.mjs /tmp/redact-hosted-consumer
CLOUDFLARE_ACCOUNT_ID=your-account-id \
VINEXT_TEST_CONSUMER=/tmp/redact-hosted-consumer \
VINEXT_HOSTED_RESULTS=/tmp/redact-hosted-results \
pnpm test:vinext:hosted --deploy
```

The fixtures use Durable Object storage for records and Vinext's public `cache.data` adapter for a shared cache. The cache coordinator runs Vinext's own `MemoryCacheHandler`, with one namespace per application, so tag invalidation reaches every application isolate. Cloudflare RPC preserves binary Flight values. This is test infrastructure, not code shipped in either Redact bundle.

A local workerd contract verifies cache reads, invalidation across clients, namespace isolation, binary values, controlled streaming, and record writes. Hosted browser checks additionally make 12 concurrent server requests before and after a mutation, then reload the page. The original mutation assertion also remains.

The first completed hosted run passed 269 of 270 scenarios. Its one stale-data failure was reproduced in native React and Redact by warming separate Worker caches before saving. The fixture then gained a shared cache and the concurrent-read regression. That failure is retained in the [initial hosted report](./results/framework-release-vinext-hosted-initial.json).

The exact six-run cache reproduction returned 62 stale responses out of 144 reads before the correction and zero out of 144 afterward. Both renderers pass afterward. [Before/after diagnostic](./results/framework-hosted-cache-diagnostic.json).
