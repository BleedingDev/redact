# @tanstack/redact

## 0.2.0

### Minor Changes

- Add `withRedact` for Next.js 15.5 and 16.0 through 16.4 with Turbopack and Webpack. Keep native React for server rendering and Server Components while Redact renders in the browser. Support both routers, Cache Components, streamed Suspense, hydration IDs, async actions, forms, metadata, and Fast Refresh. ([#52](https://github.com/TanStack/redact/pull/52))

  Keep visible transitions independent of suspended hidden Activity trees, preserve retained DOM and effect lifecycles, and expose promised children in the public types. Keep action hooks and pending transition inspection working with React DevTools. Reduce shared runtime code so both the full client and default Vite client remain below their pre-integration bundle limits.

  Require complete packed-package compatibility checks across all pinned versions, three browser engines, development, production, standalone output, and static export before release publication. Reject prerelease and untested Next.js minor versions at configuration time.

  Correct Next 16.2 development cache detection through a version-scoped browser loader, preserving cached debug-channel replay without changing installed Next files.

- Add a Vinext browser adapter that keeps native React for SSR and Server Components. Resolve browser entries per Vite environment so server imports remain intact. ([#52](https://github.com/TanStack/redact/pull/52))

  Retain committed content during suspended transitions and deferred updates, rebase urgent and transition updates in source order, and preserve error boundaries and class callbacks. Preserve hydration, refs, controlled and uncontrolled form resets, and the existing bundle limits.

  Require paired native React and Redact verification from an unpatched npm install. Cover mixed App and Pages Router apps and separate Pages-only apps across Node, standalone output, static export, and local Workers in Chromium, Firefox, and WebKit. Use stable Cloudflare tooling and keep setup, browser, and completeness failures in the release gate.

  Ship maintained Vinext module-identity and Pages data corrections, plus an optional Cloudflare integration with the development evaluator fix. Keep native React controls on the same corrected platform. Validate development Flight timing bounds without suppressing real application errors. Upgrade the verification toolchain to the published Undici and fflate security fixes through standard dependency overrides.

### Patch Changes

- Flush renderer work and effects through the public act utility, including nested and awaited scopes, and preserve synchronous errors. Share the implementation with react-dom/test-utils. ([#52](https://github.com/TanStack/redact/pull/52))

  Correct pointer-capture event names, bubble focus and blur handlers, and accept native change events for text fields without repeating an input notification.

## 0.1.5

### Patch Changes

- Add development-only React DevTools support for component and hook inspection, editing props and state, owner and source lookup, warning attribution, error and Suspense controls, and commit profiling. Keep synchronous runtime behavior and remove the adapter entirely from production builds. ([#48](https://github.com/TanStack/redact/pull/48))

## 0.1.4

### Patch Changes

- Keep component and context provider ancestry when recovering from a hydration mismatch. Document recovery preserves the existing shell, root renders still update the full app, and abandoned effects are cleaned up. ([#40](https://github.com/TanStack/redact/pull/40))

## 0.1.3

### Patch Changes

- Support React Fast Refresh in development, preserving component state for compatible edits, remounting incompatible hook signatures, rerunning effects, and recovering from render errors. Works with the normal React Refresh transform used by `@vitejs/plugin-react`. ([#38](https://github.com/TanStack/redact/pull/38))

## 0.1.2

### Patch Changes

- Fix updates from undefined state so refs and layout effects commit correctly, including animated dialog cleanup. Match React's TypeScript overload for calling `useState()` without an initial value. Process pending parent updates before propagating context to prevent stale route matches during navigation. ([#33](https://github.com/TanStack/redact/pull/33))

## 0.1.1

### Patch Changes

- Support React 19's direct context provider syntax (`<Context value={value}>`) on the client and server, including hydration. `Context.Provider` is now the context itself, so switching between the two forms preserves component state. ([#29](https://github.com/TanStack/redact/pull/29))

  Keep `ref` in the props returned by `createElement` and `cloneElement`, including refs passed through function components and render-prop triggers. Cloning with an undefined ref preserves the original ref.

  Use explicit reserved-key checks when copying props. This also preserves own props named `constructor`, `toString`, or `hasOwnProperty`.

## 0.1.0

### Minor Changes

- Add React 19.3 APIs and improve runtime compatibility while keeping Redact's synchronous rendering contract. ([#24](https://github.com/TanStack/redact/pull/24))

  - Add state-preserving Activity boundaries, Fragment refs, browser rendering boundaries, and cache API compatibility. Native ViewTransition animation and transition types are experimental and opt-in through the Vite plugin.
  - Fix effect and ref ordering, retained Suspense and Activity updates, reducer queues, error boundaries, controlled inputs, hydration recovery, and document and ShadowRoot resource ownership.
  - Reduce unnecessary reconciliation and effect work, and harden server rendering, streaming, cancellation, and nonce handling.
  - Fix native ESM and declaration imports, shared dispatcher identity, environment-sensitive builds, and Vite feature selection in the published package.
  - Document measured bundle sizes, React performance comparisons, and the supported APIs and intentional synchronous downgrades in the README.

  Concurrent scheduling is still not implemented. Action and optimistic hooks retain their documented no-op behavior, and native animations remain disabled by default.

## 0.0.21

### Patch Changes

- Retire abandoned hydration trees before client recovery so old effects, subscriptions, refs, and class lifecycles cannot mount duplicate UI. Preserve the document shell and remove portals owned by the discarded tree. ([#22](https://github.com/TanStack/redact/pull/22))

## 0.0.20

### Patch Changes

- Preserve muted audio and video during hydration, and handle enumerated attribute values consistently across server rendering, hydration, and DOM updates. ([#20](https://github.com/TanStack/redact/pull/20))
