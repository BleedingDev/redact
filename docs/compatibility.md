---
title: Compatibility
---

React's APIs and behavior are the reference for Redact. The default Vite configuration uses synchronous rendering, so some APIs behave differently from React's concurrent implementation. These are runtime tradeoffs, not recommendations to change how React works.

| Area | Redact behavior |
|---|---|
| Core rendering | JSX, hooks (including `use`, `useEffectEvent`, `useId`, and `useSyncExternalStore`), context, refs, memo, lazy, portals, error boundaries, and modern class lifecycles. Legacy class lifecycles are no-ops. |
| DOM and forms | Controlled inputs, reset defaults, event handling, and preservation of edits during hydration have shared React tests. |
| Suspense and hydration | Fallbacks, retained primary DOM, retries, streaming boundaries, and event replay. No priority scheduling. |
| `Activity` | Retains hidden DOM/state and disconnects effects, refs, and subscriptions. Insertion effects stay connected. Hidden work is synchronous, not background priority. |
| Fragment refs | Stable DOM instances with events, focus, geometry, observers, scrolling, and portal/visibility tracking. |
| Transitions | `useTransition` retains committed content and pending state while work suspends. `useDeferredValue` retains stale results. Rendering passes stay synchronous, without time slicing or interruptible component renders. |
| `useActionState` | Queues actions against the previous result, tracks pending actions, and sends failures to error boundaries. |
| `useOptimistic`, `useFormStatus` | Optimistic updates rebase on current state and roll back when their action finishes. Form descendants receive pending status and submitted data. |
| View transitions | `ViewTransition` preserves state; `addTransitionType` does not animate by default. Native snapshots/styles/callbacks are experimental and opt-in. Animated commits wait for the browser snapshot callback, without a concurrent scheduler. |
| Browser-only rendering | `browser()` requests a server-to-client Suspense fallback; `onBrowserBailout` reports it separately from errors. `use(browser())` returns `undefined` on the client. |
| Resource APIs | Preload/preinit/preconnect/DNS hints and declarative styles/scripts, with document/ShadowRoot ownership and streamed stylesheet coverage. |
| SSR | `renderToString`, `renderToStaticMarkup`, readable and pipeable streams. Full Fizz prerender/resume APIs are not implemented. |
| Caching | `cache` returns its function, `cacheSignal` returns `null`, and `unstable_useCacheRefresh` is a stable client no-op. Invoking a server refresh throws. Client/DOM-server rendering is uncached. |
| React Compiler | The `react/compiler-runtime` memo-cache entrypoint is implemented and aliased. This is not validation of every compiler output pattern. |
| Server Components / Flight | Kept on upstream React in the RSC environment, not reimplemented by Redact. |
| Debugging | Fast Refresh preserves state for compatible edits. React DevTools supports component and hook inspection, edits, owners, error and Suspense controls, and commit profiling in development. `useDebugValue` labels appear in DevTools. All DevTools code is removed in production. `StrictMode` still avoids double invocation, and the `<Profiler>` callback remains a no-op. [DevTools checks and timings](https://github.com/TanStack/redact/blob/main/docs/devtools-implementation-status.md). |

Native animation is not exhaustive visual parity. Production animation, hidden-tab behavior, broader resource/navigation races, and Safari/Firefox remain unverified. [API details](https://github.com/TanStack/redact/blob/main/docs/REACT_19_3_SUPPORT.md), [upstream audit](https://github.com/TanStack/redact/blob/main/docs/REACT_19_3_AUDIT.md), [native animation limits](https://github.com/TanStack/redact/blob/main/docs/VIEW_TRANSITION_EXPERIMENT.md).
