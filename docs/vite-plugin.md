---
title: Vite Plugin Reference
---

```ts
import { redact } from '@tanstack/redact/vite'

redact({
  preset: 'full',
  features: { viewTransitions: false },
})
```

## Options

| Option | Type | Behavior |
| --- | --- | --- |
| `preset` | `'full'` or `'nano'` | Defaults to `full`. Full enables every optional feature except native animation. Nano disables all optional features. |
| `features` | `RedactFeatures` | Boolean overrides merged with the preset. See [Feature Flags](./feature-flags.md). |
| `skip` | `ReadonlyArray<string>` | Import specifiers to exclude from aliasing. |
| `resolveFrom` | `string` | Package resolution root, defaults to the Vite config root. Useful in monorepos. |
| `packageRoots` | `Record<string, string>` | Explicit package names mapped to absolute package directories, bypassing node_modules lookup for local builds. |

## Import aliases

The plugin redirects React, JSX runtimes, React Compiler runtime, React DOM, DOM client, server rendering, scheduler, and use-sync-external-store entrypoints to Redact. Your application's React imports stay unchanged.

The RSC environment remains on upstream React, Redact does not implement Flight serialization.

For the exact alias map and resolution behavior, see the [plugin source](https://github.com/TanStack/redact/blob/main/packages/redact/src/vite/index.ts). The [development guide](https://github.com/TanStack/redact/blob/main/docs/DEVELOPMENT.md) covers runtime internals.
