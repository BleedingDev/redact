# Vinext release evidence

The stable release requires both the mixed-router and Pages-only suites to pass from the same unpatched npm consumer. No workspace links or dependency patches satisfy this gate.

## Recorded run

The recorded local packed-runtime run passes all 36 Pages-only configurations and all 150 Pages scenarios. Both router suites record the same source and build fingerprints.

The mixed suite attempts all 66 configurations. It completes 54 and passes 41. Of 1,002 executed scenarios, 989 pass and 13 fail. Twelve Workers development configurations fail setup, leaving 258 required scenarios unexecuted. The gate reports incomplete coverage and fails.

Twelve scenario failures are Pages data navigation in standalone output, affecting native React and Redact equally. One native React WebKit component case failed to load its image after a lost network connection. Ten separate diagnostic runs, including two full journeys per renderer, did not reproduce that image failure. The original failure is retained.

In that local run, no executed scenario failed only with Redact, and the paired transition checks recorded no behavior differences. This does not turn shared failures or missing scenarios into passes.

[Mixed-router report](./results/framework-release-vinext.json), [Pages-only report](./results/framework-release-vinext-pages.json), [combined release result](./results/framework-release-vinext-combined.json).

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

## Remaining dependency failures

[Root causes, native React controls, and upstream fixes](./upstream/README.md). The unpatched mixed-router stack has Pages data redirects and Workers development prebundling failures. Correcting the optimizer also exposes a Cloudflare development eval failure during Cache Components rendering. React's development Flight profiler has a separately reproduced negative timestamp failure. These failures remain visible in the strict reports.

## Upstream fix validation

An isolated consumer with the proposed dependency fixes passes all 24 affected configurations and all 504 scenarios: 12 standalone configurations for the Pages data redirect fix, and 12 Workers development configurations for the optimizer and development evaluator fixes. Both renderers and all three browser engines pass, with Cache Components enabled and disabled.

These are [diagnostic results](./results/framework-upstream-fix-diagnostics.json) from modified dependencies. They do not replace the unpatched release result above. The [Cloudflare Worker contract checks](./results/cloudflare-dev-eval-diagnostic.json) separately verify corrected development behavior and unchanged production restrictions.

## Hosted Workers

The deployed run passes all 18 configurations and all 282 scenarios using the same unpatched package as the local matrix. It covers native React and Redact in Chromium, Firefox, and WebKit, with standard rendering, Cache Components, and Pages-only apps. [Complete hosted report](./results/framework-release-vinext-hosted.json).

[Redact preview](https://redact-vinext-mvna4dza-redact-app.thetanstack.workers.dev), [native React preview](https://redact-vinext-mvna4dza-react-app.thetanstack.workers.dev), [Redact Pages-only preview](https://redact-vinext-mvna4dza-redact-pages.thetanstack.workers.dev).

`pnpm test:vinext:hosted --deploy` creates six application Workers and one shared fixture service in an explicitly selected Cloudflare account. It requires an unpatched packed-package consumer and runs all 18 configurations and 282 scenarios. It checks each deployed version before opening browsers and records deployment IDs, runtime hashes, fixture hashes, and results.

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
