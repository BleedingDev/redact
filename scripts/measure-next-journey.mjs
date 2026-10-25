import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import { chromium } from 'playwright'

const output = resolve(process.env.JOURNEY_RESULTS || 'benchmarks/results/next-journey')
const host = process.env.JOURNEY_URL || 'http://localhost:4310'
const config = await (await fetch(`${host}/config.json`)).json()
const app = resolve('examples/next-journey')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const sourceHash = createHash('sha256')
async function hashSources(directory) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.next')) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await hashSources(path)
    else sourceHash.update(path).update(await readFile(path))
  }
}
await hashSources('examples/next-journey')
const packageJSON = JSON.parse(await readFile(join(app, 'package.json')))
const browser = await chromium.launch({ headless: true })
const report = {
  measuredAt: new Date().toISOString(),
  next: packageJSON.dependencies.next,
  react: packageJSON.dependencies.react,
  browser: browser.version(),
  mode: 'production',
  bundler: 'turbopack',
  sourceHash: sourceHash.digest('hex'),
  method: {
    scope: 'External JavaScript actually requested by each standalone app, including Next router, Flight client, runtime, and app code. Comparison host excluded.',
    gzipBytes: 'Browser Resource Timing encodedBodySize for downloaded JavaScript. Excludes HTTP headers and chunk framing. Cross-checked against decoded response bodies and Playwright transport sizes. Every scenario starts in a fresh browser context with normal caching enabled.',
    bodyTransportBytes: 'Playwright request.sizes().responseBodySize. Local HTTP/1.1 chunk framing makes this slightly larger than encodedBodySize.',
    decodedBytes: 'Downloaded JavaScript after decompression, not a heap-memory measurement.',
    modeledBrotliBytes: 'Each actual JavaScript response recompressed separately with Brotli quality 11. Modeled CDN payload, not compression served by these local Next servers.',
    omissions: 'HTML, inline Flight/bootstrap scripts, navigation Flight responses, CSS, images, and HTTP headers are not included in JavaScript totals. Separate response rows retain their measured sizes.',
    sampleCount: 'Three cold list loads per renderer, one full journey and one cold detail load per renderer.',
    units: 'Bytes in JSON. KB in the report means 1,000 bytes.',
  },
  builds: {},
  samples: [],
}
const selector = name => `[data-journey="${name}"]`
const compression = new Map()
function compressed(bytes) {
  const key = hash(bytes)
  if (!compression.has(key)) compression.set(key, {
    sha256: key,
    modeledGzipBytes: gzipSync(bytes).length,
    modeledBrotliBytes: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
  })
  return compression.get(key)
}
function total(rows) {
  const js = rows.filter(row => row.javascript)
  return {
    requests: js.length,
    ...Object.fromEntries(['gzipBytes', 'bodyTransportBytes', 'decodedBytes', 'modeledGzipBytes', 'modeledBrotliBytes'].map(key => [key, js.reduce((sum, row) => sum + row[key], 0)])),
  }
}
try {
  for (const renderer of ['react', 'redact']) {
    const buildDir = join(app, `.next-${renderer}-${new URL(host).port}`)
    report.builds[renderer] = { buildId: (await readFile(join(buildDir, 'BUILD_ID'), 'utf8')).trim() }
    for (const scenario of ['journey', 'cold-list-repeat-1', 'cold-list-repeat-2', 'cold-detail']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })
      try {
        const page = await context.newPage()
        const rows = [], pending = [], errors = [], stages = []
        let stage = scenario === 'cold-detail' ? 'cold-detail' : 'cold-list'
        const requestStages = new WeakMap()
        page.on('pageerror', error => errors.push(error.message))
        page.on('request', request => requestStages.set(request, stage))
        page.on('requestfailed', request => {
          if (new URL(request.url()).pathname.endsWith('.js')) errors.push(`${request.url()}: ${request.failure()?.errorText}`)
        })
        page.on('requestfinished', request => pending.push((async () => {
          const response = await request.response()
          const headers = await response.allHeaders()
          const sizes = await request.sizes()
          const url = new URL(request.url())
          const javascript = url.pathname.endsWith('.js')
          const body = javascript ? await response.body() : null
          rows.push({
            stage: requestStages.get(request), path: url.pathname + url.search,
            type: request.resourceType(), method: request.method(), status: response.status(),
            encoding: headers['content-encoding'] || 'identity', javascript,
            bodyTransportBytes: sizes.responseBodySize, headerBytes: sizes.responseHeadersSize,
            ...(body ? { decodedBytes: body.length, ...compressed(body) } : {}),
          })
        })().catch(error => errors.push(error.message))))
        async function checkpoint() {
          await page.waitForLoadState('networkidle')
          await Promise.all(pending)
          assert.deepEqual(errors, [], `${renderer}/${scenario}/${stage}`)
          const timings = await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => new URL(entry.name).pathname.endsWith('.js')).map(entry => ({
            path: new URL(entry.name).pathname + new URL(entry.name).search, encodedBodySize: entry.encodedBodySize,
            decodedBodySize: entry.decodedBodySize, transferSize: entry.transferSize,
          })))
          const remaining = [...timings]
          for (const row of rows.filter(row => row.javascript)) {
            const index = remaining.findIndex(entry => entry.path === row.path)
            assert.ok(index >= 0, `Missing Resource Timing entry: ${row.path}`)
            const [timing] = remaining.splice(index, 1)
            assert.equal(row.decodedBytes, timing.decodedBodySize, 'Decoded response and Resource Timing byte totals disagree')
            row.gzipBytes = timing.transferSize > 0 ? timing.encodedBodySize : 0
            assert.ok(row.bodyTransportBytes >= row.gzipBytes, 'Transport bytes cannot be smaller than the compressed payload')
          }
          assert.equal(remaining.length, 0, 'Uncounted JavaScript Resource Timing entries')
          const cumulative = total(rows)
          stages.push({ stage, incremental: total(rows.filter(row => row.stage === stage)), cumulative, resourceTiming: timings })
        }
        await page.goto(config[renderer] + (scenario === 'cold-detail' ? '/tasks/FW-104' : '/'))
        await page.locator('html[data-hydrated="true"]').waitFor()
        assert.equal(await page.evaluate(() => !!globalThis[Symbol.for('@tanstack/redact.ReactSharedInternals')]), renderer === 'redact')
        if (scenario === 'cold-detail') await page.locator(selector('activity-ready')).waitFor()
        await checkpoint()
        if (scenario === 'journey') {
          stage = 'navigate-detail'
          await page.getByLabel('Find a task').fill('checkout')
          await page.locator(selector('FW-104')).click()
          await page.locator(selector('activity-ready')).waitFor()
          await checkpoint()
          stage = 'save-status'
          await page.getByLabel('Task status', { exact: true }).selectOption('In review')
          await page.getByRole('button', { name: 'Update status' }).click()
          await page.waitForFunction(() => document.querySelector('[data-journey="status-result"]')?.textContent === 'Saved' && document.querySelector('[data-journey="status"]')?.textContent === 'In review')
          await checkpoint()
          stage = 'validate-comment'
          await page.getByRole('button', { name: 'Post comment' }).click()
          await page.locator(selector('comment-error')).waitFor()
          await checkpoint()
          stage = 'post-comment'
          await page.getByLabel('Add a comment').fill('Client transfer measurement')
          await page.getByRole('button', { name: 'Post comment' }).click()
          await page.waitForFunction(() => !document.querySelector('.comment[data-pending]') && [...document.querySelectorAll('.comment p')].some(node => node.textContent === 'Client transfer measurement'))
          await checkpoint()
          stage = 'return-list'
          await page.locator(selector('back')).click()
          await page.locator(selector('FW-104')).waitFor()
          assert.equal(await page.locator(selector('FW-104') + ' .status-pill').textContent(), 'In review')
          await checkpoint()
        }
        report.samples.push({ renderer, scenario, stages, responses: rows })
        console.log(JSON.stringify({ renderer, scenario, stages: stages.map(({ stage, incremental, cumulative }) => ({ stage, incremental, cumulative })) }))
      } finally { await context.close() }
    }
  }
  for (const renderer of ['react', 'redact']) {
    const cold = report.samples.filter(sample => sample.renderer === renderer && sample.scenario !== 'cold-detail').map(sample => sample.stages[0].cumulative)
    assert.deepEqual(cold[0], cold[1], 'Cold-list byte counts changed between runs')
    assert.deepEqual(cold[0], cold[2], 'Cold-list byte counts changed between runs')
  }
  assert.ok(report.samples.every(sample => sample.responses.filter(row => row.javascript).every(row => row.status === 200 && row.encoding === 'gzip')), 'Unexpected JavaScript response or compression')
  await mkdir(output, { recursive: true })
  await writeFile(join(output, 'client-sizes.json'), JSON.stringify(report, null, 2) + '\n')
  const sample = (renderer, scenario) => report.samples.find(row => row.renderer === renderer && row.scenario === scenario)
  const first = renderer => sample(renderer, 'journey').stages[0].cumulative
  const last = renderer => sample(renderer, 'journey').stages.at(-1).cumulative
  const kb = value => (value / 1000).toFixed(1)
  const row = (label, react, redact, key) => `| ${label} | ${kb(react[key])} | ${kb(redact[key])} | ${kb(react[key] - redact[key])} (${((1 - redact[key] / react[key]) * 100).toFixed(1)}%) |`
  await writeFile(join(output, 'client-sizes.md'), [
    '# Next.js client downloads', '',
    `Same application source, Next.js ${report.next}, production Turbopack, Chromium ${report.browser}. Measured ${report.measuredAt}. KB means 1,000 bytes.`, '',
    '| JavaScript payload | React, KB | Redact, KB | Saved |',
    '| --- | ---: | ---: | ---: |',
    row('Cold task list, served gzip', first('react'), first('redact'), 'gzipBytes'),
    row('Cold task detail, served gzip', sample('react', 'cold-detail').stages[0].cumulative, sample('redact', 'cold-detail').stages[0].cumulative, 'gzipBytes'),
    row('Full journey, served gzip', last('react'), last('redact'), 'gzipBytes'),
    row('Cold task list, modeled Brotli quality 11', first('react'), first('redact'), 'modeledBrotliBytes'),
    row('Cold task list, after decompression', first('react'), first('redact'), 'decodedBytes'), '',
    'Each scenario starts with a fresh browser context. All three cold task-list samples matched exactly for each renderer. Both browser runtime identities and successful application interactions were checked.', '',
    'These totals include the JavaScript the browser actually requests for Next routing, the Flight client, the selected renderer, and the application. They exclude the comparison host, unused output files, HTML and inline scripts, streamed Flight data, CSS, images, HTTP headers, and HTTP chunk framing. Brotli is a separate per-file recompression estimate; the local production servers actually served gzip.', '',
    'The full journey opens the detail route, saves a status, submits an invalid comment, posts a valid comment, and returns to the list. Opening the detail route adds 2,008 gzip bytes with React and 1,989 with Redact. The remaining steps request no additional JavaScript. Flight and action responses still transfer data. Cached runtime chunks do not save another 39 KB on every navigation.', '',
    'These are measurements of this example and its current compatibility limits, not a guarantee for every Next.js application or proof of equivalent concurrent behavior. Decoded code size is not memory use or a measured speedup.', '',
    'Run the production comparison with `pnpm example:next:journey`, then run `node scripts/measure-next-journey.mjs`. Set `PLAYWRIGHT_BROWSERS_PATH` if the browser binaries are outside the default installation location. `JOURNEY_URL` can select another comparison port.', '',
    '[Raw response sizes, hashes, build IDs, and browser Resource Timing cross-checks](./client-sizes.json).', '',
  ].join('\n'))
} finally { await browser.close() }
