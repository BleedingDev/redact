import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { chromium, firefox, webkit } from 'playwright'
import { checkNext } from './next-browser-checks.mjs'

const types = { chromium, firefox, webkit }
const engines = process.env.PLAYWRIGHT_BROWSER ? [process.env.PLAYWRIGHT_BROWSER] : Object.keys(types)
const server = createServer((request, response) => {
  response.setHeader('content-type', request.url === '/api/runtime' ? 'application/json' : request.url === '/pending.js' ? 'application/javascript' : 'text/html')
  response.end(request.url === '/api/runtime' ? JSON.stringify({ version: '19.3.1', redact: false }) : request.url === '/pending.js' ? 'window.pendingScriptLoaded = true' : '<html><head><title>Lifecycle check</title></head><body><script src="/pending.js"></script></body></html>')
})
server.listen(0, '127.0.0.1'); await once(server, 'listening')
const origin = `http://127.0.0.1:${server.address().port}`
try {
  for (const engine of engines) {
    assert.ok(types[engine], `Unknown browser ${engine}`)
    const browser = await types[engine].launch({ headless: true })
    const originalContext = browser.newContext.bind(browser)
    let pendingInitializations = 0, pendingRoutes = 0
    browser.newContext = async options => {
      const context = await originalContext(options), originalPage = context.newPage.bind(context), originalClose = context.close.bind(context)
      context.close = async () => {
        assert.equal(pendingInitializations, 0, 'Finish observer initialization before closing the context')
        assert.equal(pendingRoutes, 0, 'Finish held route handlers before closing the context')
        await originalClose()
      }
      context.newPage = async () => {
        const page = await originalPage(), originalInit = page.addInitScript.bind(page), originalRoute = page.route.bind(page), originalTimeout = page.setDefaultTimeout.bind(page)
        page.addInitScript = async (...args) => {
          pendingInitializations++
          try { await new Promise(done => setTimeout(done, 40)); return await originalInit(...args) }
          finally { pendingInitializations-- }
        }
        page.route = (url, handler) => originalRoute(url, async (...args) => {
          pendingRoutes++
          try { return await handler(...args) } finally { pendingRoutes-- }
        })
        page.setDefaultTimeout = () => originalTimeout(1000)
        return page
      }
      return context
    }
    try {
      assert.equal((await checkNext({ browser, origin, production: true, scenarios: ['server-runtime'] })).passed, true)
      const failed = await checkNext({ browser, origin, production: true, scenarios: ['hydration'] })
      assert.equal(failed.passed, false, 'Keep the intentional assertion failure in the result')
      assert.equal(failed.scenarios.length, 1)
      assert.match(failed.scenarios[0].error, /Count: 0/)
      assert.equal(pendingInitializations, 0)
      assert.equal(pendingRoutes, 0)
      console.log(`PASS ${engine}: delayed observer setup and teardown after a failed assertion with held scripts`)
    } finally { await browser.close() }
  }
} finally { server.closeAllConnections(); await new Promise(done => server.close(done)) }
