---
"@tanstack/redact": patch
---

Fix hydration loops when useSyncExternalStore reads different server and client snapshots. Keep queued store updates inside their active Suspense boundary.
