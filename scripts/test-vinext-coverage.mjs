import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createWriteStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { vinextMatrix } from './vinext-matrix.mjs'
import { collectVinextCoverage, formatVinextCoverage } from './report-vinext-coverage.mjs'
import { prepareVinextPackage } from './prepare-vinext-fixture.mjs'

const output = resolve(process.env.VINEXT_TEST_RESULTS || 'benchmarks/results/vinext')
await mkdir(output, { recursive: true })
const jobs = vinextMatrix(process.env.VINEXT_TEST_DEPLOYMENTS?.split(',')).filter(job => !process.env.VINEXT_TEST_MODES || process.env.VINEXT_TEST_MODES.split(',').includes(job.mode))
const concurrency = Number(process.env.VINEXT_TEST_CONCURRENCY || 3)
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error('VINEXT_TEST_CONCURRENCY must be between 1 and 8')
const packageRoot = await prepareVinextPackage()
let next = 0
await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, async (_, slot) => {
  while (next < jobs.length) {
    const job = jobs[next++]
    const script = job.deployment === 'static-export' ? 'test-vinext-static.mjs' : 'test-vinext.mjs'
    const args = [fileURLToPath(new URL(script, import.meta.url)), ...(job.mode === 'production' && job.deployment !== 'static-export' ? ['--production'] : []), ...(job.deployment === 'standalone' ? ['--standalone'] : [])]
    const log = createWriteStream(join(output, `${job.name}.runner.log`))
    console.log(`START ${job.name}`)
    const child = spawn(process.execPath, args, {
      env: { ...process.env, VINEXT_TEST_PACKAGE: packageRoot, VINEXT_TEST_REFERENCE: job.reference ? '1' : '', VINEXT_TEST_WORKERS: job.deployment === 'workers' ? '1' : '', VINEXT_TEST_CACHE_COMPONENTS: job.rendering === 'cache-components' ? '1' : '', VINEXT_TEST_BASE_PATH: job.basePath, VINEXT_TEST_RESULT: join(output, `${job.name}.json`), VINEXT_TEST_PORT: String(Number(process.env.VINEXT_TEST_PORT || 4600) + slot) },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    for (const stream of [child.stdout, child.stderr]) stream.on('data', data => log.write(data))
    const [code, signal] = await once(child, 'exit')
    log.end(); await once(log, 'finish')
    console.log(`${code === 0 && !signal ? 'PASS' : 'FAIL'} ${job.name}`)
    if (code !== 0 || signal) process.exitCode = 1
  }
}))

// Diagnostic subsets keep their individual artifacts. The ordinary gate also
// requires every browser and scenario, even when an inherited filter ran less.
if (!process.env.VINEXT_TEST_DEPLOYMENTS && !process.env.VINEXT_TEST_MODES) {
  const report = await collectVinextCoverage(output)
  await writeFile(join(output, 'coverage.json'), JSON.stringify(report, null, 2) + '\n')
  await writeFile(join(output, 'coverage.md'), formatVinextCoverage(report))
  console.log(JSON.stringify(report.summary))
  if (!report.passed) process.exitCode = 1
}
