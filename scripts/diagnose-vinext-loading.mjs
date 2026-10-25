import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { webkit } from 'playwright'
import { prepareVinextFixture, vinextExample } from './prepare-vinext-fixture.mjs'
import { startVinextTestGate } from './vinext-test-gate.mjs'

const require = createRequire(join(vinextExample, 'package.json'))
const vite = join(dirname(require.resolve('vite/package.json')), 'bin/vite.js')
const output = resolve('benchmarks/results/vinext/diagnostics')
await mkdir(output, { recursive: true })
const results = []
for (const reference of [true, false]) {
  const name = `loading-${reference ? 'react' : 'redact'}`
  const gate = await startVinextTestGate()
  const cwd = await prepareVinextFixture({ directory: join(vinextExample, '.fixtures', `diagnose-${name}`), gateOrigin: gate.origin })
  const env = { ...process.env, VINEXT_TEST_DIR: cwd, VINEXT_TEST_REFERENCE: reference ? '1' : '', VINEXT_TEST_WORKERS: '', VINEXT_TEST_CACHE_COMPONENTS: '1', VINEXT_TEST_BASE_PATH: '', VINEXT_TEST_OUTPUT: '', NEXT_TELEMETRY_DISABLED: '1' }
  const log = createWriteStream(join(output, `${name}.log`))
  const run = (args, directory = vinextExample) => {
    const child = spawn(process.execPath, args, { cwd: directory, env, stdio: ['ignore', 'pipe', 'pipe'] })
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => log.write(chunk))
    return child
  }
  let server, browser
  try {
    const build = run([vite, 'build', '--config', join(vinextExample, 'vite.config.mjs')])
    assert.equal((await once(build, 'exit'))[0], 0)
    const origin = 'http://localhost:4860'
    server = run([join(vinextExample, 'node_modules/vinext/dist/cli.js'), 'start', '--port', '4860'], cwd)
    let ready = false
    for (let i = 0; i < 100; i++) { try { ready = (await fetch(origin)).ok } catch {} if (ready) break; await new Promise(resolve => setTimeout(resolve, 100)) }
    assert.ok(ready)
    browser = await webkit.launch({ headless: true })
    for (let attempt = 0; attempt < Number(process.env.VINEXT_DIAGNOSIS_ATTEMPTS || 10); attempt++) {
      const context = await browser.newContext(process.env.VINEXT_DIAGNOSIS_ENCODING ? { extraHTTPHeaders: { 'Accept-Encoding': process.env.VINEXT_DIAGNOSIS_ENCODING } } : {})
      const page = await context.newPage()
      await page.addInitScript(() => {
        window.flightChunks = []
        const original = window.fetch
        window.fetch = async (...args) => {
          const response = await original(...args)
          if (String(args[0]).includes('/slow')) {
            const reader = response.clone().body.getReader(), decoder = new TextDecoder()
            ;(async () => {
              while (true) {
                const { value, done } = await reader.read()
                window.flightChunks.push({ at: performance.now(), done, text: value && decoder.decode(value) })
                if (done) return
              }
            })().catch(error => window.flightChunks.push({ error: String(error) }))
          }
          return response
        }
      })
      page.setDefaultTimeout(15_000)
      await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }))
      const requests = [], errors = [], started = Date.now()
      page.on('response', response => requests.push({ url: response.url(), status: response.status(), at: Date.now() - started }))
      page.on('pageerror', error => errors.push(error.message))
      page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`))
      const result = { reference, attempt, browserVersion: browser.version(), passed: true }
      try {
        await page.goto(origin + '/routing/one')
        await page.waitForFunction(() => document.querySelector('main[data-ready="true"]'))
        await page.evaluate(() => { window.originalDocument = document.documentElement })
        await page.getByRole('link', { name: 'Slow route', exact: true }).click({ noWaitAfter: true })
        await page.getByText('Loading slow route', { exact: true }).waitFor()
        await page.getByRole('link', { name: 'Cancel slow route', exact: true }).click()
        await page.getByRole('heading', { name: 'Route three', exact: true }).waitFor()
      } catch (error) {
        Object.assign(result, { passed: false, error: error.stack, url: page.url(), state: await page.evaluate(() => ({ text: document.body.innerText, documentRetained: window.originalDocument === document.documentElement, chunks: window.flightChunks })), pending: await (await fetch(gate.origin)).json(), requests, errors })
        await page.screenshot({ path: join(output, `${name}-${attempt}.png`) })
      } finally {
        const release = await (await page.request.post(origin + '/api/release-slow')).json()
        assert.ok(release.released > 0)
      }
      results.push(result)
      console.log(JSON.stringify({ reference, attempt, passed: result.passed, state: result.state }))
      await context.close()
    }
  } finally {
    await browser?.close()
    if (server) { const stopped = once(server, 'exit'); server.kill('SIGTERM'); await stopped }
    await gate.close()
    log.end(); await once(log, 'finish')
  }
}
await writeFile(join(output, 'loading-repeat.json'), JSON.stringify({ framework: 'vinext', version: '1.3.0', browser: 'webkit', cacheComponents: true, results }, null, 2) + '\n')
if (results.some(result => !result.passed)) process.exitCode = 1
