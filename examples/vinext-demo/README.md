# Vinext compatibility fixture

This runs the Next.js verification app through Vinext 1.3.0 with either native React or Redact in the browser. Server rendering and Server Components use native React in both cases.

```sh
pnpm build
pnpm example:vinext
```

The preparation script copies `examples/next-demo` into `.fixture` and adds the transition, deferred search, and select reset cases from `fixtures/app`. Edit those source fixtures, generated directories are replaced on each run.

Use `VINEXT_TEST_REFERENCE=1 pnpm example:vinext` to run native React. Run `pnpm test:vinext` from the repository root for the paired browser matrix. Each matrix job gets its own `.fixtures` directory and a local HTTP data source for controlled streaming and cancellation tests.

[Setup and dependency patches](../../docs/vinext.md), [coverage](../../benchmarks/VINEXT_COVERAGE.md).
