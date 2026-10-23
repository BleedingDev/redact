---
title: Overview
---

React, redacted. A small React-compatible runtime with synchronous rendering. One Vite plugin replaces the React, DOM, server, scheduler, and JSX entrypoints, your application's imports stay unchanged.

Redact keeps the React component model and everyday APIs without concurrent scheduling. JSX, hooks, context, refs, memo, lazy, portals, error boundaries, streaming SSR, and hydration are supported, but API availability does not mean every React behavior is implemented.

Read [Compatibility](./compatibility.md) before switching an existing app, especially if it depends on pending transitions, actions, optimistic state, or React DevTools.

## Get started

[Install Redact](./installation.md), then [add the Vite plugin](./quick-start.md). Start with the default preset and only disable features after checking what your app uses.

The [feature flags guide](./feature-flags.md) explains the behavior each flag removes. The [Vite plugin reference](./vite-plugin.md) covers monorepos and manual package resolution.

## Measurements

The [bundle size and performance guide](./performance.md) records the measured versions, configurations, and workload limits. Runtime bundle sizes are not whole-app sizes, and microbenchmarks do not establish whole-app speedups.
