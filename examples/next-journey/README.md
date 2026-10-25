# React and Redact in Next.js

Run the same project workspace with native React and with Redact in the browser.

```sh
pnpm install
pnpm example:next:journey
```

Open [the comparison](http://localhost:4310). Choose **Play journey** to run both apps together, or interact with either app yourself. **Reset** clears both demo sessions. **Open app** opens a full-width version.

The journey filters a task list, opens a task, streams its activity, saves a status optimistically, handles server validation, posts an optimistic comment, and returns to the updated list. Status and comments survive a reload in separate, short-lived cookies for each renderer. The data is fictional and stays local.

Both sides use the same source and Next.js 16.4.3 production builds with Turbopack. Only the Redact build applies `withRedact`. Next.js server rendering and Flight still use React on both sides. The comparison verifies each browser runtime after hydration.

Server actions include 750ms of simulated work and the activity stream includes 900ms, equally on both sides, to make pending states visible. Replay waits for both apps at each step. It is a behavior demonstration, not a performance benchmark.

The comparison also reports observed differences. An uncontrolled status dropdown currently resets differently after saving in Redact. The saved task status itself is correct. [Recorded observations](../../benchmarks/results/next-journey/README.md) distinguish journey completion from full behavioral parity.

The replay bridge has a fixed set of commands, accepts messages only from its configured parent origin, and interacts through the app's normal DOM controls. It does not set component state or call actions directly. Independent browser tests also drive those controls without the bridge.

## Verification

With the comparison running:

```sh
JOURNEY_URL=http://localhost:4310 pnpm test:next:journey
```

Or build and start a separate test instance automatically:

```sh
pnpm test:next:journey
```

Install Playwright's Chromium, Firefox, and WebKit first if needed. Set `PLAYWRIGHT_BROWSERS_PATH` when using an existing browser installation.

Checks cover the replay, actual runtime identity, exact screenshot equality at identical viewport sizes, streamed content, optimistic pending states, server persistence, form reset, escaped comments, session isolation, browser back and forward, server HTML without JavaScript, and the mobile layout with reduced motion. The streamed activity still needs JavaScript to reveal its Suspense segment, as it does in native React. JavaScript-disabled checks verify the initial task content and server navigation.

Results, screenshots, and a real browser recording go to `benchmarks/results/next-journey/`. `JOURNEY_RESULTS` changes that directory and `JOURNEY_BROWSERS` selects browser engines. The full compatibility matrix is separate, in `benchmarks/NEXT_COVERAGE.md`.

`JOURNEY_PORT` changes the comparison port. Its two apps use the next two ports. Each port and renderer has its own build directory. Stop the launcher with Ctrl+C to stop all three servers.
