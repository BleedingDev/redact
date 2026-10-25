import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { writeNextResults } from './next-results.mjs'

assert.ok(process.env.NEXT_TEST_DIR, 'NEXT_TEST_DIR must name a packed static-export fixture')
const cwd = resolve(process.env.NEXT_TEST_DIR)
const require = createRequire(join(cwd, 'package.json'))
const version = require('next/package.json').version
const webpack = process.argv.includes('--webpack')
const engines = (process.env.NEXT_TEST_BROWSERS || 'chromium,firefox,webkit').split(',')
for (const engine of engines) assert.ok(({ chromium, firefox, webkit })[engine], `Unknown browser: ${engine}`)
let server
const watchdog = setTimeout(() => {
  console.error('Next static-export gate timed out')
  build.kill('SIGTERM')
  server?.closeAllConnections()
  process.exit(1)
}, 120_000 * (engines.length + 1))
watchdog.unref()
const bundler = webpack ? Number(version.split('.')[0]) >= 16 ? ['--webpack'] : [] : ['--turbopack']
const build = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'build', ...bundler], { cwd, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: 'inherit' })
assert.equal((await once(build, 'exit'))[0], 0, 'Static export build failed')
const out = join(cwd, 'out'), basePath = process.env.NEXT_TEST_BASE_PATH || ''
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.txt': 'text/plain' }
server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    assert.ok(pathname.startsWith(basePath + '/'))
    let path = resolve(out, '.' + pathname.slice(basePath.length))
    assert.ok(path.startsWith(out + '/') || path === out)
    try { if ((await stat(path)).isDirectory()) path = join(path, 'index.html') } catch {
      response.statusCode = 404
      path = join(out, '404.html')
    }
    response.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream')
    response.end(await readFile(path))
  } catch { response.writeHead(500).end() }
})
server.listen(Number(process.env.NEXT_TEST_PORT || 3230), '127.0.0.1')
await once(server, 'listening')
const origin = `http://127.0.0.1:${server.address().port}${basePath}`
const results = []
let browser
try {
  for (const engine of engines) {
    const result = { version, rendering: 'standard', bundler: webpack ? 'webpack' : 'turbopack', mode: 'production', deployment: 'static-export', browser: engine, basePath, reference: false }
    const started = Date.now()
    try {
    browser = await ({ chromium, firefox, webkit })[engine].launch({ headless: true })
    result.browserVersion = browser.version()
    const page = await browser.newPage(), errors = []
    page.setDefaultTimeout(15000)
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }))
    let release
    const gate = new Promise(yes => { release = yes })
    await page.route('**/*.js*', async route => { await gate; await route.continue() })
    await page.goto(origin + '/', { waitUntil: 'commit' })
    await page.getByRole('button', { name: 'Count: 0', exact: true }).waitFor()
    const id = await page.getByLabel('Static input').getAttribute('id')
    await page.evaluate(() => { window.staticButton = document.querySelector('button'); window.staticDocument = document.documentElement })
    release()
    await page.waitForFunction(() => document.querySelector('button[data-ready="true"]'))
    assert.ok(await page.evaluate(() => !!globalThis[Symbol.for('@tanstack/redact.ReactSharedInternals')]))
    assert.ok(await page.evaluate(() => window.staticButton === document.querySelector('button')))
    assert.equal(await page.getByLabel('Static input').getAttribute('id'), id)
    await page.getByRole('button', { name: 'Count: 0', exact: true }).click()
    await page.getByRole('link', { name: 'First post', exact: true }).click()
    await page.getByRole('heading', { name: 'Post one', exact: true }).waitFor()
    await page.waitForFunction(() => document.title === 'Post one')
    await page.getByRole('button', { name: 'Count: 1', exact: true }).waitFor()
    assert.ok(await page.evaluate(() => window.staticDocument === document.documentElement))
    await page.getByRole('link', { name: 'Second post', exact: true }).click()
    await page.getByRole('heading', { name: 'Post two', exact: true }).waitFor()
    await page.goBack()
    await page.getByRole('heading', { name: 'Post one', exact: true }).waitFor()
    await page.reload()
    await page.getByRole('heading', { name: 'Post one', exact: true }).waitFor()
    await page.waitForFunction(() => document.querySelector('button[data-ready="true"]'))
    assert.equal(await page.locator('main').evaluate(node => getComputedStyle(node).color), 'rgb(12, 34, 56)')
    assert.deepEqual(errors, [])
    const missing = await page.request.get(`${origin}/missing/`)
    assert.equal(missing.status(), 404)
    assert.ok((await missing.text()).includes('Static missing page'))
    result.passed = true
    console.log('PASS Next static export ' + JSON.stringify(result))
    } catch (error) {
      Object.assign(result, { passed: false, error: error.stack || String(error) })
      console.error('FAIL Next static export ' + JSON.stringify(result))
      process.exitCode = 1
    } finally {
    result.scenarios = [{ name: 'static-export', passed: result.passed, ...(result.error ? { error: result.error } : {}) }]
    result.durationMs = Date.now() - started
    results.push(result)
    await browser?.close()
    browser = null
    }
  }
} finally {
  await browser?.close()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  clearTimeout(watchdog)
  await writeNextResults({ cwd, version, results, engines })
}
