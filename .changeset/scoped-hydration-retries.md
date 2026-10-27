---
'@tanstack/redact': patch
---

Preserve matching server DOM when a component suspends during hydration. Retry at the root or nearest marked Suspense boundary, keep outside siblings interactive, and avoid committing unfinished effects.
