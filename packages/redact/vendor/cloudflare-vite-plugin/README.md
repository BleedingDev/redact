# Cloudflare Vite integration

This directory contains the published `@cloudflare/vite-plugin@1.65.0` distribution, with one maintained correction to the development module runner. Indirect `eval` uses the evaluator already provided to that runner, before application modules initialize. Production Workers retain their original evaluation restriction.

The original MIT license is in `LICENSE`. `provenance.json` records every source file hash and the upstream fix. `scripts/vendor-cloudflare.mjs` reproduces this distribution from the pinned npm tarball. The build verifies its contents before packaging.

`@tanstack/redact/cloudflare` loads this copy using the installed Cloudflare plugin's dependency graph. It requires that exact peer version and scopes dependency resolution to this directory. Other modules use their original resolution. The application must resolve Miniflare's Undici dependency to the fixed version, currently `7.30.1`.

This is Node and Worker tooling. It is not imported by any Redact browser runtime entry.
