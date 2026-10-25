---
title: Overview
---

We love React, and we want to keep writing it. Redact is an alternative runtime for React apps, built around React's APIs and component model. Integrations for Vite, Next.js, and Vinext keep your application's imports unchanged. Next.js and Vinext keep native React on the server and use Redact in the browser.

The goal is another runtime option within the React ecosystem, not a replacement for React as a project. Redact chooses synchronous rendering and a smaller footprint; React's concurrent scheduler supports use cases that need different behavior. JSX, hooks, context, refs, memo, lazy, portals, error boundaries, streaming SSR, and hydration are supported.

The [compatibility guide](./compatibility.md) explains the API differences, including pending transitions, actions, and optimistic state. React DevTools supports inspection, editing, and commit profiling in development, with [checks and timings](https://github.com/TanStack/redact/blob/main/docs/devtools-implementation-status.md).

## Get started

[Install Redact](./installation.md), then choose [Vite](./quick-start.md), [Next.js](./next.md), or [Vinext](./vinext.md). The framework adapters use the full runtime. In Vite apps, start with the default preset and only disable features after checking what your app uses.

The [feature flags guide](./feature-flags.md) explains the behavior each flag removes. The [Vite plugin reference](./vite-plugin.md) covers monorepos and manual package resolution.

## Measurements

The [bundle size and performance guide](./performance.md) records the measured versions, configurations, and workload limits. Runtime bundle sizes are not whole-app sizes, and microbenchmarks do not establish whole-app speedups.
