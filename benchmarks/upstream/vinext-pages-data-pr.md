# fix(router): keep Pages data requests out of document redirects

Published: https://github.com/cloudflare/vinext/pull/4299

With `trailingSlash: true`, the mixed App and Pages Router handler normalizes `/_next/data/<build-id>/page.json` to `/page`, then redirects it to `/page/`. Pages navigation receives a document response and reloads, losing client state.

Exclude verified Pages data requests from document trailing-slash canonicalization. Keep normal document redirects, including when a document request supplies an `x-nextjs-data` header.

Add 16 regression cases for root, static, and dynamic data URLs, both slash settings, and empty or `/docs` base paths. Four fail before the fix. All 442 handler tests pass after it. Formatting, lint, and type checks pass for both changed files.

Next.js reference: https://github.com/vercel/next.js/blob/canary/test/e2e/middleware-trailing-slash/test/index.test.ts

Validation:

```sh
vp test run --project unit tests/app-rsc-handler.test.ts
vp check tests/app-rsc-handler.test.ts packages/vinext/src/server/app-rsc-handler.ts
```
