---
title: Compatibility
---

This is the default Vite configuration. API availability is not a promise of every React behavior, especially concurrent behavior.

| Area | Redact behavior |
|---|---|
| Core rendering | JSX, hooks (including `use`, `useEffectEvent`, `useId`, and `useSyncExternalStore`), context, refs, memo, lazy, portals, error boundaries, and modern class lifecycles. Legacy class lifecycles are no-ops. |
| DOM and forms | Controlled inputs, reset defaults, event handling, and preservation of edits during hydration have shared React tests. |
| Suspense and hydration | Fallbacks, retained primary DOM, retries, streaming boundaries, and event replay. No priority scheduling. |
| `Activity` | Retains hidden DOM/state and disconnects effects, refs, and subscriptions. Insertion effects stay connected. Hidden work is synchronous, not background priority. |
| Fragment refs | Stable DOM instances with events, focus, geometry, observers, scrolling, and portal/visibility tracking. |
| Transitions | `useTransition` / `startTransition` run work synchronously. Pending stays false; `useDeferredValue` returns its input. No time slicing or interruptible renders. |
| `useActionState` | Returns the initial state, a no-op dispatch, and `false`. It does not run the action. |
| `useOptimistic`, `useFormStatus` | No optimistic overlay; the optimistic setter is a no-op. Form status stays idle. |
| View transitions | `ViewTransition` preserves state; `addTransitionType` does not animate by default. Native snapshots/styles/callbacks are experimental and opt-in. Animated commits wait for the browser snapshot callback, without a concurrent scheduler. |
| Browser-only rendering | `browser()` requests a server-to-client Suspense fallback; `onBrowserBailout` reports it separately from errors. `use(browser())` returns `undefined` on the client. |
| Resource APIs | Preload/preinit/preconnect/DNS hints and declarative styles/scripts, with document/ShadowRoot ownership and streamed stylesheet coverage. |
| SSR | `renderToString`, `renderToStaticMarkup`, readable and pipeable streams. Full Fizz prerender/resume APIs are not implemented. |
| Caching | `cache` returns its function, `cacheSignal` returns `null`, and `unstable_useCacheRefresh` is a stable client no-op. Invoking a server refresh throws. Client/DOM-server rendering is uncached. |
| React Compiler | The `react/compiler-runtime` memo-cache entrypoint is implemented and aliased. This is not validation of every compiler output pattern. |
| Server Components / Flight | Kept on upstream React in the RSC environment, not reimplemented by Redact. |
| Debugging | Fast Refresh works with `@vitejs/plugin-react`, preserving state for compatible edits and remounting when hook signatures change. `StrictMode` / `Profiler` render children without double invocation or profiling. `useDebugValue` is a no-op. React DevTools inspection is not implemented. |

Native animation is not exhaustive visual parity. Production animation, hidden-tab behavior, broader resource/navigation races, and Safari/Firefox remain unverified. [API details](https://github.com/TanStack/redact/blob/main/docs/REACT_19_3_SUPPORT.md), [upstream audit](https://github.com/TanStack/redact/blob/main/docs/REACT_19_3_AUDIT.md), [native animation limits](https://github.com/TanStack/redact/blob/main/docs/VIEW_TRANSITION_EXPERIMENT.md).
