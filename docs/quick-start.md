---
title: Quick Start
---

Choose the integration that owns your build:

| Build | Integration | Server rendering |
| --- | --- | --- |
| [TanStack Start](./start.md) | `redact` from `@tanstack/redact/vite` | Redact |
| Vite | `redact` from `@tanstack/redact/vite` | Redact, with native React in the RSC environment |
| [Vinext](./vinext.md) | `redact` from `@tanstack/redact/vinext` | Native React |
| [Next.js](./next.md) | `withRedact` from `@tanstack/redact/next` | Native React |

The Vinext and Next.js guides record the tested versions and coverage. For Vite, add Redact to your existing configuration and keep your React or framework plugin in place.

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { redact } from '@tanstack/redact/vite'

export default defineConfig({
  plugins: [react(), redact()],
})
```

Your application code stays familiar.

```tsx
import { useState } from 'react'
import { createRoot } from 'react-dom/client'

function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button onClick={() => setCount(count + 1)}>
      Clicked {count} times
    </button>
  )
}

createRoot(document.getElementById('root')!).render(<Counter />)
```

The plugin handles client and SSR builds. The RSC environment stays on upstream React so `@vitejs/plugin-rsc` can own Server Component serialization.

## Check your app

Run your tests and production build. Check hydration, forms, portals, navigation, and third-party components. Check pending transitions, actions, and optimistic state in your own journeys. Redact keeps rendering passes synchronous, without React's time slicing or interruptible component renders.

Read [Compatibility](./compatibility.md) before shipping. Keep hydration enabled in apps that use `hydrateRoot`.
