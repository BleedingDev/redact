---
title: Quick Start
---

Add Redact to your existing Vite configuration. Keep your React or framework plugin in place.

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

Run your tests and production build. Check hydration, forms, portals, navigation, and third-party components. Pay particular attention to pending transitions, actions, and optimistic state, their behavior differs from React.

Read [Compatibility](./compatibility.md) before shipping. Keep hydration enabled in apps that use `hydrateRoot`.
