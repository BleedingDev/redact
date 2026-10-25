# [vite-plugin] Support React development stack reconstruction

Published: https://github.com/cloudflare/workers-sdk/pull/16466

Status: automatically closed by the vouched-collaborator gate; requires maintainer action to reopen.

React 19.3.1 logs `eval() is not supported in this environment` when decoding cached Server Component output in the Vite development Worker. This reproduces with native React and Redact using Vinext 1.3.0, `@vitejs/plugin-rsc` 0.5.38, and `@cloudflare/vite-plugin` 1.65.0.

The cached content renders and the counter remains interactive. The observed failure is React's development debugging diagnostic, and no production rendering failure has been demonstrated. React Flight uses indirect eval to reconstruct development call stacks, while the runner's global eval still throws.

This proposes connecting indirect eval to the runner's existing local evaluation binding before application modules load. Non-string inputs retain their identity, and evaluator return values and exceptions propagate. This enables indirect eval throughout the development runner, so review of that scope is welcome. Production preview retains its eval restriction.

The evaluator itself already exists in Miniflare. This change is in the Vite runner that consumes it, with no shared configuration or evaluator API changes. Wrangler and the Vitest integration are outside this patch.

Validation:

- Three helper tests pass for string evaluation, non-string identity, and exceptions. The helper and tests pass strict TypeScript checking.
- A framework-free Worker check verifies that indirect eval throws before the change, evaluates numbers and named functions after it, preserves object identity and null, and propagates syntax errors. Production preview still throws `EvalError` after the change.
- All 12 affected Vinext Workers development configurations and 258 scenarios pass across native React and Redact, standard and Cache Components rendering, Chromium, Firefox, and WebKit. These diagnostics also need the separate Vinext optimizer and Pages data fixes; they are not results from an unmodified dependency installation.
- The four changed files match the locally tested and formatted sources. The full workers-sdk package suite has not been run.

---

- Tests
  - [x] Tests included/updated
  - [ ] Automated tests not possible - manual testing has been completed as follows:
  - [ ] Additional testing not necessary because:
- Public documentation
  - [ ] Cloudflare docs PR(s):
  - [x] Documentation not necessary because: the proposal repairs development stack reconstruction without adding configuration or changing production behavior.
