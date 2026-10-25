import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

async function hashFiles(paths) {
  const hash = createHash('sha256')
  async function visit(path, key) {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = `${key}/${entry.name}`
      if (entry.isDirectory()) await visit(join(path, entry.name), name)
      else if (entry.isFile()) hash.update(name).update(await readFile(join(path, entry.name)))
    }
  }
  for (const [key, path, directory] of paths) {
    if (!existsSync(path)) continue
    if (directory) await visit(path, key)
    else hash.update(key).update(await readFile(path))
  }
  return hash.digest('hex')
}

export async function vinextInstallation(consumer) {
  if (!consumer) return 'workspace'
  const evidence = JSON.parse(await readFile(join(consumer, 'package-evidence.json'), 'utf8'))
  if (evidence.patches !== false) return 'modified-consumer'
  assert.match(evidence.tarball, /^redact-[a-f0-9]{16}\.tgz$/, 'Missing packed consumer artifact')
  const hash = createHash('sha256').update(await readFile(join(consumer, evidence.tarball))).digest('hex')
  assert.equal(hash, evidence.sha256, 'The consumer tarball changed after installation')
  return 'npm-tarball'
}

export async function vinextPackageEvidence(packageRoot) {
  return {
    sourceSha256: await hashFiles([['src', join(packageRoot, 'src'), true], ['vendor', join(packageRoot, 'vendor'), true]]),
    buildSha256: await hashFiles([['dist', join(packageRoot, 'dist'), true], ['vendor', join(packageRoot, 'vendor'), true]]),
  }
}

export async function vinextEvidence(fixture, packageRoot = process.env.VINEXT_TEST_PACKAGE || fileURLToPath(new URL('../packages/redact/', import.meta.url))) {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const consumer = process.env.VINEXT_TEST_CONSUMER
  const installation = consumer || join(root, 'examples/vinext-demo')
  const dependencyFiles = consumer ? [['npm-lockfile', join(consumer, 'package-lock.json')], ['tarball', join(consumer, 'package-evidence.json')]] : [['framework-patches', join(root, 'patches'), true], ['lockfile', join(root, 'pnpm-lock.yaml')]]
  const scripts = ['test-cloudflare', 'browser-reload', 'prepare-vinext-consumer', 'test-vinext-consumer', 'test-vinext', 'test-vinext-static', 'prepare-vinext-fixture', 'vinext-test-gate', 'vinext-results', 'vinext-edge-checks', 'vinext-static-checks', 'vinext-browser-errors', 'next-browser-checks', 'next-extended-checks', 'next-browser-errors']
  return {
    suiteSha256: await hashFiles([
      ...scripts.map(name => [name, join(root, 'scripts', `${name}.mjs`)]),
      ...dependencyFiles,
    ]),
    installation: await vinextInstallation(consumer),
    ...await vinextPackageEvidence(packageRoot),
    fixtureSha256: await hashFiles([
      ...['app', 'pages', 'public'].map(name => [name, join(fixture, name), true]),
      ...['next.config.mjs', 'jsconfig.json', 'wrangler.jsonc', 'hosted-cache.mjs'].map(name => [name, join(fixture, name)]),
      ['fixture-vite.config.mjs', join(fixture, 'vite.config.mjs')],
      ...['package.json', 'vite.config.mjs'].map(name => [name, join(installation, name)]),
      ...dependencyFiles,
    ]),
  }
}
