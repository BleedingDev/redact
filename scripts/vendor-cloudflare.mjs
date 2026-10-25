import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const vendor = fileURLToPath(new URL('../packages/redact/vendor/cloudflare-vite-plugin/', import.meta.url))
const manifestPath = join(vendor, 'provenance.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const digest = (value, algorithm = 'sha256') => createHash(algorithm).update(value).digest(algorithm === 'sha512' ? 'base64' : 'hex')
async function files(directory, prefix = '') {
  const result = []
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = prefix + entry.name
    if (entry.isDirectory()) result.push(...await files(join(directory, entry.name), name + '/'))
    else if (entry.isFile() && !['README.md', 'provenance.json'].includes(name)) result.push(name)
  }
  return result
}

if (process.argv.includes('--refresh')) {
  const response = await fetch(manifest.source)
  assert.equal(response.status, 200, 'Could not download the pinned Cloudflare distribution')
  const tarball = Buffer.from(await response.arrayBuffer())
  assert.equal('sha512-' + digest(tarball, 'sha512'), manifest.integrity, 'Cloudflare registry integrity changed')
  const temporary = await mkdtemp(join(tmpdir(), 'redact-cloudflare-vendor-'))
  try {
    const archive = join(temporary, 'source.tgz')
    await writeFile(archive, tarball)
    execFileSync('tar', ['-xzf', archive, '-C', temporary])
    const source = join(temporary, 'package')
    const runnerPath = join(source, 'dist/workers/runner-worker/index.js')
    const runner = await readFile(runnerPath, 'utf8')
    assert.equal(digest(runner), manifest.originalRunnerSha256, 'The development runner changed')
    const signature = 'async function createModuleRunner(env, webSocket, environmentName) {'
    assert.equal(runner.split(signature).length, 2, 'Expected one development runner initializer')
    await writeFile(runnerPath, runner.replace(signature, signature + '\n\tglobalThis.eval = (input) => typeof input === "string" ? env.__VITE_UNSAFE_EVAL__.eval(input, "eval") : input;'))
    await rm(join(vendor, 'dist'), { recursive: true, force: true })
    for (const name of ['dist', 'package.json']) await cp(join(source, name), join(vendor, name), { recursive: true })
  } finally { await rm(temporary, { recursive: true, force: true }) }
  manifest.files = Object.fromEntries(await Promise.all((await files(vendor)).map(async name => [name, digest(await readFile(join(vendor, name)))])))
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
}

assert.deepEqual((await files(vendor)).sort(), Object.keys(manifest.files).sort(), 'The owned Cloudflare distribution has unexpected or missing files')
for (const [name, sha256] of Object.entries(manifest.files)) {
  assert.equal(digest(await readFile(join(vendor, name))), sha256, `Owned Cloudflare file changed: ${name}`)
}
console.log(`Verified ${manifest.name}@${manifest.version}, ${Object.keys(manifest.files).length} owned files.`)
