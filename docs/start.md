---
id: start
title: TanStack Start
---

Add Redact after your existing Start and React plugins, and bundle server dependencies so Vite can redirect their React imports too:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { redact } from '@tanstack/redact/vite'

export default defineConfig({
  ssr: { noExternal: true },
  plugins: [tanstackStart(), react(), redact()],
})
```

Keep React and React DOM installed, and keep your normal React imports. Redact handles server rendering and browser hydration. Start still handles routing and server functions.

## Optional features

Start uses hydration, context, Suspense, lazy components, memoization, forwarded refs, and class error boundaries. Keep those features enabled. Start with `redact()` and only disable optional features your app and dependencies do not use.

The measured starter app does not use Activity, Fragment refs, or portals:

```ts
redact({
  features: { activity: false, fragmentRefs: false, portal: false },
})
```

This reduces that starter's emitted client JavaScript and CSS from 62.3 KB to 59.8 KB gzip. Your app's savings depend on what it imports. [Measurements and browser checks](https://github.com/TanStack/tanstack.com/tree/345faa6a31e3d09ae57700fbc85e61fb09617769/launch/benchmarks/redact-frameworks).

Read the [feature flags](./feature-flags.md) and [compatibility guide](./compatibility.md) before changing presets. Redact renders synchronously, without time slicing or interruptible component renders. Run your production build and check direct loads, navigation, forms, and any third-party components after switching runtimes.
