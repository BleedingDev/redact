// @vitest-environment node
import { expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

async function fixture(version = '1.65.0') {
  const root = await mkdtemp(join(tmpdir(), 'redact-cloudflare-resolution-'))
  async function file(path: string, contents: string) {
    await mkdir(join(root, path, '..'), { recursive: true })
    await writeFile(join(root, path), contents)
  }
  await file('package.json', '{"type":"module"}')
  await file('owned/src/cloudflare/index.ts', await readFile(new URL('../packages/redact/src/cloudflare/index.ts', import.meta.url), 'utf8'))
  await file('node_modules/@cloudflare/vite-plugin/package.json', JSON.stringify({ name: '@cloudflare/vite-plugin', version, type: 'module', exports: { '.': { import: './dist/index.mjs' } } }))
  await file('node_modules/@cloudflare/vite-plugin/dist/index.mjs', 'throw new Error("The original implementation must not be loaded")')
  for (const [prefix, value] of [['node_modules', 'application'], ['node_modules/@cloudflare/vite-plugin/node_modules', 'peer']]) {
    await file(`${prefix}/resolver-contract/package.json`, '{"type":"module","exports":"./index.js"}')
    await file(`${prefix}/resolver-contract/index.js`, `export default ${JSON.stringify(value)}`)
  }
  await file('owned/vendor/cloudflare-vite-plugin/dist/local.mjs', 'export default "local"')
  await file('owned/vendor/cloudflare-vite-plugin/dist/index.mjs', `import dependency from 'resolver-contract'; import local from './local.mjs'; export function cloudflare(options) { return [{ name: dependency + '-' + local, options }] }`)
  return root
}

it('uses the peer dependency graph only for owned modules and retains plugin options', async () => {
  const root = await fixture()
  try {
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { cloudflare } from './owned/src/cloudflare/index.ts';
      import before from 'resolver-contract';
      const options = { inspectorPort: false, config: () => ({ name: 'app' }) };
      const [first, second] = await Promise.all([cloudflare(options), cloudflare(options)]);
      assert.equal(first[0].options, options);
      assert.equal(second[0].options, options);
      assert.equal(first[0].name, 'peer-local');
      assert.equal(before, 'application');
      assert.equal((await import('resolver-contract')).default, 'application');
      console.log('isolated');
    `], { cwd: root, encoding: 'utf8' })
    expect(output.trim()).toBe('isolated')
  } finally { await rm(root, { recursive: true, force: true }) }
})

it('rejects unverified Cloudflare peer versions before loading the implementation', async () => {
  const root = await fixture('1.66.0')
  try {
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { cloudflare } from './owned/src/cloudflare/index.ts';
      await assert.rejects(cloudflare(), /supports @cloudflare\\/vite-plugin 1\\.65\\.0; found 1\\.66\\.0/);
      console.log('rejected');
    `], { cwd: root, encoding: 'utf8' })
    expect(output.trim()).toBe('rejected')
  } finally { await rm(root, { recursive: true, force: true }) }
})
