import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { join, resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { prepareVinextConsumer } from './prepare-vinext-consumer.mjs'
import { collectVinextCoverage } from './report-vinext-coverage.mjs'
import { collectVinextPagesCoverage } from './report-vinext-pages-coverage.mjs'

const consumer = await prepareVinextConsumer(process.env.VINEXT_TEST_CONSUMER)
const output = resolve(process.env.VINEXT_TEST_RESULTS || 'benchmarks/results/vinext')
const pagesOutput = resolve(process.env.VINEXT_TEST_PAGES_RESULTS || output + '-pages')
const prerequisites = {}
for (const script of ['test-framework-dependencies.mjs', 'test-cloudflare.mjs', 'test-vinext-coverage.mjs', 'test-vinext-pages.mjs']) {
  const child = spawn(process.execPath, [fileURLToPath(new URL(script, import.meta.url)), ...(['test-framework-dependencies.mjs', 'test-cloudflare.mjs'].includes(script) ? [consumer] : [])], {
    stdio: 'inherit',
    env: { ...process.env, VINEXT_TEST_CONSUMER: consumer, VINEXT_TEST_PACKAGE: join(consumer, 'node_modules/@tanstack/redact'), VINEXT_TEST_RESULTS: output, VINEXT_TEST_PAGES_RESULTS: pagesOutput },
  })
  const [code, signal] = await once(child, 'exit')
  if (['test-framework-dependencies.mjs', 'test-cloudflare.mjs'].includes(script)) prerequisites[script] = code === 0 && !signal
  if (code !== 0 || signal) process.exitCode = 1
}
const mixed = await collectVinextCoverage(output), pages = await collectVinextPagesCoverage(pagesOutput)
const samePackage = mixed.fingerprints.source.length === 1 && mixed.fingerprints.build.length === 1 &&
  mixed.fingerprints.source[0] === pages.fingerprints.sourceSha256[0] && mixed.fingerprints.build[0] === pages.fingerprints.buildSha256[0]
const report = { recordedAt: new Date().toISOString(), prerequisites, passed: Object.values(prerequisites).every(Boolean) && mixed.passed && pages.passed && samePackage, complete: mixed.complete && pages.complete && samePackage, samePackage, mixed: mixed.summary, pages: pages.summary }
await writeFile(join(output, 'release.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report))
if (!report.passed) process.exitCode = 1
