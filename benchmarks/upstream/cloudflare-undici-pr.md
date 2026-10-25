Undici 7.29.1 can terminate the Node process after `fetch()` rejects a response with more than five content encodings and the server closes the connection early. Catching the rejected promise does not catch the later unhandled error on the internal response stream. This affects the published Miniflare dependency in the current Wrangler and Vite toolchain, as described in [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c).

Update the shared Undici and matching types catalog pins to 7.30.1 and regenerate the lockfile. Include release notes for runtime dependencies and bundled consumers so the corrected dependency ships through the tools that use it.

The new Miniflare HTTP regression serves a truncated, over-encoded response and runs the fetch in a child process. It verifies both the expected rejection and a clean process exit, so catching the fetch error alone cannot make the test pass. The same check exits with an unhandled Readable error against the published 7.29.1 dependency and exits cleanly against the source-built 7.30.1 update.

Validation:

- Miniflare and its workspace dependencies build successfully, nine tasks.
- All 75 Miniflare HTTP tests pass, including the process-exit regression.
- Miniflare TypeScript checks pass.
- Catalog and exact dependency-pin validators pass.
- Changed files pass formatting; the regression passes type-aware lint.

The full Workers SDK test matrix has not been run locally.

---

- Tests
  - [x] Tests included/updated
  - [ ] Automated tests not possible - manual testing has been completed as follows:
  - [ ] Additional testing not necessary because:
- Public documentation
  - [ ] Cloudflare docs PR(s):
  - [x] Documentation not necessary because: this updates a vulnerable dependency without changing public configuration or API behavior.
