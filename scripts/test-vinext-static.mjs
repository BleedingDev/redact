import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, extname } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { prepareVinextFixture, prepareVinextPackage, vinextExample } from './prepare-vinext-fixture.mjs'
import { vinextEvidence } from './vinext-results.mjs'
import { checkVinextStatic } from './vinext-static-checks.mjs'

const reference = !!process.env.VINEXT_TEST_REFERENCE
const name = `${reference ? 'react' : 'redact'}-production-static-export`
const cwd = await prepareVinextFixture({ example: 'next-static', directory: join(vinextExample, '.fixtures', name) })
const packageRoot = process.env.VINEXT_TEST_PACKAGE || await prepareVinextPackage()
const evidence = await vinextEvidence(cwd, packageRoot)
const pkg = JSON.parse(await readFile(join(vinextExample, 'package.json')))
const require = createRequire(join(vinextExample, 'package.json'))
const vite = resolve(dirname(require.resolve('vite/package.json')), 'bin/vite.js')
const output = resolve(process.env.VINEXT_TEST_RESULT || `benchmarks/results/vinext/${name}.json`)
await mkdir(dirname(output), { recursive: true })
const log = createWriteStream(output.replace(/\.json$/, '.log'))
const basePath = process.env.VINEXT_TEST_BASE_PATH || '/coverage'
const env = { ...process.env, VINEXT_TEST_PACKAGE: packageRoot, VINEXT_TEST_DIR: cwd, VINEXT_TEST_OUTPUT: 'export', VINEXT_TEST_BASE_PATH: basePath, NEXT_PUBLIC_BASE_PATH: basePath }
const engines = (process.env.VINEXT_TEST_BROWSERS || 'chromium,firefox,webkit').split(',')
const browsers = { chromium, firefox, webkit }
for (const engine of engines) assert.ok(browsers[engine], `Unknown browser: ${engine}`)
let build, server, browser, failure
const results = []
const started = Date.now()
const watchdog = setTimeout(() => { build?.kill('SIGTERM'); server?.closeAllConnections(); process.exit(1) }, 300_000)
watchdog.unref()
try {
  build = spawn(process.execPath, [vite, 'build', '--config', join(vinextExample, 'vite.config.mjs')], { cwd: vinextExample, env, stdio: ['ignore', 'pipe', 'pipe'] })
  for (const stream of [build.stdout, build.stderr]) stream.on('data', data => log.write(data))
  assert.equal((await once(build, 'exit'))[0], 0, 'Static export build failed, see the matching log')
  const out = join(cwd, 'dist/client')
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.txt': 'text/plain', '.rsc': 'text/x-component' }
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
      assert.ok(pathname.startsWith(basePath + '/'))
      // Vinext includes basePath in its exported directory layout.
      let path = resolve(out, '.' + pathname)
      assert.ok(path.startsWith(out + '/') || path === out)
      try { if ((await stat(path)).isDirectory()) path = join(path, 'index.html') } catch {
        response.statusCode = 404
        path = join(out, '404.html')
      }
      response.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream')
      response.end(await readFile(path))
    } catch { response.writeHead(500).end() }
  })
  server.listen(Number(process.env.VINEXT_TEST_PORT || 4560), '127.0.0.1')
  await once(server, 'listening')
  const origin = `http://127.0.0.1:${server.address().port}${basePath}`
  for (const engine of engines) {
    const result = { framework: 'vinext', version: pkg.dependencies.vinext, rendering: 'standard', mode: 'production', deployment: 'static-export', browser: engine, basePath, reference }
    const start = Date.now()
    try {
      browser = await browsers[engine].launch({ headless: true })
      result.browserVersion = browser.version()
      Object.assign(result, await checkVinextStatic({ browser, origin, reference }), { passed: true })
    } catch (error) {
      Object.assign(result, { passed: false, error: error.stack || String(error) })
    } finally {
      result.scenarios = [{ name: 'static-export', passed: result.passed, ...(result.error ? { error: result.error } : {}) }]
      result.durationMs = Date.now() - start
      results.push(result)
      console.log(`${result.passed ? 'PASS' : 'FAIL'} Vinext static export ${JSON.stringify(result)}`)
      await browser?.close()
      browser = null
    }
  }
} catch (error) { failure = error.stack || String(error); console.error(failure) }
finally {
  await browser?.close()
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  if (build?.exitCode === null) build.kill('SIGTERM')
  clearTimeout(watchdog)
  log.end(); await once(log, 'finish')
  const passed = !failure && results.length === engines.length && results.every(result => result.passed)
  if (!passed) process.exitCode = 1
  await writeFile(output, JSON.stringify({ framework: 'vinext', version: pkg.dependencies.vinext, recordedAt: new Date().toISOString(), node: process.version, evidence, durationMs: Date.now() - started, results, complete: results.length === engines.length, passed, ...(failure ? { error: failure } : {}) }, null, 2) + '\n')
}
