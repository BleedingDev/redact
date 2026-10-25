import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { cp, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { checkNext } from './next-browser-checks.mjs'
import { writeNextResults } from './next-results.mjs'

const cwd = resolve(process.env.NEXT_TEST_DIR || fileURLToPath(new URL('../examples/next-demo/', import.meta.url)))
const require = createRequire(join(cwd, 'package.json'))
const version = require('next/package.json').version
const major = Number(version.split('.')[0])
const cacheComponents = major >= 16 && process.env.NEXT_TEST_CACHE_COMPONENTS !== '0'
const rendering = cacheComponents ? 'cache-components' : 'standard'
const production = process.argv.includes('--production')
const webpack = process.argv.includes('--webpack')
const standalone = process.argv.includes('--standalone')
assert.ok(!standalone || production, 'Standalone output requires a production build')
const engines = (process.env.NEXT_TEST_BROWSERS || process.env.PLAYWRIGHT_BROWSER || 'chromium,firefox,webkit').split(',')
const browsers = { chromium, firefox, webkit }
for (const engine of engines) assert.ok(browsers[engine], `Unknown browser: ${engine}`)
const port = process.env.NEXT_TEST_PORT || '3229'
const origin = `http://localhost:${port}${process.env.NEXT_TEST_BASE_PATH || ''}`
const next = require.resolve('next/dist/bin/next')
const bundler = webpack ? major >= 16 ? ['--webpack'] : [] : ['--turbopack']
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', REDACT_NEXT_TEST: '1', NEXT_PUBLIC_BASE_PATH: process.env.NEXT_TEST_BASE_PATH || '', ...(standalone ? { NEXT_TEST_OUTPUT: 'standalone' } : {}) }
const children = new Set()
let logs = '', browser, server
const results = []
// Each browser retains the original per-assertion deadlines. The whole-run
// deadline scales with the number of browsers and the separate build step.
const watchdog = setTimeout(() => {
  console.error('Next browser gate timed out', logs.slice(-12000))
  for (const child of children) child.kill('SIGTERM')
  process.exit(1)
}, 120_000 * (engines.length + Number(production)))
watchdog.unref()
function run(args, overrides = {}) {
  const child = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], ...overrides })
  children.add(child)
  child.once('exit', () => children.delete(child))
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { logs += data })
  return child
}
async function ready() {
  const deadline = Date.now() + 90_000
  while (true) {
    assert.equal(server.exitCode, null, logs)
    assert.equal(server.signalCode, null, logs)
    try { if ((await fetch(origin)).ok) return } catch {}
    assert.ok(Date.now() < deadline, logs)
    await new Promise(resolve => setTimeout(resolve, 250))
  }
}
async function stopServer() {
  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill('SIGTERM')
    await once(server, 'exit')
  }
  server = null
}
try {
  if (production) {
    const build = run([next, 'build', ...bundler])
    const [code] = await once(build, 'exit')
    assert.equal(code, 0, logs)
    const built = JSON.parse(await readFile(join(cwd, '.next/required-server-files.json'), 'utf8'))
    assert.equal(!!built.config.cacheComponents, cacheComponents, 'The build must use the requested rendering mode')
  }
  if (standalone) {
    const directory = join(cwd, '.next/standalone')
    await cp(join(cwd, '.next/static'), join(directory, '.next/static'), { recursive: true })
    await cp(join(cwd, 'public'), join(directory, 'public'), { recursive: true })
    server = run([join(directory, 'server.js')], { cwd: directory, env: { ...env, PORT: port, HOSTNAME: '127.0.0.1' } })
  } else if (production) server = run([next, 'start', '--port', port])
  if (production) await ready()
  for (const engine of engines) {
    const result = { version, rendering, bundler: webpack ? 'webpack' : 'turbopack', mode: production ? 'production' : 'development', deployment: standalone ? 'standalone' : 'node', browser: engine, reference: !!process.env.NEXT_TEST_REFERENCE, basePath: process.env.NEXT_TEST_BASE_PATH || '' }
    const started = Date.now()
    try {
    if (!production) {
      // Fast Refresh edits source. Each browser gets its own compiler state so
      // a preceding browser's HMR hash cannot invalidate its streamed document.
      server = run([next, 'dev', ...bundler, '--port', port], { env: { ...env, NEXT_TEST_DIST_DIR: `.next/${engine}` } })
      await ready()
    }
    browser = await browsers[engine].launch({ ...(engine === 'chromium' && process.env.PLAYWRIGHT_CHANNEL && process.env.PLAYWRIGHT_CHANNEL !== 'chromium' ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}), headless: true })
    result.browserVersion = browser.version()
    const observed = await checkNext({ browser, origin, production, cwd, cacheComponents, reference: !!process.env.NEXT_TEST_REFERENCE })
    Object.assign(result, observed)
    if (!result.passed) { process.exitCode = 1; console.error(logs.slice(-24000)) }
    console.log((result.passed ? 'PASS' : 'FAIL') + ' Next compatibility ' + JSON.stringify(result))
    } catch (error) {
      Object.assign(result, { passed: false, error: error.stack || String(error) })
      console.error('FAIL Next compatibility ' + JSON.stringify(result))
      console.error(logs.slice(-16000))
      process.exitCode = 1
    } finally {
    result.durationMs = Date.now() - started
    results.push(result)
    await browser?.close()
    browser = null
    if (!production) await stopServer()
    }
  }
} catch (error) {
  console.error(logs.slice(-16000))
  throw error
} finally {
  await browser?.close()
  for (const child of children) child.kill('SIGTERM')
  if (server && server.exitCode === null && server.signalCode === null) await once(server, 'exit')
  clearTimeout(watchdog)
  await writeNextResults({ cwd, version, results, engines })
}
