---
'@tanstack/redact': patch
---

Detect React 18 in Vite consumers and adapt its element markers, context shapes, and version string at build time, without adding runtime version checks or increasing production bundles. React 19 runtime code stays unchanged. Add packed-package browser comparisons against React 18 and 19, plus a strict bundle-size comparison against the base branch. Concurrent features keep their synchronous behavior. Deprecated legacy ReactDOM roots are not included.
