// @vitest-environment node
import { expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { redact } from '../packages/redact/src/vinext'

const root = fileURLToPath(new URL('../examples/vinext-demo/', import.meta.url))
const require = createRequire(new URL('../examples/vinext-demo/package.json', import.meta.url))
async function configured(app = true) {
  const plugin = redact({ renderer: 'react' })
  await plugin.config.handler({ root, environments: app ? { rsc: {}, client: {} } : { ssr: {}, client: {} } })
  return plugin
}

it('keeps CommonJS Next shim imports in the shared ESM graph', async () => {
  const plugin = await configured()
  const config: any = { consumer: 'server', optimizeDeps: {} }
  plugin.configEnvironment.handler('worker', config)
  const { rolldown } = await import(pathToFileURL(createRequire(require.resolve('vite')).resolve('rolldown')).href)
  for (const specifier of ['next/navigation', 'next/navigation.js', 'next/error', 'next/headers', 'next/dist/client/components/navigation']) {
    const bundle = await rolldown({
      input: 'redact-test.cjs',
      plugins: [...config.optimizeDeps.rolldownOptions.plugins, {
        name: 'fixture',
        resolveId(id: string) {
          if (id === 'redact-test.cjs') return id
          throw new Error(`The shim escaped its ESM adapter: ${id}`)
        },
        load(id: string) { if (id === 'redact-test.cjs') return `module.exports = require(${JSON.stringify(specifier)});` },
      }],
    })
    try {
      const { output } = await bundle.generate({ format: 'esm' })
      expect(output[0].imports).toContain(specifier)
      expect(output[0].code).not.toContain('require("' + specifier + '")')
    } finally { await bundle.close() }
  }
})

it('retains required shim dependencies when an explicit include activates a noDiscovery optimizer', async () => {
  const plugin = await configured()
  const config: any = { consumer: 'client', optimizeDeps: { noDiscovery: true, include: ['next/image', 'library > next/navigation.js'], exclude: ['web-vitals'] } }
  plugin.configEnvironment.handler('client', config)
  expect(config.optimizeDeps.include).toEqual(['vinext > @unpic/react', 'vinext > ipaddr.js'])
  expect(config.optimizeDeps.exclude).toContain('next/navigation.js')
})

it('preserves Pages-only client prebundling and unrelated optimizer plugins', async () => {
  const plugin = await configured(false)
  const alias = { name: 'vinext:dep-optimize-alias' }, custom = { name: 'user-plugin' }
  const config: any = { consumer: 'client', optimizeDeps: { include: ['next/router', 'other'], rolldownOptions: { plugins: [alias, custom] } } }
  plugin.configEnvironment.handler('client', config)
  expect(config.optimizeDeps.include).toEqual(['next/router', 'other'])
  expect(config.optimizeDeps.rolldownOptions.plugins).toEqual(expect.arrayContaining([alias, custom]))
})

it('removes conflicting shim includes after all framework configuration hooks run', async () => {
  const plugin = await configured()
  const config: any = { consumer: 'client', optimizeDeps: { include: ['next/*', 'library > next/navigation.js', 'react'], rolldownOptions: { plugins: [{ name: 'vinext:dep-optimize-alias' }, { name: 'user-plugin' }] } } }
  plugin.configResolved.handler({ environments: { browser: config } })
  expect(config.optimizeDeps.include).toContain('react')
  expect(config.optimizeDeps.include).not.toContain('next/*')
  expect(config.optimizeDeps.include).not.toContain('library > next/navigation.js')
  expect(config.optimizeDeps.rolldownOptions.plugins.map((item: any) => item.name)).toEqual(['user-plugin', 'redact:vinext-modules'])
})
