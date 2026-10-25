import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { vinextPackageEvidence } from './vinext-results.mjs'

export const vinextExample = process.env.VINEXT_TEST_CONSUMER || fileURLToPath(new URL('../examples/vinext-demo/', import.meta.url))
export async function prepareVinextPackage(source = process.env.VINEXT_TEST_PACKAGE || fileURLToPath(new URL('../packages/redact/', import.meta.url)), parent = resolve(vinextExample, '.fixtures')) {
  assert.ok(existsSync(resolve(source, 'dist/vinext/index.js')), 'Build Redact before preparing Vinext checks')
  const before = await vinextPackageEvidence(source)
  await mkdir(parent, { recursive: true })
  const directory = await mkdtemp(resolve(parent, 'runtime-'))
  try {
    for (const name of ['package.json', 'src', 'dist']) await cp(resolve(source, name), resolve(directory, name), { recursive: true })
    assert.deepEqual(await vinextPackageEvidence(directory), before, 'The runtime changed while its snapshot was copied')
    assert.deepEqual(await vinextPackageEvidence(source), before, 'The runtime changed while its snapshot was copied')
    return directory
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error }
}

export async function prepareVinextFixture({ example = 'next-demo', directory = resolve(vinextExample, '.fixture'), gateOrigin } = {}) {
  const fixture = resolve(directory)
  await mkdir(fixture, { recursive: true })
  await cp(resolve(vinextExample, 'package.json'), resolve(fixture, 'package.json'))
  for (const name of ['app', 'pages', 'public']) {
    await rm(resolve(fixture, name), { recursive: true, force: true })
    const source = fileURLToPath(new URL(`../examples/${example}/${name}`, import.meta.url))
    if (existsSync(source)) await cp(source, resolve(fixture, name), { recursive: true })
  }
  const jsconfig = fileURLToPath(new URL(`../examples/${example}/jsconfig.json`, import.meta.url))
  if (existsSync(jsconfig)) await cp(jsconfig, resolve(fixture, 'jsconfig.json'))
  await cp(resolve(vinextExample, 'next.config.mjs'), resolve(fixture, 'next.config.mjs'))
  await rm(resolve(fixture, 'wrangler.jsonc'), { force: true })
  if (process.env.VINEXT_TEST_WORKERS) await cp(resolve(vinextExample, 'wrangler.jsonc'), resolve(fixture, 'wrangler.jsonc'))
  if (example === 'next-demo') await cp(resolve(vinextExample, 'fixtures/app'), resolve(fixture, 'app'), { recursive: true })
  if (example === 'next-demo' && gateOrigin) {
    // Use the same external data dependency in Node and Workers. Workers cannot
    // wait on promises that another request resolves from global isolate state.
    await writeFile(resolve(fixture, 'app/slow/gate.js'), `const origin = ${JSON.stringify(gateOrigin)}
export async function waitForRelease() { const response = await fetch(origin + '/wait', { cache: 'no-store' }); if (!response.ok) throw new Error('Slow data source failed'); await response.text() }
export async function pendingCount() { return (await (await fetch(origin, { cache: 'no-store' })).json()).pending }
export async function release() { return (await (await fetch(origin, { method: 'POST' })).json()).released }
`)
    await writeFile(resolve(fixture, 'app/api/release-slow/route.js'), `import { pendingCount, release } from '../../slow/gate'
import { connection } from 'next/server'
export async function GET() { await connection(); return Response.json({ pending: await pendingCount() }) }
export async function POST() { return Response.json({ released: await release() }) }
`)
  }
  return fixture
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(await prepareVinextFixture())
