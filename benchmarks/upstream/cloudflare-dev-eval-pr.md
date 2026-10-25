React 19.3.1 logs `eval() is not supported in this environment` when decoding cached Server Component output in the Vite development Worker. This reproduces with native React and Redact using Vinext 1.3.0, `@vitejs/plugin-rsc` 0.5.38, and `@cloudflare/vite-plugin` 1.65.0.

The cached content renders and the counter remains interactive. The observed failure is React's development debugging diagnostic, and no production rendering failure has been demonstrated. React Flight uses indirect eval to reconstruct development call stacks, while the runner's global eval still throws.

This proposes connecting indirect eval to the runner's existing local evaluation binding before application modules load. Non-string inputs retain their identity, and evaluator return values and exceptions propagate. This enables indirect eval throughout the development runner, so review of that scope is welcome. Production preview retains its eval restriction.

The evaluator itself already exists in Miniflare. This change is in the Vite runner that consumes it, with no shared configuration or evaluator API changes. Wrangler and the Vitest integration are outside this patch.

Validation:

- Three helper tests pass for string evaluation, non-string identity, and exceptions. The helper and tests pass strict TypeScript checking.
- A framework-free Worker check verifies that indirect eval throws before the change, evaluates numbers and named functions after it, preserves object identity and null, and propagates syntax errors. Production preview still throws `EvalError` after the change.
- All 12 affected Vinext Workers development configurations and 258 scenarios pass across native React and Redact, standard and Cache Components rendering, Chromium, Firefox, and WebKit. These diagnostics also need the separate Vinext optimizer and Pages data fixes; they are not results from an unmodified dependency installation.
- A permanent Worker playground regression captures and calls indirect eval during application module initialization. It checks evaluated values, reconstructed function names, non-string identity, and thrown errors in real workerd. Production build/preview must still return `EvalError`. All 13 development tests and 12 production tests pass, with the existing production-only HMR skip unchanged. Removing the runner fix makes this same regression fail with `EvalError`.
- The complete plugin dependency build passed all 16 tasks. The Worker fixture passes type checking, and the changed files pass formatting and type-aware lint with no warnings or errors. Local playground validation used Vite 8.3.4, Playwright 1.60.0, and Node 24.22.0. The existing CI matrix also runs the fixture with Vite 7 and 8 on Linux, macOS, and Windows. The full workers-sdk package suite has not been run locally.

---

- Tests
  - [x] Tests included/updated
  - [ ] Automated tests not possible - manual testing has been completed as follows:
  - [ ] Additional testing not necessary because:
- Public documentation
  - [ ] Cloudflare docs PR(s):
  - [x] Documentation not necessary because: the proposal repairs development stack reconstruction without adding configuration or changing production behavior.

<!-- devin-review-badge-begin -->

---

<a href="https://cloudflare.devinenterprise.com/review/cloudflare/workers-sdk/pull/16466" target="_blank"><picture><source media="(prefers-color-scheme: dark)" srcset="https://static.devin.ai/assets/gh-devin-review-dark.svg?v=4"><img src="https://static.devin.ai/assets/gh-devin-review-light.svg?v=4" alt="Devin Review"></picture></a>
<!-- devin-review-badge-end -->
