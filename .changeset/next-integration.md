---
"@tanstack/redact": minor
---

Add `withRedact` for Next.js 15.5 and 16.0 through 16.4 with Turbopack and Webpack. Keep native React for server rendering and Server Components while Redact renders in the browser. Support both routers, Cache Components, streamed Suspense, hydration IDs, async actions, forms, metadata, and Fast Refresh.

Keep visible transitions independent of suspended hidden Activity trees, preserve retained DOM and effect lifecycles, and expose promised children in the public types. Keep action hooks and pending transition inspection working with React DevTools. Reduce shared runtime code so both the full client and default Vite client remain below their pre-integration bundle limits.

Require complete packed-package compatibility checks across all pinned versions, three browser engines, development, production, standalone output, and static export before release publication. Reject prerelease and untested Next.js minor versions at configuration time.

Correct Next 16.2 development cache detection through a version-scoped browser loader, preserving cached debug-channel replay without changing installed Next files.
