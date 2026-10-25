import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'
import { prepareVinextFixture, vinextExample } from './prepare-vinext-fixture.mjs'

// Probe both renderers with the installed, versioned framework fixes. No
// fixture-level dependency exclusions are needed for the Worker RSC runner.
const require = createRequire(join(vinextExample, 'package.json'))
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href)
const output = resolve(process.env.VINEXT_DIAGNOSIS_RESULT || 'benchmarks/results/vinext/diagnostics/workers-prebundle.json')
process.chdir(vinextExample)
process.env.VINEXT_TEST_REFERENCE = '1'
process.env.VINEXT_TEST_WORKERS = '1'
const results = []
for (const reference of [true, false]) {
  process.env.VINEXT_TEST_REFERENCE = reference ? '1' : ''
  const directory = join(vinextExample, '.fixtures', `diagnose-workers-${reference ? 'react' : 'redact'}`)
  process.env.VINEXT_TEST_DIR = await prepareVinextFixture({ directory })
  const server = await createServer({
    configFile: join(vinextExample, 'vite.config.mjs'),
    server: { host: 'localhost', port: reference ? 4850 : 4851, strictPort: true },
  })
  try {
    await server.listen()
    const response = await fetch(server.resolvedUrls.local[0], { signal: AbortSignal.timeout(60_000) })
    const body = await response.text()
    results.push({ renderer: reference ? 'react' : 'redact', status: response.status, containsCounter: body.includes('Increment on server') })
  } finally { await server.close() }
}
await mkdir(resolve(output, '..'), { recursive: true })
await writeFile(output, JSON.stringify({ framework: 'vinext', version: '1.3.0', node: process.version, results }, null, 2) + '\n')
console.log(JSON.stringify(results))
for (const result of results) {
  assert.equal(result.status, 200)
  assert.equal(result.containsCounter, true)
}
