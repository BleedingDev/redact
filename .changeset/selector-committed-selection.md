---
'@tanstack/redact': patch
---

Keep the last committed external-store selection through abandoned Suspense renders so equal selections retain their identity and do not rerun dependent effects.
