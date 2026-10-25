import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'

export async function writeNextResults({ cwd, version, results, engines }) {
  if (!process.env.NEXT_TEST_RESULT) return
  const output = resolve(process.env.NEXT_TEST_RESULT)
  const pkg = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8'))
  const packagePath = pkg.dependencies['@tanstack/redact']
  const hash = createHash('sha256')
  for (const name of ['browser-reload.mjs', 'test-next.mjs', 'test-next-static.mjs', 'next-browser-checks.mjs', 'next-extended-checks.mjs', 'next-browser-errors.mjs', 'next-results.mjs', 'next-versions.mjs', 'prepare-next-fixture.mjs', 'test-next-matrix.mjs', 'test-next-deployments.mjs', 'test-next-coverage.mjs', 'report-next-coverage.mjs']) {
    hash.update(name).update(await readFile(new URL(name, import.meta.url)))
  }
  const fixtureHash = createHash('sha256')
  async function hashTree(directory, prefix = '') {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (['node_modules', '.next', 'out', 'AGENTS.md', 'CLAUDE.md'].includes(entry.name) || entry.name.endsWith('.tgz')) continue
      const name = prefix + entry.name
      if (entry.isDirectory()) await hashTree(join(directory, entry.name), name + '/')
      else if (entry.isFile()) fixtureHash.update(name).update(await readFile(join(directory, entry.name)))
    }
  }
  await hashTree(cwd)
  const evidence = {
    recordedAt: new Date().toISOString(), node: process.version, platform: process.platform,
    playwright: createRequire(import.meta.url)('playwright/package.json').version,
    packageSha256: packagePath.startsWith('file:') ? createHash('sha256').update(await readFile(resolve(cwd, packagePath.slice(5)))).digest('hex') : null,
    suiteSha256: hash.digest('hex'),
    fixtureSha256: fixtureHash.digest('hex'),
  }
  const complete = results.length === engines.length && !process.env.NEXT_TEST_SCENARIOS
  await mkdir(resolve(output, '..'), { recursive: true })
  await writeFile(output, JSON.stringify({ version, evidence, results, complete, passed: results.length === engines.length && results.every(result => result.passed) }, null, 2) + '\n')
}
