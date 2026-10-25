// Run with: node --conditions=react-server benchmarks/upstream/vinext-pages-data.mjs /path/to/node_modules/vinext
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const { createAppRscRequestHandler } = await import(pathToFileURL(resolve(process.argv[2], 'dist/server/app-rsc-handler.js')))
let failures = 0
for (const basePath of ['', '/docs']) for (const trailingSlash of [false, true]) {
  const handler = createAppRscRequestHandler({
    basePath, buildId: 'test-build', trailingSlash,
    clearRequestContext() {}, setNavigationContext() {}, registerCacheAdapters() {},
    configHeaders: [], configRedirects: [], configRewrites: { beforeFiles: [], afterFiles: [], fallback: [] },
    draftModeSecret: 'local-test', i18nConfig: null, isDev: false,
    hasInterceptionId: () => false, matchRoute: () => null, publicFiles: new Set(), staticParamsMap: {},
    renderNotFound: async () => null,
    dispatchMatchedPage: async () => new Response('app'),
    dispatchMatchedRouteHandler: async () => new Response('route'),
    renderPagesFallback: async ({ isDataRequest, pagesDataRequest, pathname }) => Response.json({
      data: isDataRequest, pathname, source: pagesDataRequest?.url,
    }),
  })
  for (const page of ['index', 'legacy-static', 'legacy-data/one']) {
    const url = `https://example.test${basePath}/_next/data/test-build/${page}.json?q=kept`
    const response = await handler(new Request(url), null)
    try {
      assert.equal(response.status, 200, 'Data requests must not receive a document redirect')
      assert.equal(response.headers.has('location'), false)
      const data = await response.json()
      assert.equal(data.data, true)
      assert.equal(new URL(data.source).search, '?q=kept')
      console.log('PASS', JSON.stringify({ basePath, trailingSlash, page }))
    } catch (error) {
      failures++
      console.error('FAIL', JSON.stringify({ basePath, trailingSlash, page, status: response.status, location: response.headers.get('location'), error: error.message }))
    }
  }
  // Genuine document requests must still receive canonical redirects, even
  // when a client supplies the internal-looking data header.
  const path = `/legacy-static${trailingSlash ? '' : '/'}`
  const document = await handler(new Request(`https://example.test${basePath}${path}?q=kept`, { headers: { 'x-nextjs-data': '1' } }), null)
  assert.equal(document.status, 308)
  assert.equal(document.headers.get('location'), `${basePath}/legacy-static${trailingSlash ? '/' : ''}?q=kept`)
}
assert.equal(failures, 0, `${failures} Pages data requests redirected`)
